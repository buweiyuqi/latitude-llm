import * as factories from '@latitude-data/core/factories'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { ProviderApiKey, Workspace } from '../../browser'
import { database } from '../../client'
import {
  ErrorableEntity,
  LogSources,
  Providers,
  RunErrorCodes,
} from '../../constants'
import { generateUUIDIdentifier } from '../../lib'
import { apiKeys, runErrors } from '../../schema'
import { createProviderLog, type CreateProviderLogProps } from './create'

let workspace: Workspace
let provider: ProviderApiKey
let providerProps: CreateProviderLogProps
let apiKeyId: number | undefined = undefined
let documentLogUuid: string | undefined

describe('create provider', () => {
  beforeEach(async () => {
    const { workspace: wp, userData } = await factories.createWorkspace()
    workspace = wp
    provider = await factories.createProviderApiKey({
      workspace,
      type: Providers.OpenAI,
      name: 'openai',
      user: userData,
    })
    providerProps = {
      uuid: generateUUIDIdentifier(),
      generatedAt: new Date(),
      providerId: provider.id,
      providerType: provider.provider,
      source: LogSources.API,
      model: 'gpt-4o',
      config: { model: 'gpt-4o' },
      apiKeyId,
      usage: { promptTokens: 3, completionTokens: 7, totalTokens: 10 },
      responseText: 'This is the response',
      messages: [],
      toolCalls: [],
      duration: 1000,
      documentLogUuid,
    }
  })

  it('creates provider log', async () => {
    const providerLog = await createProviderLog(providerProps).then((r) =>
      r.unwrap(),
    )
    expect(providerLog).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        costInMillicents: 12,
        tokens: 10,
        finishReason: 'stop',
        messages: [],
        toolCalls: [],
        model: 'gpt-4o',
        config: { model: 'gpt-4o' },
        responseObject: null,
        responseText: 'This is the response',
        source: 'api',
        documentLogUuid: null,
      }),
    )
  })

  it('touch latitude API key', async () => {
    const { apiKey } = await factories.createApiKey({
      name: 'MylatitudeAPIkey',
      workspace,
    })
    const providerLog = await createProviderLog({
      ...providerProps,
      apiKeyId: apiKey.id,
    }).then((r) => r.unwrap())

    const touchedApiKey = await database.query.apiKeys.findFirst({
      where: eq(apiKeys.id, apiKey.id),
    })
    expect(providerLog.apiKeyId).toEqual(apiKey.id)
    expect(touchedApiKey!.lastUsedAt).not.toBeNull()
  })

  it('assign costInMillicents', async () => {
    const providerLog = await createProviderLog({
      ...providerProps,
      costInMillicents: 100,
    }).then((r) => r.unwrap())
    expect(providerLog.costInMillicents).toEqual(100)
  })

  it('creates and assigns error', async () => {
    const prompt = factories.helpers.createPrompt({
      provider: 'openai',
      model: 'gpt-4o',
    })
    const setup = await factories.createProject({
      providers: [{ type: Providers.OpenAI, name: 'openai' }],
      name: 'Default Project',
      documents: {
        foo: {
          content: prompt,
        },
      },
    })
    const { commit } = await factories.createDraft({
      project: setup.project,
      user: setup.user,
    })
    const { documentLog } = await factories.createDocumentLog({
      document: setup.documents[0]!,
      commit,
    })
    const providerLog = await createProviderLog({
      ...providerProps,
      providerId: setup.providers[0]!.id,
      providerType: setup.providers[0]!.provider,
      documentLogUuid: documentLog.uuid,
      providerError: {
        errorableUuid: documentLog.uuid,
        errorableType: ErrorableEntity.DocumentLog,
        errorCode: RunErrorCodes.AIRunError,
        message: 'Something wrong happened in Can Altman',
      },
    }).then((r) => r.unwrap())
    const error = await database.query.runErrors.findFirst({
      where: eq(runErrors.id, providerLog.errorId!),
    })
    expect(providerLog).toEqual(
      expect.objectContaining({
        errorId: expect.any(Number),
        providerId: setup.providers[0]!.id,
        documentLogUuid: documentLog.uuid,
      }),
    )
    expect(error).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        errorableType: ErrorableEntity.DocumentLog,
        errorableUuid: documentLog.uuid,
        code: RunErrorCodes.AIRunError,
        message: 'Something wrong happened in Can Altman',
      }),
    )
  })
})
