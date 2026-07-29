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
import { getApiErrorDataCode } from '@/utils/apiError'

const ACTIVE_THREAD_STORAGE_KEY = 'oracle_active_thread_id'
const PROMPT_QUEUE_STORAGE_KEY = 'oracle_prompt_queue_v1'
const AUTH_USER_STORAGE_KEY = 'ds_user'

export interface QueuedOraclePrompt {
  id: string
  threadId: string | null
  content: string
  createdAt: number
}

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

function restorePromptQueue(userId: string | null): QueuedOraclePrompt[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(accountStorageKey(PROMPT_QUEUE_STORAGE_KEY, userId)) || '[]',
    )
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is QueuedOraclePrompt =>
      typeof item?.id === 'string'
      && (typeof item?.threadId === 'string' || item?.threadId === null)
      && typeof item?.content === 'string'
      && item.content.trim().length > 0
      && Number.isFinite(item?.createdAt))
  } catch {
    return []
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
  const promptQueue = ref<QueuedOraclePrompt[]>(restorePromptQueue(sessionUserId.value))
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

  function persistPromptQueue() {
    const key = accountStorageKey(PROMPT_QUEUE_STORAGE_KEY, sessionUserId.value)
    if (promptQueue.value.length) localStorage.setItem(key, JSON.stringify(promptQueue.value))
    else localStorage.removeItem(key)
  }

  function enqueuePrompt(threadId: string | null, content: string): QueuedOraclePrompt | null {
    const normalized = content.trim()
    if (!normalized) return null
    const prompt = {
      id: crypto.randomUUID(),
      threadId,
      content: normalized,
      createdAt: Date.now(),
    }
    promptQueue.value.push(prompt)
    persistPromptQueue()
    return prompt
  }

  function updateQueuedPrompt(id: string, content: string) {
    const prompt = promptQueue.value.find((item) => item.id === id)
    const normalized = content.trim()
    if (!prompt || !normalized) return
    prompt.content = normalized
    persistPromptQueue()
  }

  function removeQueuedPrompt(id: string) {
    promptQueue.value = promptQueue.value.filter((item) => item.id !== id)
    persistPromptQueue()
  }

  function assignUnscopedPrompts(threadId: string) {
    let changed = false
    promptQueue.value.forEach((item) => {
      if (item.threadId !== null) return
      item.threadId = threadId
      changed = true
    })
    if (changed) persistPromptQueue()
  }

  function promptsForThread(threadId: string | null): QueuedOraclePrompt[] {
    return promptQueue.value.filter((item) => item.threadId === threadId)
  }

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

  function captureError(error: unknown): never {
    errorCode.value = getApiErrorDataCode(error) || 'oracle_internal_error'
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
      promptQueue.value = promptQueue.value.filter((prompt) => prompt.threadId !== threadId)
      persistPromptQueue()
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
    promptQueue.value = []
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
    promptQueue.value = restorePromptQueue(userId)
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
    promptQueue,
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
    enqueuePrompt,
    updateQueuedPrompt,
    removeQueuedPrompt,
    assignUnscopedPrompts,
    promptsForThread,
    notifyCitationStateChanged,
    startAccountSession,
    endAccountSession,
  }
})
