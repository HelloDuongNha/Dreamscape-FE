import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getOracleRunStatus } from '@/api/oracleApi'

const RUN_NOTIFICATION_KEY = 'dreamscape:oracle-run-notification:v1'

export interface BackgroundOracleRun {
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

export interface CompletedOracleRun {
  threadId: string
  title: string
  expiresAt: number
}

function storageKey(userId: string | null): string {
  return userId ? `${RUN_NOTIFICATION_KEY}:${userId}` : RUN_NOTIFICATION_KEY
}

function restoreNotification(userId: string | null): {
  background: BackgroundOracleRun | null
  completed: CompletedOracleRun | null
} {
  const key = storageKey(userId)
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (saved?.kind === 'background' && saved.runId && saved.threadId) {
      return { background: saved, completed: null }
    }
    if (saved?.kind === 'completed' && Number(saved.expiresAt) > Date.now()) {
      return { background: null, completed: saved }
    }
    localStorage.removeItem(key)
  } catch {
    localStorage.removeItem(key)
  }
  return { background: null, completed: null }
}

export const useOracleRunStore = defineStore('oracleRun', () => {
  const sessionUserId = ref<string | null>(null)
  const backgroundRun = ref<BackgroundOracleRun | null>(null)
  const completedRun = ref<CompletedOracleRun | null>(null)
  let completionTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  function trackRun(
    threadId: string,
    runId: string,
    title: string,
    metadata: Partial<Omit<BackgroundOracleRun, 'threadId' | 'runId' | 'title'>> = {},
  ): void {
    const previous = backgroundRun.value?.runId === runId ? backgroundRun.value : null
    const nextRun: BackgroundOracleRun = {
      threadId,
      runId,
      title,
      startedAt: metadata.startedAt || previous?.startedAt || new Date().toISOString(),
      expectedMinMs: metadata.expectedMinMs ?? previous?.expectedMinMs ?? null,
      expectedMaxMs: metadata.expectedMaxMs ?? previous?.expectedMaxMs ?? null,
      stage: metadata.stage || previous?.stage || 'thinking',
      stageStartedAt: metadata.stageStartedAt || previous?.stageStartedAt || null,
      assistantTurnId: metadata.assistantTurnId || previous?.assistantTurnId || null,
    }
    backgroundRun.value = nextRun
    completedRun.value = null
    localStorage.setItem(storageKey(sessionUserId.value), JSON.stringify({
      kind: 'background',
      ...nextRun,
    }))
    if (completionTimer) clearTimeout(completionTimer)
    schedulePoll()
  }

  function completeRun(threadId: string, title?: string): void {
    completedRun.value = {
      threadId,
      title: title || backgroundRun.value?.title || 'Oracle',
      expiresAt: Date.now() + 3000,
    }
    backgroundRun.value = null
    localStorage.setItem(storageKey(sessionUserId.value), JSON.stringify({
      kind: 'completed',
      ...completedRun.value,
    }))
    clearPoll()
    scheduleCompletionCleanup()
  }

  async function refreshTrackedRun(
    tracked: BackgroundOracleRun = backgroundRun.value as BackgroundOracleRun,
  ): Promise<void> {
    if (!tracked) return
    const status = await getOracleRunStatus(tracked.runId)
    if (backgroundRun.value?.runId !== tracked.runId) return
    if (['completed', 'cancelled', 'failed'].includes(status.status)) {
      completeRun(status.threadId, tracked.title)
      return
    }
    trackRun(status.threadId, status.runId, tracked.title, {
      startedAt: status.startedAt,
      expectedMinMs: status.expectedMinMs,
      expectedMaxMs: status.expectedMaxMs,
      stage: status.stage,
      stageStartedAt: status.stageStartedAt,
      assistantTurnId: status.assistantTurnId,
    })
  }

  function schedulePoll(): void {
    if (pollTimer || !backgroundRun.value) return
    pollTimer = setTimeout(async () => {
      pollTimer = null
      const tracked = backgroundRun.value
      if (!tracked) return
      try {
        await refreshTrackedRun(tracked)
      } catch {
        // A transient status failure must not discard a running job.
      } finally {
        if (backgroundRun.value) schedulePoll()
      }
    }, 4000)
  }

  function clearPoll(): void {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  function scheduleCompletionCleanup(): void {
    if (!completedRun.value) return
    if (completionTimer) clearTimeout(completionTimer)
    completionTimer = setTimeout(() => {
      completedRun.value = null
      localStorage.removeItem(storageKey(sessionUserId.value))
      completionTimer = null
    }, Math.max(0, completedRun.value.expiresAt - Date.now()))
  }

  function startAccountSession(userId: string): void {
    reset()
    sessionUserId.value = userId
    const restored = restoreNotification(userId)
    backgroundRun.value = restored.background
    completedRun.value = restored.completed
    if (backgroundRun.value) schedulePoll()
    scheduleCompletionCleanup()
  }

  function endAccountSession(): void {
    reset()
    sessionUserId.value = null
  }

  function reset(): void {
    clearPoll()
    if (completionTimer) clearTimeout(completionTimer)
    completionTimer = null
    backgroundRun.value = null
    completedRun.value = null
  }

  return {
    backgroundRun,
    completedRun,
    trackRun,
    completeRun,
    refreshTrackedRun,
    startAccountSession,
    endAccountSession,
  }
})
