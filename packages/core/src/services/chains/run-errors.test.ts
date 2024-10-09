import { Chain, ContentType, MessageRole } from '@latitude-data/compiler'
import { beforeEach, describe, it, vi } from 'vitest'

import { Workspace } from '../../browser'
import { DEFAULT_PROVIDER_MAX_FREE_RUNS, LogSources, Providers } from '../../constants'
import { Result } from '../../lib'
import * as factories from '../../tests/factories'
import * as aiModule from '../ai'
import { runChain } from './run'

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

  it('stores error when default provider quota is exceeded', async () => {
    vi.doMock('../freeRunsManager', async () => {
      const defaultMod = await import('../freeRunsManager') as typeof import('../freeRunsManager')
      return {
        ...defaultMod,
        incrFreeRuns: async () => DEFAULT_PROVIDER_MAX_FREE_RUNS + 1,
      }
    })
    const run = await runChain({
      workspace,
      chain: mockChain as Chain,
      providersMap,
      source: LogSources.API,
    })

    const response = await run.response
  })
})
