import { describe, expect, it } from 'vitest'
import {
  createHighlightedExcerpt,
  findLiteralTextRanges,
} from '@/utils/highlightText'
import {
  dreamMoodCssVariables,
  resolveDreamMoodLevel,
} from '@/utils/dreamMood'
import { formatUsername } from '@/utils/username'

describe('dream search highlighting', () => {
  it('finds a literal phrase across repeated whitespace without treating symbols as regex', () => {
    expect(findLiteralTextRanges('Nhà   ga (cũ), nhà ga mới', 'nhà ga')).toEqual([
      { start: 0, end: 8 },
      { start: 15, end: 21 },
    ])
    expect(findLiteralTextRanges('A dream costs $5.00', '$5.00')).toEqual([
      { start: 14, end: 19 },
    ])
  })

  it('merges overlapping server ranges and keeps highlighted text as plain segments', () => {
    const result = createHighlightedExcerpt(
      '<script>alert(1)</script> dream station',
      [
        { start: -10, end: 8 },
        { start: 5, end: 25 },
        { start: 26, end: 31 },
      ],
      80,
    )

    expect(result.clippedBefore).toBe(false)
    expect(result.clippedAfter).toBe(false)
    expect(result.segments).toEqual([
      { text: '<script>alert(1)</script>', highlighted: true },
      { text: ' ', highlighted: false },
      { text: 'dream', highlighted: true },
      { text: ' station', highlighted: false },
    ])
  })

  it('centres a long excerpt around the first valid match', () => {
    const text = `${'a'.repeat(120)}station${'b'.repeat(120)}`
    const result = createHighlightedExcerpt(
      text,
      findLiteralTextRanges(text, 'station'),
      60,
    )

    expect(result.clippedBefore).toBe(true)
    expect(result.clippedAfter).toBe(true)
    expect(result.segments.some(segment =>
      segment.highlighted && segment.text === 'station')).toBe(true)
    expect(result.segments.map(segment => segment.text).join('')).toHaveLength(60)
  })
})

describe('dream mood presentation', () => {
  it('maps the current valence scale to the five visible mood levels', () => {
    expect([-2, -1, 0, 1, 2].map(value => resolveDreamMoodLevel(value))).toEqual([
      'very-negative',
      'negative',
      'mixed',
      'positive',
      'very-positive',
    ])
  })

  it('uses the legacy tone when the current valence is missing or invalid', () => {
    expect(resolveDreamMoodLevel(undefined, 'fearful')).toBe('very-negative')
    expect(resolveDreamMoodLevel(9, 'calm')).toBe('positive')
    expect(resolveDreamMoodLevel(0.5, 'anxious')).toBe('negative')
  })

  it('returns the shared CSS variables for a mood level', () => {
    expect(dreamMoodCssVariables('positive')).toEqual({
      '--dream-mood-bg': '#10271f',
      '--dream-mood-border': '#315f55',
      '--dream-mood-fg': '#71c8af',
    })
  })
})

describe('username presentation', () => {
  it('keeps exactly one leading at sign for current and legacy values', () => {
    expect(formatUsername('dreamer')).toBe('@dreamer')
    expect(formatUsername('@@dreamer')).toBe('@dreamer')
    expect(formatUsername(null)).toBe('@')
  })
})
