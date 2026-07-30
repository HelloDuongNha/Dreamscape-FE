export function resolveAuthRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/'
  const redirect = value.trim()
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return '/'
  return redirect
}
