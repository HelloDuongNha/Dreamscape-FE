<template>
  <div class="message-toast-container" role="log" aria-live="polite">
    <!-- Dedicated pinned lane for Oracle notifications at the absolute top (Top 1) -->
    <div
      v-if="oracleStore.isPinnedVisible && oracleStore.trackedDream"
      class="oracle-pinned-toast"
      @click="handleOraclePinnedClick"
    >
      <div class="oracle-pinned-toast__header">
        <span class="oracle-pinned-toast__title">Oracle: {{ oracleTitle }}</span>
        <button
          class="oracle-pinned-toast__close"
          aria-label="Dismiss notification"
          @click.stop="oracleStore.stopTracking()"
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
      class="extraction-pinned-toast"
      @click="handleExtractionPinnedClick"
    >
      <div class="extraction-pinned-toast__header">
        <span class="extraction-pinned-toast__title">Phân tích: {{ extractionTitle }}</span>
        <button
          class="extraction-pinned-toast__close"
          aria-label="Dismiss notification"
          @click.stop="extractionStore.stopTracking()"
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
import { usePostStore }         from '@/store/usePostStore'
import { useExtractionStore }   from '@/store/useExtractionStore'
import MessageToast             from './MessageToast.vue'

const toastStore = useMessageToastStore()
const chatStore  = useChatStore()
const router     = useRouter()
const oracleStore = useOracleStore()
const postStore  = usePostStore()
const extractionStore = useExtractionStore()

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
  return `Oracle đang phân tích giấc mơ (${oracleStore.progress}%)...`
})

function handleOraclePinnedClick() {
  if (oracleStore.completedDream) {
    const dreamId = oracleStore.completedDream._id
    oracleStore.stopTracking()
    postStore.openPost(dreamId)
  } else if (oracleStore.failedDream) {
    oracleStore.stopTracking()
  } else {
    oracleStore.openDialog()
  }
}

const extractionTitle = computed(() => {
  if (extractionStore.status === 'success') {
    if (extractionStore.outcome === 'success_with_existing_candidates') {
      return 'Đã có luật tương tự'
    }
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
    if (extractionStore.outcome === 'success_with_existing_candidates') {
      return 'Không tạo bản mới vì các ứng viên tương tự đã tồn tại. Đã mở danh sách hiện có.'
    }
    let msg = `Đã trích xuất ${extractionStore.createdCount} ứng viên quy luật.`
    if (extractionStore.hasApproved) {
      msg += ' (Lưu ý: Tài liệu này đã đóng góp các quy luật được phê duyệt trước đó.)'
    }
    return msg
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
</style>
