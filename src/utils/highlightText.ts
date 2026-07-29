import type { SearchTextRange } from '@/api/types'

export interface HighlightTextSegment {
  text: string
  highlighted: boolean
}

export interface HighlightedExcerpt {
  segments: HighlightTextSegment[]
  clippedBefore: boolean
  clippedAfter: boolean
}

/** Find literal matches while allowing equivalent whitespace between query words. */
export function findLiteralTextRanges(text: string, query: string): SearchTextRange[] {
  const tokens = query.trim().split(/\s+/u).filter(Boolean)
  if (!text || !tokens.length) return []
  const pattern = tokens
    .map(token => token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('\\s+')
  const ranges: SearchTextRange[] = []
  for (const match of text.matchAll(new RegExp(pattern, 'giu'))) {
    if (match.index === undefined) continue
    ranges.push({ start: match.index, end: match.index + match[0].length })
  }
  return ranges
}

/**
 * Converts server-provided original-string ranges into safe text segments.
 * It never emits HTML, and clamps/merges malformed ranges so highlighting
 * cannot distort the surrounding content or create overlapping DOM nodes.
 */
export function createHighlightedExcerpt(
  text: string,
  ranges: SearchTextRange[],
  maxLength = 240,
): HighlightedExcerpt {
  const normalizedRanges = normalizeRanges(ranges, text.length)
  const window = chooseExcerptWindow(text.length, normalizedRanges, maxLength)
  const visibleRanges = normalizedRanges
    .map(range => ({
      start: Math.max(range.start, window.start) - window.start,
      end: Math.min(range.end, window.end) - window.start,
    }))
    .filter(range => range.end > range.start)

  return {
    segments: segmentText(text.slice(window.start, window.end), visibleRanges),
    clippedBefore: window.start > 0,
    clippedAfter: window.end < text.length,
  }
}

function chooseExcerptWindow(
  textLength: number,
  ranges: SearchTextRange[],
  maxLength: number,
): { start: number; end: number } {
  if (textLength <= maxLength) return { start: 0, end: textLength }
  if (!ranges.length) return { start: 0, end: maxLength }

  const contextBefore = Math.min(80, Math.floor(maxLength / 3))
  const start = Math.max(0, Math.min(ranges[0].start - contextBefore, textLength - maxLength))
  return { start, end: Math.min(textLength, start + maxLength) }
}

function normalizeRanges(ranges: SearchTextRange[], textLength: number): SearchTextRange[] {
  const sorted = ranges
    .map(range => ({
      start: Math.max(0, Math.min(textLength, Math.floor(range.start))),
      end: Math.max(0, Math.min(textLength, Math.floor(range.end))),
    }))
    .filter(range => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const merged: SearchTextRange[] = []
  for (const range of sorted) {
    const previous = merged[merged.length - 1]
    if (!previous || range.start > previous.end) {
      merged.push({ ...range })
      continue
    }
    previous.end = Math.max(previous.end, range.end)
  }
  return merged
}

function segmentText(text: string, ranges: SearchTextRange[]): HighlightTextSegment[] {
  if (!text) return []
  if (!ranges.length) return [{ text, highlighted: false }]

  const segments: HighlightTextSegment[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), highlighted: false })
    }
    segments.push({ text: text.slice(range.start, range.end), highlighted: true })
    cursor = range.end
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false })
  }
  return segments
}
