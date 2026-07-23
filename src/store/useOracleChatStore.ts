import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  createOracleThread,
  deleteOracleThread,
  getOracleRunStatus,
  listOracleThreads,
  updateOracleThread,
  type OracleThreadDto,
} from '@/api/oracleApi'
import type { OracleMode, OracleThreadItem } from '@/features/oracle/oracleShell.types'

const ACTIVE_THREAD_STORAGE_KEY = 'oracle_active_thread_id'
const ORACLE_RUN_NOTIFICATION_KEY = 'dreamscape:oracle-run-notification:v1'

interface BackgroundOracleRun {
  threadId: string
  runId: string
  assistantTurnId?: string | null
  title: string
  startedAt: string
  expectedMinMs?: number | null
  expectedMaxMs?: number | null
  stage?: 'thinking' | 'preparing' | 'completed' | null
  stageStartedAt?: string | null
}

interface CompletedOracleRun {
  threadId: string
  title: string
  expiresAt: number
}

function restoreNotification(): {
  background: BackgroundOracleRun | null
  completed: CompletedOracleRun | null
} {
  try {
    const saved = JSON.parse(localStorage.getItem(ORACLE_RUN_NOTIFICATION_KEY) || 'null')
    if (saved?.kind === 'background' && saved.runId && saved.threadId) {
      return { background: saved, completed: null }
    }
    if (saved?.kind === 'completed' && Number(saved.expiresAt) > Date.now()) {
      return { background: null, completed: saved }
    }
    localStorage.removeItem(ORACLE_RUN_NOTIFICATION_KEY)
  } catch {
    localStorage.removeItem(ORACLE_RUN_NOTIFICATION_KEY)
  }
  return { background: null, completed: null }
}

function toThreadItem(thread: OracleThreadDto): OracleThreadItem {
  return {
    id: thread._id,
    title: thread.title,
    mode: thread.mode,
    pinned: thread.pinned,
    archived: thread.archived,
    updatedAt: thread.updatedAt,
    lastTurnAt: thread.lastTurnAt,
    activeRunId: thread.activeRunId || null,
    activeRunStatus: thread.activeRunStatus || null,
    activeRunStartedAt: thread.activeRunStartedAt || null,
    activeRunAssistantTurnId: thread.activeRunAssistantTurnId || null,
    activeRunExpectedMinMs: thread.activeRunExpectedMinMs || null,
    activeRunExpectedMaxMs: thread.activeRunExpectedMaxMs || null,
    activeRunStage: thread.activeRunStage || null,
    activeRunStageStartedAt: thread.activeRunStageStartedAt || null,
  }
}

export const useOracleChatStore = defineStore('oracleChat', () => {
  const restoredNotification = restoreNotification()
  const threads = ref<OracleThreadItem[]>([])
  const activeThreadId = ref<string | null>(localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY))
  const isLoading = ref(false)
  const isMutating = ref(false)
  const errorCode = ref<string | null>(null)
  const backgroundRun = ref<BackgroundOracleRun | null>(restoredNotification.background)
  const completedRun = ref<CompletedOracleRun | null>(restoredNotification.completed)
  let completionTimer: ReturnType<typeof setTimeout> | null = null
  let backgroundPollTimer: ReturnType<typeof setTimeout> | null = null

  const activeThread = computed(
    () => threads.value.find((thread) => thread.id === activeThreadId.value) ?? null,
  )

  function replaceThread(dto: OracleThreadDto) {
    const item = toThreadItem(dto)
    const index = threads.value.findIndex((thread) => thread.id === item.id)
    if (index === -1) threads.value.unshift(item)
    else threads.value[index] = item
    threads.value.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.lastTurnAt).getTime() - new Date(a.lastTurnAt).getTime()
    })
  }

  function captureError(error: any): never {
    errorCode.value = error?.response?.data?.code || 'oracle_internal_error'
    throw error
  }

  async function loadThreads() {
    isLoading.value = true
    errorCode.value = null
    try {
      threads.value = (await listOracleThreads()).map(toThreadItem)
      const serverActive = threads.value.find((thread) => thread.activeRunId)
      if (serverActive?.activeRunId) {
        trackRun(serverActive.id, serverActive.activeRunId, {
          startedAt: serverActive.activeRunStartedAt || undefined,
          expectedMinMs: serverActive.activeRunExpectedMinMs,
          expectedMaxMs: serverActive.activeRunExpectedMaxMs,
          stage: serverActive.activeRunStage,
          stageStartedAt: serverActive.activeRunStageStartedAt,
          assistantTurnId: serverActive.activeRunAssistantTurnId,
        })
      } else if (backgroundRun.value) {
        // The thread list is not an authoritative run-status endpoint. It can
        // briefly omit a run during navigation, pagination, or a status write.
        // Keep tracking the exact run ID until its own endpoint says terminal.
        void refreshTrackedRun(backgroundRun.value)
      }
      if (
        activeThreadId.value &&
        !threads.value.some((thread) => thread.id === activeThreadId.value)
      ) {
        selectThread(null)
      }
    } catch (error) {
      captureError(error)
    } finally {
      isLoading.value = false
    }
  }

  async function addThread(title: string, mode: OracleMode): Promise<string> {
    isMutating.value = true
    errorCode.value = null
    try {
      const thread = await createOracleThread({ title, mode })
      replaceThread(thread)
      selectThread(thread._id)
      return thread._id
    } catch (error) {
      captureError(error)
    } finally {
      isMutating.value = false
    }
  }

  async function renameThread(threadId: string, title: string) {
    const normalized = title.trim()
    if (!normalized) return
    isMutating.value = true
    try {
      replaceThread(await updateOracleThread(threadId, { title: normalized }))
    } catch (error) {
      captureError(error)
    } finally {
      isMutating.value = false
    }
  }

  async function togglePinned(threadId: string) {
    const thread = threads.value.find((item) => item.id === threadId)
    if (!thread) return
    isMutating.value = true
    try {
      replaceThread(await updateOracleThread(threadId, { pinned: !thread.pinned }))
    } catch (error) {
      captureError(error)
    } finally {
      isMutating.value = false
    }
  }

  async function removeThread(threadId: string) {
    isMutating.value = true
    try {
      await deleteOracleThread(threadId)
      threads.value = threads.value.filter((thread) => thread.id !== threadId)
      if (activeThreadId.value === threadId) selectThread(null)
    } catch (error) {
      captureError(error)
    } finally {
      isMutating.value = false
    }
  }

  function selectThread(threadId: string | null) {
    activeThreadId.value = threadId
    if (threadId) localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId)
    else localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY)
  }

  function persistBackground(run: BackgroundOracleRun) {
    localStorage.setItem(ORACLE_RUN_NOTIFICATION_KEY, JSON.stringify({ kind: 'background', ...run }))
  }

  async function refreshTrackedRun(tracked: BackgroundOracleRun) {
    const status = await getOracleRunStatus(tracked.runId)
    if (backgroundRun.value?.runId !== tracked.runId) return
    if (['completed', 'cancelled', 'failed'].includes(status.status)) {
      completeRun(status.threadId)
      return
    }
    trackRun(status.threadId, status.runId, {
      startedAt: status.startedAt,
      expectedMinMs: status.expectedMinMs,
      expectedMaxMs: status.expectedMaxMs,
      stage: status.stage,
      stageStartedAt: status.stageStartedAt,
      assistantTurnId: status.assistantTurnId,
    })
  }

  function scheduleBackgroundPoll() {
    if (backgroundPollTimer || !backgroundRun.value) return
    // Poll only after the preceding request has settled. setInterval allowed
    // slow status requests to overlap, which created unnecessary network,
    // reactive and localStorage work while the model was busy.
    backgroundPollTimer = setTimeout(async () => {
      backgroundPollTimer = null
      const tracked = backgroundRun.value
      if (!tracked) return
      try {
        await refreshTrackedRun(tracked)
      } catch {
        // A transient network failure must not erase a still-running job.
      } finally {
        if (backgroundRun.value) scheduleBackgroundPoll()
      }
    }, 4000)
  }

  function trackRun(
    threadId: string,
    runId: string,
    metadata: Partial<Omit<BackgroundOracleRun, 'threadId' | 'runId' | 'title'>> = {},
  ) {
    const thread = threads.value.find((item) => item.id === threadId)
    if (thread) {
      thread.activeRunId = runId
      thread.activeRunStatus = 'running'
      thread.activeRunStartedAt ||= new Date().toISOString()
    }
    const previous = backgroundRun.value?.runId === runId ? backgroundRun.value : null
    const nextRun: BackgroundOracleRun = {
      threadId,
      runId,
      title: thread?.title || 'Oracle',
      startedAt: metadata.startedAt || previous?.startedAt || new Date().toISOString(),
      expectedMinMs: metadata.expectedMinMs ?? previous?.expectedMinMs ?? null,
      expectedMaxMs: metadata.expectedMaxMs ?? previous?.expectedMaxMs ?? null,
      stage: metadata.stage || previous?.stage || 'thinking',
      stageStartedAt: metadata.stageStartedAt || previous?.stageStartedAt || null,
      assistantTurnId: metadata.assistantTurnId || previous?.assistantTurnId || null,
    }
    const changed = !previous
      || previous.threadId !== nextRun.threadId
      || previous.title !== nextRun.title
      || previous.startedAt !== nextRun.startedAt
      || previous.expectedMinMs !== nextRun.expectedMinMs
      || previous.expectedMaxMs !== nextRun.expectedMaxMs
      || previous.stage !== nextRun.stage
      || previous.stageStartedAt !== nextRun.stageStartedAt
      || previous.assistantTurnId !== nextRun.assistantTurnId
    if (changed) {
      backgroundRun.value = nextRun
      persistBackground(nextRun)
    }
    completedRun.value = null
    if (completionTimer) clearTimeout(completionTimer)
    scheduleBackgroundPoll()
  }

  function completeRun(threadId: string) {
    const thread = threads.value.find((item) => item.id === threadId)
    if (thread) {
      thread.activeRunId = null
      thread.activeRunStatus = null
      thread.activeRunStartedAt = null
      thread.activeRunAssistantTurnId = null
    }
    completedRun.value = {
      threadId,
      title: thread?.title || backgroundRun.value?.title || 'Oracle',
      expiresAt: Date.now() + 3000,
    }
    backgroundRun.value = null
    localStorage.setItem(ORACLE_RUN_NOTIFICATION_KEY, JSON.stringify({
      kind: 'completed',
      ...completedRun.value,
    }))
    if (backgroundPollTimer) clearTimeout(backgroundPollTimer)
    backgroundPollTimer = null
    if (completionTimer) clearTimeout(completionTimer)
    completionTimer = setTimeout(() => {
      completedRun.value = null
      localStorage.removeItem(ORACLE_RUN_NOTIFICATION_KEY)
      completionTimer = null
    }, 3000)
  }

  if (completedRun.value) {
    completionTimer = setTimeout(() => {
      completedRun.value = null
      localStorage.removeItem(ORACLE_RUN_NOTIFICATION_KEY)
      completionTimer = null
    }, Math.max(0, completedRun.value.expiresAt - Date.now()))
  }

  return {
    threads,
    activeThreadId,
    activeThread,
    isLoading,
    isMutating,
    errorCode,
    backgroundRun,
    completedRun,
    loadThreads,
    addThread,
    renameThread,
    togglePinned,
    removeThread,
    selectThread,
    trackRun,
    completeRun,
  }
})
