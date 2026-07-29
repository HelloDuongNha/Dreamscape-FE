<template>
  <div class="source-processing-history">
    <section class="history-panel">
      <h3 class="history-panel__title">{{ t('library.system.readerBuilds') }}</h3>
      <div v-if="readerBuilds.length" class="history-list">
        <details
          v-for="build in readerBuilds"
          :key="`${build.builtAt}-${build.engine}-${build.sourceType}`"
          :class="['history-item', { 'history-item--active': build.isActive }]"
        >
          <summary>
            <AppIcon class="history-item__chevron" name="chevron-down" :size="12" />
            <span class="history-item__main">
              <strong>{{ build.label }}</strong>
              <small>{{ t('library.system.buildNumber', { number: build.number }) }}</small>
            </span>
            <span class="history-item__meta">
              <strong :class="{ 'status-failed': build.status === 'failed' }">
                {{ build.status === 'failed'
                  ? t('library.statuses.failed')
                  : t('library.system.sectionsChunks', {
                      sections: build.sectionCount,
                      chunks: build.chunkCount,
                    }) }}
              </strong>
              <small>{{ formatDuration(build.timing?.durationMs ?? null) }}</small>
            </span>
          </summary>
          <dl class="history-details">
            <div><dt>{{ t('library.system.completedAt') }}</dt><dd>{{ formatDate(build.builtAt) }}</dd></div>
            <div><dt>{{ t('library.system.readerEngine') }}</dt><dd>{{ build.engine }}</dd></div>
            <div><dt>{{ t('library.system.readerSourceType') }}</dt><dd>{{ build.sourceType }}</dd></div>
            <div v-if="build.status === 'failed'">
              <dt>{{ t('library.system.stopReason') }}</dt>
              <dd>{{ build.failureMessage || build.failureCode || t('library.rule.failure.unknown') }}</dd>
            </div>
            <div v-if="build.status !== 'failed' && build.isPdf && build.timing?.pageCount">
              <dt>{{ t('library.system.pdfDetails') }}</dt>
              <dd>{{ build.timing.pageCount }} {{ t('library.readerLocal.pagesShort') }} · {{ build.timing.ocrUsed ? 'OCR' : (build.engine || 'PDF') }}</dd>
            </div>
            <div v-if="build.status !== 'failed' && build.hasEstimate">
              <dt>{{ t('library.system.estimateDifference') }}</dt>
              <dd :class="isTimingEarly(build.timing) ? 'timing-early' : 'timing-late'">
                {{ formatTimingDelta(build.timing) }}
              </dd>
            </div>
          </dl>
        </details>
      </div>
      <p v-else class="history-empty">{{ t('library.system.noReaderHistory') }}</p>
    </section>

    <section class="rule-panel">
      <h3 class="history-panel__title">{{ t('library.system.ruleRuns') }}</h3>
      <p v-if="ruleSummaryLoading" class="history-empty">{{ t('library.system.loadingResults') }}</p>
      <template v-else-if="ruleSummary">
        <div v-if="ruleSummary.totalRuleCount > 0" class="rule-counts">
          <span class="rule-count rule-count--pending"><strong>{{ ruleSummary.counts.pending }}</strong>{{ t('library.system.pending') }}</span>
          <span class="rule-count rule-count--approved"><strong>{{ ruleSummary.counts.verified }}</strong>{{ t('library.system.approved') }}</span>
          <span class="rule-count rule-count--rejected"><strong>{{ ruleSummary.counts.rejected }}</strong>{{ t('library.system.rejected') }}</span>
          <span v-if="ruleSummary.evidenceGapMatches.candidateFound > 0" class="rule-count rule-count--evidence">
            <strong>{{ ruleSummary.evidenceGapMatches.candidateFound }}</strong>{{ t('library.system.evidenceNeedsMatched') }}
          </span>
          <span v-if="ruleSummary.evidenceGapMatches.resolved > 0" class="rule-count rule-count--resolved">
            <strong>{{ ruleSummary.evidenceGapMatches.resolved }}</strong>{{ t('library.system.evidenceNeedsResolved') }}
          </span>
        </div>

        <details v-if="ruleSummary.evidenceGapDetails.length" class="evidence-details">
          <summary>
            <AppIcon class="history-item__chevron" name="chevron-down" :size="12" />
            <span>
              <strong>{{ t('library.system.evidenceMatchDetails') }}</strong>
              <small>{{ t('library.system.evidenceMatchDetailsHint') }}</small>
            </span>
          </summary>
          <div class="evidence-list">
            <article v-for="gap in ruleSummary.evidenceGapDetails" :key="gap.gapId" class="evidence-item">
              <div>
                <span :class="['status-chip', gap.status === 'resolved' ? 'status-verified' : 'status-pending']">
                  {{ gap.status === 'resolved' ? t('library.system.evidenceResolved') : t('library.system.evidenceCandidateOnly') }}
                </span>
                <small v-if="gap.occurrenceCount > 1">{{ t('library.system.evidenceOccurrenceCount', { count: gap.occurrenceCount }) }}</small>
              </div>
              <strong>{{ gap.localizedClaim ? (locale === 'vi' ? gap.localizedClaim.vi : gap.localizedClaim.en) : gap.claim }}</strong>
              <ul>
                <li v-for="rule in gap.rules" :key="rule.ruleId">
                  <span translate="no">{{ rule.ruleCode }}</span>
                  <span>{{ rule.statement }}</span>
                  <small>{{ rule.evidenceScore }}/100 · {{ rule.resolutionRole === 'resolved' ? t('library.system.directlyResolved') : t('library.system.candidateMatch') }}</small>
                </li>
              </ul>
            </article>
          </div>
        </details>

        <div v-if="ruleSummary.runHistory.length" class="run-list">
          <details v-for="(run, index) in ruleSummary.runHistory" :key="run.runId" class="history-item">
            <summary>
              <AppIcon class="history-item__chevron" name="chevron-down" :size="12" />
              <span class="history-item__main">
                <strong>{{ t('library.system.runNumber', { number: ruleSummary.runHistory.length - index }) }}</strong>
                <small>{{ t('library.system.runCompact', { chunks: run.targetChunkCount ?? '—', saved: run.savedCandidateCount }) }}</small>
              </span>
              <span class="history-item__meta">
                <strong :class="`status-${run.status}`">{{ statusText(run.status) }}</strong>
                <small>{{ formatDuration(run.durationMs) }}</small>
              </span>
            </summary>
            <dl class="history-details">
              <div><dt>{{ t('library.system.startedAt') }}</dt><dd>{{ formatDate(run.startedAt) }}</dd></div>
              <div><dt>{{ t('library.system.batchProgress') }}</dt><dd>{{ run.processedBatches }}/{{ run.totalBatches }}</dd></div>
              <div><dt>{{ t('library.system.rawVerified') }}</dt><dd>{{ run.rawCandidateCount }} / {{ run.verifiedCandidateCount }}</dd></div>
              <div><dt>{{ t('library.system.createdMergedRejected') }}</dt><dd>{{ run.savedCandidateCount }} / {{ run.mergedCandidateCount }} / {{ run.rejectedCandidateCount }}</dd></div>
              <div><dt>{{ t('library.system.targetEvidenceChunks') }}</dt><dd>{{ run.targetChunkCount ?? '—' }} / {{ run.evidenceChunkCount ?? '—' }}</dd></div>
              <div v-if="run.status === 'failed'"><dt>{{ t('library.system.stopReason') }}</dt><dd>{{ failureText(run.sanitizedErrorCode) }}</dd></div>
            </dl>
            <div v-if="run.rejectionDiagnostics.length" class="run-rejections">
              <strong>{{ t('library.system.rejectionReasons') }}</strong>
              <ul>
                <li v-for="(item, itemIndex) in run.rejectionDiagnostics" :key="`${item.batchId}-${itemIndex}`">
                  <span translate="no">{{ item.safeMessage }}</span>
                  <small v-if="item.proposedStatement" translate="no">{{ item.proposedStatement }}</small>
                  <small>{{ t('library.system.evidenceBatch', { id: item.batchId }) }}</small>
                </li>
              </ul>
            </div>
          </details>
        </div>
        <p v-else class="history-empty">{{ t('library.system.noRunRecord') }}</p>
        <button v-if="ruleSummary.totalRuleCount > 0" type="button" class="rules-link" @click="$emit('open-rules')">
          {{ t('library.system.viewRules') }}
        </button>
        <p v-if="!ruleSummary.latestRun && ruleSummary.totalRuleCount === 0" class="history-empty">
          {{ t('library.system.noRuleRun') }}
        </p>
      </template>
      <p v-else class="history-empty">{{ t('library.system.ruleHistoryError') }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '@/components/common/AppIcon.vue'
import type { ReaderBuildSnapshot } from '@/api/moderationApi'
import type { RuleV3SourceAnalysisSummary } from '@/api/ruleCandidateApi'

interface ReaderTiming {
  durationMs: number
  estimatedDurationSeconds: number
  pageCount: number
  ocrUsed: boolean
}

interface ReaderBuildHistoryItem extends ReaderBuildSnapshot {
  number: number
  timing: ReaderTiming | null
  isPdf: boolean
  hasEstimate: boolean
  label: string
  isActive: boolean
}

defineProps<{
  readerBuilds: ReaderBuildHistoryItem[]
  ruleSummary: RuleV3SourceAnalysisSummary | null
  ruleSummaryLoading: boolean
  formatDuration: (durationMs: number | null) => string
  formatDate: (value: string) => string
  statusText: (status: string) => string
  failureText: (code: string | null) => string
  isTimingEarly: (timing: ReaderTiming | null) => boolean
  formatTimingDelta: (timing: ReaderTiming | null) => string
}>()

defineEmits<{ 'open-rules': [] }>()
const { t, locale } = useI18n({ useScope: 'global' })
</script>

<style scoped>
.source-processing-history { display: grid; gap: 8px; }
.history-panel, .rule-panel { display: grid; gap: 7px; padding: 10px; border: 1px solid #2f3744; border-radius: 9px; background: rgba(15, 23, 42, .5); }
.rule-panel { gap: 9px; border-color: #312e81; background: rgba(30, 27, 75, .28); }
.history-panel__title { margin: 0; color: #94a3b8; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.history-empty { margin: 0; color: var(--color-text-muted); font-size: 11px; line-height: 1.45; }
.history-list, .run-list { display: grid; gap: 6px; max-height: 320px; overflow-y: auto; padding-right: 3px; overscroll-behavior: contain; }
.history-list { max-height: 270px; }
.history-item { border: 1px solid #30364a; border-radius: 7px; background: rgba(15, 23, 42, .54); font-size: 10px; }
.history-item--active { border-color: rgba(16, 185, 129, .7); background: rgba(16, 185, 129, .07); }
.history-item summary { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; align-items: center; gap: 7px; padding: 8px; cursor: pointer; color: #cbd5e1; list-style: none; }
.history-item summary::-webkit-details-marker { display: none; }
.history-item__chevron { color: #94a3b8; transform: rotate(-90deg); transition: transform 150ms ease; }
details[open] > summary .history-item__chevron { transform: rotate(0deg); }
.history-item__main, .history-item__meta { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.history-item__main strong { overflow: hidden; color: #e2e8f0; text-overflow: ellipsis; white-space: nowrap; }
.history-item__main small, .history-item__meta small { color: #94a3b8; font-size: 9px; font-weight: 500; }
.history-item__meta { align-items: flex-end; text-align: right; }
.history-item__meta strong { color: #e2e8f0; font-size: 10px; white-space: nowrap; }
.history-details { display: grid; gap: 5px; margin: 0; padding: 0 9px 9px 29px; }
.history-details div { display: flex; justify-content: space-between; gap: 10px; }
.history-details dt { color: #94a3b8; }
.history-details dd { margin: 0; color: #e2e8f0; text-align: right; }
.rule-counts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.rule-count { display: flex; flex-direction: column; gap: 2px; padding: 7px 5px; border-radius: 7px; background: rgba(15, 23, 42, .64); color: #94a3b8; text-align: center; font-size: 9px; }
.rule-count strong { font-size: 14px; }
.rule-count--pending strong, .status-pending { color: #fbbf24; }
.rule-count--approved strong, .status-success { color: #34d399; }
.rule-count--rejected strong, .status-failed { color: #f87171; }
.rule-count--evidence strong { color: #60a5fa; }
.rule-count--resolved strong { color: #2dd4bf; }
.evidence-details { border: 1px solid rgba(96, 165, 250, .25); border-radius: 8px; background: rgba(15, 23, 42, .38); }
.evidence-details > summary { display: flex; align-items: center; gap: 7px; padding: 8px; cursor: pointer; color: #dbeafe; list-style: none; }
.evidence-details > summary span { display: grid; gap: 2px; }
.evidence-details > summary small { color: #94a3b8; font-size: 9px; }
.evidence-list { display: grid; gap: 6px; max-height: 300px; overflow-y: auto; padding: 0 7px 7px; }
.evidence-item { display: grid; gap: 6px; padding: 8px; border-radius: 7px; background: rgba(2, 6, 23, .52); }
.evidence-item > div { display: flex; justify-content: space-between; gap: 8px; color: #94a3b8; font-size: 9px; }
.evidence-item > strong { color: #e2e8f0; font-size: 10px; line-height: 1.45; }
.evidence-item ul { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.evidence-item li { display: grid; grid-template-columns: auto 1fr; gap: 3px 7px; padding-top: 5px; border-top: 1px solid rgba(148, 163, 184, .13); color: #cbd5e1; font-size: 9px; }
.evidence-item li small { grid-column: 2; color: #93c5fd; }
.rules-link { padding: 7px 8px; border: 1px solid #4338ca; border-radius: 7px; background: rgba(67, 56, 202, .14); color: #c7d2fe; cursor: pointer; font-size: 10px; font-weight: 650; }
.rules-link:hover { background: rgba(67, 56, 202, .24); }
.run-rejections { margin: 0 8px 8px; padding: 8px; border-left: 2px solid #f59e0b; background: rgba(120, 53, 15, .12); color: #fcd34d; }
.run-rejections ul { display: grid; gap: 7px; margin: 6px 0 0; padding-left: 15px; }
.run-rejections span, .run-rejections small { display: block; }
.run-rejections small { margin-top: 2px; color: #cbd5e1; line-height: 1.35; }
.timing-early { color: #34d399; }
.timing-late { color: #f59e0b; }
</style>
