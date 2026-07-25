import assert from 'node:assert/strict'
import test from 'node:test'
import {
  estimateRuleDurationSeconds,
  estimateRuleSecondsPerBatch,
} from './ruleExtractionTiming.service'

test('uses a 12-second cold-start prior when no completed run exists', () => {
  assert.equal(estimateRuleSecondsPerBatch([]), 12)
})

test('learns the median observed seconds per batch from repeated successful runs', () => {
  const rate = estimateRuleSecondsPerBatch([
    { status: 'success', durationMs: 71 * 60 * 1000, processedBatches: 365 },
    { status: 'success', durationMs: (93 * 60 + 13) * 1000, processedBatches: 522 },
  ])
  assert.ok(Math.abs(rate - 11.193) < 0.02)
  assert.equal(estimateRuleDurationSeconds(522, rate), 5851)
})

test('ignores failed runs and is robust to one extreme successful outlier', () => {
  const rate = estimateRuleSecondsPerBatch([
    { status: 'success', durationMs: 110_000, processedBatches: 10 },
    { status: 'success', durationMs: 1_120_000, processedBatches: 100 },
    { status: 'success', durationMs: 5_000_000, processedBatches: 100 },
    { status: 'failed', durationMs: 900_000, processedBatches: 1 },
  ])
  assert.equal(rate, 11.2)
})

test('scales the same learned throughput to a different batch count', () => {
  assert.equal(estimateRuleDurationSeconds(365, 11.2), 4096)
  assert.equal(estimateRuleDurationSeconds(522, 11.2), 5855)
})
