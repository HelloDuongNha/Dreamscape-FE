export interface OracleInlinePart {
  text: string
  strong: boolean
  citationIndex?: number
  unsupported?: boolean
}

// Splits analysis prose into text, emphasis and citation markers.
export function splitOracleInlineParts(text: string): OracleInlinePart[] {
  const parts: OracleInlinePart[] = []
  const pattern = /\*\*(.+?)\*\*|\[(\d+|\?)\]/g
  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) parts.push({ text: text.slice(cursor, index), strong: false })

    if (match[1]) {
      parts.push({ text: match[1], strong: true })
    } else if (match[2] === '?') {
      parts.push({ text: match[0], strong: false, unsupported: true })
    } else {
      parts.push({ text: match[0], strong: false, citationIndex: Number(match[2]) })
    }
    cursor = index + match[0].length
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), strong: false })
  return parts.length ? parts : [{ text, strong: false }]
}
