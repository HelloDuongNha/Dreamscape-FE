import apiClient from './client'

export interface RuleCandidate {
  _id: string
  academicSourceId: any // Populated or string
  academicFullTextId?: string
  evidenceChunkIds: string[]
  proposedRuleId: string
  label: string
  fullStatement?: string
  probeBlueprint?: {
    verificationKind: string
    checkable: boolean
    conditionSummary: string | null
    explanation?: string
    applicabilityCheck?: string
    feedbackEffect: string
  }
  group: 'sleep_context' | 'dream_psychology' | 'personality_knowledge' | 'cultural_limitation'
  category: string
  factor: string
  inputSource: string
  inputRequired: Record<string, any>
  scientificBasis: string
  aiInstruction: string
  limitations: string
  claimStrength:
    | 'association_not_causation'
    | 'possible_contributing_factor'
    | 'interpretive_framework'
    | 'hypothesis_not_diagnosis'
    | 'epistemic_boundary_rule'
  confidenceCap: number
  evidenceRole: 'primary_support' | 'secondary_support' | 'background' | 'limitation' | 'contradiction'
  evidenceSummary: string
  candidateKey?: string
  sourceAuthors?: string[]
  sourceYear?: number
  sourceTitle?: string
  sourceDoi?: string
  generationModel?: string
  generationPromptVersion?: string
  validationErrors?: string[]
  generationWarnings?: string[]
  extractionStatus?: 'pending' | 'success' | 'failed' | 'needs_review'
  extractionError?: string
  status: 'pending' | 'approved' | 'rejected' | 'needs_edit'
  reviewerNote?: string
  reviewedBy?: any
  reviewedAt?: string
  legitimacyScore?: number
  legitimacyLevel?: 'weak' | 'moderate' | 'strong' | 'mixed'
  legitimacyReason?: string
  evidenceCredibilityScore?: number
  oracleUsefulnessScore?: number
  claimTypeV3?: string
  effectPolarityV3?: string
  evidenceInterpretationV3?: string
  conditionsList?: string[]
  limitationsList?: string[]
  dreamFeatureTags?: string[]
  qualityAccepted?: boolean
  qualityReasonCodes?: Array<
    | 'document_navigation'
    | 'research_recommendation'
    | 'claim_type_evidence_mismatch'
    | 'evidence_does_not_entail_claim'
    | 'generic_subject_or_outcome'
  >
  qualitySummary?: string
  applicationReadiness?: 'direct' | 'conditional' | 'background' | 'not_usable'
  exactCitationCount?: number
  supportingCitationCount?: number
  limitingCitationCount?: number
  contradictingCitationCount?: number
  independentSourceCount?: number
  scoringFormulaVersion?: string
  scoreCriteria?: Array<{
    key: 'source_breadth' | 'evidence_breadth' | 'research_fit' | 'scope_definition' | 'conflict_handling'
    score: number
    maxScore: number
    reason: string
    rubric: string
  }>
  paperDomain?: 'dream_sleep_psychology' | 'computer_vision' | 'medicine' | 'general_science' | 'unknown'
  oracleEligible?: boolean
  evidenceType?: 'theoretical_framework' | 'empirical_study' | 'literature_review' | 'opinion_or_hypothesis' | 'mixed' | 'unknown'
  conflictStatus?: 'none' | 'possible_conflict' | 'conflicts_with_existing_rule' | 'supports_existing_rule' | 'duplicate_or_overlap' | 'unknown'
  conflictNotes?: string
  createdAt: string
  updatedAt: string
}

export interface EvidenceChunkPreview {
  chunkId: string
  sectionTitle?: string
  sectionType: string
  pageStart?: number
  pageEnd?: number
  sourceOrder: number
  chunkPreview: string
}

export interface EvidenceExcerpt {
  evidenceGroupId: string
  sourceId: string
  sourceTitle?: string
  sourceDoi?: string
  chunkId: string
  stance: 'supports' | 'refutes' | 'limits'
  spanCount: number
  excerpt: string
  pageStart?: number
  pageEnd?: number
  sectionTitle?: string
  sectionType: string
}

export interface CandidateDetailResponse {
  candidate: RuleCandidate
  evidenceChunks: EvidenceChunkPreview[]
  evidenceExcerpts?: EvidenceExcerpt[]
  ruleRelationships?: Array<{
    ruleId: string
    ruleCode: string
    status: 'pending' | 'approved' | 'retired'
    label: string
    relationship: 'equivalent' | 'overlapping' | 'contradictory' | 'reverse_direction'
    evidenceScore: number
  }>
  feedbackStats?: {
    supports: number
    weakens: number
    unresolved: number
    total: number
    applicabilityRate: number | null
  }
}

/**
 * Lấy danh sách quy luật ứng viên.
 */
export const getRuleCandidates = async (params: {
  status?: string
  academicSourceId?: string
}): Promise<{
  success: boolean
  data: RuleCandidate[]
}> => {
  const { data } = await apiClient.get<{
    success: boolean
    data: RuleCandidate[]
  }>('/moderation/rules-v3/candidates', { params })
  return data
}

/**
 * Lấy chi tiết quy luật ứng viên (kèm chunk previews).
 */
export const getRuleCandidateDetail = async (
  id: string
): Promise<{
  success: boolean
  data: CandidateDetailResponse
}> => {
  const { data } = await apiClient.get<{
    success: boolean
    data: CandidateDetailResponse
  }>(`/moderation/rules-v3/candidates/${id}`)
  return data
}

/**
 * Phê duyệt quy luật ứng viên thành live rule.
 */
export const approveRuleCandidate = async (
  id: string
): Promise<{
  success: boolean
  message?: string
  data?: any
}> => {
  const { data } = await apiClient.post<{
    success: boolean
    message?: string
    data?: any
  }>(`/moderation/rules-v3/candidates/${id}/approve`)
  return data
}

/**
 * Từ chối quy luật ứng viên.
 */
export const rejectRuleCandidate = async (
  id: string,
  reviewerNote?: string
): Promise<{
  success: boolean
  message?: string
  data?: any
}> => {
  const { data } = await apiClient.post<{
    success: boolean
    message?: string
    data?: any
  }>(`/moderation/rules-v3/candidates/${id}/reject`, { reviewerNote })
  return data
}

export type RuleV3BulkAction = 'approve_pending' | 'reject_pending' | 'restore_rejected' | 'delete_rejected'

export const runRuleV3BulkAction = async (
  action: RuleV3BulkAction,
  confirmation: string,
  sourceId?: string
): Promise<{ success: true; data: { processed: number; failed: number; failures: Array<{ ruleId: string; reason: string }> } }> => {
  const { data } = await apiClient.post('/moderation/rules-v3/bulk-action', { action, confirmation, sourceId })
  return data
}

export interface RuleV3ExtractionRun {
  _id: string
  status: 'pending' | 'success' | 'failed'
  currentStage: 'initializing' | 'extracting_candidates' | 'saving_candidates' | 'completed' | 'failed'
  totalBatches: number
  processedBatches: number
  rawCandidateCount: number
  verifiedCandidateCount: number
  savedCandidateCount: number
  mergedCandidateCount: number
  rejectedCandidateCount: number
  targetChunkCount: number
  evidenceChunkCount: number
  rejectionDiagnostics: Array<{
    batchId: string
    reasonCode: string
    safeMessage: string
    proposedStatement?: string
  }>
  sanitizedErrorCode?: string
  resultRuleIds: string[]
}

export interface RuleV3SourceRunSummary {
  runId: string
  status: 'pending' | 'success' | 'failed'
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  generationModel: string
  targetChunkCount: number | null
  evidenceChunkCount: number | null
  totalBatches: number
  processedBatches: number
  rawCandidateCount: number
  verifiedCandidateCount: number
  savedCandidateCount: number
  mergedCandidateCount: number
  rejectedCandidateCount: number
  sanitizedErrorCode: string | null
  rejectionDiagnostics: Array<{
    batchId: string
    reasonCode: string
    safeMessage: string
    proposedStatement?: string
  }>
}

export interface RuleV3SourceAnalysisSummary {
  counts: {
    pending: number
    verified: number
    rejected: number
    retired: number
  }
  totalRuleCount: number
  runHistory: RuleV3SourceRunSummary[]
  latestRun: RuleV3SourceRunSummary | null
}

export const startRuleV3Extraction = async (sourceId: string, replaceExisting = false): Promise<{
  success: true
  data: { runId: string; reused: boolean; status: 'pending' | 'success' }
}> => {
  const { data } = await apiClient.post(`/moderation/sources/${sourceId}/rules-v3/extract`, { replaceExisting })
  return data
}

export const getRuleV3SourceAnalysisSummary = async (sourceId: string): Promise<{
  success: true
  data: RuleV3SourceAnalysisSummary
}> => {
  const { data } = await apiClient.get(`/moderation/sources/${sourceId}/rules-v3/summary`)
  return data
}

export const getRuleV3ExtractionProgress = async (runId: string): Promise<{
  success: true
  data: RuleV3ExtractionRun
}> => {
  const { data } = await apiClient.get(`/moderation/rules-v3/runs/${runId}`)
  return data
}
