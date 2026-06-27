import { defineStore } from 'pinia'
import { ref }         from 'vue'
import apiClient       from '@/api/client'

export type ToastType = 'success' | 'error'

interface Toast {
  message: string
  type:    ToastType
  visible: boolean
}

export interface DeviceSession {
  _id: string
  device_name: string
  browser: string
  location: string
  last_active: string
  is_current: boolean
}

export const useSettingsStore = defineStore('settings', () => {

  // ── Sessions state ────────────────────────────────────────────
  const sessions = ref<DeviceSession[]>([])
  const isLoadingSessions = ref(false)

  async function loadSessions() {
    isLoadingSessions.value = true
    try {
      const { data } = await apiClient.get<{ success: boolean; sessions: DeviceSession[] }>('/auth/sessions')
      sessions.value = data.sessions
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      isLoadingSessions.value = false
    }
  }

  async function logoutSession(id: string) {
    try {
      const { data } = await apiClient.delete(`/auth/sessions/${id}`)
      if (data.success) {
        sessions.value = sessions.value.filter(s => s._id !== id)
        showToast('Device logged out successfully.', 'success')
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to log out device.'
      showToast(msg, 'error')
    }
  }

  // ── Toast notification ────────────────────────────────────────
  const toast = ref<Toast>({ message: '', type: 'success', visible: false })
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string, type: ToastType = 'success') {
    if (toastTimer) clearTimeout(toastTimer)
    toast.value = { message, type, visible: true }
    toastTimer = setTimeout(() => { toast.value.visible = false }, 3500)
  }

  // ── Password change ───────────────────────────────────────────
  function changePassword(current: string, next: string, confirm: string): void {
    if (!current || !next || !confirm) {
      showToast('Please fill in all password fields.', 'error'); return
    }
    if (next.length < 8) {
      showToast('New password must be at least 8 characters.', 'error'); return
    }
    if (next !== confirm) {
      showToast('Passwords do not match.', 'error'); return
    }
    showToast('Password updated successfully.', 'success')
  }

  // ── Email update ──────────────────────────────────────────────
  const email     = ref('nguyenha@dreamscape.app')
  const verified  = ref(true)

  function updateEmail(newEmail: string) {
    if (!newEmail.includes('@')) {
      showToast('Please enter a valid email address.', 'error'); return
    }
    email.value    = newEmail
    verified.value = false   // reset verification on change
    showToast('Email updated. Please verify your new address.', 'success')
  }

  return {
    sessions,
    isLoadingSessions,
    loadSessions,
    logoutSession,
    toast,
    showToast,
    changePassword,
    email,
    verified,
    updateEmail,
  }
})
