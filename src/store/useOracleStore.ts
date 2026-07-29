import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ApiDream } from '@/api/types'
import apiClient from '@/api/client'
import { useDreamStore } from './useDreamStore'
import { useNotificationStore } from './useNotificationStore'

const ORACLE_DREAM_TASK_KEY = 'dreamscape:pinned-task:oracle-dream:v2'
const LEGACY_ORACLE_DREAM_TASK_KEY = 'dreamscape:pinned-task:oracle-dream:v1'
const TERMINAL_DISPLAY_MS = 3000

type DreamAnalysisStatus = 'pending' | 'completed' | 'failed' | 'cancelled'
type DreamTaskPresentation = 'dialog' | 'pinned' | 'hidden'

export interface DreamAnalysisTask {
  dreamId: string
  dream: ApiDream
  status: DreamAnalysisStatus
  progress: number
  elapsedSeconds: number
  statusMessage: string
  startedAtMs: number
  presentation: DreamTaskPresentation
  expiresAt: number | null
  createdAt: number
}

interface PersistedDreamTask {
  dreamId: string
  presentation: DreamTaskPresentation
  expiresAt: number | null
  createdAt: number
}

function analysisStatus(dream: ApiDream): DreamAnalysisStatus {
  if (dream.ai_status === 'completed') return 'completed'
  if (dream.ai_status === 'failed') return 'failed'
  if (dream.ai_status === 'cancelled') return 'cancelled'
  return 'pending'
}

function startedAtMs(dream: ApiDream): number {
  const processingStartedAt = dream.analysisMetadata?.processingStartedAt
  const queuedStartedAt = dream.analysisMetadata?.startedAt
  const parsed = (processingStartedAt || queuedStartedAt)
    ? new Date(processingStartedAt || queuedStartedAt || '').getTime()
    : Number.NaN
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function initialProgress(dream: ApiDream): number {
  if (dream.ai_status === 'completed' || dream.ai_status === 'cancelled') return 100
  if (dream.ai_status === 'failed') return 0
  return Math.max(0, Math.min(99, dream.analysisMetadata?.progress || 0))
}

function terminalAnalysisStatus(
  dream: ApiDream,
): Exclude<DreamAnalysisStatus, 'pending'> | null {
  if (dream.ai_status === 'completed') return 'completed'
  if (dream.ai_status === 'failed') return 'failed'
  if (dream.ai_status === 'cancelled') return 'cancelled'
  return null
}

function parsePersistedTasks(raw: string): PersistedDreamTask[] {
  const saved: unknown = JSON.parse(raw)
  if (!isRecord(saved)) return []

  if (Array.isArray(saved.tasks)) {
    return saved.tasks
      .map(normalizePersistedTask)
      .filter((task): task is PersistedDreamTask => task !== null)
  }

  const legacyTask = normalizePersistedTask(saved)
  return legacyTask ? [{ ...legacyTask, presentation: 'pinned' }] : []
}

function normalizePersistedTask(value: unknown): PersistedDreamTask | null {
  if (!isRecord(value) || typeof value.dreamId !== 'string') return null
  const presentation: DreamTaskPresentation =
    value.presentation === 'dialog'
    || value.presentation === 'hidden'
    || value.presentation === 'pinned'
      ? value.presentation
      : 'pinned'
  return {
    dreamId: value.dreamId,
    presentation,
    expiresAt: typeof value.expiresAt === 'number' ? value.expiresAt : null,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

export const useOracleStore = defineStore('oracle', () => {
  const tasks = ref<DreamAnalysisTask[]>([])
  const activeDreamId = ref<string | null>(null)
  const isDialogVisible = ref(false)
  const isCancelling = ref(false)

  const pollIntervals = new Map<string, ReturnType<typeof setInterval>>()
  const elapsedIntervals = new Map<string, ReturnType<typeof setInterval>>()
  const completionTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const pollingDreamIds = new Set<string>()

  const activeTask = computed(() =>
    tasks.value.find(task => task.dreamId === activeDreamId.value) || null,
  )
  const pinnedTasks = computed(() =>
    tasks.value
      .filter(task => task.presentation === 'pinned')
      .sort((left, right) => left.createdAt - right.createdAt),
  )

  // Compatibility facade for the existing analysis modal.
  const trackedDream = computed(() => activeTask.value?.dream || null)
  const progress = computed(() => activeTask.value?.progress || 0)
  const elapsedSeconds = computed(() => activeTask.value?.elapsedSeconds || 0)
  const statusMessage = computed(() =>
    activeTask.value?.statusMessage || 'Oracle đang phân tích giấc mơ...',
  )
  const completedDream = computed(() =>
    activeTask.value?.status === 'completed' ? activeTask.value.dream : null,
  )
  const failedDream = computed(() =>
    activeTask.value?.status === 'failed' ? activeTask.value.dream : null,
  )
  const cancelledDream = computed(() =>
    activeTask.value?.status === 'cancelled' ? activeTask.value.dream : null,
  )
  const isPinnedVisible = computed(() => activeTask.value?.presentation === 'pinned')

  function findTask(dreamId: string): DreamAnalysisTask | undefined {
    return tasks.value.find(task => task.dreamId === dreamId)
  }

  function replaceDreamInFeed(dream: ApiDream) {
    const dreamStore = useDreamStore()
    const index = dreamStore.dreams.findIndex(item => item._id === dream._id)
    if (index !== -1) {
      const existingUser = dreamStore.dreams[index].userId
      dreamStore.dreams[index] = {
        ...dream,
        userId: dream.userId || existingUser,
      }
    }
  }

  function createOrUpdateTask(
    dream: ApiDream,
    presentation: DreamTaskPresentation,
    expiresAt: number | null = null,
    createdAt = Date.now(),
  ): DreamAnalysisTask {
    const existing = findTask(dream._id)
    const status = analysisStatus(dream)
    if (existing) {
      existing.dream = dream
      existing.status = status
      existing.presentation = presentation
      existing.expiresAt = expiresAt
      existing.startedAtMs = startedAtMs(dream)
      existing.progress = initialProgress(dream)
      existing.statusMessage = dream.analysisMetadata?.statusMessage
        || existing.statusMessage
      return existing
    }

    const task: DreamAnalysisTask = {
      dreamId: dream._id,
      dream,
      status,
      progress: initialProgress(dream),
      elapsedSeconds: 0,
      statusMessage: dream.analysisMetadata?.statusMessage || 'Oracle đang phân tích giấc mơ...',
      startedAtMs: startedAtMs(dream),
      presentation,
      expiresAt,
      createdAt,
    }
    tasks.value.push(task)
    return task
  }

  function persistTasks() {
    const persistedTasks: PersistedDreamTask[] = tasks.value.map(task => ({
      dreamId: task.dreamId,
      presentation: task.presentation,
      expiresAt: task.expiresAt,
      createdAt: task.createdAt,
    }))
    if (persistedTasks.length === 0) {
      localStorage.removeItem(ORACLE_DREAM_TASK_KEY)
      localStorage.removeItem(LEGACY_ORACLE_DREAM_TASK_KEY)
      return
    }
    localStorage.setItem(ORACLE_DREAM_TASK_KEY, JSON.stringify({
      version: 2,
      activeDreamId: activeDreamId.value,
      tasks: persistedTasks,
    }))
    localStorage.removeItem(LEGACY_ORACLE_DREAM_TASK_KEY)
  }

  function clearTaskTimers(dreamId: string) {
    const pollInterval = pollIntervals.get(dreamId)
    if (pollInterval) clearInterval(pollInterval)
    pollIntervals.delete(dreamId)

    const elapsedInterval = elapsedIntervals.get(dreamId)
    if (elapsedInterval) clearInterval(elapsedInterval)
    elapsedIntervals.delete(dreamId)
    pollingDreamIds.delete(dreamId)
  }

  function clearCompletionTimer(dreamId: string) {
    const timer = completionTimers.get(dreamId)
    if (timer) clearTimeout(timer)
    completionTimers.delete(dreamId)
  }

  function removeTask(dreamId: string) {
    clearTaskTimers(dreamId)
    clearCompletionTimer(dreamId)
    tasks.value = tasks.value.filter(task => task.dreamId !== dreamId)
    if (activeDreamId.value === dreamId) {
      activeDreamId.value = null
      isDialogVisible.value = false
      isCancelling.value = false
    }
    persistTasks()
  }

  function scheduleTerminalDismiss(dreamId: string, delayMs = TERMINAL_DISPLAY_MS) {
    clearCompletionTimer(dreamId)
    completionTimers.set(dreamId, setTimeout(() => {
      const task = findTask(dreamId)
      if (task?.presentation === 'pinned') removeTask(dreamId)
      completionTimers.delete(dreamId)
    }, Math.max(0, delayMs)))
  }

  function startElapsedClock(dreamId: string) {
    if (elapsedIntervals.has(dreamId)) return
    elapsedIntervals.set(dreamId, setInterval(() => {
      const task = findTask(dreamId)
      if (!task || task.status !== 'pending') return
      task.elapsedSeconds = Math.max(0, Math.floor((Date.now() - task.startedAtMs) / 1000))
    }, 1000))
  }

  function finishTask(dream: ApiDream, status: Exclude<DreamAnalysisStatus, 'pending'>) {
    const task = findTask(dream._id)
      || createOrUpdateTask(dream, 'pinned')
    task.dream = dream
    task.status = status
    task.progress = status === 'failed' ? 0 : 100
    task.statusMessage = dream.analysisMetadata?.statusMessage || (
      status === 'cancelled' ? 'Hủy tác vụ thành công.' : task.statusMessage
    )
    replaceDreamInFeed(dream)
    clearTaskTimers(dream._id)

    const remainsInOpenDialog =
      activeDreamId.value === dream._id && isDialogVisible.value
    if (remainsInOpenDialog) {
      task.presentation = 'dialog'
      task.expiresAt = null
      clearCompletionTimer(dream._id)
    } else {
      task.presentation = 'pinned'
      task.expiresAt = Date.now() + TERMINAL_DISPLAY_MS
      scheduleTerminalDismiss(dream._id)
    }
    persistTasks()
  }

  function startPolling(dreamId: string) {
    if (pollIntervals.has(dreamId)) return
    pollIntervals.set(dreamId, setInterval(async () => {
      if (pollingDreamIds.has(dreamId)) return
      pollingDreamIds.add(dreamId)
      try {
        const { data } = await apiClient.get<{ success: boolean; data: ApiDream }>(
          `/dreams/${dreamId}`,
        )
        if (!data.success) return

        const dream = data.data
        const task = findTask(dreamId)
        if (!task) return
        syncTaskFromDream(task, dream)
        handlePolledTerminalDream(dream)
      } catch (error) {
        console.warn(`Dream analysis polling continues for ${dreamId}:`, error)
      } finally {
        pollingDreamIds.delete(dreamId)
      }
    }, 2500))
  }

  function syncTaskFromDream(task: DreamAnalysisTask, dream: ApiDream) {
    task.dream = dream
    task.status = analysisStatus(dream)
    const metadata = dream.analysisMetadata
    if (metadata?.startedAt) task.startedAtMs = startedAtMs(dream)
    if (typeof metadata?.progress === 'number') {
      task.progress = Math.min(99, Math.max(0, metadata.progress))
    }
    if (metadata?.statusMessage) task.statusMessage = metadata.statusMessage
    replaceDreamInFeed(dream)
  }

  function handlePolledTerminalDream(dream: ApiDream) {
    const terminalStatus = terminalAnalysisStatus(dream)
    if (!terminalStatus) return
    finishTask(dream, terminalStatus)
    if (terminalStatus === 'completed') {
      void useNotificationStore().fetchNotifications()
    }
  }

  function startPendingTask(task: DreamAnalysisTask) {
    clearCompletionTimer(task.dreamId)
    task.expiresAt = null
    startElapsedClock(task.dreamId)
    startPolling(task.dreamId)
  }

  function startTracking(dream: ApiDream) {
    pinPreviousDialog(dream._id)

    const task = createOrUpdateTask(dream, 'dialog')
    activeDreamId.value = dream._id
    isDialogVisible.value = true
    isCancelling.value = false

    if (task.status === 'pending') {
      startPendingTask(task)
    } else {
      clearTaskTimers(task.dreamId)
    }
    persistTasks()
  }

  function pinPreviousDialog(nextDreamId: string) {
    const previousActive = activeTask.value
    if (!previousActive || previousActive.dreamId === nextDreamId) return
    if (previousActive.presentation === 'dialog') {
      previousActive.presentation = 'pinned'
    }
  }

  async function restoreTracking() {
    const raw = localStorage.getItem(ORACLE_DREAM_TASK_KEY)
      || localStorage.getItem(LEGACY_ORACLE_DREAM_TASK_KEY)
    if (!raw) return

    try {
      const savedTasks = parsePersistedTasks(raw)

      const restoredTasks = await Promise.all(savedTasks.map(async persisted => {
        if (persisted.expiresAt && persisted.expiresAt <= Date.now()) return
        try {
          const { data } = await apiClient.get<{ success: boolean; data: ApiDream }>(
            `/dreams/${persisted.dreamId}`,
          )
          return data.success ? { persisted, dream: data.data } : undefined
        } catch {
          // One inaccessible/removed dream must not prevent restoring other jobs.
          return undefined
        }
      }))

      for (const restored of restoredTasks) {
        if (!restored) continue
        const { persisted, dream } = restored
        const status = analysisStatus(dream)
        const presentation = status === 'pending'
          ? persisted.presentation === 'hidden' ? 'hidden' : 'pinned'
          : 'pinned'
        const expiresAt = status === 'pending'
          ? null
          : persisted.expiresAt || Date.now() + TERMINAL_DISPLAY_MS
        const task = createOrUpdateTask(
          dream,
          presentation,
          expiresAt,
          Number.isFinite(persisted.createdAt) ? persisted.createdAt : Date.now(),
        )
        replaceDreamInFeed(dream)

        if (status === 'pending') {
          startPendingTask(task)
        } else if (expiresAt) {
          scheduleTerminalDismiss(task.dreamId, expiresAt - Date.now())
        }
      }
      activeDreamId.value = null
      isDialogVisible.value = false
      persistTasks()
    } catch {
      localStorage.removeItem(ORACLE_DREAM_TASK_KEY)
      localStorage.removeItem(LEGACY_ORACLE_DREAM_TASK_KEY)
    }
  }

  function openTask(dreamId: string) {
    const task = findTask(dreamId)
    if (!task) return
    pinPreviousDialog(dreamId)
    clearCompletionTimer(dreamId)
    task.presentation = 'dialog'
    task.expiresAt = null
    activeDreamId.value = dreamId
    isDialogVisible.value = true
    persistTasks()
  }

  function openDialog() {
    if (activeDreamId.value) openTask(activeDreamId.value)
  }

  function minimizeDialog() {
    const task = activeTask.value
    if (!task) return
    task.presentation = 'pinned'
    isDialogVisible.value = false
    if (task.status !== 'pending') {
      task.expiresAt = Date.now() + TERMINAL_DISPLAY_MS
      scheduleTerminalDismiss(task.dreamId)
    }
    persistTasks()
  }

  function dismissPinned(dreamId = activeDreamId.value) {
    if (!dreamId) return
    const task = findTask(dreamId)
    if (!task) return
    if (task.status === 'pending') {
      task.presentation = 'hidden'
      persistTasks()
      return
    }
    removeTask(dreamId)
  }

  function stopTracking(dreamId = activeDreamId.value) {
    if (dreamId) removeTask(dreamId)
  }

  async function cancelAnalysis() {
    const task = activeTask.value
    if (!task || task.status !== 'pending' || isCancelling.value) return
    isCancelling.value = true
    try {
      const { data } = await apiClient.post<{ success: boolean; data: ApiDream }>(
        `/dreams/${task.dreamId}/analysis/cancel`,
      )
      if (data.success) finishTask(data.data, 'cancelled')
    } finally {
      isCancelling.value = false
    }
  }

  async function retryAnalysis() {
    const dreamId = activeDreamId.value
    if (!dreamId) return
    const { data } = await apiClient.post<{ success: boolean; data: ApiDream }>(
      `/dreams/${dreamId}/analyze`,
    )
    if (data.success) startTracking(data.data)
  }

  function openCompletedDialog(dream: ApiDream) {
    const task = createOrUpdateTask(dream, 'dialog')
    task.status = 'completed'
    task.progress = 100
    task.elapsedSeconds = typeof dream.analysisMetadata?.durationMs === 'number'
      ? Math.max(0, Math.round(dream.analysisMetadata.durationMs / 1000))
      : Math.max(0, Math.floor((Date.now() - task.startedAtMs) / 1000))
    clearTaskTimers(task.dreamId)
    clearCompletionTimer(task.dreamId)
    activeDreamId.value = task.dreamId
    isDialogVisible.value = true
    persistTasks()
  }

  return {
    tasks,
    pinnedTasks,
    activeDreamId,
    trackedDream,
    isDialogVisible,
    isPinnedVisible,
    progress,
    elapsedSeconds,
    statusMessage,
    completedDream,
    failedDream,
    cancelledDream,
    isCancelling,
    startTracking,
    restoreTracking,
    stopTracking,
    dismissPinned,
    minimizeDialog,
    openTask,
    openDialog,
    openCompletedDialog,
    cancelAnalysis,
    retryAnalysis,
  }
})
