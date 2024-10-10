import * as factories from '@latitude-data/core/factories'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DocumentLog } from '../../../browser'
import {
  ErrorableEntity,
  LogSources,
  Providers,
  RunErrorCodes,
} from '../../../constants'
import { publisher } from '../../../events/publisher'
import * as jobsModule from '../../../jobs'
import { generateUUIDIdentifier } from '../../../lib'
import * as createProviderLogService from '../../providerLogs/create'
import { ChainError } from '../ChainErrors'
import { StreamConsumeReturn } from '../ChainStreamConsumer/consumeStream'
import { LogData, saveOrPublishProviderLogs } from './saveOrPublishProviderLogs'

const publisherSpy = vi.spyOn(publisher, 'publishLater')
const createProviderLogSpy = vi.spyOn(
  createProviderLogService,
  'createProviderLog',
)

const mocks = vi.hoisted(() => ({
  queues: {
    defaultQueue: {
      jobs: {
        enqueueCreateProviderLogJob: vi.fn(),
      },
    },
  },
}))
const setupJobsSpy = vi.spyOn(jobsModule, 'setupJobs')
// @ts-expect-error - mock implementation
setupJobsSpy.mockResolvedValue(mocks.queues)

let streamConsumedResult: StreamConsumeReturn = {
  finishReason: 'stop',
  error: undefined,
}
let errorable: DocumentLog
let data: LogData<'text'>
describe('saveOrPublishProviderLogs', () => {
  beforeEach(async () => {
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
    errorable = documentLog
    data = {
      workspaceId: setup.workspace.id,
      uuid: generateUUIDIdentifier(),
      source: LogSources.API,
      providerId: setup.providers[0]!.id,
      providerType: setup.providers[0]!.provider,
      documentLogUuid: documentLog.uuid,
      duration: 1000,
      generatedAt: new Date(),
      model: 'gpt-4o',
      config: { model: 'gpt-4o' },
      usage: { promptTokens: 3, completionTokens: 7, totalTokens: 10 },
      messages: [],
      toolCalls: [],
      responseText: 'MY TEXT',
    }
  })

  it('publishes event', async () => {
    await saveOrPublishProviderLogs({
      data,
      streamType: 'text',
      saveSyncProviderLogs: true,
      streamConsumedResult,
      errorableUuid: errorable.uuid,
      errorableType: ErrorableEntity.DocumentLog,
    })

    expect(publisherSpy).toHaveBeenCalledWith({
      type: 'aiProviderCallCompleted',
      data: { ...data, streamType: 'text' },
    })
  })

  it('calls createProviderLog', async () => {
    await saveOrPublishProviderLogs({
      data,
      streamType: 'text',
      saveSyncProviderLogs: true,
      streamConsumedResult,
      errorableUuid: errorable.uuid,
      errorableType: ErrorableEntity.DocumentLog,
    })

    expect(createProviderLogSpy).toHaveBeenCalledWith({
      ...data,
      finishReason: 'stop',
    })
  })

  it('calls createProviderLog with error', async () => {
    streamConsumedResult = {
      finishReason: 'error',
      error: new ChainError({
        code: RunErrorCodes.AIRunError,
        message: 'Some AI error',
      }),
    }
    await saveOrPublishProviderLogs({
      data,
      streamType: 'text',
      saveSyncProviderLogs: true,
      streamConsumedResult,
      errorableUuid: errorable.uuid,
      errorableType: ErrorableEntity.DocumentLog,
    })

    expect(createProviderLogSpy).toHaveBeenCalledWith({
      ...data,
      finishReason: 'error',
      providerError: {
        errorableType: ErrorableEntity.DocumentLog,
        errorableUuid: errorable.uuid,
        errorCode: RunErrorCodes.AIRunError,
        message: 'Some AI error',
      },
    })
  })

  it('enqueues providerLog creation', async () => {
    await saveOrPublishProviderLogs({
      data,
      streamType: 'text',
      saveSyncProviderLogs: false,
      streamConsumedResult,
      errorableUuid: errorable.uuid,
      errorableType: ErrorableEntity.DocumentLog,
    })

    expect(
      mocks.queues.defaultQueue.jobs.enqueueCreateProviderLogJob,
    ).toHaveBeenCalledWith({
      ...data,
      finishReason: 'error',
      providerError: {
        errorCode: 'ai_run_error',
        errorableType: 'document_log',
        errorableUuid: errorable.uuid,
        message: 'Some AI error',
      },
    })
  })
})
