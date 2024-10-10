import { Message } from '@latitude-data/compiler'
import { v4 } from 'uuid'

import {
  ErrorableEntity,
  LogSources,
  ProviderApiKey,
  RunErrorCodes,
  StreamType,
} from '../../../browser'
import { StreamCommonData } from '../../../events/events'
import { AIReturn, PartialConfig } from '../../ai'
import { ChainError } from '../ChainErrors'
import { StreamConsumeReturn } from '../ChainStreamConsumer/consumeStream'
import { processStreamObject } from './processStreamObject'
import { processStreamText } from './processStreamText'
import { saveOrPublishProviderLogs } from './saveOrPublishProviderLogs'

export class ProviderProcessor {
  private apiProvider: ProviderApiKey
  private source: LogSources
  private workspaceId: number
  private config: PartialConfig
  private messages: Message[]
  private saveSyncProviderLogs: boolean
  private errorableUuid: string
  private errorableType: ErrorableEntity

  constructor({
    apiProvider,
    source,
    config,
    messages,
    saveSyncProviderLogs,
    errorableUuid,
    errorableType,
  }: {
    apiProvider: ProviderApiKey
    source: LogSources
    config: PartialConfig
    messages: Message[]
    saveSyncProviderLogs: boolean
    errorableUuid: string
    errorableType: ErrorableEntity
  }) {
    this.apiProvider = apiProvider
    this.workspaceId = apiProvider.workspaceId
    this.source = source
    this.errorableUuid = errorableUuid
    this.config = config
    this.messages = messages
    this.saveSyncProviderLogs = saveSyncProviderLogs
    this.errorableUuid = errorableUuid
    this.errorableType = errorableType
  }

  /**
   * This method is responsible of 2 things
   * 1. Process the AI response
   * 2. Create a provider log if necessary (syncronous call or enqueue call)
   *
   * Provider log is created with AI error if present in the consumed stream
   */
  async call({
    aiResult,
    startTime,
    streamConsumedResult,
  }: {
    aiResult: Awaited<AIReturn<StreamType>>
    startTime: number
    streamConsumedResult: StreamConsumeReturn
  }) {
    this.throwIfNotValidStreamType(aiResult)

    const { response, providerLogsData } = await this.processResponse({
      aiResult,
      startTime,
    })

    const providerLog = await saveOrPublishProviderLogs({
      streamType: aiResult.type,
      streamConsumedResult,
      data: providerLogsData,
      saveSyncProviderLogs: this.saveSyncProviderLogs,
      errorableUuid: this.errorableUuid,
      errorableType: this.errorableType,
    })

    return { ...response, providerLog }
  }

  private async processResponse({
    aiResult,
    startTime,
  }: {
    aiResult: Awaited<AIReturn<StreamType>>
    startTime: number
  }) {
    const commonData = await this.buildCommonData({ aiResult, startTime })

    if (aiResult.type === 'text') {
      return processStreamText({ aiResult, commonData })
    }

    return processStreamObject({ aiResult, commonData })
  }

  private async buildCommonData({
    aiResult,
    startTime,
  }: {
    aiResult: Awaited<AIReturn<StreamType>>
    startTime: number
  }): Promise<StreamCommonData> {
    const endTime = Date.now()
    return {
      uuid: v4(),

      // AI Provider Data
      workspaceId: this.workspaceId,
      source: this.source,
      providerId: this.apiProvider.id,
      providerType: this.apiProvider.provider,
      // FIXME: This should be polymorphic
      // https://github.com/latitude-dev/latitude-llm/issues/229
      documentLogUuid: this.errorableUuid,

      // AI
      duration: endTime - startTime,
      generatedAt: new Date(),
      model: this.config.model,
      config: this.config,
      messages: this.messages,
      usage: await aiResult.data.usage,
    }
  }

  private throwIfNotValidStreamType(aiResult: AIReturn<StreamType>) {
    const { type } = aiResult
    const invalidType = type !== 'text' && type !== 'object'
    if (!invalidType) return

    throw new ChainError({
      code: RunErrorCodes.UnsupportedProviderResponseTypeError,
      message: `Invalid stream type ${type} result is not a textStream or objectStream`,
    })
  }
}
