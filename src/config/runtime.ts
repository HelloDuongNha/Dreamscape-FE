const DEFAULT_BACKEND_URL = 'http://localhost:5001'

function normalizeBackendUrl(value: unknown): string {
  const configuredUrl = String(value || '').trim()
  return (configuredUrl || DEFAULT_BACKEND_URL).replace(/\/+$/, '')
}

export const BACKEND_URL = normalizeBackendUrl(import.meta.env.VITE_BACKEND_URL)
export const API_BASE_URL = `${BACKEND_URL}/api`
