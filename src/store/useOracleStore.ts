import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ApiDream } from '@/api/types'
import apiClient from '@/api/client'
import { useDreamStore } from './useDreamStore'

export const useOracleStore = defineStore('oracle', () => {
  const trackedDream = ref<ApiDream | null>(null)
  const isDialogVisible = ref(false)
  const isPinnedVisible = ref(false)
  const progress = ref(0)
  const statusMessage = ref('Oracle đang phân tích giấc mơ...')
  const completedDream = ref<ApiDream | null>(null)
  const failedDream = ref<ApiDream | null>(null)

  let pollInterval: ReturnType<typeof setInterval> | null = null
  let progressInterval: ReturnType<typeof setInterval> | null = null

  function startTracking(dream: ApiDream) {
    stopTracking()

    trackedDream.value = dream
    isDialogVisible.value = true
    isPinnedVisible.value = false
    progress.value = 0
    statusMessage.value = 'Oracle đang phân tích giấc mơ...'
    completedDream.value = null
    failedDream.value = null

    // Simulated progress (stops at 90%)
    startSimulatedProgress()

    // Polling status every 2.5s
    startPolling(dream._id)
  }

  function startSimulatedProgress() {
    progressInterval = setInterval(() => {
      if (progress.value < 20) {
        progress.value += 4
      } else if (progress.value < 50) {
        progress.value += 3
      } else if (progress.value < 80) {
        progress.value += 2
      } else if (progress.value < 90) {
        progress.value += 1
      }
    }, 1000)
  }

  function startPolling(dreamId: string) {
    const startTime = Date.now()
    const maxPollTime = 110000 // 110 seconds max polling duration

    pollInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime
      if (elapsed > maxPollTime) {
        // Stop polling, perform one final refetch, then show failed state
        clearTimers()
        try {
          const { data } = await apiClient.get<{ success: boolean; data: ApiDream }>(`/dreams/${dreamId}`)
          if (data.success && data.data.ai_status === 'completed') {
            handleSuccess(data.data)
            return
          }
        } catch (err) {
          console.warn('Final refetch failed:', err)
        }
        handleFailure()
        return
      }

      try {
        const { data } = await apiClient.get<{ success: boolean; data: ApiDream }>(`/dreams/${dreamId}`)
        if (data.success) {
          const currentDream = data.data
          // Update the dream in the main store so any feed card updates automatically
          const dreamStore = useDreamStore()
          const idx = dreamStore.dreams.findIndex(d => d._id === dreamId)
          if (idx !== -1) {
            dreamStore.dreams[idx] = currentDream
          }

          if (currentDream.ai_status === 'completed') {
            handleSuccess(currentDream)
          } else if (currentDream.ai_status === 'failed') {
            handleFailure()
          }
        }
      } catch (err) {
        console.warn('Polling error, continuing:', err)
      }
    }, 2500)
  }

  function handleSuccess(dream: ApiDream) {
    progress.value = 100
    completedDream.value = dream
    isDialogVisible.value = false
    isPinnedVisible.value = true // convert to completion pinned notification
    clearTimers()
  }

  function handleFailure() {
    progress.value = 0
    failedDream.value = trackedDream.value
    isDialogVisible.value = false
    isPinnedVisible.value = true // convert to failed pinned notification
    clearTimers()
  }

  function clearTimers() {
    if (pollInterval) clearInterval(pollInterval)
    if (progressInterval) clearInterval(progressInterval)
    pollInterval = null
    progressInterval = null
  }

  function stopTracking() {
    clearTimers()
    trackedDream.value = null
    isDialogVisible.value = false
    isPinnedVisible.value = false
    progress.value = 0
    completedDream.value = null
    failedDream.value = null
  }

  function minimizeDialog() {
    isDialogVisible.value = false
    if (trackedDream.value && trackedDream.value.ai_status === 'pending') {
      isPinnedVisible.value = true
    }
  }

  function openDialog() {
    if (trackedDream.value && trackedDream.value.ai_status === 'pending') {
      isDialogVisible.value = true
      isPinnedVisible.value = false
    }
  }

  return {
    trackedDream,
    isDialogVisible,
    isPinnedVisible,
    progress,
    statusMessage,
    completedDream,
    failedDream,
    startTracking,
    stopTracking,
    minimizeDialog,
    openDialog,
  }
})
