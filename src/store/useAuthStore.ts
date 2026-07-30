import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/api/client'
import { useChatStore } from '@/store/useChatStore'
import { useOracleChatStore } from '@/store/useOracleChatStore'
import type { ApiUser, AuthResponse } from '@/api/types'

const TOKEN_KEY = 'ds_token'
const USER_KEY  = 'ds_user'

export const useAuthStore = defineStore('auth', () => {

  // ── State ──────────────────────────────────────────────────────────────────
  const token   = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user    = ref<ApiUser | null>(
    (() => {
      try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') }
      catch { return null }
    })()
  )

  // ── Getters ────────────────────────────────────────────────────────────────
  const isLoggedIn = computed(() => !!token.value)
  const myId       = computed(() => user.value?._id ?? '')
  const myUser     = computed(() => user.value)

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _persist(t: string, u: ApiUser) {
    token.value = t
    user.value  = u
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(USER_KEY,  JSON.stringify(u))
    // Reset all account-scoped chat state before loading the new account.
    useChatStore().startSession(u._id)
    useOracleChatStore().startAccountSession(u._id)
  }

  function _clear() {
    token.value = null
    user.value  = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    useChatStore().resetSession()
    useOracleChatStore().endAccountSession()
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function register(payload: {
    username:     string
    display_name: string
    email:        string
    password:     string
    bio?:         string
  }): Promise<{
    success: boolean
    status?: string
    email?: string
    expiresAt?: string
    resendAvailableAt?: string
  }> {
    const { data } = await apiClient.post<any>('/auth/register', payload)
    if (data.status !== 'pending') {
      _persist(data.token, data.user)
    }
    return data
  }

  async function login(email: string, password: string): Promise<void> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password })
    _persist(data.token, data.user)
  }

  async function loginWithGoogle(idToken: string): Promise<void> {
    const { data } = await apiClient.post<AuthResponse>('/auth/google', { idToken })
    _persist(data.token, data.user)
  }

  async function logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      _clear()
      const { useSettingsStore } = await import('@/store/useSettingsStore')
      useSettingsStore().showToastKey('toasts.logoutSuccess', undefined, 'success')
    }
  }

  function updateCurrentUser(updatedUser: ApiUser) {
    user.value = updatedUser
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
  }

  function clearSession() {
    _clear()
  }

  // If the app loads with an existing token in localStorage, reconnect the socket
  if (token.value) {
    useChatStore().connectSocket()
    if (user.value?._id) useOracleChatStore().startAccountSession(user.value._id)
  }

  return { token, user, isLoggedIn, myId, myUser, register, login, loginWithGoogle, logout, updateCurrentUser, clearSession }
})
