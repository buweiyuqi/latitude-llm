import { ErrorableEntity, StreamType } from '../../../constants'
import { AIProviderCallCompletedData } from '../../../events/events'
import { publisher } from '../../../events/publisher'
import { setupJobs } from '../../../jobs'
import { createProviderLog } from '../../providerLogs'
import { StreamConsumeReturn } from '../ChainStreamConsumer/consumeStream'
import { type ObjectProviderLogsData } from './processStreamObject'
import { type TextProviderLogsData } from './processStreamText'

export type LogData<T extends StreamType> = T extends 'text'
  ? Awaited<TextProviderLogsData>
  : T extends 'object'
    ? Awaited<ObjectProviderLogsData>
    : unknown

export async function saveOrPublishProviderLogs<T extends StreamType>({
  data,
  streamType,
  saveSyncProviderLogs,
  streamConsumedResult,
  errorableUuid,
  errorableType,
}: {
  streamType: T
  data: LogData<T>
  saveSyncProviderLogs: boolean
  streamConsumedResult: StreamConsumeReturn
  errorableUuid: string
  errorableType: ErrorableEntity
}) {
  publisher.publishLater({
    type: 'aiProviderCallCompleted',
    data: { ...data, streamType } as AIProviderCallCompletedData<T>,
  })

  const error = streamConsumedResult.error
  const providerLogsData = {
    ...data,
    finishReason: streamConsumedResult.finishReason,
    providerError: error
      ? {
          errorableType,
          errorableUuid,
          errorCode: error.errorCode,
          message: error.message,
        }
      : undefined,
  }
  if (saveSyncProviderLogs) {
    const providerLog = await createProviderLog(providerLogsData).then((r) =>
      r.unwrap(),
    )
    return providerLog
  }

  const queues = await setupJobs()
  queues.defaultQueue.jobs.enqueueCreateProviderLogJob(providerLogsData)
}
