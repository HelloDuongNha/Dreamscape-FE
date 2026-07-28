<template>
  <div class="oracle-view">
    <!-- Left Thread Sidebar -->
    <OracleThreadSidebar
      v-model:is-open="isSidebarOpen"
      :threads="threads"
      :active-thread-id="activeThreadId"
      :is-loading="isLoading"
      @new-thread="handleNewThread"
      @select-thread="handleSelectThread"
      @rename-thread="handleRenameThread"
      @toggle-pin="handleTogglePin"
      @delete-thread="requestDeleteThread"
      @manage-connections="showModelConnections = true"
      @close="isSidebarOpen = false"
    />

    <!-- Main Chat Area -->
    <OracleChatShell
      ref="chatShell"
      :messages="activeMessages"
      :is-sidebar-open="isSidebarOpen"
      :thread-title="activeThread?.title"
      :is-sending="isSending"
      :suggested-prompts="latestSuggestions"
      :wait-for-complete="waitForComplete"
      :context-usage="latestContextUsage"
      :context-message-count="activeMessages.length"
      :run-estimate="activeThread ? {
        expectedMinMs: activeThread.activeRunExpectedMinMs,
        expectedMaxMs: activeThread.activeRunExpectedMaxMs,
      } : undefined"
      @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
      @send="handleSend"
      @cancel="handleCancel"
      @open-citation="handleOpenCitation"
      @edit-message="handleEditMessage"
      @select-branch="handleSelectBranch"
      @update:wait-for-complete="setWaitForComplete"
    />

    <OracleCitationModal
      v-model="showCitationModal"
      :message-id="selectedCitationMessageId"
      :citation="selectedCitation"
      @open-source="openAcademicSource"
    />
    <AppConfirm
      v-model="showDeleteConfirm"
      :title="t('oracle.deleteConversation')"
      :message="t('oracle.deleteConversationConfirm')"
      :confirm-label="t('oracle.delete')"
      :cancel-label="t('oracle.cancel')"
      :loading="isMutating"
      danger
      @confirm="confirmDeleteThread"
    />
    <OracleModelConnections v-model="showModelConnections" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import OracleThreadSidebar from './components/OracleThreadSidebar.vue'
import OracleChatShell from './components/OracleChatShell.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import OracleModelConnections from './components/OracleModelConnections.vue'
import OracleCitationModal from './components/OracleCitationModal.vue'
import { useOracleChatStore } from '@/store/useOracleChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { usePostStore } from '@/store/usePostStore'
import { useRoute, useRouter } from 'vue-router'
import {
  getOracleThread,
  getOracleCitationDetails,
  branchOracleTurn,
  cancelOracleRun,
  postOracleTurn,
  streamOracleRun,
  type OracleTurnDto,
  type OracleCitationDto,
} from '@/api/oracleApi'
import type { OracleMode, OracleShellMessage } from './oracleShell.types'
import { materializeOracleBranch } from './services/oracleBranchPresentation.service'
import { applyOracleStreamEvent } from './services/oracleStreamPresentation.service'

const { t } = useI18n()
const oracleStore = useOracleChatStore()
const settingsStore = useSettingsStore()
const postStore = usePostStore()
const router = useRouter()
const route = useRoute()
const {
  threads,
  activeThreadId,
  activeThread,
  isLoading,
  isMutating,
  backgroundRun,
  citationChange,
} = storeToRefs(oracleStore)
const isSidebarOpen = ref(false)
const chatShell = ref<InstanceType<typeof OracleChatShell> | null>(null)
const activeMode = ref<OracleMode>('chat')
const activeMessages = ref<OracleShellMessage[]>([])
const allThreadTurns = ref<OracleTurnDto[]>([])
const selectedBranchLeafId = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const showModelConnections = ref(false)
const showCitationModal = ref(false)
const selectedCitation = ref<OracleCitationDto | null>(null)
const selectedCitationMessageId = ref('')
const pendingDeleteThreadId = ref<string | null>(null)
const isSending = ref(false)
const waitForComplete = ref(localStorage.getItem('oracle_wait_for_complete') === 'true')
let streamController: AbortController | null = null
let currentRunId: string | null = null
let presentationFrame: number | null = null
let presentationQueue = ''
let presentationTargetId: string | null = null
let presentationReady = false
let lastPresentationAt = 0
let drainResolvers: Array<() => void> = []
let isLeavingView = false
let routeSyncReady = false

const latestSuggestions = computed(() => {
  const assistant = [...activeMessages.value].reverse().find((message) => message.role === 'assistant')
  return assistant?.suggestedPrompts || []
})
const latestContextUsage = computed(() => (
  [...activeMessages.value].reverse().find((message) => message.contextUsage)?.contextUsage || {
    usedTokens: Math.ceil(
      activeMessages.value.reduce((total, message) => total + message.content.length, 0) / 4,
    ),
    maxTokens: 32768,
    percent: Math.min(100, Math.round(
      (activeMessages.value.reduce((total, message) => total + message.content.length, 0) / 4 / 32768) * 100,
    )),
    provider: 'estimate',
    modelName: undefined,
  }
))

function resolvePresentationDrain() {
  if (presentationQueue || presentationFrame !== null) return
  const resolvers = drainResolvers
  drainResolvers = []
  resolvers.forEach((resolve) => resolve())
}

function paintPresentationFrame(timestamp: number) {
  presentationFrame = null
  const target = activeMessages.value.find((message) => message.id === presentationTargetId)
  if (!target || !presentationQueue) {
    presentationQueue = ''
    resolvePresentationDrain()
    return
  }
  const elapsed = lastPresentationAt ? timestamp - lastPresentationAt : 16
  lastPresentationAt = timestamp
  const characters = document.hidden
    ? presentationQueue.length
    : Math.max(4, Math.min(48, Math.ceil(presentationQueue.length / 90), Math.floor(elapsed / 4)))
  target.content += presentationQueue.slice(0, characters)
  presentationQueue = presentationQueue.slice(characters)
  if (presentationQueue) presentationFrame = requestAnimationFrame(paintPresentationFrame)
  else resolvePresentationDrain()
}

function enqueuePresentation(targetId: string, text: string) {
  presentationTargetId = targetId
  presentationQueue += text
}

function setWaitForComplete(value: boolean) {
  waitForComplete.value = value
  localStorage.setItem('oracle_wait_for_complete', String(value))
  if (presentationReady) releasePresentation()
}

function releasePresentation() {
  if (!presentationReady) return
  if (waitForComplete.value) {
    clearPresentation(true)
    return
  }
  if (presentationQueue && presentationFrame === null) {
    lastPresentationAt = 0
    presentationFrame = requestAnimationFrame(paintPresentationFrame)
  }
}

function waitForPresentationDrain(): Promise<void> {
  if (!presentationQueue && presentationFrame === null) return Promise.resolve()
  return new Promise((resolve) => drainResolvers.push(resolve))
}

function clearPresentation(flush = false) {
  if (presentationFrame !== null) cancelAnimationFrame(presentationFrame)
  presentationFrame = null
  const target = activeMessages.value.find((message) => message.id === presentationTargetId)
  if (flush && target) target.content += presentationQueue
  presentationQueue = ''
  presentationTargetId = null
  presentationReady = false
  resolvePresentationDrain()
}

async function handleNewThread() {
  streamController?.abort()
  clearPresentation()
  activeMode.value = 'chat'
  oracleStore.selectThread(null)
  await router.replace({ path: '/oracle', query: {} })
  activeMessages.value = []
  allThreadTurns.value = []
  selectedBranchLeafId.value = null
  isSidebarOpen.value = false
  await nextTick()
  chatShell.value?.focusComposer()
}

async function loadThreadMessages(id: string, preferredLeafId?: string) {
  const data = await getOracleThread(id)
  allThreadTurns.value = data.turns
  const runtimeById = new Map(
    activeMessages.value.map((message) => [
      message.id,
      {
        runState: message.runState,
        startedAt: message.startedAt,
        thoughtCompletedAt: message.thoughtCompletedAt,
        presentationStartedAt: message.presentationStartedAt,
        firstTokenAt: message.firstTokenAt,
        completedAt: message.completedAt,
        expectedMinMs: message.expectedMinMs,
        expectedMaxMs: message.expectedMaxMs,
      },
    ]),
  )
  const selected = materializeOracleBranch(
    data.turns,
    preferredLeafId || selectedBranchLeafId.value || undefined,
  )
  selectedBranchLeafId.value = selected[selected.length - 1]?.id || null
  activeMessages.value = selected.map((message) => {
    const runtime = runtimeById.get(message.id)
    if (!runtime) return message
    const definedRuntime = Object.fromEntries(
      Object.entries(runtime).filter(([, value]) => value !== undefined),
    )
    return { ...message, ...definedRuntime }
  })
}

async function handleSelectThread(id: string, updateRoute = true) {
  streamController?.abort()
  clearPresentation()
  oracleStore.selectThread(id)
  if (updateRoute) await router.replace({ path: '/oracle', query: { thread: id } })
  selectedBranchLeafId.value = null
  allThreadTurns.value = []
  isSidebarOpen.value = false
  try {
    const thread = threads.value.find((item) => item.id === id)
    const tracked = backgroundRun.value?.threadId === id ? backgroundRun.value : null
    const runId = thread?.activeRunId || tracked?.runId
    const assistantTurnId = thread?.activeRunAssistantTurnId || tracked?.assistantTurnId
    await loadThreadMessages(id, assistantTurnId || undefined)
    if (runId && !isSending.value) {
      await resumeActiveRun(
        id,
        runId,
        thread?.activeRunStartedAt || tracked?.startedAt,
        assistantTurnId,
        thread?.activeRunStage || tracked?.stage,
        thread?.activeRunStageStartedAt || tracked?.stageStartedAt,
      )
    }
  } catch (error: any) {
    if (!isLeavingView && error?.name !== 'AbortError') {
      settingsStore.showToastKey('oracle.loadError', undefined, 'error')
    }
  }
}

async function handleRenameThread(id: string, title: string) {
  try {
    await oracleStore.renameThread(id, title)
  } catch {
    settingsStore.showToastKey('oracle.updateError', undefined, 'error')
  }
}

async function handleTogglePin(id: string) {
  try {
    await oracleStore.togglePinned(id)
  } catch {
    settingsStore.showToastKey('oracle.updateError', undefined, 'error')
  }
}

function requestDeleteThread(id: string) {
  pendingDeleteThreadId.value = id
  showDeleteConfirm.value = true
}

async function confirmDeleteThread() {
  if (!pendingDeleteThreadId.value) return
  try {
    const deletedThreadId = pendingDeleteThreadId.value
    await oracleStore.removeThread(deletedThreadId)
    showDeleteConfirm.value = false
    pendingDeleteThreadId.value = null
    activeMessages.value = []
    if (route.query.thread === deletedThreadId) {
      await router.replace({ path: '/oracle', query: {} })
    }
    settingsStore.showToastKey('oracle.deleteSuccess', undefined, 'success')
  } catch {
    settingsStore.showToastKey('oracle.deleteError', undefined, 'error')
  }
}

async function handleSend(content: string) {
  if (isSending.value) return
  isSending.value = true
  let threadId = activeThreadId.value
  let createdForThisMessage = false
  let runPersisted = false
  try {
    if (!threadId) {
      threadId = await oracleStore.addThread(t('oracle.untitledConversation'), activeMode.value)
      if (!threadId) throw new Error('oracle_thread_create_failed')
      createdForThisMessage = true
    }
    // Resolve the real persisted parent before adding the optimistic assistant.
    // A local placeholder ID must never be sent as a backend turn ID.
    const parentTurnId = [...activeMessages.value]
      .reverse()
      .find((message) => message.role === 'assistant' && !message.id.startsWith('local-'))
      ?.id
    const optimisticUserId = `local-user-${Date.now()}`
    const optimisticAssistantId = `local-assistant-${Date.now()}`
    activeMessages.value.push({
      id: optimisticUserId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    })
    activeMessages.value.push({
      id: optimisticAssistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      runState: 'thinking',
      startedAt: Date.now(),
    })
    const clientRequestId = `oracle_${crypto.randomUUID()}`
    const run = await postOracleTurn(threadId, content, clientRequestId, parentTurnId)
    runPersisted = true
    currentRunId = run.runId
    oracleStore.trackRun(threadId, run.runId, { assistantTurnId: run.assistantTurnId })
    await oracleStore.loadThreads()
    const userMessage = activeMessages.value.find((message) => message.id === optimisticUserId)
    const assistantMessage = activeMessages.value.find((message) => message.id === optimisticAssistantId)
    if (userMessage) userMessage.id = run.userTurnId
    if (assistantMessage) assistantMessage.id = run.assistantTurnId

    streamController?.abort()
    streamController = new AbortController()
    await streamOracleRun(run.runId, (event) => {
      const target = activeMessages.value.find((message) => message.id === run.assistantTurnId)
      if (!target) return
      if (event.type === 'done') presentationReady = true
      applyOracleStreamEvent({
        event,
        target,
        waitForComplete: waitForComplete.value,
        enqueueText: (text) => enqueuePresentation(run.assistantTurnId, text),
        releasePresentation,
        clearPresentation,
        responseUnavailable: t('oracle.responseUnavailable'),
        responseCancelled: t('oracle.responseCancelled'),
      })
    }, streamController.signal)
    await waitForPresentationDrain()
    const completedTarget = activeMessages.value.find((message) => message.id === run.assistantTurnId)
    if (completedTarget?.runState === 'responding') completedTarget.runState = 'completed'
    oracleStore.completeRun(threadId)
    await oracleStore.loadThreads()
    await loadThreadMessages(threadId, run.assistantTurnId)
  } catch (error: any) {
    if (createdForThisMessage && !runPersisted && error?.name !== 'AbortError' && threadId) {
      await oracleStore.removeThread(threadId).catch(() => undefined)
      activeMessages.value = []
    }
    if (error?.name !== 'AbortError') {
      settingsStore.showToastKey('oracle.sendError', undefined, 'error')
    }
  } finally {
    currentRunId = null
    isSending.value = false
  }
}

async function handleEditMessage(message: OracleShellMessage, content: string) {
  if (isSending.value || message.role !== 'user' || !activeThreadId.value) return
  const threadId = activeThreadId.value
  isSending.value = true
  const editedMessageIndex = activeMessages.value.findIndex((item) => item.id === message.id)
  if (editedMessageIndex >= 0) {
    // Editing creates a sibling branch, so the old visible branch must not
    // remain beside its optimistic replacement.
    activeMessages.value.splice(editedMessageIndex)
  }
  const optimisticUserId = `local-branch-user-${Date.now()}`
  const optimisticAssistantId = `local-branch-assistant-${Date.now()}`
  activeMessages.value.push({
    id: optimisticUserId,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  })
  activeMessages.value.push({
    id: optimisticAssistantId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    runState: 'thinking',
    startedAt: Date.now(),
  })
  try {
    const run = await branchOracleTurn(threadId, message.id, content, `oracle_${crypto.randomUUID()}`)
    currentRunId = run.runId
    oracleStore.trackRun(threadId, run.runId, { assistantTurnId: run.assistantTurnId })
    const userMessage = activeMessages.value.find((item) => item.id === optimisticUserId)
    const assistantMessage = activeMessages.value.find((item) => item.id === optimisticAssistantId)
    if (userMessage) userMessage.id = run.userTurnId
    if (assistantMessage) assistantMessage.id = run.assistantTurnId
    selectedBranchLeafId.value = run.assistantTurnId
    await loadThreadMessages(threadId, run.assistantTurnId)
    streamController?.abort()
    streamController = new AbortController()
    await streamOracleRun(run.runId, (event) => {
      const target = activeMessages.value.find((item) => item.id === run.assistantTurnId)
      if (!target) return
      if (event.type === 'done') presentationReady = true
      applyOracleStreamEvent({
        event,
        target,
        waitForComplete: waitForComplete.value,
        enqueueText: (text) => enqueuePresentation(target.id, text),
        releasePresentation,
        clearPresentation,
        responseUnavailable: t('oracle.responseUnavailable'),
        responseCancelled: t('oracle.responseCancelled'),
      })
    }, streamController.signal)
    await waitForPresentationDrain()
    const completed = activeMessages.value.find((item) => item.id === run.assistantTurnId)
    if (completed?.runState === 'responding') completed.runState = 'completed'
    oracleStore.completeRun(threadId)
    await oracleStore.loadThreads()
    await loadThreadMessages(threadId, run.assistantTurnId)
  } catch (error: any) {
    if (error?.name !== 'AbortError') settingsStore.showToastKey('oracle.sendError', undefined, 'error')
    await loadThreadMessages(threadId).catch(() => undefined)
  } finally {
    currentRunId = null
    isSending.value = false
  }
}

function handleSelectBranch(leafId: string) {
  const selected = materializeOracleBranch(allThreadTurns.value, leafId)
  selectedBranchLeafId.value = leafId
  activeMessages.value = selected
}

async function resumeActiveRun(
  threadId: string,
  runId: string,
  startedAt?: string | null,
  assistantTurnId?: string | null,
  stage?: 'thinking' | 'preparing' | 'completed' | null,
  stageStartedAt?: string | null,
) {
  const existingTarget = assistantTurnId
    ? activeMessages.value.find((message) => message.id === assistantTurnId)
    : undefined
  const runStartedAt = startedAt ? new Date(startedAt).getTime() : Date.now()
  const restoredStageAt = stageStartedAt ? new Date(stageStartedAt).getTime() : undefined
  const target: OracleShellMessage = existingTarget || {
    id: assistantTurnId || `resumed-${runId}`,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    runState: stage === 'preparing' ? 'preparing' : 'thinking',
    startedAt: runStartedAt,
    thoughtCompletedAt: stage === 'preparing' ? restoredStageAt : undefined,
  }
  target.startedAt ||= runStartedAt
  if (stage === 'preparing') {
    target.runState = 'preparing'
    target.thoughtCompletedAt = restoredStageAt || target.thoughtCompletedAt || runStartedAt
  } else if (!target.runState) {
    target.runState = 'thinking'
  }
  if (!existingTarget) activeMessages.value.push(target)
  isSending.value = true
  currentRunId = runId
  oracleStore.trackRun(threadId, runId, {
    startedAt: startedAt || undefined,
    stage,
    stageStartedAt,
  })
  streamController?.abort()
  streamController = new AbortController()
  try {
    await streamOracleRun(runId, (event) => {
      if (event.type === 'done') presentationReady = true
      applyOracleStreamEvent({
        event,
        target,
        waitForComplete: waitForComplete.value,
        enqueueText: (text) => enqueuePresentation(target.id, text),
        releasePresentation,
        clearPresentation,
        responseUnavailable: t('oracle.responseUnavailable'),
        responseCancelled: t('oracle.responseCancelled'),
      })
    }, streamController.signal)
    await waitForPresentationDrain()
    if (target.runState === 'responding') target.runState = 'completed'
    oracleStore.completeRun(threadId)
    await Promise.all([oracleStore.loadThreads(), loadThreadMessages(threadId)])
  } finally {
    isSending.value = false
    currentRunId = null
  }
}

async function handleOpenCitation(message: OracleShellMessage, index: number) {
  const citation = message.citations?.find((item) => item.index === index)
  if (!citation) return
  if (citation.sourceType === 'academic_source') {
    try {
      const details = await getOracleCitationDetails(message.id, index, citation.sourceId)
      selectedCitationMessageId.value = message.id
      selectedCitation.value = details
      showCitationModal.value = true
      const stored = message.citations?.findIndex((item) => item.index === index) ?? -1
      if (stored >= 0 && message.citations) message.citations[stored] = details
    } catch {
      settingsStore.showToast(t('oracle.sourceDetailsLoadFailed'), 'error')
    }
    return
  }
  await postStore.openPost(citation.sourceId)
}

async function openAcademicSource(sourceId: string) {
  showCitationModal.value = false
  await router.push(`/library/sources/${sourceId}`)
}

async function handleCancel() {
  if (!currentRunId) return
  const runId = currentRunId
  streamController?.abort()
  clearPresentation(true)
  const pending = [...activeMessages.value].reverse().find(
    (message) => message.role === 'assistant'
      && ['thinking', 'preparing', 'responding'].includes(message.runState || ''),
  )
  if (pending) {
    pending.runState = 'cancelled'
    pending.completedAt = Date.now()
    pending.content ||= t('oracle.responseCancelled')
  }
  try {
    await cancelOracleRun(runId)
  } catch {
    settingsStore.showToastKey('oracle.sendError', undefined, 'error')
  } finally {
    isSending.value = false
    currentRunId = null
  }
}

watch(activeThread, (thread) => {
  if (thread) activeMode.value = thread.mode
})

watch(() => citationChange.value?.revision, async () => {
  const threadId = activeThreadId.value
  const change = citationChange.value
  if (!threadId || !change?.threadIds.includes(threadId)) return
  showCitationModal.value = false
  selectedCitation.value = null
  await loadThreadMessages(threadId)
})

watch(
  () => route.query.thread,
  async (value) => {
    if (!routeSyncReady) return
    const threadId = typeof value === 'string' ? value : null
    if (threadId === activeThreadId.value) return
    if (!threadId) {
      streamController?.abort()
      clearPresentation()
      oracleStore.selectThread(null)
      activeMessages.value = []
      allThreadTurns.value = []
      selectedBranchLeafId.value = null
      return
    }
    await handleSelectThread(threadId, false)
  },
)

onMounted(async () => {
  try {
    await oracleStore.loadThreads()
    const requestedThreadId = typeof route.query.thread === 'string'
      ? route.query.thread
      : activeThreadId.value
    if (requestedThreadId) {
      oracleStore.selectThread(requestedThreadId)
      const thread = threads.value.find((item) => item.id === requestedThreadId)
      const tracked = backgroundRun.value?.threadId === requestedThreadId
        ? backgroundRun.value
        : null
      const runId = thread?.activeRunId || tracked?.runId
      const assistantTurnId = thread?.activeRunAssistantTurnId || tracked?.assistantTurnId
      await loadThreadMessages(requestedThreadId, assistantTurnId || undefined)
      if (runId) {
        await resumeActiveRun(
          requestedThreadId,
          runId,
          thread?.activeRunStartedAt || tracked?.startedAt,
          assistantTurnId,
          thread?.activeRunStage || tracked?.stage,
          thread?.activeRunStageStartedAt || tracked?.stageStartedAt,
        )
      }
    }
  } catch (error: any) {
    if (!isLeavingView && error?.name !== 'AbortError') {
      settingsStore.showToastKey('oracle.loadError', undefined, 'error')
    }
  } finally {
    routeSyncReady = true
  }
})

onBeforeUnmount(() => {
  isLeavingView = true
  streamController?.abort()
  clearPresentation()
})
</script>

<style scoped>
.oracle-view {
  display: flex;
  width: 100%;
  height: calc(100dvh - var(--header-height, 60px));
  background: var(--color-bg-base, #0a0a0a);
  overflow: hidden;
  position: relative;
}
</style>
