const requiredUrl = (
  name: 'VITE_API_BASE_URL' | 'VITE_SOCKET_URL',
  configuredValue: string | undefined,
): string => {
  const value = configuredValue?.trim()

  if (value) return value.replace(/\/+$/, '')

  throw new Error(`${name} is required`)
}

export const API_BASE_URL = requiredUrl(
  'VITE_API_BASE_URL',
  import.meta.env.VITE_API_BASE_URL,
)

export const SOCKET_URL = requiredUrl(
  'VITE_SOCKET_URL',
  import.meta.env.VITE_SOCKET_URL,
)
