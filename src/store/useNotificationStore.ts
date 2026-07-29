import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/api/client'
import type { ApiNotification, ApiNotificationTarget } from '@/api/types'

export const useNotificationStore = defineStore('notification', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const notifications = ref<ApiNotification[]>([])
  const isLoading = ref(false)
  const hasLoadError = ref(false)

  // ── Getters ────────────────────────────────────────────────────────────────
  const unreadCount = computed<number>(() =>
    notifications.value.filter(n => !n.isRead).length
  )

  // ── Actions ────────────────────────────────────────────────────────────────
  async function fetchNotifications(): Promise<void> {
    isLoading.value = true
    hasLoadError.value = false
    try {
      const { data } = await apiClient.get<{ success: boolean; data: ApiNotification[] }>('/notifications')
      if (data.success) {
        notifications.value = data.data
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
      hasLoadError.value = true
    } finally {
      isLoading.value = false
    }
  }

  async function markAllRead(): Promise<boolean> {
    const previousState = notifications.value.map(n => ({ ...n }))
    notifications.value.forEach(n => {
      n.isRead = true
    })

    try {
      await apiClient.patch('/notifications/mark-read')
      return true
    } catch (err) {
      console.error('Failed to mark notifications as read:', err)
      notifications.value = previousState
      return false
    }
  }

  async function openNotification(notificationId: string): Promise<ApiNotificationTarget> {
    const { data } = await apiClient.post<{
      success: boolean
      data: { target: ApiNotificationTarget }
    }>(`/notifications/${notificationId}/open`)
    const notification = notifications.value.find(item => item._id === notificationId)
    if (notification) notification.isRead = true
    return data.data.target
  }

  async function deleteNotification(notificationId: string): Promise<void> {
    await apiClient.delete(`/notifications/${notificationId}`)
    const index = notifications.value.findIndex(item => item._id === notificationId)
    if (index >= 0) notifications.value.splice(index, 1)
  }

  function addNotification(notification: ApiNotification): void {
    const exists = notifications.value.some(n => n._id === notification._id)
    if (!exists) {
      notifications.value.unshift(notification)
    }
  }

  return {
    notifications,
    isLoading,
    hasLoadError,
    unreadCount,
    fetchNotifications,
    markAllRead,
    openNotification,
    deleteNotification,
    addNotification,
  }
})
