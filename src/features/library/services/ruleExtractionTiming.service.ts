export interface CompletedRuleRunTiming {
  status: string
  durationMs: number | null
  processedBatches: number
}

const COLD_START_SECONDS_PER_BATCH = 12
const MIN_SECONDS_PER_BATCH = 3
const MAX_SECONDS_PER_BATCH = 60

/**
 * Robust throughput estimate used in the report and UI:
 *
 *   r_i = duration_i / processed_batches_i
 *   r̂   = median(r_i)
 *   T̂   = 8 + total_batches × clamp(r̂, 3, 60)
 *
 * Median prevents one interrupted/slow run from dominating later estimates.
 */
export function estimateRuleSecondsPerBatch(runs: CompletedRuleRunTiming[]): number {
  const samples = runs
    .filter(run => run.status === 'success' && Number(run.durationMs) > 0 && run.processedBatches > 0)
    .map(run => Number(run.durationMs) / 1000 / run.processedBatches)
    .filter(value => Number.isFinite(value) && value >= MIN_SECONDS_PER_BATCH && value <= MAX_SECONDS_PER_BATCH)
    .sort((left, right) => left - right)

  if (!samples.length) return COLD_START_SECONDS_PER_BATCH
  const middle = Math.floor(samples.length / 2)
  return samples.length % 2 === 1
    ? samples[middle]
    : (samples[middle - 1] + samples[middle]) / 2
}

export function estimateRuleDurationSeconds(totalBatches: number, secondsPerBatch: number): number {
  const boundedRate = Math.min(MAX_SECONDS_PER_BATCH, Math.max(MIN_SECONDS_PER_BATCH, secondsPerBatch))
  return Math.max(1, Math.ceil(8 + Math.max(0, totalBatches) * boundedRate))
}
