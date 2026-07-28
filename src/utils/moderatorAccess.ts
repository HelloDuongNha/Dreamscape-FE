export function isModeratorUserId(userId: string | null | undefined): boolean {
  if (!userId) return false
  const allowedIds = String(import.meta.env.VITE_MODERATOR_USER_IDS || '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean)
  return allowedIds.includes(userId.toLowerCase())
}
