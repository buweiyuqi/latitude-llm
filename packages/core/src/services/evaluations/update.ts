import { isEmpty, omit } from 'lodash-es'

import { eq } from 'drizzle-orm'

import { EvaluationDto } from '../../browser'
import { database } from '../../client'
import { Result, Transaction } from '../../lib'
import { compactObject } from '../../lib/compactObject'
import { evaluations, llmAsJudgeEvaluationMetadatas } from '../../schema'

export async function updateEvaluation(
  {
    evaluation,
    name,
    description,
    metadata = {},
  }: {
    evaluation: EvaluationDto
    name?: string
    description?: string
    metadata: Record<string, unknown>
  },
  trx = database,
) {
  return await Transaction.call(async ({ db: tx }) => {
    let updatedEvals = [omit(evaluation, 'metadata')]
    let values = compactObject({ name, description })
    if (!isEmpty(values)) {
      updatedEvals = await tx
        .update(evaluations)
        .set(values)
        .where(eq(evaluations.id, evaluation.id))
        .returning()
    }

    let updatedMetadata = [evaluation.metadata]
    values = compactObject(metadata)
    if (!isEmpty(values)) {
      updatedMetadata = await tx
        .update(llmAsJudgeEvaluationMetadatas)
        .set(values)
        .where(eq(llmAsJudgeEvaluationMetadatas.id, evaluation.metadata.id))
        .returning()
    }

    return Result.ok({
      ...updatedEvals[0]!,
      metadata: updatedMetadata[0]!,
    })
  }, trx)
}
