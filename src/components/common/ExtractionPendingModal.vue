<template>
  <LongRunningTaskModal
    :model-value="extractionStore.isDialogVisible && Boolean(extractionStore.sourceId)"
    :title="t('rules.extraction.title')"
    :subject="extractionStore.sourceTitle"
    :subtitle="t('rules.extraction.subtitle')"
    :aria-label="t('rules.extraction.dialogAria')"
    :minimize-label="t('rules.extraction.minimize')"
    :steps-aria-label="t('rules.extraction.stepsAria')"
    :stages="renderedStages"
    :current-stage-index="currentStageIndex"
    :progress="extractionStore.progress"
    :step-text="localizedStepText"
    :detail-text="localizedStageDetail"
    :elapsed-seconds="extractionStore.elapsedSeconds"
    :processed-label="processedLabel"
    :estimated-remaining-seconds="extractionStore.estimatedRemainingSeconds"
    :timing-delta-seconds="extractionStore.timingDeltaSeconds"
    :completed="extractionStore.status !== 'pending'"
    :hide-elapsed="extractionStore.currentStage === 'queued'"
    :cancelable="extractionStore.status === 'pending'"
    :cancel-loading="extractionStore.isCancelling"
    :cancel-label="t('common.longTask.cancel')"
    :cancel-confirm-title="t('common.longTask.cancelConfirm')"
    :cancel-confirm-message="t('common.longTask.cancelMessage')"
    :cancel-confirm-label="t('common.longTask.confirmCancel')"
    :keep-running-label="t('common.longTask.keepRunning')"
    @minimize="extractionStore.minimizeDialog()"
    @cancel="extractionStore.cancelExtraction()"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useExtractionStore } from '@/store/useExtractionStore'
import LongRunningTaskModal, { type LongRunningTaskStage } from './LongRunningTaskModal.vue'

const extractionStore = useExtractionStore()
const { t } = useI18n({ useScope: 'global' })

const stages = computed(() => [
  { key: 'initializing', label: t('rules.extraction.steps.prepare'), detail: t('rules.extraction.stepDetails.prepare') },
  { key: 'extracting_candidates', label: t('rules.extraction.steps.extract'), detail: t('rules.extraction.stepDetails.extract') },
  { key: 'saving_candidates', label: t('rules.extraction.steps.save'), detail: t('rules.extraction.stepDetails.save') },
  { key: 'merging_candidates', label: t('rules.extraction.steps.merge'), detail: t('rules.extraction.stepDetails.merge') },
])
const stageOrder = ['initializing', 'extracting_candidates', 'saving_candidates', 'merging_candidates', 'completed'] as const
const currentStageIndex = computed(() => extractionStore.currentStage === 'completed'
  ? stages.value.length
  : extractionStore.currentStage === 'queued'
    ? 0
    : Math.max(0, stageOrder.indexOf(extractionStore.currentStage)))
const renderedStages = computed<LongRunningTaskStage[]>(() => stages.value.map((stage, index) => ({
  ...stage,
  activeDetail: localizedStageDetail.value,
  state: index < currentStageIndex.value || extractionStore.currentStage === 'completed'
    ? 'done'
    : index === currentStageIndex.value
      ? 'active'
      : 'pending',
})))
const localizedStepText = computed(() => {
  if (extractionStore.currentStage === 'queued') return t('rules.extraction.queued')
  if (extractionStore.currentStage === 'extracting_candidates') {
    return t('rules.extraction.extracting', {
      processed: extractionStore.processedBatches,
      total: extractionStore.totalBatches,
    })
  }
  if (extractionStore.currentStage === 'saving_candidates') return t('rules.extraction.saving')
  if (extractionStore.currentStage === 'merging_candidates') return t('rules.extraction.merging')
  if (extractionStore.currentStage === 'completed') return t('rules.extraction.completed')
  return t('rules.extraction.preparing')
})
const localizedStageDetail = computed(() => {
  if (extractionStore.currentStage === 'queued') return t('rules.extraction.queuedDetail')
  if (extractionStore.currentStage === 'extracting_candidates') {
    return t('rules.extraction.candidateCounts', {
      raw: extractionStore.rawCandidateCount,
      verified: extractionStore.verifiedCandidateCount,
    })
  }
  if (extractionStore.currentStage === 'saving_candidates') return t('rules.extraction.stepDetails.save')
  if (extractionStore.currentStage === 'merging_candidates') return t('rules.extraction.stepDetails.merge')
  if (extractionStore.currentStage === 'completed') return t('rules.extraction.stepDetails.completed')
  return t('rules.extraction.stepDetails.prepare')
})
const processedLabel = computed(() => extractionStore.totalBatches > 0
  ? t('rules.extraction.batchProgress', {
      processed: extractionStore.processedBatches,
      total: extractionStore.totalBatches,
    })
  : '')
</script>
