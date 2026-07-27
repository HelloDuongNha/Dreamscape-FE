import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import apiClient from '@/api/client'
import type { ApiDream } from '@/api/types'
import { useDreamStore } from './useDreamStore'
import { usePostStore } from './usePostStore'

const STORAGE_KEY = 'dreamscape:pinned-task:dream-continuation:v1'
const TERMINAL_DISPLAY_MS = 3000

export interface DreamContinuationTask {
  dreamId: string
  dream: ApiDream
  status: 'pending' | 'completed' | 'failed'
  progress: number
  elapsedSeconds: number
  statusMessage: string
  startedAtMs: number
  presentation: 'dialog' | 'pinned'
  createdAt: number
}

function taskStatus(dream: ApiDream): DreamContinuationTask['status'] {
  if (dream.continuationMetadata?.status === 'completed') return 'completed'
  if (dream.continuationMetadata?.status === 'failed') return 'failed'
  return 'pending'
}

export const useDreamContinuationStore = defineStore('dreamContinuation', () => {
  const tasks = ref<DreamContinuationTask[]>([])
  const pollers = new Map<string, ReturnType<typeof setInterval>>()
  const clocks = new Map<string, ReturnType<typeof setInterval>>()
  const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const pinnedTasks = computed(() => tasks.value
    .filter(task => task.presentation === 'pinned')
    .sort((left, right) => left.createdAt - right.createdAt))

  function findTask(dreamId: string) {
    return tasks.value.find(task => task.dreamId === dreamId)
  }

  function persist() {
    const pending = tasks.value
      .filter(task => task.status === 'pending')
      .map(task => ({ dreamId: task.dreamId, presentation: task.presentation, createdAt: task.createdAt }))
    if (!pending.length) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  }

  function syncDream(dream: ApiDream) {
    const dreamStore = useDreamStore()
    const index = dreamStore.dreams.findIndex(item => item._id === dream._id)
    if (index >= 0) dreamStore.dreams[index] = { ...dreamStore.dreams[index], ...dream }
    const postStore = usePostStore()
    if (postStore.focusedDream?._id === dream._id) Object.assign(postStore.focusedDream, dream)
  }

  function stopTimers(dreamId: string) {
    const poller = pollers.get(dreamId)
    if (poller) clearInterval(poller)
    pollers.delete(dreamId)
    const clock = clocks.get(dreamId)
    if (clock) clearInterval(clock)
    clocks.delete(dreamId)
  }

  function removeTask(dreamId: string) {
    stopTimers(dreamId)
    const timer = dismissTimers.get(dreamId)
    if (timer) clearTimeout(timer)
    dismissTimers.delete(dreamId)
    tasks.value = tasks.value.filter(task => task.dreamId !== dreamId)
    persist()
  }

  function finishTask(task: DreamContinuationTask, dream: ApiDream) {
    task.dream = dream
    task.status = taskStatus(dream)
    task.progress = task.status === 'completed' ? 100 : 0
    task.statusMessage = dream.continuationMetadata?.statusMessage || task.statusMessage
    syncDream(dream)
    stopTimers(task.dreamId)
    if (task.presentation === 'pinned') {
      dismissTimers.set(task.dreamId, setTimeout(() => removeTask(task.dreamId), TERMINAL_DISPLAY_MS))
    }
    persist()
  }

  async function poll(dreamId: string) {
    const task = findTask(dreamId)
    if (!task) return
    try {
      const response = await apiClient.get<{ success: boolean; data: ApiDream }>(`/dreams/${dreamId}`)
      if (!response.data.success) return
      const dream = response.data.data
      task.dream = dream
      task.progress = Math.max(0, Math.min(100, dream.continuationMetadata?.progress || 0))
      task.statusMessage = dream.continuationMetadata?.statusMessage || task.statusMessage
      syncDream(dream)
      if (taskStatus(dream) !== 'pending') finishTask(task, dream)
    } catch {
      // A transient poll failure must not discard a server-side task.
    }
  }

  function startTimers(task: DreamContinuationTask) {
    if (!clocks.has(task.dreamId)) {
      clocks.set(task.dreamId, setInterval(() => {
        task.elapsedSeconds = Math.max(0, Math.floor((Date.now() - task.startedAtMs) / 1000))
      }, 1000))
    }
    if (!pollers.has(task.dreamId)) {
      pollers.set(task.dreamId, setInterval(() => void poll(task.dreamId), 1800))
    }
  }

  function track(dream: ApiDream, presentation: DreamContinuationTask['presentation'] = 'dialog') {
    const metadata = dream.continuationMetadata
    const startedAt = metadata?.startedAt || metadata?.enqueuedAt
    const parsedStart = startedAt ? new Date(startedAt).getTime() : Date.now()
    let task = findTask(dream._id)
    if (!task) {
      task = {
        dreamId: dream._id,
        dream,
        status: taskStatus(dream),
        progress: metadata?.progress || 0,
        elapsedSeconds: 0,
        statusMessage: metadata?.statusMessage || '',
        startedAtMs: Number.isFinite(parsedStart) ? parsedStart : Date.now(),
        presentation,
        createdAt: Date.now(),
      }
      tasks.value.push(task)
    } else {
      task.dream = dream
      task.status = taskStatus(dream)
      task.progress = metadata?.progress || task.progress
      task.statusMessage = metadata?.statusMessage || task.statusMessage
      task.presentation = presentation
    }
    if (task.status === 'pending') startTimers(task)
    persist()
    return task
  }

  async function start(dreamId: string) {
    const response = await apiClient.post<{ success: boolean; data: ApiDream }>(
      `/dreams/${dreamId}/continuation/regenerate`,
    )
    return track(response.data.data, 'dialog')
  }

  function pin(dreamId: string) {
    const task = findTask(dreamId)
    if (!task || task.status !== 'pending') return
    task.presentation = 'pinned'
    persist()
  }

  function showInDialog(dreamId: string) {
    const task = findTask(dreamId)
    if (task) task.presentation = 'dialog'
    persist()
  }

  async function restoreTracking() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as Array<{ dreamId: string; presentation: 'dialog' | 'pinned' }>
      await Promise.all(saved.map(async item => {
        try {
          const response = await apiClient.get<{ success: boolean; data: ApiDream }>(`/dreams/${item.dreamId}`)
          if (response.data.success && taskStatus(response.data.data) === 'pending') {
            track(response.data.data, 'pinned')
          }
        } catch {
          // Ignore inaccessible dreams while restoring other tasks.
        }
      }))
    } finally {
      persist()
    }
  }

  return {
    tasks,
    pinnedTasks,
    findTask,
    start,
    pin,
    showInDialog,
    restoreTracking,
  }
})
