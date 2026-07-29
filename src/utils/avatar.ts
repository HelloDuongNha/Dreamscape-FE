const AVATAR_BACKGROUNDS = [
  '#1e3a5f',
  '#2c1f4a',
  '#1a3d2e',
  '#3d1f1f',
  '#2e2a14',
] as const

export function getInitials(name: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'

  return words
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getAvatarBg(id: string): string {
  const hash = id
    .split('')
    .reduce((sum, character) => sum + character.charCodeAt(0), 0)

  return AVATAR_BACKGROUNDS[hash % AVATAR_BACKGROUNDS.length]
}
