export type AcademicSourceCategory = 'science' | 'psychology' | 'symbol' | 'culture'

interface AcademicSourceCategoryInput {
  title?: string
  journal?: string
  metadata?: { category?: string }
}

const CATEGORY_ALIASES: Record<AcademicSourceCategory, string[]> = {
  science: ['science', 'khoa học'],
  psychology: ['psychology', 'tâm lý'],
  symbol: ['symbol', 'symbols', 'biểu tượng'],
  culture: ['culture', 'văn hóa'],
}

const CATEGORY_PATTERNS: Record<AcademicSourceCategory, RegExp> = {
  science: /sleep|dream|neuro|brain|science|clinical|medical|biology|physiol|y học|khoa học|thần kinh/i,
  psychology: /psych|cognit|behavior|mental|therapy|freud|jung|tâm lý|hành vi|nhận thức/i,
  symbol: /symbol|archetype|meaning|biểu tượng|mẫu gốc|giải mã/i,
  culture: /cultur|myth|anthropo|history|folklore|văn hóa|thần thoại|lịch sử/i,
}

const INFERENCE_ORDER: AcademicSourceCategory[] = [
  'psychology',
  'symbol',
  'culture',
  'science',
]

export function resolveAcademicSourceCategory(
  source: AcademicSourceCategoryInput,
): AcademicSourceCategory {
  const declaredCategory = String(source.metadata?.category || '').trim().toLowerCase()
  const declaredMatch = (Object.keys(CATEGORY_ALIASES) as AcademicSourceCategory[])
    .find(category => CATEGORY_ALIASES[category].includes(declaredCategory))
  if (declaredMatch) return declaredMatch

  const searchableText = `${source.title || ''} ${source.journal || ''}`
  const inferredMatch = INFERENCE_ORDER
    .find(category => CATEGORY_PATTERNS[category].test(searchableText))

  return inferredMatch || 'science'
}
