export const DREAM_MOOD_LEVELS = [
  'very-negative',
  'negative',
  'mixed',
  'positive',
  'very-positive',
] as const

export type DreamMoodLevel = (typeof DREAM_MOOD_LEVELS)[number]

export type LegacyDreamTone =
  | 'urgent_conflicted'
  | 'anxious'
  | 'fearful'
  | 'sad'
  | 'calm'
  | 'mixed'
  | 'neutral'

const legacyValence: Record<LegacyDreamTone, -2 | -1 | 0 | 1 | 2> = {
  fearful: -2,
  sad: -2,
  anxious: -1,
  urgent_conflicted: -1,
  mixed: 0,
  neutral: 0,
  calm: 1,
}

const levelByValence: Record<-2 | -1 | 0 | 1 | 2, DreamMoodLevel> = {
  [-2]: 'very-negative',
  [-1]: 'negative',
  [0]: 'mixed',
  [1]: 'positive',
  [2]: 'very-positive',
}

export const DREAM_MOOD_COLORS: Record<
  DreamMoodLevel,
  { background: string; border: string; foreground: string }
> = {
  'very-negative': { border: '#6f292f', background: '#2d1014', foreground: '#f28b93' },
  negative: { border: '#67412b', background: '#2b1b12', foreground: '#e9a16e' },
  mixed: { border: '#5a5127', background: '#27230f', foreground: '#d8c268' },
  positive: { border: '#315f55', background: '#10271f', foreground: '#71c8af' },
  'very-positive': { border: '#236a45', background: '#0d2b1b', foreground: '#62d692' },
}

export function resolveDreamMoodLevel(
  valence?: number,
  tone: LegacyDreamTone = 'neutral',
): DreamMoodLevel {
  if (Number.isInteger(valence) && valence! >= -2 && valence! <= 2) {
    return levelByValence[valence as -2 | -1 | 0 | 1 | 2]
  }
  return levelByValence[legacyValence[tone]]
}

export function dreamMoodCssVariables(level: DreamMoodLevel): Record<string, string> {
  const colors = DREAM_MOOD_COLORS[level]
  return {
    '--dream-mood-bg': colors.background,
    '--dream-mood-border': colors.border,
    '--dream-mood-fg': colors.foreground,
  }
}
