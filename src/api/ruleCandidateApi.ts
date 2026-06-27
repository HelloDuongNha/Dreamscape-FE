import apiClient from './client'

export interface RuleCandidate {
  _id: string
  academicSourceId: any // Populated or string
  academicFullTextId?: string
  evidenceChunkIds: string[]
  proposedRuleId: string
  label: string
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
  chunkId: string
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
}

/**
 * Trích xuất quy luật ứng viên từ tài liệu học thuật (Sequential RAG chunking + extract).
 */
export const extractRuleCandidates = async (
  sourceId: string
): Promise<{
  success: boolean
  message?: string
  data?: {
    createdCount: number
    skippedCount: number
    candidateIds: string[]
    validationErrors: string[]
    generationWarnings: string[]
    alreadyExists?: boolean
    isAnalyzing?: boolean
  }
}> => {
  const { data } = await apiClient.post<{
    success: boolean
    message?: string
    data?: any
  }>(`/moderation/sources/${sourceId}/analyze-rules`)
  return data
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
  }>('/moderation/rule-candidates', { params })
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
  }>(`/moderation/rule-candidates/${id}`)
  return data
}

/**
 * Cập nhật/chỉnh sửa quy luật ứng viên.
 */
export const updateRuleCandidate = async (
  id: string,
  payload: Partial<RuleCandidate>
): Promise<{
  success: boolean
  data: RuleCandidate
}> => {
  const { data } = await apiClient.patch<{
    success: boolean
    data: RuleCandidate
  }>(`/moderation/rule-candidates/${id}`, payload)
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
  }>(`/moderation/rule-candidates/${id}/approve`)
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
  }>(`/moderation/rule-candidates/${id}/reject`, { reviewerNote })
  return data
}

/**
 * Vô hiệu hóa một quy luật đã duyệt.
 */
export const deactivateRule = async (
  ruleId: string,
  confirm: boolean,
  reason?: string
): Promise<{
  success: boolean
  message?: string
  data?: any
}> => {
  const { data } = await apiClient.post<{
    success: boolean
    message?: string
    data?: any
  }>(`/moderation/rules/${ruleId}/deactivate`, { confirm, reason })
  return data
}

/**
 * Vô hiệu hóa toàn bộ quy luật liên kết với nguồn tài liệu.
 */
export const deactivateSourceRules = async (
  sourceId: string,
  confirmationText: string,
  reason?: string
): Promise<{
  success: boolean
  message?: string
  data?: any
}> => {
  const { data } = await apiClient.post<{
    success: boolean
    message?: string
    data?: any
  }>(`/moderation/sources/${sourceId}/deactivate-rules`, { confirmationText, reason })
  return data
}

/**
 * Khôi phục quy luật ứng viên bị từ chối về trạng thái chờ duyệt.
 */
export const restoreRejectedCandidate = async (
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
  }>(`/moderation/rule-candidates/${id}/restore`)
  return data
}

/**
 * Xóa vĩnh viễn quy luật ứng viên bị từ chối.
 */
export const deleteCandidate = async (
  id: string,
  confirm: boolean
): Promise<{
  success: boolean
  message?: string
  data?: any
}> => {
  const { data } = await apiClient.delete<{
    success: boolean
    message?: string
    data?: any
  }>(`/moderation/rule-candidates/${id}`, { data: { confirm } })
  return data
}

/**
 * Xóa sạch toàn bộ quy luật ứng viên bị từ chối.
 */
export const clearAllRejectedCandidates = async (
  confirmationText: string
): Promise<{
  success: boolean
  message?: string
  data?: any
}> => {
  const { data } = await apiClient.delete<{
    success: boolean
    message?: string
    data?: any
  }>(`/moderation/rule-candidates/rejected`, { data: { confirmationText } })
  return data
}

/**
 * Lấy danh sách quy luật đang hoạt động đã duyệt.
 */
export const getApprovedRules = async (): Promise<{
  success: boolean
  data: any[]
}> => {
  const { data } = await apiClient.get<{
    success: boolean
    data: any[]
  }>('/moderation/knowledge-rules')
  return data
}

/**
 * Lấy tiến trình trích xuất quy luật của tài liệu.
 */
export const getAnalyzeProgress = async (
  sourceId: string
): Promise<{
  success: boolean
  data?: {
    status: 'pending' | 'success' | 'failed'
    currentStage?: 'initializing' | 'domain_check' | 'extracting_candidates' | 'saving_candidates' | 'completed' | 'failed'
    processedSectionGroups?: number
    sectionGroupCount?: number
    rawCandidateCount?: number
    consolidatedCandidateCount?: number
    savedCandidateCount?: number
    updatedCandidateCount?: number
    reusedCandidateCount?: number
    reasonCode?: string
    message?: string
    outcome?: string
    candidateIds?: string[]
  }
}> => {
  const { data } = await apiClient.get<{
    success: boolean
    data?: any
  }>(`/moderation/sources/${sourceId}/analyze-progress`)
  return data
}

