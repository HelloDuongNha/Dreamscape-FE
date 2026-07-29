export type BrowserTranslationAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available'

export interface BrowserTranslatorInstance {
  translate(text: string): Promise<string>
  translateStreaming?: (text: string) => ReadableStream<string>
  destroy?: () => void
}

interface BrowserTranslatorFactory {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslationAvailability>
  create(options: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (monitor: EventTarget) => void
  }): Promise<BrowserTranslatorInstance>
}

export function getBrowserTranslatorFactory(): BrowserTranslatorFactory | null {
  const candidate = (globalThis as typeof globalThis & { Translator?: BrowserTranslatorFactory }).Translator
  if (!candidate || typeof candidate.availability !== 'function' || typeof candidate.create !== 'function') {
    return null
  }
  return candidate
}

export async function createBrowserTranslator(
  sourceLanguage: string,
  targetLanguage: string,
  onDownloadProgress?: (progress: number) => void,
): Promise<{ translator: BrowserTranslatorInstance; availability: BrowserTranslationAvailability }> {
  const factory = getBrowserTranslatorFactory()
  if (!factory) throw new BrowserTranslationUnavailableError()

  const availability = await factory.availability({ sourceLanguage, targetLanguage })
  if (availability === 'unavailable') throw new BrowserTranslationUnavailableError()

  const translator = await factory.create({
    sourceLanguage,
    targetLanguage,
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', (event) => {
        const loaded = Number((event as Event & { loaded?: number }).loaded)
        if (Number.isFinite(loaded)) onDownloadProgress?.(Math.max(0, Math.min(1, loaded)))
      })
    },
  })
  return { translator, availability }
}

export class BrowserTranslationUnavailableError extends Error {
  constructor() {
    super('Browser Translator API is unavailable for this language pair')
    this.name = 'BrowserTranslationUnavailableError'
  }
}

const PROTECTED_TOKEN_RE = /\([^()]*(?:19|20)\d{2}[a-z]?[^()]*\)|\b[A-Z][A-Za-zÀ-ỹ'’\-]+(?:\s+(?:và cộng sự|et\s+al\.))?,?\s+(?:19|20)\d{2}|https?:\/\/[^\s<>]+|doi:\s*10\.\d{4,9}\/[-._;()/:A-Z0-9]+|10\.\d{4,9}\/[-._;()/:A-Z0-9]+|\[[0-9,;\-–—\s]+\]|\bp\s*[<=>]\s*0?\.\d+|\b\d+(?:\.\d+)?\s*(?:%|mg\/dL|mmol\/L|µg\/mL|ms|Hz|kg|cm|mm)\b/gi
const AUTHOR_YEAR_CITATION_RE = /\([^()]*(?:19|20)\d{2}[a-z]?[^()]*\)/gi
const SCIENTIFIC_LITERAL_RE = new RegExp([
  AUTHOR_YEAR_CITATION_RE.source,
  'https?:\\/\\/[^\\s<>]+',
  'doi:\\s*10\\.\\d{4,9}\\/[-._;()/:A-Z0-9]+',
  '10\\.\\d{4,9}\\/[-._;()/:A-Z0-9]+',
  '\\[[0-9,;\\-–—\\s]+\\]',
  '(?:Wald\\s+)?χ(?:2|²)?\\s*\\([^()]*\\)\\s*=\\s*\\d+(?:\\.\\d+)?',
  '\\bF\\([^()]*\\)\\s*=\\s*\\d+(?:\\.\\d+)?',
  '\\bp\\s*[<=>]\\s*0?\\.\\d+',
  '\\bN\\s*=\\s*\\d+',
  '\\d+(?:\\.\\d+)?\\s*(?:%|mg\\/dL|mmol\\/L|µg\\/mL|ms|Hz|kg|cm|mm|s)\\b',
  '\\d+(?:\\.\\d+)?',
].join('|'), 'giu')

const ACADEMIC_HEADING_GLOSSARY: Record<string, Record<string, string>> = {
  'en:vi': {
    abstract: 'Tóm tắt',
    references: 'Tài liệu tham khảo',
    introduction: 'Giới thiệu',
    methods: 'Phương pháp',
    'materials and methods': 'Vật liệu và phương pháp',
    results: 'Kết quả',
    discussion: 'Thảo luận',
    conclusion: 'Kết luận',
    conclusions: 'Kết luận',
    acknowledgements: 'Lời cảm ơn',
    'creation of the wake self': 'Sự hình thành cái tôi khi thức',
    'what are the materials of a dream?': 'Những chất liệu tạo nên giấc mơ là gì?',
  },
  'vi:en': {
    'tóm tắt': 'Abstract',
    'tài liệu tham khảo': 'References',
    'giới thiệu': 'Introduction',
    'phương pháp': 'Methods',
    'vật liệu và phương pháp': 'Materials and methods',
    'kết quả': 'Results',
    'thảo luận': 'Discussion',
    'kết luận': 'Conclusion',
    'lời cảm ơn': 'Acknowledgements',
  },
}

export function normalizeLetterSpacedWords(text: string): string {
  return text.replace(/(?:\p{L}\s+){3,}\p{L}/gu, match => match.replace(/\s+/g, ''))
}

function applySourceCase(source: string, translated: string, targetLanguage: string): string {
  const sourceLetters = Array.from(source).filter(character => /\p{L}/u.test(character)).join('')
  if (!sourceLetters) return translated

  const locale = targetLanguage === 'vi' ? 'vi-VN' : 'en-US'
  if (sourceLetters === sourceLetters.toLocaleUpperCase(locale)) {
    return translated.toLocaleUpperCase(locale)
  }
  if (sourceLetters === sourceLetters.toLocaleLowerCase(locale)) {
    return translated.toLocaleLowerCase(locale)
  }
  return translated
}

function capitalizeSentenceStarts(text: string, targetLanguage: string): string {
  const locale = targetLanguage === 'vi' ? 'vi-VN' : 'en-US'
  const capitalizeAfterBoundary = (value: string) => value.replace(
    /(^|[.!?]\s+)(["'“‘(\[]*)(\p{Ll})/gu,
    (_match, boundary: string, prefix: string, letter: string) => `${boundary}${prefix}${letter.toLocaleUpperCase(locale)}`,
  )
  const capitalize = (segment: string) => segment.replace(
    /(^\s*["'“‘(\[]*)(\p{Ll})/u,
    (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase(locale)}`,
  )
  if (typeof Intl.Segmenter !== 'function') {
    return capitalizeAfterBoundary(text)
  }
  const segmented = Array.from(
    new Intl.Segmenter(locale, { granularity: 'sentence' }).segment(text),
    item => capitalize(item.segment),
  ).join('')
  return capitalizeAfterBoundary(segmented)
}

export function resolveAcademicHeading(
  sourceText: string,
  sourceLanguage: string,
  targetLanguage: string,
): string | null {
  const normalized = normalizeLetterSpacedWords(sourceText).replace(/\s+/g, ' ').trim()
  const exact = ACADEMIC_HEADING_GLOSSARY[`${sourceLanguage}:${targetLanguage}`]?.[normalized.toLocaleLowerCase(sourceLanguage)]
  return exact ? applySourceCase(normalized, exact, targetLanguage) : null
}

export function protectScientificTokens(text: string): { masked: string; restore: (translated: string) => string | null } {
  const tokens: string[] = []
  const masked = text.replace(PROTECTED_TOKEN_RE, (token) => {
    const index = tokens.push(token) - 1
    return `ZXQDS${index}QXZ`
  })

  return {
    masked,
    restore(translated) {
      let restored = translated
      for (let index = 0; index < tokens.length; index++) {
        const marker = `ZXQDS${index}QXZ`
        if (!restored.includes(marker)) return null
        restored = restored.replaceAll(marker, tokens[index])
      }
      return restored
    },
  }
}

export function splitForBrowserTranslation(text: string, maxChars = 3000): string[] {
  if (text.length <= maxChars) return [text]

  const segments: string[] = []
  let remaining = text
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars + 1)
    const candidates = [window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf(' ')]
    const cut = candidates.find(index => index >= Math.floor(maxChars * 0.55)) ?? maxChars
    const end = cut === maxChars ? cut : cut + (window.slice(cut, cut + 2) === '. ' ? 1 : 0)
    segments.push(remaining.slice(0, end).trim())
    remaining = remaining.slice(end).trimStart()
  }
  if (remaining) segments.push(remaining)
  return segments.filter(Boolean)
}

export function localizeAuthorYearCitation(citation: string, targetLanguage: string): string {
  if (targetLanguage === 'vi') {
    return citation
      .replace(/\bet\s+al\./gi, 'và cộng sự')
      .replace(/\s+and\s+/gi, ' và ')
  }
  return citation
    .replace(/\bvà\s+(?:cộng sự|cs\.)/giu, 'et al.')
    .replace(/\s+và\s+/giu, ' and ')
}

function localizeCitations(text: string, targetLanguage: string): string {
  const parenthetical = text.replace(AUTHOR_YEAR_CITATION_RE, citation => localizeAuthorYearCitation(citation, targetLanguage))
  if (targetLanguage === 'vi') return parenthetical.replace(/\bet\s+al\./gi, 'và cộng sự')
  return parenthetical.replace(/\bvà\s+(?:cộng sự|cs\.)/giu, 'et al.')
}

function postEditAcademicTerms(translated: string, sourceLanguage: string, targetLanguage: string): string {
  let result = translated
  if (sourceLanguage === 'en' && targetLanguage === 'vi') {
    const replacements: Array<[RegExp, string]> = [
      [/(?:ý thức|cảm giác) về bản thân/giu, 'cảm nhận về bản thân'],
      [/cảm giác (?:về )?(?:sự )?thống nhất/giu, 'cảm giác mình là một thể thống nhất'],
      [/khi tỉnh táo/giu, 'khi thức'],
      [/thử nghiệm ngẫu nhiên có đối chứng/giu, 'thử nghiệm đối chứng ngẫu nhiên'],
      [/Tôi có cảm giác này về một tôi(?: duy nhất)?/gu, 'Tôi cảm nhận mình là một bản thể duy nhất'],
      [/tôi có cảm giác này về một tôi(?: duy nhất)?/gu, 'tôi cảm nhận mình là một bản thể duy nhất'],
      [/Cảm giác về một tôi(?: duy nhất)?/gu, 'Cảm nhận về một bản thể duy nhất của chính mình'],
      [/cảm giác về một tôi(?: duy nhất)?/gu, 'cảm nhận về một bản thể duy nhất của chính mình'],
    ]
    for (const [pattern, replacement] of replacements) result = result.replace(pattern, replacement)
  }
  return result
}

export function segmentAcademicText(text: string, sourceLanguage: string): string[] {
  const normalized = normalizeLetterSpacedWords(text).replace(/\s+([;,:.!?])/g, '$1')
  const sentences = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(sourceLanguage, { granularity: 'sentence' }).segment(normalized), item => item.segment.trim())
    : normalized.split(/(?<=[.!?])\s+/u)

  const clauses: string[] = []
  for (const sentence of sentences.filter(Boolean)) {
    if (sentence.length <= 420) {
      clauses.push(sentence)
      continue
    }
    clauses.push(...splitAcademicClause(sentence, 320))
  }

  // Keep neighbouring sentences together so pronouns, terminology and claim
  // strength are translated with paragraph context instead of word-by-word.
  const segments: string[] = []
  let current = ''
  for (const clause of clauses) {
    const next = current ? `${current} ${clause}` : clause
    if (current && next.length > 760) {
      segments.push(current)
      current = clause
    } else {
      current = next
    }
  }
  if (current) segments.push(current)
  return segments
}

function splitAcademicClause(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text.trim()]

  const punctuationParts = text
    .split(/(?<=[;:,])\s+/u)
    .map(part => part.trim())
    .filter(Boolean)

  if (punctuationParts.length > 1) {
    const packed: string[] = []
    let current = ''
    for (const part of punctuationParts) {
      const next = current ? `${current} ${part}` : part
      if (current && next.length > maxChars) {
        packed.push(current)
        current = part
      } else {
        current = next
      }
    }
    if (current) packed.push(current)
    return packed.flatMap(part => part.length > maxChars ? splitForBrowserTranslation(part, maxChars) : [part])
  }

  return splitForBrowserTranslation(text, maxChars)
}

function isPlausiblyComplete(source: string, translated: string): boolean {
  const sourceLetters = Array.from(source).filter(character => /\p{L}/u.test(character)).length
  const translatedLetters = Array.from(translated).filter(character => /\p{L}/u.test(character)).length
  if (sourceLetters < 12) return translatedLetters > 0
  const minimumRatio = sourceLetters >= 120 ? 0.4 : sourceLetters >= 48 ? 0.38 : 0.34
  return translatedLetters >= Math.max(6, Math.floor(sourceLetters * minimumRatio))
}

function hasSuspiciousRepeatedTranslation(text: string): boolean {
  const units = text
    .split(/(?<=[.!?])\s+/u)
    .map(normalizeForComparison)
    .filter(unit => unit.length >= 12)
  return units.length >= 3 && new Set(units).size <= Math.ceil(units.length / 3)
}

function normalizeForComparison(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isEffectivelyUntranslated(source: string, translated: string): boolean {
  const normalizedSource = normalizeForComparison(source)
  const normalizedTranslated = normalizeForComparison(translated)
  if (!normalizedTranslated) return true
  if (normalizedTranslated === normalizedSource) return true
  if (normalizedSource.length >= 24 && normalizedTranslated.includes(normalizedSource)) return true

  const sourceWords = normalizedSource.split(' ').filter(word => word.length >= 3)
  const translatedWords = new Set(normalizedTranslated.split(' ').filter(word => word.length >= 3))
  if (sourceWords.length < 8) return false
  const overlap = sourceWords.filter(word => translatedWords.has(word)).length / sourceWords.length
  return overlap >= 0.78
}

function numbersArePreserved(source: string, translated: string): boolean {
  const expectedNumbers = source.match(/\d+(?:\.\d+)?/g) || []
  return expectedNumbers.every(number => translated.includes(number))
}

async function callBrowserTranslator(
  translator: BrowserTranslatorInstance,
  text: string,
  attempts = 3,
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await translator.translate(text)
    } catch (error) {
      lastError = error
      if (attempt + 1 < attempts) {
        await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)))
      }
    }
  }
  throw lastError
}

interface TranslationFragment {
  text: string
  protected: boolean
}

function splitScientificLiterals(text: string): TranslationFragment[] {
  const fragments: TranslationFragment[] = []
  let cursor = 0
  SCIENTIFIC_LITERAL_RE.lastIndex = 0
  for (const match of text.matchAll(SCIENTIFIC_LITERAL_RE)) {
    const index = match.index ?? 0
    if (index > cursor) fragments.push({ text: text.slice(cursor, index), protected: false })
    fragments.push({ text: match[0], protected: true })
    cursor = index + match[0].length
  }
  if (cursor < text.length) fragments.push({ text: text.slice(cursor), protected: false })
  return fragments.filter(fragment => fragment.text.length > 0)
}

async function translateWithoutMarkers(
  translator: BrowserTranslatorInstance,
  source: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string | null> {
  const citationLocalized = localizeCitations(source, targetLanguage)
  const fragments = splitScientificLiterals(citationLocalized)
  const translated: string[] = []

  for (const fragment of fragments) {
    if (fragment.protected || !/[\p{L}]/u.test(fragment.text)) {
      translated.push(fragment.text)
      continue
    }
    const leadingWhitespace = fragment.text.match(/^\s*/u)?.[0] || ''
    const trailingWhitespace = fragment.text.match(/\s*$/u)?.[0] || ''
    const prose = fragment.text.slice(leadingWhitespace.length, fragment.text.length - trailingWhitespace.length)
    try {
      let result = await callBrowserTranslator(translator, prose)
      const letterCount = Array.from(prose).filter(character => /\p{L}/u.test(character)).length
      if (isEffectivelyUntranslated(prose, result) && targetLanguage === 'vi') {
        const shortConnector = prose.toLocaleLowerCase('en-US').trim().replace(/[.,;:]+$/u, '')
        const connectorMap: Record<string, string> = {
          vs: 'so với',
          versus: 'so với',
          and: 'và',
          or: 'hoặc',
          see: 'xem',
        }
        if (connectorMap[shortConnector]) result = connectorMap[shortConnector]
      }
      const unchangedTechnicalAcronym = prose.trim().length <= 6
        && prose.trim() === prose.trim().toLocaleUpperCase('en-US')
      if (
        !isPlausiblyComplete(prose, result)
        || (!unchangedTechnicalAcronym && letterCount > 0 && isEffectivelyUntranslated(prose, result))
      ) return null
      translated.push(
        leadingWhitespace
        + postEditAcademicTerms(result.trim(), sourceLanguage, targetLanguage)
        + trailingWhitespace,
      )
    } catch {
      return null
    }
  }

  const result = translated.join('')
  return isPlausiblyComplete(source, result) ? result.trim() : null
}

async function translateOnce(
  translator: BrowserTranslatorInstance,
  source: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string | null> {
  const citationLocalized = localizeCitations(source, targetLanguage)
  const protectedTokens = protectScientificTokens(citationLocalized)

  try {
    const result = await callBrowserTranslator(translator, protectedTokens.masked)
    const restored = protectedTokens.restore(result)
    if (
      restored !== null
      && numbersArePreserved(citationLocalized, restored)
      && isPlausiblyComplete(source, restored)
      && !isEffectivelyUntranslated(citationLocalized, restored)
    ) {
      return postEditAcademicTerms(restored, sourceLanguage, targetLanguage).trim()
    }
  } catch {
    // Retry without opaque markers below. Some browser models reject or rewrite them.
  }

  // Marker-free fallback: translate only prose spans and splice citations,
  // statistics, units and numbers back into their exact canonical positions.
  return translateWithoutMarkers(translator, source, sourceLanguage, targetLanguage)
}

async function translateWithRecovery(
  translator: BrowserTranslatorInstance,
  source: string,
  sourceLanguage: string,
  targetLanguage: string,
  depth = 0,
): Promise<string | null> {
  const direct = await translateOnce(translator, source, sourceLanguage, targetLanguage)
  if (direct !== null) return direct

  // Chrome's on-device model sometimes rejects a single long/complex clause or
  // returns it unchanged. Subdivide only that clause instead of discarding the
  // translation of the entire paragraph.
  if (source.length < 72 || depth >= 3) return null
  const configuredLimit = depth === 0 ? 120 : depth === 1 ? 80 : 56
  // The recovery limit must always be smaller than the clause that just failed;
  // otherwise a 73–120 character clause would be retried unchanged forever.
  const maxChars = Math.min(configuredLimit, Math.max(48, Math.floor(source.length * 0.65)))
  const pieces = splitAcademicClause(source, maxChars)
  if (pieces.length <= 1) return null

  const translatedPieces: string[] = []
  for (const piece of pieces) {
    const translated = await translateWithRecovery(
      translator,
      piece,
      sourceLanguage,
      targetLanguage,
      depth + 1,
    )
    if (translated === null) return null
    translatedPieces.push(translated)
  }
  return translatedPieces.join(' ')
}

async function translateBestEffort(
  translator: BrowserTranslatorInstance,
  source: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string | null> {
  const localized = localizeCitations(source, targetLanguage)
  const attempts = [localized, ...splitAcademicClause(localized, 48)]

  // First try the complete clause once without quality gates. If Chrome returns
  // a non-identical result, preserving the translation is better than reverting
  // an entire multi-paragraph block because of one conservative validator.
  try {
    const whole = await callBrowserTranslator(translator, attempts[0])
    if (
      whole.trim()
      && isPlausiblyComplete(localized, whole)
      && !isEffectivelyUntranslated(localized, whole)
    ) {
      return postEditAcademicTerms(whole, sourceLanguage, targetLanguage).trim()
    }
  } catch {
    // Continue with small word groups below.
  }

  const pieces = attempts.slice(1)
  if (pieces.length <= 1) return null
  const translatedPieces: string[] = []
  for (const piece of pieces) {
    try {
      const result = await callBrowserTranslator(translator, piece)
      if (!result.trim() || !isPlausiblyComplete(piece, result)) return null
      translatedPieces.push(postEditAcademicTerms(result, sourceLanguage, targetLanguage).trim())
    } catch {
      return null
    }
  }
  const joined = translatedPieces.join(' ')
  return joined.trim() && !isEffectivelyUntranslated(localized, joined) ? joined : null
}

async function translateLastResort(
  translator: BrowserTranslatorInstance,
  source: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string> {
  const localized = localizeCitations(source, targetLanguage)
  const groups = splitAcademicClause(localized, 36)
  const translatedGroups: string[] = []

  for (const group of groups) {
    try {
      const result = await callBrowserTranslator(translator, group)
      if (result.trim() && !isEffectivelyUntranslated(group, result)) {
        translatedGroups.push(postEditAcademicTerms(result, sourceLanguage, targetLanguage).trim())
        continue
      }
    } catch {
      // Try word-level recovery below.
    }

    const tokens = group.split(/(\s+)/u)
    const translatedTokens: string[] = []
    for (const token of tokens) {
      if (!/[\p{L}]/u.test(token) || token.trim().length <= 1) {
        translatedTokens.push(token)
        continue
      }
      try {
        const result = await callBrowserTranslator(translator, token, 2)
        translatedTokens.push(result.trim() || token)
      } catch {
        translatedTokens.push(token)
      }
    }
    translatedGroups.push(translatedTokens.join(''))
  }
  const joined = translatedGroups.join(' ')
  const normalizedGroups = translatedGroups.map(group => normalizeForComparison(group)).filter(Boolean)
  if (normalizedGroups.length >= 3 && new Set(normalizedGroups).size === 1) return source
  return isPlausiblyComplete(localized, joined) ? joined : source
}

export async function translateBrowserText(
  translator: BrowserTranslatorInstance,
  text: string,
  sourceLanguage = 'en',
  targetLanguage = 'vi',
): Promise<string> {
  const normalizedText = normalizeLetterSpacedWords(text)
  const exactHeading = resolveAcademicHeading(normalizedText, sourceLanguage, targetLanguage)
  if (exactHeading) return exactHeading

  const chunks = segmentAcademicText(normalizedText, sourceLanguage)
  const translated: string[] = []
  for (const chunk of chunks) {
    let candidate = await translateWithRecovery(
      translator,
      chunk,
      sourceLanguage,
      targetLanguage,
    )
    if (candidate === null) {
      candidate = await translateBestEffort(
        translator,
        chunk,
        sourceLanguage,
        targetLanguage,
      )
    }
    if (candidate === null) {
      candidate = await translateLastResort(
        translator,
        chunk,
        sourceLanguage,
        targetLanguage,
      )
    }
    translated.push(candidate)
  }
  const contextualTranslation = capitalizeSentenceStarts(translated.join(' '), targetLanguage)
  if (hasSuspiciousRepeatedTranslation(contextualTranslation)) return normalizedText
  return applySourceCase(normalizedText, contextualTranslation, targetLanguage)
}

export async function translateBrowserTableHtml(
  translator: BrowserTranslatorInstance,
  html: string,
  sourceLanguage = 'en',
  targetLanguage = 'vi',
): Promise<string> {
  if (typeof DOMParser !== 'function') return html
  const document = new DOMParser().parseFromString(html, 'text/html')
  const roots = Array.from(document.body.children)
  let translatedCellCount = 0

  for (const root of roots) {
    const textNodes: Text[] = []
    const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */)
    let node = walker.nextNode()
    while (node) {
      const parentName = node.parentElement?.tagName.toLocaleLowerCase() || ''
      if (
        node.nodeValue
        && /[\p{L}]/u.test(node.nodeValue)
        && !['script', 'style', 'math', 'svg', 'code'].includes(parentName)
      ) textNodes.push(node as Text)
      node = walker.nextNode()
    }
    for (const textNode of textNodes) {
      const source = textNode.nodeValue || ''
      try {
        const translated = await translateBrowserText(translator, source, sourceLanguage, targetLanguage)
        if (!isEffectivelyUntranslated(source, translated)) {
          textNode.nodeValue = translated
          translatedCellCount++
        }
      } catch {
        // One malformed cell must not abort translation of the remaining table.
      }
    }
  }

  return translatedCellCount > 0 ? document.body.innerHTML : html
}
