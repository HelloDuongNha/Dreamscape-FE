<template>
  <LongRunningTaskModal
    :model-value="sourceProgressStore.isDialogVisible && Boolean(sourceProgressStore.contributionId)"
    :title="modalTitle"
    :subject="sourceProgressStore.sourceTitle"
    :subtitle="modalSubtitle"
    :aria-label="modalTitle"
    :minimize-label="t('common.longTask.minimize')"
    :steps-aria-label="stepsAriaLabel"
    :stages="stages"
    :current-stage-index="currentStageIndex"
    :progress="sourceProgressStore.progress"
    :step-text="presentedStepText"
    :detail-text="presentedDetailText"
    :elapsed-seconds="sourceProgressStore.elapsedSeconds"
    :estimated-remaining-seconds="sourceProgressStore.estimatedRemainingSeconds"
    :timing-delta-seconds="sourceProgressStore.timingDeltaSeconds"
    :completed="sourceProgressStore.status !== 'pending'"
    :cancelable="sourceProgressStore.status === 'pending'"
    :cancel-loading="sourceProgressStore.isCancelling"
    :cancel-label="t('common.longTask.cancel')"
    :cancel-confirm-title="t('common.longTask.cancelConfirm')"
    :cancel-confirm-message="t('common.longTask.cancelMessage')"
    :cancel-confirm-label="t('common.longTask.confirmCancel')"
    :keep-running-label="t('common.longTask.keepRunning')"
    @minimize="sourceProgressStore.minimizeDialog()"
    @cancel="sourceProgressStore.cancelCurrentTask()"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSourceProgressStore } from '@/store/useSourceProgressStore'
import LongRunningTaskModal, { type LongRunningTaskStage } from './LongRunningTaskModal.vue'

const sourceProgressStore = useSourceProgressStore()
const { t } = useI18n({ useScope: 'global' })

const modalTitle = computed(() => {
  if (sourceProgressStore.pipelineKind === 'structured') return t('common.sourceProgress.structuredTitle')
  if (sourceProgressStore.pipelineKind === 'pdf') return t('common.sourceProgress.pdfTitle')
  return t('common.sourceProgress.importTitle')
})
const modalSubtitle = computed(() => {
  if (sourceProgressStore.pipelineKind === 'structured') return t('common.sourceProgress.structuredSubtitle')
  if (sourceProgressStore.pipelineKind === 'pdf') return t('common.sourceProgress.pdfSubtitle')
  return t('common.sourceProgress.importSubtitle')
})
const stepsAriaLabel = computed(() => sourceProgressStore.pipelineKind === 'pdf'
  ? t('common.sourceProgress.doclingStagesLabel')
  : t('common.sourceProgress.importStagesLabel'))
const stageCount = computed(() => sourceProgressStore.pipelineKind === 'pdf'
  ? (sourceProgressStore.ocrExpected ? 6 : 5)
  : sourceProgressStore.pipelineKind === 'structured'
    ? 3
    : 4)

const pdfStageDefinitions = computed(() => [
  { key: 'received', label: t('common.sourceProgress.receivePdf'), detail: t('common.sourceProgress.receivePdfDetail') },
  { key: 'inspecting_text', label: t('common.sourceProgress.inspectOcr'), detail: t('common.sourceProgress.inspectOcrDetail') },
  ...(sourceProgressStore.ocrExpected
    ? [{ key: 'ocr_processing', label: t('common.sourceProgress.recognizeOcr'), detail: t('common.sourceProgress.recognizeOcrDetail') }]
    : []),
  { key: 'parsing_layout', label: t('common.sourceProgress.parseDocling'), detail: t('common.sourceProgress.parseDoclingDetail') },
  { key: 'cleaning_ocr', label: t('common.sourceProgress.cleanOcr'), detail: t('common.sourceProgress.cleanOcrDetail') },
  { key: 'compiling_reader', label: t('common.sourceProgress.buildReader'), detail: t('common.sourceProgress.buildReaderDetail') },
])

const structuredStageDefinitions = computed(() => [
  { key: 'prepare', label: t('common.sourceProgress.structuredPrepare'), detail: t('common.sourceProgress.structuredPrepareDetail') },
  { key: 'retrieve', label: t('common.sourceProgress.structuredRetrieve'), detail: t('common.sourceProgress.structuredRetrieveDetail') },
  { key: 'compile', label: t('common.sourceProgress.structuredCompile'), detail: t('common.sourceProgress.structuredCompileDetail') },
])

const importStageDefinitions = computed(() => [
  { key: 'prepare', label: t('common.sourceProgress.importPrepare'), detail: t('common.sourceProgress.importPrepareDetail') },
  { key: 'reader', label: t('common.sourceProgress.importReader'), detail: t('common.sourceProgress.importReaderDetail') },
  { key: 'original', label: t('common.sourceProgress.importOriginal'), detail: t('common.sourceProgress.importOriginalDetail') },
  { key: 'finish', label: t('common.sourceProgress.importFinish'), detail: t('common.sourceProgress.importFinishDetail') },
])

const currentStageIndex = computed(() => {
  if (sourceProgressStore.status === 'success') return stageCount.value
  if (sourceProgressStore.pipelineKind === 'pdf') {
    const keys = pdfStageDefinitions.value.map(stage => stage.key)
    if (sourceProgressStore.pdfStage === 'completed') return keys.length
    const index = keys.indexOf(sourceProgressStore.pdfStage || '')
    return Math.max(0, index)
  }
  if (sourceProgressStore.pipelineKind === 'structured') {
    return sourceProgressStore.progress >= 90 ? 2 : sourceProgressStore.progress >= 35 ? 1 : 0
  }
  return sourceProgressStore.progress >= 75 ? 3 : sourceProgressStore.progress >= 45 ? 2 : sourceProgressStore.progress >= 20 ? 1 : 0
})

const stageDefinitions = computed(() => sourceProgressStore.pipelineKind === 'pdf'
  ? pdfStageDefinitions.value
  : sourceProgressStore.pipelineKind === 'structured'
    ? structuredStageDefinitions.value
    : importStageDefinitions.value)

const activeStage = computed(() => {
  if (sourceProgressStore.pipelineKind === 'pdf') {
    return pdfStageDefinitions.value.find(stage => stage.key === sourceProgressStore.pdfStage)
      || pdfStageDefinitions.value[currentStageIndex.value]
  }
  return stageDefinitions.value[currentStageIndex.value]
})

const presentedStepText = computed(() => activeStage.value?.label || sourceProgressStore.stepText)
const presentedDetailText = computed(() => activeStage.value?.detail || sourceProgressStore.stageDetail)

const stages = computed<LongRunningTaskStage[]>(() => {
  return stageDefinitions.value.map((definition, index) => ({
    ...definition,
    activeDetail: definition.detail,
    state: sourceProgressStore.status === 'cancelled' && index === currentStageIndex.value
      ? 'failed'
      : index < currentStageIndex.value || sourceProgressStore.status === 'success'
        ? 'done'
        : index === currentStageIndex.value
          ? 'active'
          : 'pending',
  }))
})
</script>
