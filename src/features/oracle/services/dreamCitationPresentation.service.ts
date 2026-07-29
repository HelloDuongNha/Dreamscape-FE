import type {
  AiDreamAnalysisResult,
  AiRealLifeHypothesis,
  AiScientificContextNote,
} from '@/api/types'
import type { OracleCitationDto, OracleCitationRuleLinkDto } from '@/api/oracleApi'

export interface DreamVerificationQuestionEntry {
  item: AiRealLifeHypothesis
  hypothesisIndex: number
}

export interface DreamCitationSource extends OracleCitationDto {
  doi?: string
  authors?: string[] | string
  quote: string
  key: string
  ruleLinks: OracleCitationRuleLinkDto[]
}

type AcademicSource = NonNullable<AiRealLifeHypothesis['sources']>[number]
type EvidenceQuote = NonNullable<AiScientificContextNote['evidenceQuotes']>[number]

// Selects questions backed by a current citation or resolved prose claim.
export function selectDreamVerificationQuestions(
  analysis: AiDreamAnalysisResult | null | undefined,
): DreamVerificationQuestionEntry[] {
  const hypotheses = analysis?.real_life_hypotheses || []
  const entries = hypotheses.map((item, hypothesisIndex) => ({ item, hypothesisIndex }))
  const bindings = resolvedBindings(analysis)
  const citations = analysis?.citations || []
  if (!hasCitationLedger(analysis) && citations.length === 0) return entries
  const selected: DreamVerificationQuestionEntry[] = []
  const usedKeys = new Set<string>()
  for (const entry of entries) {
    const verificationKey = String(entry.item?.verificationKey || '')
    const matchesVerificationKey = Boolean(verificationKey)
      && bindings.some(binding => binding.verificationKey === verificationKey)
    const matchesActiveSource = questionSources(entry.item).some(source =>
      bindings.some(binding => sameSource(source, binding.source || {}))
      || citations.some(citation => sameSource(source, citation)))
    const active = matchesVerificationKey || matchesActiveSource
    if (!active) continue
    const key = verificationKey
      || `${entry.item?.ruleId || ''}:${entry.item?.followUpQuestion || ''}`
    if (!key || usedKeys.has(key)) continue
    usedKeys.add(key)
    selected.push(entry)
  }
  return selected
}

// Builds citation cards and modal rule links from the same active Dream ledger.
export function buildDreamCitationSources(
  analysis: AiDreamAnalysisResult | null | undefined,
  fallbackTitle: string,
): DreamCitationSource[] {
  if (!analysis) return []
  const bindings = resolvedBindings(analysis)
  const sources = new Map<string, DreamCitationSource>()
  const citations = (analysis.citations || []).filter(citation =>
    Boolean(sourceKey(citation)))

  for (const citation of citations) {
    const key = sourceKey(citation)
    if (!key) continue
    sources.set(key, {
      sourceType: citation.sourceType || 'academic_source',
      sourceId: String(citation.sourceId || ''),
      doi: String(citation.doi || ''),
      title: String(citation.title || fallbackTitle),
      year: Number(citation.year) || undefined,
      excerpt: String(citation.excerpt || ''),
      quote: String(citation.excerpt || ''),
      index: Number(citation.index),
      ruleLinks: [],
      key,
    })
  }

  const hypotheses = analysis.real_life_hypotheses || []
  for (const note of analysis.scientific_context_notes || []) {
    for (const source of note.sources || []) {
      if (!isAcademicSource(source) || !isActiveSource(source, bindings, analysis)) continue
      const related = hypotheses
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.ruleId === note.ruleId || item.ruleIds?.includes(note.ruleId))
      const quote = note.evidenceQuotes
        ?.find((item: EvidenceQuote) => sameSource(item, source))?.quote || ''
      mergeSource(sources, source, fallbackTitle, [{
        ruleId: note.ruleId,
        ruleCode: note.ruleCode || '',
        statement: note.ruleStatement || note.note,
        quote,
        evidenceScore: note.academicEvidenceScore || related[0]?.item.ruleScore || 0,
        supportingSourceCount: note.sources?.length || 1,
        verificationQuestion: related[0]?.item.followUpQuestion,
        localizedVerificationQuestion: completeLocalized(
          related[0]?.item.localizedFollowUpQuestion,
        ),
        currentUserAnswer: related[0]?.item.userFeedback,
        dreamHypothesisIndex: related[0]?.index,
        dreamVerificationKey: related[0]?.item.verificationKey,
      }])
    }
  }

  for (const [hypothesisIndex, hypothesis] of hypotheses.entries()) {
    for (const source of hypothesis.sources || []) {
      if (!isAcademicSource(source) || !isActiveSource(source, bindings, analysis)) continue
      const linkedRuleIds = [...new Set([
        hypothesis.ruleId,
        ...(hypothesis.ruleIds || []),
      ].map(value => String(value || '').trim()).filter(Boolean))]
      mergeSource(sources, source, fallbackTitle, linkedRuleIds.map(ruleId => ({
        ruleId,
        ruleCode: hypothesis.ruleCode || '',
        statement: hypothesis.ruleStatement || hypothesis.hypothesis,
        localizedStatement: completeLocalized(hypothesis.localizedHypothesis),
        quote: hypothesis.validationExactQuote || '',
        evidenceScore: hypothesis.ruleScore || 0,
        supportingSourceCount: hypothesis.sources?.length || 1,
        verificationQuestion: hypothesis.followUpQuestion,
        localizedVerificationQuestion: completeLocalized(
          hypothesis.localizedFollowUpQuestion,
        ),
        currentUserAnswer: hypothesis.userFeedback,
        dreamHypothesisIndex: hypothesisIndex,
        dreamVerificationKey: hypothesis.verificationKey,
      })))
    }
  }

  return [...sources.values()]
    .map(source => ({
      ...source,
      index: Number(source.index)
        || citationIndexForSource(source, analysis.citations || [], bindings),
      key: sourceKey(source),
    }))
    .filter(source => source.index > 0)
    .sort((left, right) => left.index - right.index)
}

type SourceIdentity = { sourceId?: string; doi?: string }

function hasCitationLedger(analysis: AiDreamAnalysisResult | null | undefined): boolean {
  return Array.isArray(analysis?.claim_bindings)
}

function resolvedBindings(
  analysis: AiDreamAnalysisResult | null | undefined,
): NonNullable<AiDreamAnalysisResult['claim_bindings']> {
  return (analysis?.claim_bindings || []).filter(binding =>
    binding.status === 'resolved' && binding.source && binding.citationIndex)
}

function questionSources(question: AiRealLifeHypothesis): SourceIdentity[] {
  const sources: SourceIdentity[] = (question.sources || []).map(source => ({
    sourceId: String(source?.sourceId || ''),
    doi: String(source?.doi || ''),
  }))
  const validationSourceId = String(question?.validationSourceId || '')
  if (validationSourceId) sources.push({ sourceId: validationSourceId })
  return sources.filter((source: SourceIdentity) => sourceKey(source))
}

function isActiveSource(
  source: SourceIdentity,
  bindings: ReturnType<typeof resolvedBindings>,
  analysis: AiDreamAnalysisResult,
): boolean {
  return !hasCitationLedger(analysis)
    || (analysis.citations || []).some(citation => sameSource(source, citation))
    || bindings.some(binding => sameSource(source, binding.source || {}))
}

function isAcademicSource(source: AcademicSource): boolean {
  return source?.sourceType === 'academic_source'
    || Boolean(source?.chunkIds?.length || source?.doi || source?.journal || source?.publisher)
}

function mergeSource(
  sources: Map<string, DreamCitationSource>,
  source: AcademicSource,
  fallbackTitle: string,
  ruleLinks: OracleCitationRuleLinkDto[],
): void {
  const key = sourceKey(source)
  if (!key) return
  const existing = sources.get(key)
  sources.set(key, {
    ...(existing || {}),
    ...source,
    sourceType: source.sourceType || existing?.sourceType || 'academic_source',
    sourceId: String(source.sourceId || existing?.sourceId || ''),
    doi: String(source.doi || existing?.doi || ''),
    title: String(source.title || existing?.title || fallbackTitle),
    authors: source.authors || existing?.authors || [],
    year: source.year || existing?.year,
    excerpt: String(existing?.excerpt || ruleLinks[0]?.quote || ''),
    quote: String(existing?.quote || ruleLinks[0]?.quote || ''),
    index: Number(existing?.index) || 0,
    ruleLinks: [...(existing?.ruleLinks || []), ...ruleLinks]
      .filter((rule, index, rows) =>
        rows.findIndex(item => item.ruleId === rule.ruleId) === index),
    key,
  })
}

function citationIndexForSource(
  source: SourceIdentity,
  citations: NonNullable<AiDreamAnalysisResult['citations']>,
  bindings: ReturnType<typeof resolvedBindings>,
): number {
  const citationIndex = Number(citations.find(citation =>
    sameSource(source, citation))?.index)
  if (citationIndex > 0) return citationIndex
  return Number(bindings.find(binding =>
    sameSource(source, binding.source || {}))?.citationIndex) || 0
}

function sameSource(left: SourceIdentity, right: SourceIdentity): boolean {
  const leftId = String(left.sourceId || '').trim()
  const rightId = String(right.sourceId || '').trim()
  if (leftId && rightId && leftId === rightId) return true
  const leftDoi = normalizeDoi(left.doi)
  const rightDoi = normalizeDoi(right.doi)
  return Boolean(leftDoi && rightDoi && leftDoi === rightDoi)
}

function sourceKey(source: SourceIdentity): string {
  return String(source.sourceId || '').trim() || normalizeDoi(source.doi)
}

function normalizeDoi(value: unknown): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, '')
}

function completeLocalized(
  value: { vi?: string; en?: string } | undefined,
): { vi: string; en: string } | undefined {
  return value?.vi && value?.en ? { vi: value.vi, en: value.en } : undefined
}
