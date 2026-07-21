<template>
  <div class="message-toast-container" role="log" aria-live="polite">
    <!-- Dedicated pinned lane for Oracle notifications at the absolute top (Top 1) -->
    <div
      v-if="oracleStore.isPinnedVisible && oracleStore.trackedDream"
      :class="['oracle-pinned-toast', { 'oracle-pinned-toast--terminal': oracleStore.completedDream || oracleStore.failedDream }]"
      @click="handleOraclePinnedClick"
    >
      <div class="oracle-pinned-toast__header">
        <span class="oracle-pinned-toast__title">Oracle: {{ oracleTitle }}</span>
        <button
          class="oracle-pinned-toast__close"
          aria-label="Dismiss notification"
          @click.stop="oracleStore.dismissPinned()"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <p class="oracle-pinned-toast__body">{{ oracleMessage }}</p>

      <!-- Progress Bar (only shown when pending) -->
      <div v-if="oracleStore.trackedDream.ai_status === 'pending' && !oracleStore.completedDream && !oracleStore.failedDream" class="oracle-pinned-toast__progress-bar-bg">
        <div class="oracle-pinned-toast__progress-bar-fill" :style="{ width: `${oracleStore.progress}%` }"></div>
      </div>
    </div>

    <!-- Dedicated pinned lane for Extraction notifications (Top 2) -->
    <div
      v-if="extractionStore.isPinnedVisible && extractionStore.sourceId"
      :class="['extraction-pinned-toast', { 'pinned-toast--terminal': extractionStore.status !== 'pending' }]"
      @click="handleExtractionPinnedClick"
    >
      <div class="extraction-pinned-toast__header">
        <span class="extraction-pinned-toast__title">Phân tích: {{ extractionTitle }}</span>
        <button
          class="extraction-pinned-toast__close"
          aria-label="Dismiss notification"
          @click.stop="extractionStore.dismissPinned()"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <p class="extraction-pinned-toast__body">{{ extractionMessage }}</p>

      <!-- Progress Bar (only shown when pending) -->
      <div v-if="extractionStore.status === 'pending'" class="extraction-pinned-toast__progress-bar-bg">
        <div class="extraction-pinned-toast__progress-bar-fill" :style="{ width: `${extractionStore.progress}%` }"></div>
      </div>
    </div>

    <!-- Dedicated pinned lane for Source Pipeline notifications (Top 3) -->
    <div
      v-if="sourceProgressStore.isPinnedVisible && sourceProgressStore.contributionId"
      :class="['source-pinned-toast', { 'pinned-toast--terminal': sourceProgressStore.status !== 'pending' }]"
      @click="handleSourcePinnedClick"
    >
      <div class="source-pinned-toast__header">
        <span class="source-pinned-toast__title">Nguồn: {{ sourceTitle }}</span>
        <button
          class="source-pinned-toast__close"
          aria-label="Dismiss notification"
          @click.stop="sourceProgressStore.dismissPinned()"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <p class="source-pinned-toast__body" style="white-space: pre-line;">{{ sourceMessage }}</p>

      <!-- Progress Bar (only shown when pending) -->
      <div v-if="sourceProgressStore.status === 'pending'" class="source-pinned-toast__progress-bar-bg">
        <div class="source-pinned-toast__progress-bar-fill" :style="{ width: `${sourceProgressStore.progress}%` }"></div>
      </div>
    </div>

    <div
      v-for="(job, index) in academicQueue.queuedJobs"
      :key="job.id"
      class="source-pinned-toast academic-queue-toast"
    >
      <div class="source-pinned-toast__header">
        <span class="source-pinned-toast__title">Đang chờ #{{ index + 1 }}</span>
      </div>
      <p class="source-pinned-toast__body">
        {{ queueKindLabel(job.kind) }} · {{ job.title }}
      </p>
      <p class="academic-queue-toast__hint">Sẽ tự chạy khi tác vụ phía trước hoàn tất.</p>
    </div>

    <TransitionGroup name="stack-list" tag="div" class="stack-list-wrapper">
      <div
        v-for="stack in toastStore.activeStacks"
        :key="stack.conversationId"
        class="toast-stack"
        :style="{ height: getStackHeight(stack.messages.length) }"
      >
        <TransitionGroup name="card-pile">
          <MessageToast
            v-for="(msg, index) in stack.messages"
            :key="msg.id"
            :message="msg"
            :index="index"
            :total="stack.messages.length"
            @click="handleToastClick(stack.conversationId)"
            @dismiss="toastStore.dismissStack(stack.conversationId)"
          />
        </TransitionGroup>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMessageToastStore } from '@/store/useMessageToastStore'
import { useRouter }            from 'vue-router'
import { useChatStore }         from '@/store/useChatStore'
import { useOracleStore }       from '@/store/useOracleStore'
import { useExtractionStore }   from '@/store/useExtractionStore'
import { useSourceProgressStore } from '@/store/useSourceProgressStore'
import { useAcademicJobQueueStore } from '@/store/useAcademicJobQueueStore'
import MessageToast             from './MessageToast.vue'

const toastStore = useMessageToastStore()
const chatStore  = useChatStore()
const router     = useRouter()
const oracleStore = useOracleStore()
const extractionStore = useExtractionStore()
const sourceProgressStore = useSourceProgressStore()
const academicQueue = useAcademicJobQueueStore()

function queueKindLabel(kind: string) {
  if (kind === 'pdf') return 'Dựng bản đọc từ PDF'
  if (kind === 'structured') return 'Nhập lại từ DOI / HTML / XML'
  if (kind === 'rules') return 'Phân tích luật'
  return 'Xử lý nguồn'
}

const sourceTitle = computed(() => {
  if (sourceProgressStore.status === 'success') return 'Hoàn thành'
  if (sourceProgressStore.status === 'failed') return 'Thất bại'
  return 'Đang tiền xử lý...'
})

const sourceMessage = computed(() => {
  if (sourceProgressStore.status === 'pending') {
    return `${sourceProgressStore.stepText} (${sourceProgressStore.progress}%)`
  }

  if (sourceProgressStore.pipelineKind === 'structured') {
    if (sourceProgressStore.status === 'success') {
      const sourceMap: Record<string, string> = {
        jats: 'JATS/XML',
        html: 'HTML',
        pdf_text: 'PDF',
        docling_pdf: 'Docling PDF',
        none: 'Nguồn có cấu trúc'
      }
      const sourceMsg = sourceMap[sourceProgressStore.selectedSource] || 'Nguồn có cấu trúc'
      return `Nhập lại bản đọc hoàn tất.\n• Bản đọc thông minh: Thành công\n• Nguồn bản đọc: ${sourceMsg}`
    }

    if (sourceProgressStore.status === 'failed') {
      return `Nhập lại bản đọc thất bại.\n• Bản đọc thông minh: Không tạo được\n• Chi tiết: ${sourceProgressStore.stepText}`
    }
  }

  if (
    sourceProgressStore.pipelineKind === 'pdf' &&
    sourceProgressStore.status === 'failed' &&
    sourceProgressStore.pdfResult === 'success'
  ) {
    if (sourceProgressStore.smartReaderResult === 'ocr_needed') {
      return `Xử lý tài liệu PDF hoàn tất.\n• PDF gốc: Đã lưu\n• Bản đọc thông minh: Cần OCR`
    }
    return `Xử lý tài liệu PDF hoàn tất.\n• PDF gốc: Đã lưu\n• Bản đọc thông minh: Không tạo được\n• Chi tiết: ${sourceProgressStore.stepText}`
  }

  if (sourceProgressStore.status === 'success') {
    if (
      sourceProgressStore.pipelineKind === 'pdf' &&
      sourceProgressStore.selectedSource &&
      sourceProgressStore.selectedSource !== 'none'
    ) {
      let readerMsg = 'Thành công'
      if (sourceProgressStore.smartReaderResult === 'ocr_needed') {
        readerMsg = 'Cần OCR'
      } else if (sourceProgressStore.smartReaderResult === 'failed') {
        readerMsg = 'Không tạo được'
      }

      const sourceMap: Record<string, string> = {
        jats: 'JATS/XML',
        html: 'HTML',
        pdf_text: 'PDF parser',
        docling_pdf: 'Docling PDF',
        none: 'Không có'
      }
      let sourceMsg = sourceMap[sourceProgressStore.selectedSource] || 'Không xác định'

      let idMsg = ''
      const ids = (sourceProgressStore.detectedIdentifiers as any) || {}
      if (ids.doi || ids.isbn || ids.pmcid) {
        const found = []
        if (ids.doi) found.push(`DOI: ${ids.doi}`)
        if (ids.isbn) found.push(`ISBN: ${ids.isbn}`)
        if (ids.pmcid) found.push(`PMCID: ${ids.pmcid}`)
        idMsg = `\n• Định danh: ${found.join(', ')}`
      }

      return `Xử lý tài liệu PDF hoàn tất.\n• PDF gốc: Đã lưu\n• Bản đọc thông minh: ${readerMsg}\n• Nguồn bản đọc: ${sourceMsg}${idMsg}`
    }

    let readerMsg = sourceProgressStore.smartReaderResult === 'success'
      ? 'Thành công'
      : (sourceProgressStore.smartReaderResult === 'failed' ? 'Không nhập được' : 'Bị giới hạn nguồn')
    
    const pdfMap: Record<string, string> = {
      success: 'Đã lưu Cloudinary',
      blocked: 'Bị chặn bởi nguồn',
      external_only: 'Có link ngoài — không lưu tự động',
      no_candidate: 'Không có PDF online',
      failed: 'Không lưu được',
      none: 'Không có PDF online'
    }
    let pdfMsg = pdfMap[sourceProgressStore.pdfResult] || 'Không xác định'
    
    return `Nguồn đã được gửi vào hàng chờ duyệt.\n• Bản đọc thông minh: ${readerMsg}\n• PDF gốc online: ${pdfMsg}`
  }
  return `${sourceProgressStore.stepText} (${sourceProgressStore.progress}%)`
})

function handleSourcePinnedClick() {
  if (sourceProgressStore.status === 'success' || sourceProgressStore.status === 'failed') {
    sourceProgressStore.stopTracking()
  } else {
    sourceProgressStore.openDialog()
  }
}

const oracleTitle = computed(() => {
  if (oracleStore.completedDream) return 'Hoàn thành'
  if (oracleStore.failedDream) return 'Thất bại'
  return 'Phân tích...'
})

const oracleMessage = computed(() => {
  if (oracleStore.completedDream) {
    return 'Oracle đã phân tích xong giấc mơ.'
  }
  if (oracleStore.failedDream) {
    return 'Oracle chưa thể phân tích giấc mơ này. Vui lòng thử lại sau.'
  }
  const minutes = Math.floor(oracleStore.elapsedSeconds / 60)
  const seconds = oracleStore.elapsedSeconds % 60
  const elapsed = minutes > 0 ? `${minutes} phút ${seconds} giây` : `${seconds} giây`
  return `${oracleStore.statusMessage} · ${oracleStore.progress}% · đã chạy ${elapsed}`
})

function handleOraclePinnedClick() {
  if (oracleStore.completedDream) {
    oracleStore.openDialog()
  } else if (oracleStore.failedDream) {
    oracleStore.stopTracking()
  } else {
    oracleStore.openDialog()
  }
}

const extractionTitle = computed(() => {
  if (extractionStore.status === 'success') {
    if (extractionStore.outcome === 'success_with_existing_candidates') {
      return 'Kết quả Rule V3 đã có sẵn'
    }
    if (extractionStore.outcome === 'success_no_verified_candidates') return 'Không có candidate đạt kiểm chứng'
    return 'Phân tích hoàn thành'
  }
  if (extractionStore.status === 'stopped') {
    if (extractionStore.outcome === 'stopped_domain_irrelevant') return 'Tài liệu không phù hợp'
    if (extractionStore.outcome === 'stopped_no_eligible_chunks') return 'Chưa có dữ liệu học thuật hợp lệ'
    if (extractionStore.outcome === 'stopped_llm_returned_zero') return 'Chưa rút ra được luật rõ ràng'
    if (extractionStore.outcome === 'stopped_all_weak_evidence') return 'Bằng chứng chưa đủ mạnh'
    if (extractionStore.outcome === 'stopped_all_duplicate') return 'Không có luật mới'
    return 'Tài liệu không phù hợp'
  }
  if (extractionStore.status === 'failed') return 'Thất bại'
  return 'Đang chạy'
})

const extractionMessage = computed(() => {
  if (extractionStore.status === 'success') {
    return extractionStore.message || 'Hoàn tất phân tích Rule V3.'
  }
  if (extractionStore.status === 'stopped') {
    if (extractionStore.outcome === 'stopped_domain_irrelevant') {
      return 'Tài liệu này không thuộc phạm vi giấc mơ, giấc ngủ hoặc tâm lý học nên hệ thống không tạo luật từ tài liệu này.'
    }
    if (extractionStore.outcome === 'stopped_no_eligible_chunks') {
      return 'Không tạo được luật vì chưa có chunk học thuật hợp lệ.'
    }
    if (extractionStore.outcome === 'stopped_llm_returned_zero') {
      return 'LLM không rút ra được kết luận đủ rõ từ tài liệu này.'
    }
    if (extractionStore.outcome === 'stopped_all_weak_evidence') {
      return 'Các kết luận bị loại vì không có đoạn bằng chứng đủ rõ.'
    }
    if (extractionStore.outcome === 'stopped_all_duplicate') {
      return 'Các luật tương tự đã tồn tại, không tạo bản trùng.'
    }
    return extractionStore.message || 'Phân tích dừng lại.'
  }
  if (extractionStore.status === 'failed') {
    return extractionStore.errorMessage || 'Phân tích tài liệu thất bại.'
  }
  return `${extractionStore.stepText} (${extractionStore.progress}%)`
})

function handleExtractionPinnedClick() {
  if (extractionStore.status === 'success') {
    const sId = extractionStore.sourceId
    extractionStore.stopTracking()
    router.push({
      path: '/moderation/rule-candidates',
      query: { sourceId: sId }
    })
  } else if (extractionStore.status === 'stopped' || extractionStore.status === 'failed') {
    extractionStore.stopTracking()
  } else {
    extractionStore.openDialog()
  }
}

function getStackHeight(count: number): string {
  const baseHeight = 72
  const offset = (count - 1) * 8
  return `${baseHeight + offset}px`
}

async function handleToastClick(conversationId: string) {
  // Dismiss this conversation's stack
  toastStore.dismissStack(conversationId)
  // Activate conversation in store
  await chatStore.openConversation(conversationId)
  // Route to messages
  router.push('/messages')
}
</script>

<style scoped>
.message-toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  width: 320px;
  display: flex;
  flex-direction: column;
  pointer-events: none; /* Let clicks pass through gaps */
}

/* Pinned Oracle toast styling */
.oracle-pinned-toast {
  position: relative;
  overflow: hidden;
  width: 100%;
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin-bottom: 12px; /* space before normal message toasts */
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  pointer-events: auto;
  box-sizing: border-box;
  box-shadow: none;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.oracle-pinned-toast--terminal::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: #6e8cff;
  animation: oracle-terminal-drain 3s linear forwards;
}

.extraction-pinned-toast.pinned-toast--terminal,
.source-pinned-toast.pinned-toast--terminal {
  position: relative;
  overflow: hidden;
}

.pinned-toast--terminal::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: #6e8cff;
  animation: oracle-terminal-drain 3s linear forwards;
}

@keyframes oracle-terminal-drain {
  from { width: 100%; }
  to { width: 0; }
}

.oracle-pinned-toast:hover {
  border-color: #3e3e3e;
  background: var(--color-bg-hover);
}

.oracle-pinned-toast__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.oracle-pinned-toast__title {
  font-size: 11px;
  font-weight: 700;
  color: #3b82f6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.oracle-pinned-toast__body {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-normal);
}

.oracle-pinned-toast__progress-bar-bg {
  width: 100%;
  height: 4px;
  background: #262626;
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: 2px;
}

.oracle-pinned-toast__progress-bar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.oracle-pinned-toast__close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.oracle-pinned-toast__close:hover {
  opacity: 1;
  color: var(--color-text-primary);
}

/* Pinned Extraction toast styling */
.extraction-pinned-toast {
  width: 100%;
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin-bottom: 12px; /* space before normal message toasts */
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  pointer-events: auto;
  box-sizing: border-box;
  box-shadow: none;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.extraction-pinned-toast:hover {
  border-color: #3e3e3e;
  background: var(--color-bg-hover);
}

.extraction-pinned-toast__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.extraction-pinned-toast__title {
  font-size: 11px;
  font-weight: 700;
  color: #3b82f6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.extraction-pinned-toast__body {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-normal);
}

.extraction-pinned-toast__progress-bar-bg {
  width: 100%;
  height: 4px;
  background: #262626;
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: 2px;
}

.extraction-pinned-toast__progress-bar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.extraction-pinned-toast__close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.extraction-pinned-toast__close:hover {
  opacity: 1;
  color: var(--color-text-primary);
}

.stack-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px; /* spacing between different stacks */
}

.toast-stack {
  position: relative;
  width: 100%;
  pointer-events: auto; /* enable click interactions on the stack card area */
  transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Transitions for stacks shifting vertically when another conversation arrives/leaves */
.stack-list-enter-active,
.stack-list-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.stack-list-enter-from {
  opacity: 0;
  transform: translateX(100px);
}
.stack-list-leave-to {
  opacity: 0;
  transform: translateX(100px);
}
.stack-list-move {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Transitions for cards piled up within a stack */
.card-pile-enter-active,
.card-pile-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.card-pile-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}
.card-pile-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
/* Pinned Source toast styling */
.source-pinned-toast {
  width: 100%;
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  pointer-events: auto;
  box-sizing: border-box;
  box-shadow: none;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.source-pinned-toast:hover {
  border-color: #3e3e3e;
  background: var(--color-bg-hover);
}

.source-pinned-toast__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.source-pinned-toast__title {
  font-size: 11px;
  font-weight: 700;
  color: #10b981;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.source-pinned-toast__body {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
  line-height: var(--line-height-normal);
}

.source-pinned-toast__progress-bar-bg {
  width: 100%;
  height: 4px;
  background: #262626;
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-top: 2px;
}

.source-pinned-toast__progress-bar-fill {
  height: 100%;
  background: #10b981;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.source-pinned-toast__close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.source-pinned-toast__close:hover {
  opacity: 1;
  color: var(--color-text-primary);
}

.academic-queue-toast {
  cursor: default;
  border-style: dashed;
  background: #151515;
}

.academic-queue-toast .source-pinned-toast__title {
  color: #94a3b8;
}

.academic-queue-toast__hint {
  margin: 0;
  color: #737373;
  font-size: 10px;
}
</style>
