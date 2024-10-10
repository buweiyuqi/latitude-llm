import { APICallError } from 'ai'

import { RunErrorCodes } from '../../constants'
import { Result } from '../../lib'
import { ChainError } from '../chains/ChainErrors'

function buildAIApiError(error: APICallError) {
  return new ChainError({
    code: RunErrorCodes.AIRunError,
    message: error.message,
  })
}

export function handleAICallAPIError(e: unknown) {
  const isApiError = APICallError.isInstance(e)

  let error: ChainError<RunErrorCodes.AIRunError>
  if (isApiError) {
    error = buildAIApiError(e)
  } else {
    error = new ChainError({
      code: RunErrorCodes.AIRunError,
      message: 'Unknown error',
    })
  }

  return Result.error(error)
}
