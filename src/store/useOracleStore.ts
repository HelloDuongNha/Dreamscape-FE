import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ApiDream } from '@/api/types'
import apiClient from '@/api/client'
import { useDreamStore } from './useDreamStore'
import { useNotificationStore } from './useNotificationStore'

export const useOracleStore = defineStore('oracle', () => {
  const trackedDream = ref<ApiDream | null>(null)
  const isDialogVisible = ref(false)
  const isPinnedVisible = ref(false)
  const progress = ref(0)
  const elapsedSeconds = ref(0)
  const statusMessage = ref('Oracle đang phân tích giấc mơ...')
  const completedDream = ref<ApiDream | null>(null)
  const failedDream = ref<ApiDream | null>(null)

  let pollInterval: ReturnType<typeof setInterval> | null = null
  let progressInterval: ReturnType<typeof setInterval> | null = null
  let completionTimer: ReturnType<typeof setTimeout> | null = null
  let localStartedAt = 0

  function startTracking(dream: ApiDream) {
    stopTracking()

    trackedDream.value = dream
    if (dream.ai_status === 'completed') {
      handleSuccess(dream)
      return
    }
    if (dream.ai_status === 'failed') {
      handleFailure(dream)
      return
    }
    isDialogVisible.value = true
    isPinnedVisible.value = false
    progress.value = Math.max(0, Math.min(99, dream.analysisMetadata?.progress || 0))
    elapsedSeconds.value = 0
    localStartedAt = dream.analysisMetadata?.startedAt
      ? new Date(dream.analysisMetadata.startedAt).getTime()
      : Date.now()
    statusMessage.value = dream.analysisMetadata?.statusMessage || 'Oracle đang phân tích giấc mơ...'
    completedDream.value = null
    failedDream.value = null

    startElapsedClock()

    // Polling status every 2.5s
    startPolling(dream._id)
  }

  function startElapsedClock() {
    progressInterval = setInterval(() => {
      elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - localStartedAt) / 1000))
    }, 1000)
  }

  function startPolling(dreamId: string) {
    pollInterval = setInterval(async () => {
      try {
        const { data } = await apiClient.get<{ success: boolean; data: ApiDream }>(`/dreams/${dreamId}`)
        if (data.success) {
          const currentDream = data.data
          trackedDream.value = currentDream
          const metadata = currentDream.analysisMetadata
          if (metadata?.startedAt) {
            const serverStartedAt = new Date(metadata.startedAt).getTime()
            if (Number.isFinite(serverStartedAt)) localStartedAt = serverStartedAt
          }
          if (typeof metadata?.progress === 'number') {
            progress.value = Math.max(progress.value, Math.min(99, metadata.progress))
          }
          if (metadata?.statusMessage) statusMessage.value = metadata.statusMessage
          // Update the dream in the main store so any feed card updates automatically
          const dreamStore = useDreamStore()
          const idx = dreamStore.dreams.findIndex(d => d._id === dreamId)
          if (idx !== -1) {
            dreamStore.dreams[idx] = currentDream
          }

          if (currentDream.ai_status === 'completed') {
            handleSuccess(currentDream)
          } else if (currentDream.ai_status === 'failed') {
            handleFailure(currentDream)
          }
        }
      } catch (err) {
        console.warn('Polling error, continuing:', err)
      }
    }, 2500)
  }

  function handleSuccess(dream: ApiDream) {
    const keepCompletionVisible = isDialogVisible.value
    progress.value = 100
    trackedDream.value = dream
    completedDream.value = dream
    clearTimers()
    void useNotificationStore().fetchNotifications()
    if (!keepCompletionVisible) {
      isDialogVisible.value = false
      isPinnedVisible.value = true
      scheduleTerminalDismiss()
      return
    }
    isDialogVisible.value = true
    isPinnedVisible.value = false
  }

  function handleFailure(dream?: ApiDream) {
    clearCompletionTimer()
    progress.value = 0
    elapsedSeconds.value = 0
    failedDream.value = dream || trackedDream.value
    isDialogVisible.value = false
    isPinnedVisible.value = true // convert to failed pinned notification
    clearTimers()
    scheduleTerminalDismiss()
  }

  function clearTimers() {
    if (pollInterval) clearInterval(pollInterval)
    if (progressInterval) clearInterval(progressInterval)
    pollInterval = null
    progressInterval = null
  }

  function clearCompletionTimer() {
    if (completionTimer) clearTimeout(completionTimer)
    completionTimer = null
  }

  function stopTracking() {
    clearTimers()
    clearCompletionTimer()
    trackedDream.value = null
    isDialogVisible.value = false
    isPinnedVisible.value = false
    progress.value = 0
    completedDream.value = null
    failedDream.value = null
  }

  function scheduleTerminalDismiss() {
    clearCompletionTimer()
    completionTimer = setTimeout(() => {
      isPinnedVisible.value = false
      completionTimer = null
    }, 3000)
  }

  /** Hide is a presentation action. It must never cancel polling for a job. */
  function dismissPinned() {
    isPinnedVisible.value = false
    if (completedDream.value || failedDream.value) {
      clearCompletionTimer()
    }
  }

  function minimizeDialog() {
    clearCompletionTimer()
    isDialogVisible.value = false
    if (trackedDream.value) {
      isPinnedVisible.value = true
      if (completedDream.value || failedDream.value) scheduleTerminalDismiss()
    }
  }

  function openDialog() {
    if (trackedDream.value) {
      clearCompletionTimer()
      isDialogVisible.value = true
      isPinnedVisible.value = false
    }
  }

  function openCompletedDialog(dream: ApiDream) {
    clearTimers()
    clearCompletionTimer()
    trackedDream.value = dream
    completedDream.value = dream
    failedDream.value = null
    progress.value = 100
    statusMessage.value = dream.analysisMetadata?.statusMessage || 'Phân tích hoàn tất.'
    localStartedAt = dream.analysisMetadata?.startedAt
      ? new Date(dream.analysisMetadata.startedAt).getTime()
      : Date.now()
    elapsedSeconds.value = typeof dream.analysisMetadata?.durationMs === 'number'
      ? Math.max(0, Math.round(dream.analysisMetadata.durationMs / 1000))
      : Math.max(0, Math.floor((Date.now() - localStartedAt) / 1000))
    isDialogVisible.value = true
    isPinnedVisible.value = false
  }

  return {
    trackedDream,
    isDialogVisible,
    isPinnedVisible,
    progress,
    elapsedSeconds,
    statusMessage,
    completedDream,
    failedDream,
    startTracking,
    stopTracking,
    dismissPinned,
    minimizeDialog,
    openDialog,
    openCompletedDialog,
  }
})
