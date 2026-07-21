<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="oracleStore.isDialogVisible && oracleStore.trackedDream"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Oracle đang phân tích giấc mơ"
        @click.self="oracleStore.minimizeDialog()"
        @keydown.esc="oracleStore.minimizeDialog()"
      >
        <div class="modal-container" tabindex="-1">
          <div class="modal-header">
            <span class="modal-title-text">Phân tích giấc mơ</span>
            <button
              class="modal-close-btn"
              aria-label="Ẩn tiến trình phân tích"
              @click="oracleStore.minimizeDialog()"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="modal-body-content">
            <div class="modal-dream-info">
              <h3>{{ isCompleted ? 'Oracle đã hoàn tất phân tích' : 'Oracle đang đọc toàn bộ mạch giấc mơ' }}</h3>
              <p>{{ dreamExcerpt }}</p>
            </div>

            <PipelineProgressPanel
              :progress="stageProgress"
              :step-text="oracleStore.statusMessage"
              :detail-text="stageDetail"
              :elapsed-seconds="oracleStore.elapsedSeconds"
              :processed-label="stageLabel"
              :estimated-remaining-seconds="null"
              :remaining-text="remainingText"
            />

            <ol class="oracle-stage-list" aria-label="Các bước phân tích">
              <li
                v-for="(item, index) in stages"
                :key="item.key"
                :class="{
                  'oracle-stage-list__item--done': index < currentStageIndex,
                  'oracle-stage-list__item--active': index === currentStageIndex,
                }"
              >
                <span class="oracle-stage-list__marker" aria-hidden="true">{{ index < currentStageIndex ? '✓' : index + 1 }}</span>
                <div>
                  <strong>{{ item.label }}</strong>
                  <p v-if="index < currentStageIndex && stageResult(item.key)" class="oracle-stage-list__result">
                    {{ stageResult(item.key) }}
                  </p>
                  <p v-else-if="index === currentStageIndex" class="oracle-stage-list__active-detail">
                    {{ currentMiniStep || item.detail }}
                    <span class="oracle-processing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                  </p>
                </div>
              </li>
            </ol>

            <button v-if="isCompleted" type="button" class="oracle-completed-action" @click="viewDreamPost">
              Xem bài viết
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOracleStore } from '@/store/useOracleStore'
import { usePostStore } from '@/store/usePostStore'
import PipelineProgressPanel from './PipelineProgressPanel.vue'

const oracleStore = useOracleStore()
const postStore = usePostStore()
const isCompleted = computed(() => oracleStore.trackedDream?.ai_status === 'completed')

const dreamExcerpt = computed(() => {
  const text = oracleStore.trackedDream?.content?.replace(/\s+/g, ' ').trim() || ''
  return text.length > 170 ? `${text.slice(0, 170)}…` : text
})

const stage = computed(() => oracleStore.trackedDream?.analysisMetadata?.currentStage || 'preparing')
const stages = [
  { key: 'preparing', label: 'Chuẩn bị lời kể và hồ sơ', detail: 'Tách nội dung giấc mơ, phản ứng khi tỉnh và bối cảnh đã cung cấp.' },
  { key: 'retrieving_context', label: 'Tìm chi tiết và trường hợp tương đồng', detail: 'Đối chiếu từ điển biểu tượng, các chi tiết trong lời kể và những giấc mơ trước.' },
  { key: 'retrieving_rules', label: 'Chọn tri thức có thể áp dụng', detail: 'Kiểm tra quy luật đã duyệt, nguồn tài liệu và phạm vi được phép suy luận.' },
  { key: 'generating_analysis', label: 'Tổng hợp các mạch diễn giải', detail: 'Mô hình viết từ phần dữ liệu đã chọn. Đây thường là bước lâu nhất và không có số token hoàn tất đáng tin cậy.' },
  { key: 'finalizing', label: 'Kiểm chứng và hoàn thiện', detail: 'Loại suy luận không có căn cứ, gắn nguồn và chuẩn hóa câu hỏi.' },
] as const
const stageOrder = stages.map(item => item.key)
const currentStageIndex = computed(() => {
  if (stage.value === 'completed') return stages.length
  const index = stageOrder.indexOf(stage.value as typeof stageOrder[number])
  return index >= 0 ? index : 0
})
const stageLabel = computed(() => {
  return currentStageIndex.value < stages.length
    ? `Bước ${currentStageIndex.value + 1}/${stages.length}`
    : 'Đã hoàn tất 5/5 bước'
})
const stageProgress = computed(() => stage.value === 'completed'
  ? 100
  : Math.max(8, Math.min(99, oracleStore.progress || oracleStore.trackedDream?.analysisMetadata?.progress || 8)))
const currentMiniStep = computed(() => oracleStore.trackedDream?.analysisMetadata?.currentMiniStep || '')
const stageResult = (key: typeof stages[number]['key']) => {
  const recorded = oracleStore.trackedDream?.analysisMetadata?.stageResults?.[key]
  if (recorded) return recorded
  if (!isCompleted.value) return ''
  if (key === 'finalizing') return 'Đã loại các liên hệ không đủ căn cứ, gắn nguồn và chuẩn hóa câu hỏi xác nhận.'
  return ''
}
const remainingText = computed(() => stage.value === 'generating_analysis'
  ? 'Đang nhận kết quả từ mô hình · không giả lập thời gian còn lại'
  : 'Tiến độ được tính theo bước đã hoàn tất')
const stageDetail = computed(() => ({
  preparing: 'Tách lời kể, cảm xúc lúc tỉnh và thông tin bối cảnh.',
  retrieving_context: 'Đối chiếu mô-típ cá nhân và các giấc mơ có nét tương đồng.',
  retrieving_rules: 'Chọn kết luận phù hợp rồi kiểm tra nguồn và trích dẫn gốc.',
  generating_analysis: 'Mô hình đang viết kết quả từ phần dữ liệu đã được chọn.',
  finalizing: 'Loại suy luận không có căn cứ và gắn nguồn cho từng nhận định.',
  completed: 'Kết quả đã sẵn sàng.',
}[stage.value] || 'Oracle vẫn đang xử lý; tiến trình không bị ngắt khi bạn ẩn cửa sổ.'))

function viewDreamPost() {
  const dreamId = oracleStore.trackedDream?._id
  if (!dreamId) return
  oracleStore.stopTracking()
  void postStore.openPost(dreamId)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 300);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, .82);
}

.modal-container {
  width: 540px;
  max-width: calc(100vw - 32px);
  overflow: hidden;
  border: 1px solid #262626;
  border-radius: var(--radius-xl);
  outline: none;
  background: #181818;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid #262626;
}

.modal-title-text {
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.modal-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
}

.modal-close-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

.modal-body-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
}

.modal-dream-info {
  padding-bottom: var(--space-4);
  border-bottom: 1px solid #262626;
}

.modal-dream-info h3 {
  margin: 0 0 6px;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  line-height: 1.4;
}

.modal-dream-info p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.oracle-stage-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.oracle-stage-list li {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 10px;
  align-items: start;
  padding: 7px 9px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
}
.oracle-stage-list__marker {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid #343434;
  border-radius: 50%;
  font-size: 11px;
}
.oracle-stage-list strong { font-size: 12px; font-weight: 600; }
.oracle-stage-list p { margin: 3px 0 0; font-size: 11px; line-height: 1.45; }
.oracle-stage-list__result { color: #aeb8b2; }
.oracle-stage-list__item--done { color: #91bca7 !important; }
.oracle-stage-list__item--active {
  color: var(--color-text-primary) !important;
  background: rgba(103, 111, 180, .09);
}
.oracle-stage-list__item--active .oracle-stage-list__marker {
  border-color: #6671b8;
  color: #c3c8f0;
  box-shadow: 0 0 0 3px rgba(102, 113, 184, .09);
  animation: oracle-marker-pulse 1.6s ease-in-out infinite;
}
.oracle-stage-list__active-detail { color: #c7cadb; }
.oracle-processing-dots { display: inline-flex; gap: 3px; margin-left: 5px; vertical-align: 2px; }
.oracle-processing-dots i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #929bd1;
  animation: oracle-dot 1.15s ease-in-out infinite;
}
.oracle-processing-dots i:nth-child(2) { animation-delay: .16s; }
.oracle-processing-dots i:nth-child(3) { animation-delay: .32s; }
@keyframes oracle-dot {
  0%, 70%, 100% { opacity: .25; transform: translateY(0); }
  35% { opacity: 1; transform: translateY(-2px); }
}
@keyframes oracle-marker-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(102, 113, 184, .09); }
  50% { box-shadow: 0 0 0 6px rgba(102, 113, 184, .04); }
}

.oracle-completed-action {
  width: 100%;
  min-height: 42px;
  border: 1px solid #6671b8;
  border-radius: var(--radius-md);
  background: #5964a8;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.oracle-completed-action:hover {
  background: #6570b7;
}

.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity .2s ease; }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }
</style>
