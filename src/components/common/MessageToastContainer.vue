<template>
  <div class="message-toast-container" role="log" aria-live="polite">
    <TransitionGroup
      name="pinned-task-list"
      tag="div"
      class="pinned-task-lane"
    >
      <PinnedTaskToast
        v-if="showOracleChatRun"
        key="oracle-chat-run"
        kind="oracle-chat"
        title="Oracle"
        :message="oracleChatStore.backgroundRun ? oracleRunMessage : t('oracle.backgroundCompleted')"
        :progress="oracleChatStore.backgroundRun ? oracleRunProgress : 100"
        :terminal="Boolean(oracleChatStore.completedRun)"
        @open="openOracleChatRun"
      />

      <PinnedTaskToast
        v-for="entry in dreamPinnedTasks"
        :key="`${entry.kind}-${entry.task.dreamId}`"
        kind="dream-analysis"
        :title="dreamPinnedTitle(entry)"
        :message="dreamPinnedMessage(entry)"
        :progress="entry.task.status === 'pending' ? entry.task.progress : 100"
        :terminal="entry.task.status !== 'pending'"
        @open="openDreamPinnedTask(entry)"
      />

      <PinnedTaskToast
        v-if="extractionStore.isPinnedVisible && extractionStore.sourceId"
        key="rule-analysis-run"
        kind="rule-analysis"
        :title="`Phân tích Rule: ${extractionTitle}`"
        :message="extractionMessage"
        :progress="extractionStore.status === 'pending' ? extractionStore.progress : 100"
        :terminal="extractionStore.status !== 'pending'"
        @open="handleExtractionPinnedClick"
      />

      <PinnedTaskToast
        v-if="sourceProgressStore.isPinnedVisible && sourceProgressStore.contributionId"
        key="source-import-run"
        kind="source-import"
        :title="`${t('common.sourceProgress.pin.prefix')}: ${sourceTitle}`"
        :message="sourceMessage"
        :progress="sourceProgressStore.status === 'pending' ? sourceProgressStore.progress : 100"
        :terminal="sourceProgressStore.status !== 'pending'"
        preserve-lines
        @open="handleSourcePinnedClick"
      />

      <PinnedTaskToast
        v-for="(job, index) in academicQueue.queuedJobs"
        :key="job.id"
        kind="queue"
        :title="`Đang chờ #${index + 1}`"
        :message="`${queueKindLabel(job.kind)} · ${job.title}`"
        hint="Sẽ tự chạy khi tác vụ phía trước hoàn tất."
        @open="openQueuedJob(job)"
      />
    </TransitionGroup>

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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessageToastStore } from '@/store/useMessageToastStore'
import { useRouter }            from 'vue-router'
import { useChatStore }         from '@/store/useChatStore'
import { useOracleStore }       from '@/store/useOracleStore'
import { useExtractionStore }   from '@/store/useExtractionStore'
import { useSourceProgressStore } from '@/store/useSourceProgressStore'
import { useAcademicJobQueueStore } from '@/store/useAcademicJobQueueStore'
import MessageToast             from './MessageToast.vue'
import PinnedTaskToast from './PinnedTaskToast.vue'
import { useOracleChatStore } from '@/store/useOracleChatStore'
import type { DreamAnalysisTask } from '@/store/useOracleStore'
import { useDreamContinuationStore, type DreamContinuationTask } from '@/store/useDreamContinuationStore'
import { usePostStore } from '@/store/usePostStore'

const toastStore = useMessageToastStore()
const chatStore  = useChatStore()
const router     = useRouter()
const oracleStore = useOracleStore()
const extractionStore = useExtractionStore()
const sourceProgressStore = useSourceProgressStore()
const academicQueue = useAcademicJobQueueStore()
const oracleChatStore = useOracleChatStore()
const continuationStore = useDreamContinuationStore()
const { t } = useI18n()
const oracleClock = ref(Date.now())
let oracleClockTimer: ReturnType<typeof setInterval> | null = null

type DreamPinnedEntry =
  | { kind: 'dream-analysis'; task: DreamAnalysisTask }
  | { kind: 'dream-continuation'; task: DreamContinuationTask }

function isQueuedDreamEntry(entry: DreamPinnedEntry) {
  return entry.kind === 'dream-analysis'
    ? entry.task.dream.analysisMetadata?.currentStage === 'queued'
    : entry.task.dream.continuationMetadata?.status === 'queued'
}

const dreamPinnedTasks = computed<DreamPinnedEntry[]>(() => [
  ...oracleStore.pinnedTasks.map(task => ({ kind: 'dream-analysis' as const, task })),
  ...continuationStore.pinnedTasks.map(task => ({ kind: 'dream-continuation' as const, task })),
].sort((left, right) => {
  const queueOrder = Number(isQueuedDreamEntry(left)) - Number(isQueuedDreamEntry(right))
  return queueOrder || left.task.createdAt - right.task.createdAt
}))

function syncOracleClock(active: boolean) {
  if (active && !oracleClockTimer) {
    oracleClock.value = Date.now()
    oracleClockTimer = setInterval(() => { oracleClock.value = Date.now() }, 1000)
    return
  }
  if (!active && oracleClockTimer) {
    clearInterval(oracleClockTimer)
    oracleClockTimer = null
  }
}
const showOracleChatRun = computed(
  () => router.currentRoute.value.path !== '/oracle'
    && Boolean(oracleChatStore.backgroundRun || oracleChatStore.completedRun),
)
const oracleRunProgress = computed(() => {
  const run = oracleChatStore.backgroundRun
  if (!run) return 100
  const elapsed = Math.max(0, oracleClock.value - new Date(run.startedAt).getTime())
  const expected = Number(run.expectedMaxMs) || 0
  if (!expected) {
    return Math.min(92, Math.max(0, Math.round(18 * Math.log1p(elapsed / 30_000))))
  }
  if (elapsed <= expected) {
    return Math.min(90, Math.max(0, Math.round(90 * Math.pow(elapsed / expected, 0.82))))
  }
  const overrun = elapsed - expected
  const tail = 9 * (1 - Math.exp(-overrun / Math.max(60_000, expected * 0.65)))
  return Math.min(99, Math.max(90, Math.round(90 + tail)))
})

function compactDuration(ms: number): string {
  const seconds = ms > 0 ? Math.max(1, Math.round(ms / 1000)) : 0
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

const oracleRunMessage = computed(() => {
  const run = oracleChatStore.backgroundRun
  if (!run) return t('oracle.backgroundCompleted')
  const elapsed = Math.max(0, oracleClock.value - new Date(run.startedAt).getTime())
  if (run.stage === 'preparing') {
    const stageStartedAt = run.stageStartedAt
      ? new Date(run.stageStartedAt).getTime()
      : oracleClock.value
    const thought = Math.max(0, stageStartedAt - new Date(run.startedAt).getTime())
    const preparing = Math.max(0, oracleClock.value - stageStartedAt)
    if (!run.expectedMaxMs) {
      return t('oracle.backgroundPreparing', { elapsed: compactDuration(elapsed) })
    }
    if (run.expectedMaxMs && elapsed >= run.expectedMaxMs) {
      return t('oracle.backgroundPreparingOverExpected', {
        thought: compactDuration(thought),
        preparing: compactDuration(preparing),
        over: compactDuration(Math.max(1_000, elapsed - run.expectedMaxMs)),
      })
    }
    return t('oracle.backgroundPreparingWithEta', {
      thought: compactDuration(thought),
      preparing: compactDuration(preparing),
      high: compactDuration(Math.max(0, run.expectedMaxMs - elapsed)),
    })
  }
  if (run.expectedMaxMs) {
    if (elapsed < run.expectedMaxMs) {
      return t('oracle.backgroundEtaUpper', {
        elapsed: compactDuration(elapsed),
        high: compactDuration(run.expectedMaxMs - elapsed),
      })
    }
    return t('oracle.backgroundOverExpected', {
      elapsed: compactDuration(elapsed),
      over: compactDuration(Math.max(1_000, elapsed - run.expectedMaxMs)),
    })
  }
  return t('oracle.backgroundEstimating', { elapsed: compactDuration(elapsed) })
})

onMounted(() => {
  syncOracleClock(Boolean(oracleChatStore.backgroundRun))
  void oracleChatStore.loadThreads().catch(() => undefined)
  void oracleStore.restoreTracking()
  void continuationStore.restoreTracking()
  void extractionStore.restoreTracking()
  sourceProgressStore.restoreTracking()
})

function formatElapsed(seconds: number) {
  if (seconds < 60) return t('oracle.continuationElapsedSeconds', { seconds })
  return t('oracle.continuationElapsedMinutes', {
    minutes: Math.floor(seconds / 60),
    seconds: seconds % 60,
  })
}

function formatDuration(seconds: number) {
  if (seconds < 60) return t('oracle.durationSeconds', { seconds })
  return t('oracle.durationMinutes', {
    minutes: Math.floor(seconds / 60),
    seconds: seconds % 60,
  })
}

function continuationTaskTitle(task: DreamContinuationTask) {
  if (task.status === 'completed') return t('oracle.continuationPinCompletedTitle')
  if (task.status === 'failed') return t('oracle.continuationPinFailedTitle')
  if (task.dream.continuationMetadata?.status === 'queued') {
    return t('oracle.continuationWaitingTitle')
  }
  return t('oracle.continuationPinTitle')
}

function continuationTaskMessage(task: DreamContinuationTask) {
  if (task.status === 'completed') return t('oracle.continuationRegenerated')
  if (task.status === 'failed') return t('oracle.continuationRegenerateFailed')
  const metadata = task.dream.continuationMetadata
  const stage = metadata?.status === 'queued'
    ? t('oracle.continuationQueued', { position: metadata.queuePosition || 1 })
    : task.progress < 40
      ? t('oracle.continuationReturning')
      : task.progress < 80
        ? t('oracle.continuationWriting')
        : t('oracle.continuationFinalizing')
  const timing = metadata?.status === 'queued'
    ? t('oracle.dreamAnalysisWaited', { duration: formatDuration(task.elapsedSeconds) })
    : formatElapsed(task.elapsedSeconds)
  return `${stage} · ${task.progress}% · ${timing}`
}

function dreamPinnedTitle(entry: DreamPinnedEntry) {
  return entry.kind === 'dream-analysis'
    ? `Oracle: ${oracleTaskTitle(entry.task)}`
    : continuationTaskTitle(entry.task)
}

function dreamPinnedMessage(entry: DreamPinnedEntry) {
  return entry.kind === 'dream-analysis'
    ? oracleTaskMessage(entry.task)
    : continuationTaskMessage(entry.task)
}

async function openDreamPinnedTask(entry: DreamPinnedEntry) {
  if (entry.kind === 'dream-analysis') {
    handleOraclePinnedClick(entry.task)
    return
  }
  continuationStore.showInDialog(entry.task.dreamId)
  await usePostStore().openPost(entry.task.dreamId)
}

watch(
  () => Boolean(oracleChatStore.backgroundRun),
  (active) => syncOracleClock(active),
)

onUnmounted(() => {
  if (oracleClockTimer) clearInterval(oracleClockTimer)
})

async function openOracleChatRun() {
  const tracked = oracleChatStore.backgroundRun || oracleChatStore.completedRun
  if (!tracked) return
  oracleChatStore.selectThread(tracked.threadId)
  await router.push({ path: '/oracle', query: { thread: tracked.threadId } })
}

function queueKindLabel(kind: string) {
  if (kind === 'pdf') return 'Dựng bản đọc từ PDF'
  if (kind === 'structured') return 'Nhập lại từ DOI / HTML / XML'
  if (kind === 'rules') return 'Phân tích luật'
  return 'Xử lý nguồn'
}

function openQueuedJob(job: { sourceId: string; kind: string }) {
  if (job.kind === 'rules') {
    void router.push({ path: '/moderation/rule-candidates', query: { sourceId: job.sourceId } })
    return
  }
  void router.push(`/library/sources/${job.sourceId}`)
}

const sourceTitle = computed(() => {
  if (sourceProgressStore.status === 'success') return t('common.sourceProgress.pin.successTitle')
  if (sourceProgressStore.status === 'failed') return t('common.sourceProgress.pin.failedTitle')
  if (sourceProgressStore.status === 'cancelled') return t('common.sourceProgress.pin.cancelledTitle')
  return t('common.sourceProgress.pin.runningTitle')
})

const localizedPdfStep = computed(() => {
  if (sourceProgressStore.pipelineKind !== 'pdf') return sourceProgressStore.stepText
  const keys: Record<string, string> = {
    received: 'receivePdf',
    inspecting_text: 'inspectOcr',
    ocr_processing: 'recognizeOcr',
    parsing_layout: 'parseDocling',
    cleaning_ocr: 'cleanOcr',
    compiling_reader: 'buildReader',
  }
  const key = keys[sourceProgressStore.pdfStage || '']
  return key ? t(`common.sourceProgress.${key}`) : sourceProgressStore.stepText
})

function compactProgressDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds < 60) return t('common.progress.seconds', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes < 60) {
    return remainder
      ? t('common.progress.minutesSeconds', { minutes, seconds: remainder })
      : t('common.progress.minutes', { count: minutes })
  }
  return t('common.progress.hoursMinutes', {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  })
}

const sourceTimingMessage = computed(() => {
  const estimate = sourceProgressStore.estimatedRemainingSeconds
  if (typeof estimate !== 'number') return t('common.progress.measuring')
  if (estimate < 0) {
    return t('common.progress.overdue', {
      duration: compactProgressDuration(Math.abs(estimate)),
    })
  }
  return t('common.progress.remaining', {
    duration: compactProgressDuration(estimate),
  })
})

const sourceMessage = computed(() => {
  if (sourceProgressStore.status === 'pending') {
    return `${localizedPdfStep.value} (${sourceProgressStore.progress}%) · ${sourceTimingMessage.value}`
  }
  if (sourceProgressStore.status === 'cancelled') {
    return t('common.sourceProgress.pin.cancelledMessage')
  }

  if (sourceProgressStore.pipelineKind === 'structured') {
    if (sourceProgressStore.status === 'success') {
      const sourceMap: Record<string, string> = {
        jats: 'JATS/XML',
        html: 'HTML',
        pdf_text: 'PDF',
        docling_pdf: 'Docling PDF',
        none: t('common.sourceProgress.pin.sourceStructured'),
      }
      const sourceMsg = sourceMap[sourceProgressStore.selectedSource]
        || t('common.sourceProgress.pin.sourceStructured')
      return t('common.sourceProgress.pin.structuredSuccess', { source: sourceMsg })
    }

    if (sourceProgressStore.status === 'failed') {
      return t('common.sourceProgress.pin.structuredFailed', {
        detail: sourceProgressStore.stepText,
      })
    }
  }

  if (
    sourceProgressStore.pipelineKind === 'pdf' &&
    sourceProgressStore.status === 'failed' &&
    sourceProgressStore.pdfResult === 'success'
  ) {
    if (sourceProgressStore.smartReaderResult === 'ocr_needed') {
      return t('common.sourceProgress.pin.pdfPartialOcr')
    }
    return t('common.sourceProgress.pin.pdfPartialFailed', {
      detail: sourceProgressStore.stepText,
    })
  }

  if (sourceProgressStore.status === 'failed') {
    return t('common.sourceProgress.pin.genericFailed', {
      detail: sourceProgressStore.stepText,
    })
  }

  if (sourceProgressStore.status === 'success') {
    if (
      sourceProgressStore.pipelineKind === 'pdf' &&
      sourceProgressStore.selectedSource &&
      sourceProgressStore.selectedSource !== 'none'
    ) {
      let readerMsg = t('common.sourceProgress.pin.readerSuccess')
      if (sourceProgressStore.smartReaderResult === 'ocr_needed') {
        readerMsg = t('common.sourceProgress.pin.readerOcrNeeded')
      } else if (sourceProgressStore.smartReaderResult === 'failed') {
        readerMsg = t('common.sourceProgress.pin.readerFailed')
      }

      const sourceMap: Record<string, string> = {
        jats: 'JATS/XML',
        html: 'HTML',
        pdf_text: 'PDF parser',
        docling_pdf: 'Docling PDF',
        none: t('common.sourceProgress.pin.sourceNone'),
      }
      const sourceMsg = sourceMap[sourceProgressStore.selectedSource]
        || t('common.sourceProgress.pin.sourceUnknown')

      let identifiers = ''
      const ids = (sourceProgressStore.detectedIdentifiers as any) || {}
      if (ids.doi || ids.isbn || ids.pmcid) {
        const found = []
        if (ids.doi) found.push(`DOI: ${ids.doi}`)
        if (ids.isbn) found.push(`ISBN: ${ids.isbn}`)
        if (ids.pmcid) found.push(`PMCID: ${ids.pmcid}`)
        identifiers = t('common.sourceProgress.pin.identifiers', { value: found.join(', ') })
      }

      return t('common.sourceProgress.pin.pdfSuccess', {
        reader: readerMsg,
        source: sourceMsg,
        identifiers,
      })
    }

    const readerMsg = sourceProgressStore.smartReaderResult === 'success'
      ? t('common.sourceProgress.pin.readerSuccess')
      : sourceProgressStore.smartReaderResult === 'failed'
        ? t('common.sourceProgress.pin.readerFailed')
        : t('common.sourceProgress.pin.readerRestricted')
    
    const pdfMap: Record<string, string> = {
      success: t('common.sourceProgress.pin.pdfStored'),
      blocked: t('common.sourceProgress.pin.pdfBlocked'),
      external_only: t('common.sourceProgress.pin.pdfExternalOnly'),
      no_candidate: t('common.sourceProgress.pin.pdfUnavailable'),
      failed: t('common.sourceProgress.pin.pdfFailed'),
      none: t('common.sourceProgress.pin.pdfUnavailable'),
    }
    const pdfMsg = pdfMap[sourceProgressStore.pdfResult]
      || t('common.sourceProgress.pin.sourceUnknown')
    
    return t('common.sourceProgress.pin.importSuccess', {
      reader: readerMsg,
      pdf: pdfMsg,
    })
  }
  return `${sourceProgressStore.stepText} (${sourceProgressStore.progress}%)`
})

function handleSourcePinnedClick() {
  if (sourceProgressStore.status === 'success' || sourceProgressStore.status === 'failed' || sourceProgressStore.status === 'cancelled') {
    sourceProgressStore.stopTracking()
  } else {
    sourceProgressStore.openDialog()
  }
}

function oracleTaskTitle(task: DreamAnalysisTask) {
  if (task.status === 'completed') return t('oracle.dreamAnalysisCompletedTitle')
  if (task.status === 'failed') return t('oracle.dreamAnalysisFailedTitle')
  if (task.status === 'cancelled') return t('oracle.dreamAnalysisCancelledTitle')
  if (task.dream.analysisMetadata?.currentStage === 'queued') {
    const position = Number(task.dream.analysisMetadata?.queuePosition)
    return Number.isFinite(position) && position > 0
      ? t('oracle.dreamAnalysisQueuedTitle', { position })
      : t('oracle.dreamAnalysisWaitingTitle')
  }
  return t('oracle.dreamAnalysisRunningTitle')
}

function oracleTaskMessage(task: DreamAnalysisTask) {
  if (task.status === 'completed') {
    return t('oracle.dreamAnalysisCompletedMessage')
  }
  if (task.status === 'failed') {
    return t('oracle.dreamAnalysisFailedMessage')
  }
  if (task.status === 'cancelled') {
    return t('oracle.dreamAnalysisCancelledMessage')
  }
  const elapsed = formatDuration(task.elapsedSeconds)
  if (task.dream.analysisMetadata?.currentStage === 'queued') {
    return `${task.statusMessage} · ${t('oracle.dreamAnalysisWaited', { duration: elapsed })}`
  }
  return `${task.statusMessage} · ${task.progress}% · ${t('oracle.dreamAnalysisRan', { duration: elapsed })}`
}

function handleOraclePinnedClick(task: DreamAnalysisTask) {
  if (task.status === 'failed') {
    oracleStore.stopTracking(task.dreamId)
    return
  }
  oracleStore.openTask(task.dreamId)
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
    if (extractionStore.outcome === 'user_cancelled') return 'Đã hủy phân tích'
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
    if (extractionStore.outcome === 'user_cancelled') return 'Phần lập luận chưa hoàn tất không được lưu.'
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
  top: 10px;
  right: 5px;
  z-index: 9999;
  width: min(292px, calc(100vw - 10px));
  display: flex;
  flex-direction: column;
  pointer-events: none; /* Let clicks pass through gaps */
}

.pinned-task-lane {
  margin-top: var(--header-height, 64px);
}

.pinned-task-list-enter-active,
.pinned-task-list-leave-active {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.pinned-task-list-enter-from,
.pinned-task-list-leave-to {
  /* The View bookmark protrudes 54px to the left of the card. Move the
     complete component far enough that even its left edge exits the screen. */
  transform: translate3d(calc(100% + 76px), 0, 0);
}

.pinned-task-list-move {
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
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
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
.stack-list-enter-from,
.stack-list-leave-to {
  transform: translate3d(calc(100% + 12px), 0, 0);
}
.stack-list-move {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Transitions for cards piled up within a stack */
.card-pile-enter-active,
.card-pile-leave-active {
  transition:
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease;
}
.card-pile-enter-from,
.card-pile-leave-to {
  opacity: 0;
  transform: translate3d(calc(100% + 12px), 0, 0) !important;
}
</style>
