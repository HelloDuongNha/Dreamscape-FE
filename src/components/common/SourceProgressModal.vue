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

const activePdfStage = computed(() => {
  if (sourceProgressStore.pipelineKind !== 'pdf') return null
  return pdfStageDefinitions.value.find(stage => stage.key === sourceProgressStore.pdfStage) || null
})

const presentedStepText = computed(() => activePdfStage.value?.label || sourceProgressStore.stepText)
const presentedDetailText = computed(() => activePdfStage.value?.detail || sourceProgressStore.stageDetail)

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

const stages = computed<LongRunningTaskStage[]>(() => {
  const definitions = sourceProgressStore.pipelineKind === 'pdf'
    ? pdfStageDefinitions.value
    : sourceProgressStore.pipelineKind === 'structured'
      ? [
          { key: 'prepare', label: 'Kiểm tra định danh và quyền truy cập', detail: 'Xác định DOI, URL và phạm vi nội dung được phép nhập.' },
          { key: 'retrieve', label: 'Lấy nội dung có cấu trúc', detail: 'Ưu tiên JATS/XML và HTML để giữ heading, bảng, hình và thứ tự đọc.' },
          { key: 'compile', label: 'Kiểm tra và dựng Bản đọc', detail: 'Chỉ nội dung hợp lệ được ghi vào Bản đọc thông minh.' },
        ]
      : [
          { key: 'prepare', label: 'Tiếp nhận nguồn', detail: 'Kiểm tra dữ liệu đầu vào và quyền truy cập.' },
          { key: 'reader', label: 'Nhập Bản đọc thông minh', detail: 'Ưu tiên nguồn có cấu trúc trước khi dùng PDF.' },
          { key: 'original', label: 'Lưu tài liệu gốc', detail: 'Chỉ lưu PDF từ nguồn hợp pháp hoặc tệp đã được tải lên.' },
          { key: 'finish', label: 'Hoàn thiện dữ liệu', detail: 'Đồng bộ định danh, trạng thái đọc và thông tin xem trước.' },
        ]
  return definitions.map((definition, index) => ({
    ...definition,
    activeDetail: index === currentStageIndex.value
      ? (sourceProgressStore.pipelineKind === 'pdf' ? definition.detail : sourceProgressStore.stageDetail)
      : definition.detail,
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
