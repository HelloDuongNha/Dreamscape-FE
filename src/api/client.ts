import axios from 'axios'
import { normalizeLocale, LOCALE_STORAGE_KEY } from '@/i18n/types'

// ─── Bootstrap Accept-Language at module load ─────────────────────────────────
// Read the persisted locale before any store is initialised.
// Guards window access for environments without DOM (test runners).
const _bootstrapLocale = normalizeLocale(
  typeof window !== 'undefined' ? window.localStorage.getItem(LOCALE_STORAGE_KEY) : null
)

// ─── Axios Instance ────────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': _bootstrapLocale,
  },
  withCredentials: false,
})

// ─── Request Interceptor: Attach Bearer Token + Accept-Language ────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ds_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Re-read locale on every request so mid-session locale changes are always
  // reflected even if apiClient.defaults was not updated for any reason.
  config.headers['Accept-Language'] = normalizeLocale(
    typeof window !== 'undefined' ? window.localStorage.getItem(LOCALE_STORAGE_KEY) : null
  )
  return config
})

// ─── Response Interceptor: Handle 401 Unauthorized ─────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      const hasToken = !!localStorage.getItem('ds_token')
      if (hasToken) {
        // Remove token immediately to prevent other concurrent 401s from repeating this logic
        localStorage.removeItem('ds_token')

        try {
          const { useAuthStore } = await import('@/store/useAuthStore')
          useAuthStore().clearSession()
        } catch (e) {
          console.error('Failed to clear auth session:', e)
        }

        try {
          const { useSettingsStore } = await import('@/store/useSettingsStore')
          // NOTE: This toast message is not localised in Phase I18N-1.
          // It is backend-driven error messaging and will be addressed in a later phase.
          useSettingsStore().showToast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'error')
        } catch (e) {
          console.error('Failed to show toast:', e)
        }

        try {
          const { default: router } = await import('@/router')
          const currentRoute = router.currentRoute.value
          if (currentRoute && !currentRoute.meta.public) {
            router.push({ name: 'login' })
          }
        } catch (e) {
          console.error('Failed to redirect:', e)
        }
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
