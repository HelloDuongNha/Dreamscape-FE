import { defineStore } from 'pinia'
import { ref }         from 'vue'
import apiClient       from '@/api/client'

export type ToastType = 'success' | 'error'

export type ToastContent =
  | { kind: 'key'; key: string; params?: Record<string, string | number> }
  | { kind: 'text'; text: string }

interface Toast {
  content: ToastContent
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

  async function logoutSession(id: string): Promise<boolean> {
    try {
      const { data } = await apiClient.delete(`/auth/sessions/${id}`)
      if (data.success) {
        sessions.value = sessions.value.filter(s => s._id !== id)
        showToastKey('toasts.sessionLoggedOutSuccess', undefined, 'success')
        return true
      }
      return false
    } catch (err: any) {
      const msg = err.response?.data?.message
      if (msg) {
        showToast(msg, 'error')
      } else {
        showToastKey('errors.logoutDeviceFailed', undefined, 'error')
      }
      return false
    }
  }

  async function logoutOtherSessions() {
    try {
      const { data } = await apiClient.post('/auth/sessions/revoke-others')
      if (data.success) {
        sessions.value = sessions.value.filter(session => session.is_current)
        showToastKey('toasts.otherSessionsLoggedOutSuccess', undefined, 'success')
      }
    } catch {
      showToastKey('errors.logoutOtherSessionsFailed', undefined, 'error')
      throw new Error('logout_other_sessions_failed')
    }
  }

  // ── Toast notification ────────────────────────────────────────
  const toast = ref<Toast>({ content: { kind: 'text', text: '' }, type: 'success', visible: false })
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string, type: ToastType = 'success') {
    if (toastTimer) clearTimeout(toastTimer)
    toast.value = { content: { kind: 'text', text: message }, type, visible: true }
    toastTimer = setTimeout(() => { toast.value.visible = false }, 3500)
  }

  function showToastKey(key: string, params?: Record<string, string | number>, type: ToastType = 'success') {
    if (toastTimer) clearTimeout(toastTimer)
    toast.value = { content: { kind: 'key', key, params }, type, visible: true }
    toastTimer = setTimeout(() => { toast.value.visible = false }, 3500)
  }

  // ── Password change ───────────────────────────────────────────
  function changePassword(current: string, next: string, confirm: string): void {
    if (!current || !next || !confirm) {
      showToastKey('toasts.passwordFieldsEmptyToast', undefined, 'error'); return
    }
    if (next.length < 8) {
      showToastKey('errors.pwLengthError', undefined, 'error'); return
    }
    if (next !== confirm) {
      showToastKey('errors.pwMatchError', undefined, 'error'); return
    }
    showToastKey('toasts.passwordUpdatedSuccess', undefined, 'success')
  }

  // ── Email update ──────────────────────────────────────────────
  const email     = ref('nguyenha@dreamscape.app')
  const verified  = ref(true)

  function updateEmail(newEmail: string) {
    if (!newEmail.includes('@')) {
      showToastKey('errors.emailInvalidError', undefined, 'error'); return
    }
    email.value    = newEmail
    verified.value = false   // reset verification on change
    showToastKey('toasts.emailUpdatedToast', undefined, 'success')
  }

  return {
    sessions,
    isLoadingSessions,
    loadSessions,
    logoutSession,
    logoutOtherSessions,
    toast,
    showToast,
    showToastKey,
    changePassword,
    email,
    verified,
    updateEmail,
  }
})
