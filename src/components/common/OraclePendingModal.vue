<template>
  <LongRunningTaskModal
    :model-value="oracleStore.isDialogVisible && Boolean(oracleStore.trackedDream)"
    :title="t('common.dreamProgress.title')"
    :subject="subject"
    :subtitle="dreamExcerpt"
    :aria-label="t('common.dreamProgress.aria')"
    :minimize-label="t('common.longTask.minimize')"
    :steps-aria-label="t('common.dreamProgress.stepsAria')"
    :stages="renderedStages"
    :current-stage-index="currentStageIndex"
    :progress="stageProgress"
    :step-text="localizedStepText"
    :detail-text="stageDetail"
    :elapsed-seconds="oracleStore.elapsedSeconds"
    :processed-label="stageLabel"
    :estimated-remaining-seconds="estimatedRemainingSeconds"
    :remaining-text="terminalTimingText"
    :timing-delta-seconds="timingDeltaSeconds"
    :completed="isTerminal"
    :cancelable="isPending"
    :cancel-loading="oracleStore.isCancelling"
    :cancel-label="t('common.longTask.cancel')"
    :cancel-confirm-title="t('common.longTask.cancelConfirm')"
    :cancel-confirm-message="t('common.longTask.cancelMessage')"
    :cancel-confirm-label="t('common.longTask.confirmCancel')"
    :keep-running-label="t('common.longTask.keepRunning')"
    @minimize="oracleStore.minimizeDialog()"
    @cancel="oracleStore.cancelAnalysis()"
  >
    <template v-if="isCompleted || isCancelled || isFailed" #actions>
      <AppButton v-if="isCancelled || isFailed" type="button" variant="primary" size="sm" @click="oracleStore.retryAnalysis()">
        {{ t('common.longTask.retry') }}
      </AppButton>
      <AppButton v-if="isCompleted" type="button" variant="primary" size="sm" @click="viewDreamPost">
        {{ t('common.dreamProgress.viewPost') }}
      </AppButton>
    </template>
  </LongRunningTaskModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOracleStore } from '@/store/useOracleStore'
import { usePostStore } from '@/store/usePostStore'
import AppButton from './AppButton.vue'
import LongRunningTaskModal, { type LongRunningTaskStage } from './LongRunningTaskModal.vue'

const oracleStore = useOracleStore()
const postStore = usePostStore()
const { t, locale } = useI18n({ useScope: 'global' })

const isCompleted = computed(() => oracleStore.trackedDream?.ai_status === 'completed')
const isCancelled = computed(() => oracleStore.trackedDream?.ai_status === 'cancelled')
const isFailed = computed(() => oracleStore.trackedDream?.ai_status === 'failed')
const isPending = computed(() => oracleStore.trackedDream?.ai_status === 'pending')
const isTerminal = computed(() => isCompleted.value || isCancelled.value || isFailed.value)
const subject = computed(() => isCompleted.value
  ? t('common.dreamProgress.completedSubject')
  : isCancelled.value
    ? t('common.dreamProgress.cancelledSubject')
    : isFailed.value
      ? t('common.dreamProgress.failedSubject')
      : t('common.dreamProgress.runningSubject'))

const dreamExcerpt = computed(() => {
  const text = oracleStore.trackedDream?.content?.replace(/\s+/g, ' ').trim() || ''
  return text.length > 170 ? `${text.slice(0, 170)}…` : text
})

type AnalysisStageKey =
  | 'queued'
  | 'preparing'
  | 'retrieving_context'
  | 'retrieving_rules'
  | 'generating_analysis'
  | 'finalizing'

const stage = computed(() => oracleStore.trackedDream?.analysisMetadata?.currentStage || 'preparing')
const stages = computed<Array<{ key: AnalysisStageKey; label: string; detail: string }>>(() => [
  { key: 'queued', label: t('common.dreamProgress.stages.queued.label'), detail: t('common.dreamProgress.stages.queued.detail') },
  { key: 'preparing', label: t('common.dreamProgress.stages.preparing.label'), detail: t('common.dreamProgress.stages.preparing.detail') },
  { key: 'retrieving_context', label: t('common.dreamProgress.stages.retrievingContext.label'), detail: t('common.dreamProgress.stages.retrievingContext.detail') },
  { key: 'retrieving_rules', label: t('common.dreamProgress.stages.retrievingRules.label'), detail: t('common.dreamProgress.stages.retrievingRules.detail') },
  { key: 'generating_analysis', label: t('common.dreamProgress.stages.generatingAnalysis.label'), detail: t('common.dreamProgress.stages.generatingAnalysis.detail') },
  { key: 'finalizing', label: t('common.dreamProgress.stages.finalizing.label'), detail: t('common.dreamProgress.stages.finalizing.detail') },
])
const stageOrder = computed(() => stages.value.map(item => item.key))
function isAnalysisStageKey(value: unknown): value is AnalysisStageKey {
  return typeof value === 'string'
    && stageOrder.value.includes(value as AnalysisStageKey)
}

function inferFailedStageIndex(): number {
  const failedAtStage = oracleStore.trackedDream?.analysisMetadata?.failedAtStage
  const recordedIndex = isAnalysisStageKey(failedAtStage)
    ? stageOrder.value.indexOf(failedAtStage)
    : -1
  if (recordedIndex >= 0) return recordedIndex

  const progress = Number(
    oracleStore.progress
    || oracleStore.trackedDream?.analysisMetadata?.progress
    || 0,
  )
  if (progress >= 88) return 5
  if (progress >= 55) return 4
  if (progress >= 45) return 3
  if (progress >= 28) return 2
  if (progress >= 8) return 1
  return 0
}

const currentStageIndex = computed(() => {
  if (isCompleted.value) return stages.value.length
  if (isFailed.value) return inferFailedStageIndex()
  const index = isAnalysisStageKey(stage.value)
    ? stageOrder.value.indexOf(stage.value)
    : -1
  return index >= 0 ? index : 0
})
const currentMiniStep = computed(() => oracleStore.trackedDream?.analysisMetadata?.currentMiniStep || '')
const isVietnamese = computed(() => locale.value.toLowerCase().startsWith('vi'))
const renderedStages = computed<LongRunningTaskStage[]>(() => stages.value.map((item, index) => ({
  ...item,
  activeDetail: isVietnamese.value && currentMiniStep.value ? currentMiniStep.value : item.detail,
  result: isVietnamese.value
    ? oracleStore.trackedDream?.analysisMetadata?.stageResults?.[item.key]
    : undefined,
  state: index < currentStageIndex.value || isCompleted.value
    ? 'done'
    : index === currentStageIndex.value
      ? (isCancelled.value || isFailed.value ? 'failed' : 'active')
      : 'pending',
})))
const stageLabel = computed(() => currentStageIndex.value < stages.value.length
  ? t('common.dreamProgress.step', {
      current: currentStageIndex.value + 1,
      total: stages.value.length,
    })
  : t('common.dreamProgress.completedSteps', { total: stages.value.length }))
const stageProgress = computed(() => isCompleted.value
  ? 100
  : Math.max(0, Math.min(99, oracleStore.progress || oracleStore.trackedDream?.analysisMetadata?.progress || 0)))
const estimatedRemainingSeconds = computed(() => {
  if (!isPending.value || stage.value === 'queued') return null
  const estimate = oracleStore.trackedDream?.analysisMetadata?.estimatedDurationSeconds
  return typeof estimate === 'number' ? estimate - oracleStore.elapsedSeconds : null
})
const timingDeltaSeconds = computed(() => oracleStore.trackedDream?.analysisMetadata?.timingDeltaSeconds ?? null)
const activeStage = computed(() => stages.value[currentStageIndex.value])
const localizedStepText = computed(() => {
  if (isCompleted.value) return t('common.dreamProgress.completed')
  if (isCancelled.value) return t('common.dreamProgress.cancelledSubject')
  if (isFailed.value) return t('common.dreamProgress.failedSubject')
  return activeStage.value?.label || t('common.dreamProgress.runningSubject')
})
const stageDetail = computed(() => {
  if (isCancelled.value) return t('common.dreamProgress.cancelled')
  if (isFailed.value) return t('common.dreamProgress.failed')
  if (isCompleted.value) return t('common.dreamProgress.completed')
  return activeStage.value?.detail || t('common.dreamProgress.runningSubject')
})
const terminalTimingText = computed(() => {
  if (isCancelled.value) return t('common.longTask.cancelled')
  if (isFailed.value) return t('common.dreamProgress.failed')
  return ''
})

function viewDreamPost() {
  const dreamId = oracleStore.trackedDream?._id
  if (!dreamId) return
  oracleStore.stopTracking()
  void postStore.openPost(dreamId)
}
</script>
