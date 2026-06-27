import axios from 'axios'

// ─── Axios Instance ────────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: 'http://localhost:5001/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

// ─── Request Interceptor: Attach Bearer Token ──────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ds_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
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

