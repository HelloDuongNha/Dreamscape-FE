import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/api/client'
import type { ApiNotification } from '@/api/types'

export const useNotificationStore = defineStore('notification', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const notifications = ref<ApiNotification[]>([])
  const isLoading = ref(false)

  // ── Getters ────────────────────────────────────────────────────────────────
  const unreadCount = computed<number>(() =>
    notifications.value.filter(n => !n.isRead).length
  )

  // ── Actions ────────────────────────────────────────────────────────────────
  async function fetchNotifications(): Promise<void> {
    isLoading.value = true
    try {
      const { data } = await apiClient.get<{ success: boolean; data: ApiNotification[] }>('/notifications')
      if (data.success) {
        notifications.value = data.data
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function markAllRead(): Promise<void> {
    // Optimistic update
    const previousState = notifications.value.map(n => ({ ...n }))
    notifications.value.forEach(n => {
      n.isRead = true
    })

    try {
      await apiClient.patch('/notifications/mark-read')
    } catch (err) {
      console.error('Failed to mark notifications as read:', err)
      // Rollback on failure
      notifications.value = previousState
    }
  }

  function addNotification(notification: ApiNotification): void {
    // Prevent duplicates
    const exists = notifications.value.some(n => n._id === notification._id)
    if (!exists) {
      notifications.value.unshift(notification)
    }
  }

  return {
    notifications,
    isLoading,
    unreadCount,
    fetchNotifications,
    markAllRead,
    addNotification,
  }
})
