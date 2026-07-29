const STREAK_LEVELS = [
  { minimumDays: 15, color: '#06B6D4' },
  { minimumDays: 8, color: '#A855F7' },
  { minimumDays: 4, color: '#EF4444' },
  { minimumDays: 1, color: '#F97316' },
] as const

export function getStreakColor(days: number): string {
  const normalizedDays = Math.max(0, Math.floor(days))
  return STREAK_LEVELS.find(level => normalizedDays >= level.minimumDays)?.color ?? ''
}
