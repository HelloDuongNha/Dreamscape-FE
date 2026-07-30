const requiredUrl = (
  name: 'VITE_API_BASE_URL' | 'VITE_SOCKET_URL',
  configuredValue: string | undefined,
): string => {
  const value = configuredValue?.trim()

  if (value) return value.replace(/\/+$/, '')

  throw new Error(`${name} is required`)
}

const requiredSocketOrigin = (configuredValue: string | undefined): string => {
  const configured = requiredUrl('VITE_SOCKET_URL', configuredValue)
  try {
    const parsed = new URL(configured)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol')
    // DreamScape Socket.IO is mounted at the server root. A value ending in
    // /api would otherwise be interpreted by socket.io-client as namespace
    // "/api", while the backend only exposes the default namespace.
    return parsed.origin
  } catch {
    throw new Error('VITE_SOCKET_URL must be an absolute HTTP(S) URL')
  }
}

const requiredApiBaseUrl = (configuredValue: string | undefined): string => {
  const configured = requiredUrl('VITE_API_BASE_URL', configuredValue)
  try {
    const parsed = new URL(configured)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol')
    const pathname = parsed.pathname.replace(/\/+$/, '')
    if (!pathname || pathname === '/') return `${parsed.origin}/api`
    if (pathname === '/api') return `${parsed.origin}/api`
    throw new Error('invalid API path')
  } catch {
    throw new Error('VITE_API_BASE_URL must be an HTTP(S) origin with an optional /api suffix')
  }
}

export const API_BASE_URL = requiredApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
)

export const SOCKET_URL = requiredSocketOrigin(
  import.meta.env.VITE_SOCKET_URL,
)
