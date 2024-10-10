import { Message, MessageRole } from '@latitude-data/compiler'
import { describe, expect, it, vi } from 'vitest'

import { ProviderApiKey, Providers, RunErrorCodes } from '../../browser'
import { ChainError } from '../chains/ChainErrors'

describe('ai function', () => {
  it('should throw an error if Google provider is used without a user message', async () => {
    // @ts-expect-error
    const provider: ProviderApiKey = {
      provider: Providers.Google,
      token: 'google-api-key',
      url: 'https://api.google.com',
    }

    const config = {
      model: 'test-model',
    }

    const messages: Message[] = [
      { role: MessageRole.system, content: 'System message' },
    ]

    const module = await import('../ai')
    const ai = module.ai
    await expect(
      ai({ provider, config, messages }).then((r) => r.unwrap()),
    ).rejects.toThrowError(
      new ChainError({
        code: RunErrorCodes.AIProviderConfigError,
        message: 'Google provider requires at least one user message',
      }),
    )
  })

  it.only('throw a ChainError when AI fails with APICallError', async () => {
    const module = await import('../ai')
    const ai = module.ai
    const AISdk = await vi.importMock<typeof import('ai')>('ai')
    AISdk.streamText.mockRejectedValue(
      new AISdk.APICallError({
        message: 'API call error',
        url: 'https://api.openai.com',
        requestBodyValues: {},
      }),
    )
    const provider: ProviderApiKey = {
      id: 33,
      authorId: '1',
      workspaceId: 1,
      provider: Providers.OpenAI,
      name: 'openai',
      token: 'fake-openai-api-key',
      url: 'https://api.openai.com',
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await expect(
      ai({ provider, config: { model: 'gpt-4o' }, messages: [] }).then((r) =>
        r.unwrap(),
      ),
    ).rejects.toThrowError(
      new ChainError({
        code: RunErrorCodes.AIRunError,
        message: 'API call error',
      }),
    )
  })
})
