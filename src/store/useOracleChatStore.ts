import { computed, ref } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import {
  createOracleThread,
  deleteOracleThread,
  listOracleThreads,
  updateOracleThread,
  type OracleThreadDto,
} from '@/api/oracleApi'
import type { OracleMode, OracleThreadItem } from '@/features/oracle/oracleShell.types'
import {
  useOracleRunStore,
  type BackgroundOracleRun,
} from '@/store/useOracleRunStore'

const ACTIVE_THREAD_STORAGE_KEY = 'oracle_active_thread_id'
const AUTH_USER_STORAGE_KEY = 'ds_user'

function accountStorageKey(key: string, userId: string | null): string {
  return userId ? `${key}:${userId}` : key
}

function storedAccountId(): string | null {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_STORAGE_KEY) || 'null')?._id || null
  } catch {
    return null
  }
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
  const runStore = useOracleRunStore()
  const { backgroundRun, completedRun } = storeToRefs(runStore)
  const sessionUserId = ref<string | null>(storedAccountId())
  const threads = ref<OracleThreadItem[]>([])
  const activeThreadId = ref<string | null>(
    localStorage.getItem(accountStorageKey(ACTIVE_THREAD_STORAGE_KEY, sessionUserId.value)),
  )
  const isLoading = ref(false)
  const isMutating = ref(false)
  const errorCode = ref<string | null>(null)
  const citationChange = ref<{
    revision: number
    threadIds: string[]
    turnIds: string[]
  } | null>(null)

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
        void runStore.refreshTrackedRun(backgroundRun.value)
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
    const storageKey = accountStorageKey(ACTIVE_THREAD_STORAGE_KEY, sessionUserId.value)
    if (threadId) localStorage.setItem(storageKey, threadId)
    else localStorage.removeItem(storageKey)
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
    runStore.trackRun(threadId, runId, thread?.title || 'Oracle', metadata)
  }

  function completeRun(threadId: string) {
    const thread = threads.value.find((item) => item.id === threadId)
    if (thread) {
      thread.activeRunId = null
      thread.activeRunStatus = null
      thread.activeRunStartedAt = null
      thread.activeRunAssistantTurnId = null
    }
    runStore.completeRun(threadId, thread?.title)
  }

  function resetAccountState(): void {
    threads.value = []
    activeThreadId.value = null
    errorCode.value = null
    isLoading.value = false
    isMutating.value = false
    citationChange.value = null
  }

  function notifyCitationStateChanged(payload: {
    threadIds?: string[]
    turnIds?: string[]
  }): void {
    citationChange.value = {
      revision: (citationChange.value?.revision || 0) + 1,
      threadIds: [...new Set(payload.threadIds || [])],
      turnIds: [...new Set(payload.turnIds || [])],
    }
  }

  function startAccountSession(userId: string): void {
    resetAccountState()
    sessionUserId.value = userId
    activeThreadId.value = localStorage.getItem(accountStorageKey(ACTIVE_THREAD_STORAGE_KEY, userId))
    runStore.startAccountSession(userId)
  }

  function endAccountSession(): void {
    resetAccountState()
    runStore.endAccountSession()
    sessionUserId.value = null
  }

  return {
    threads,
    activeThreadId,
    activeThread,
    isLoading,
    isMutating,
    errorCode,
    citationChange,
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
    notifyCitationStateChanged,
    startAccountSession,
    endAccountSession,
  }
})
