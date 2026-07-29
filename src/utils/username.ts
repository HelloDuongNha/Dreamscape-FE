/** Renders a username with exactly one leading @ for legacy and current data. */
export function formatUsername(username: string | null | undefined): string {
  return `@${String(username ?? '').replace(/^@+/, '')}`
}
