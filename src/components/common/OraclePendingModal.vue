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
    :step-text="oracleStore.statusMessage"
    :detail-text="stageDetail"
    :elapsed-seconds="oracleStore.elapsedSeconds"
    :processed-label="stageLabel"
    :estimated-remaining-seconds="estimatedRemainingSeconds"
    :remaining-text="isCancelled ? t('common.longTask.cancelled') : ''"
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
    <template v-if="isCompleted || isCancelled" #actions>
      <AppButton v-if="isCancelled" type="button" variant="primary" size="sm" @click="oracleStore.retryAnalysis()">
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
const { t } = useI18n({ useScope: 'global' })

const isCompleted = computed(() => oracleStore.trackedDream?.ai_status === 'completed')
const isCancelled = computed(() => oracleStore.trackedDream?.ai_status === 'cancelled')
const isPending = computed(() => oracleStore.trackedDream?.ai_status === 'pending')
const isTerminal = computed(() => isCompleted.value || isCancelled.value || oracleStore.trackedDream?.ai_status === 'failed')
const subject = computed(() => isCompleted.value
  ? t('common.dreamProgress.completedSubject')
  : isCancelled.value
    ? t('common.dreamProgress.cancelledSubject')
    : t('common.dreamProgress.runningSubject'))

const dreamExcerpt = computed(() => {
  const text = oracleStore.trackedDream?.content?.replace(/\s+/g, ' ').trim() || ''
  return text.length > 170 ? `${text.slice(0, 170)}…` : text
})

const stage = computed(() => oracleStore.trackedDream?.analysisMetadata?.currentStage || 'preparing')
const stages = [
  { key: 'preparing', label: 'Chuẩn bị lời kể và hồ sơ', detail: 'Tách nội dung giấc mơ, phản ứng khi tỉnh và bối cảnh đã cung cấp.' },
  { key: 'retrieving_context', label: 'Tìm chi tiết và trường hợp tương đồng', detail: 'Đối chiếu từ điển, chi tiết trong lời kể và những giấc mơ trước.' },
  { key: 'retrieving_rules', label: 'Chọn tri thức có thể áp dụng', detail: 'Kiểm tra lập luận đã duyệt, nguồn tài liệu và phạm vi được phép suy luận.' },
  { key: 'generating_analysis', label: 'Tổng hợp các mạch diễn giải', detail: 'Mô hình viết từ phần dữ liệu và bằng chứng đã chọn.' },
  { key: 'finalizing', label: 'Kiểm chứng và hoàn thiện', detail: 'Loại suy luận không có căn cứ, gắn nguồn và chuẩn hóa câu hỏi.' },
] as const
const stageOrder = stages.map(item => item.key)
const currentStageIndex = computed(() => {
  if (isCompleted.value) return stages.length
  const index = stageOrder.indexOf(stage.value as typeof stageOrder[number])
  return index >= 0 ? index : 0
})
const currentMiniStep = computed(() => oracleStore.trackedDream?.analysisMetadata?.currentMiniStep || '')
const renderedStages = computed<LongRunningTaskStage[]>(() => stages.map((item, index) => ({
  ...item,
  activeDetail: currentMiniStep.value || item.detail,
  result: oracleStore.trackedDream?.analysisMetadata?.stageResults?.[item.key],
  state: index < currentStageIndex.value || isCompleted.value
    ? 'done'
    : index === currentStageIndex.value
      ? (isCancelled.value ? 'failed' : 'active')
      : 'pending',
})))
const stageLabel = computed(() => currentStageIndex.value < stages.length
  ? `Bước ${currentStageIndex.value + 1}/${stages.length}`
  : `Đã hoàn tất ${stages.length}/${stages.length} bước`)
const stageProgress = computed(() => isCompleted.value
  ? 100
  : Math.max(0, Math.min(99, oracleStore.progress || oracleStore.trackedDream?.analysisMetadata?.progress || 0)))
const estimatedRemainingSeconds = computed(() => {
  if (!isPending.value) return null
  const estimate = oracleStore.trackedDream?.analysisMetadata?.estimatedDurationSeconds
  return typeof estimate === 'number' ? estimate - oracleStore.elapsedSeconds : null
})
const timingDeltaSeconds = computed(() => oracleStore.trackedDream?.analysisMetadata?.timingDeltaSeconds ?? null)
const stageDetail = computed(() => isCancelled.value
  ? t('common.dreamProgress.cancelled')
  : ({
      preparing: 'Tách lời kể, cảm xúc lúc tỉnh và thông tin bối cảnh.',
      retrieving_context: 'Đối chiếu mô-típ cá nhân và các giấc mơ có nét tương đồng.',
      retrieving_rules: 'Chọn kết luận phù hợp rồi kiểm tra nguồn và trích dẫn gốc.',
      generating_analysis: 'Mô hình đang viết kết quả từ phần dữ liệu đã được chọn.',
      finalizing: 'Loại suy luận không có căn cứ và gắn nguồn cho từng nhận định.',
      completed: t('common.dreamProgress.completed'),
    }[stage.value] || 'Oracle vẫn đang xử lý; tiến trình không bị ngắt khi bạn ẩn cửa sổ.'))

function viewDreamPost() {
  const dreamId = oracleStore.trackedDream?._id
  if (!dreamId) return
  oracleStore.stopTracking()
  void postStore.openPost(dreamId)
}
</script>
