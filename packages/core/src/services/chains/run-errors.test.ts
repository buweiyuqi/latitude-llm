import { Chain, ContentType, MessageRole } from '@latitude-data/compiler'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runChain } from './run'

import { Workspace } from '../../browser'
import {
  ErrorableEntity,
  LogSources,
  Providers,
  RunErrorCodes,
} from '../../constants'
import { Result } from '../../lib'
import * as factories from '../../tests/factories'
import * as aiModule from '../ai'
import { ChainError } from './ChainErrors'
import { ChainValidator } from './ChainValidator'

let finishReason: string = 'stop'

function createMockAiResponse(text: string, totalTokens: number) {
  return Result.ok({
    type: 'text' as 'text',
    data: {
      text: Promise.resolve(text),
      usage: Promise.resolve({ totalTokens }),
      toolCalls: Promise.resolve([]),
      providerLog: Promise.resolve({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
      }),
      fullStream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'text-delta', textDelta: text })
          controller.enqueue({ type: 'finish', finishReason })
          controller.close()
        },
      }),
    },
  })
}

let providersMap: Map<string, any>

let workspace: Workspace

describe('run chain error handling', () => {
  const mockChain: Partial<Chain> = {
    step: vi.fn(),
    rawText: 'Test raw text',
  }

  beforeEach(async () => {
    vi.resetAllMocks()

    const { workspace: w, providers } = await factories.createProject({
      providers: [{ name: 'openai', type: Providers.OpenAI }],
    })
    providersMap = new Map(providers.map((p) => [p.name, p]))
    workspace = w
    const mockAiResponse = createMockAiResponse('AI response', 10)
    vi.spyOn(aiModule, 'ai').mockResolvedValue(mockAiResponse as any)
    vi.mocked(mockChain.step!).mockResolvedValue({
      completed: true,
      conversation: {
        messages: [
          {
            role: MessageRole.user,
            content: [{ type: ContentType.text, text: 'Test message' }],
          },
        ],
        config: { provider: 'openai', model: 'gpt-3.5-turbo' },
      },
    })
  })

  it.only('stores error when default provider quota is exceeded', async () => {
    const chainValidatorCall = vi.spyOn(ChainValidator.prototype, 'call')
    chainValidatorCall.mockImplementation(() =>
      Promise.resolve(
        Result.error(
          new ChainError({
            code: RunErrorCodes.DefaultProviderExceededQuota,
            message:
              'You have exceeded your maximum number of free runs for today',
          }),
        ),
      ),
    )
    const run = await runChain({
      errorableType: ErrorableEntity.DocumentLog,
      workspace,
      chain: mockChain as Chain,
      providersMap,
      source: LogSources.API,
    })

    const response = await run.response
    expect(response.error).toEqual(
      new ChainError({
        code: RunErrorCodes.DefaultProviderExceededQuota,
        message: 'You have exceeded your maximum number of free runs for today',
      }),
    )
    expect(response.error?.dbError).toEqual({
      id: expect.any(Number),
      errorableUuid: expect.any(String),
      errorableType: ErrorableEntity.DocumentLog,
      code: RunErrorCodes.DefaultProviderExceededQuota,
      message: 'You have exceeded your maximum number of free runs for today',
      details: null,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
  })
})
