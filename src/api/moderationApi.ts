import apiClient from './client'
import type { TranslateReaderRequest, TranslateReaderResponse } from '../features/library/services/smartReaderTranslation.types'
import type {
  PdfCacheResponse,
  PdfProcessingResponse,
  StructuredReaderImportResponse,
  StructuredReaderReimportResponse,
} from './academicSourceProcessing.types'

export interface ReviewSourcePayload {
  reviewStatus: 'approved' | 'rejected'
  reviewNote?: string
  title?: string
}

export interface PdfImportProgressResponse {
  progress: {
    stage: 'queued' | 'received' | 'inspecting_text' | 'ocr_processing' | 'parsing_layout' | 'cleaning_ocr' | 'compiling_reader' | 'completed' | 'failed' | 'cancelled'
    startedAt: string
    updatedAt: string
    expectedDurationSeconds: number
    pageCount: number
    fileSizeBytes: number
    ocrExpected: boolean
    completedAt?: string
    durationMs?: number
    timingDeltaSeconds?: number
    failureCode?: string
    failureMessage?: string
    result?: PdfProcessingResponse
    queuePosition?: number
  } | null
  estimateSeconds: number
  history: Array<{
    durationMs: number
    estimatedDurationSeconds: number
    pageCount: number
    fileSizeBytes: number
    ocrUsed: boolean
    succeeded?: boolean
    completedAt: string
  }>
}

export interface GetModerationSourcesParams {
  status: 'pending' | 'approved' | 'rejected'
  page?: number
  limit?: number
}

export interface SourceContributionUser {
  _id: string
  username: string
  display_name: string
  email?: string
  avatar?: string
}

export interface ReaderBuildSnapshot {
  status?: 'success' | 'failed'
  engine: string
  sourceType: string
  sectionCount: number
  chunkCount: number
  builtAt: string
  durationMs?: number
  estimatedDurationSeconds?: number
  pageCount?: number
  ocrUsed?: boolean
  failureCode?: string
  failureMessage?: string
}

export interface PdfImportHistoryEntry {
  durationMs: number
  estimatedDurationSeconds: number
  pageCount: number
  fileSizeBytes: number
  ocrUsed: boolean
  succeeded?: boolean
  completedAt: string
}

export interface SourceContribution {
  _id: string
  title?: string
  submittedBy: SourceContributionUser
  doi?: string
  normalizedDoi?: string
  url?: string
  normalizedUrl?: string
  submittedNote?: string
  reviewStatus: 'pending' | 'approved' | 'rejected'
  reviewedBy?: SourceContributionUser
  reviewedAt?: string
  reviewNote?: string
  metadata?: Record<string, any>
  smartReaderStats?: {
    pageCount: number
    figureCount: number
    tableCount: number
    referenceCount: number
    updatedAt?: string
  }
  readerBuildSnapshots?: ReaderBuildSnapshot[]
  pdfImportHistory?: PdfImportHistoryEntry[]
  readableInApp?: boolean
  fullTextStatus?: 'none' | 'importing' | 'imported' | 'failed' | 'available'
  extractionStatus?: 'uploaded' | 'inspecting' | 'extracting_text' | 'resolving_identifiers' | 'fetching_preferred_source' | 'ocr_processing' | 'compiling_reader' | 'completed' | 'partial' | 'failed'
  pdfUrl?: string
  license?: string
  allowedUse?: 'metadata_only' | 'abstract_only' | 'open_access_fulltext'
  verificationStatus?: 'unverified' | 'verified_doi' | 'manual'
  sourceQuality?: 'peer_reviewed' | 'preprint' | 'informal'
  copyrightStatus?: 'public_domain' | 'copyrighted_with_open_access' | 'paywalled'
  createdAt: string
  updatedAt: string
  originalFile?: {
    storageProvider: 'firebase' | 'cloudinary' | 'local' | 'gridfs'
    originalFileName: string
    mimeType: string
    fileSize: number
    cloudinaryPublicId?: string
    cloudinarySecureUrl?: string
    firebaseStorageBucket?: string
    firebaseStoragePath?: string
    cloudinaryResourceType?: 'image' | 'raw' | 'video'
    cloudinaryFormat?: string
    uploadedBy?: string
    uploadedAt?: string
    fileHash?: string
  }
}

export interface ModerationSourcesResponse {
  sources: SourceContribution[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface OracleEvidenceGapItem {
  _id: string
  status: 'unresolved' | 'candidate_found' | 'resolved'
  claim: string
  claimKey: string
  localizedClaims: {
    vi: string
    en: string
  }
  candidateRules: Array<{
    _id: string
    ruleCode: string
    statement: string
    subject: string
    outcome: string
    evidenceScore: number
    supportingSourceCount: number
    status: string
  }>
  resolvedRules: OracleEvidenceGapItem['candidateRules']
  resolvedSources: Array<{
    sourceId: string
    title: string
    year?: number | null
    excerpt: string
    ruleId: string
  }>
  usageExcerpts: Array<{
    surfaceType: 'oracle' | 'dream_analysis'
    citationIndex: number | null
    excerpt: string
  }>
  resolutionCitationIndex?: number | null
  occurrenceCount: number
  relatedClaims: string[]
  localizedRelatedClaims: {
    vi: string[]
    en: string[]
  }
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export const getOracleEvidenceGaps = async (params: {
  status?: 'active' | 'unresolved' | 'candidate_found' | 'resolved'
  page?: number
  limit?: number
} = {}): Promise<{
  gaps: OracleEvidenceGapItem[]
  pagination: ModerationSourcesResponse['pagination']
}> => {
  const { data } = await apiClient.get<{
    success: boolean
    data: {
      gaps: OracleEvidenceGapItem[]
      pagination: ModerationSourcesResponse['pagination']
    }
  }>('/moderation/oracle-evidence-gaps', { params })
  return data.data
}

/**
 * Fetches source contributions by status with pagination, normalizing pagination output.
 */
export const getModerationSources = async (
  params: GetModerationSourcesParams
): Promise<ModerationSourcesResponse> => {
  const { data } = await apiClient.get<{
    success: boolean
    message?: string
    data?: {
      sources: any[]
      pagination?: {
        total?: number
        page?: number
        limit?: number
        pages?: number
      }
    }
  }>('/moderation/sources', { params })

  // Normalize pagination fields inside the API layer
  const sources = data.data?.sources || []
  const pag = data.data?.pagination

  return {
    sources,
    pagination: {
      total: Number(pag?.total ?? 0),
      page: Number(pag?.page ?? 1),
      limit: Number(pag?.limit ?? 20),
      pages: Number(pag?.pages ?? 1),
    },
  }
}

/**
 * Approves or rejects a source contribution.
 */
export const reviewSource = async (
  id: string,
  payload: ReviewSourcePayload
): Promise<{ success: boolean; message?: string; warning?: boolean; code?: string; details?: any; data?: any }> => {
  const { data } = await apiClient.patch<{
    success: boolean
    message?: string
    warning?: boolean
    code?: string
    details?: any
    data?: any
  }>(`/moderation/sources/${id}/status`, payload)
  return data
}

export const updateSourceContributionTitle = async (
  id: string,
  title: string,
): Promise<{ success: boolean; message?: string; data?: { title: string } }> => {
  const { data } = await apiClient.patch<{
    success: boolean
    message?: string
    data?: { title: string }
  }>(`/moderation/sources/${id}/title`, { title })
  return data
}

/**
 * Triggers manual open-access fulltext import for one AcademicSource.
 */
export const importFullText = async (
  id: string,
  signal?: AbortSignal,
): Promise<StructuredReaderImportResponse> => {
  const { data } = await apiClient.post<StructuredReaderImportResponse>(
    `/moderation/sources/${id}/import-fulltext`,
    undefined,
    { signal },
  )
  return data
}

/**
 * Triggers destructive re-import of fulltext for one AcademicSource.
 */
export const reimportFullText = async (
  id: string,
  signal?: AbortSignal,
): Promise<StructuredReaderReimportResponse> => {
  const { data } = await apiClient.post<StructuredReaderReimportResponse>(
    `/moderation/sources/${id}/reimport-fulltext`,
    undefined,
    { signal },
  )
  return data
}

/**
 * Fetches the preview data for a source contribution.
 */
export const getSourcePreview = async (
  id: string
): Promise<{
  success: boolean
  data?: {
    source: any
    fullText: any
    sections: any[]
    readerIdentity?: any
  }
}> => {
  const { data } = await apiClient.get<{
    success: boolean
    data?: any
  }>(`/moderation/sources/${id}/preview`)
  return data
}

export const getModerationSourcePdfInline = async (id: string): Promise<Blob> => {
  const { data } = await apiClient.get<Blob>(
    `/moderation/sources/${id}/pdf-inline`,
    { responseType: 'blob' }
  )
  return data
}

/**
 * Triggers online PDF caching for moderation sources.
 */
export const cacheModerationSourceOriginalPdf = async (
  id: string,
  options?: { force?: boolean },
  signal?: AbortSignal,
): Promise<PdfCacheResponse> => {
  const { data } = await apiClient.post<PdfCacheResponse>(
    `/moderation/sources/${id}/cache-original-pdf`,
    options,
    { signal },
  )
  return data
}

/**
 * Uploads a raw PDF file for moderation sources.
 */
export const uploadModerationSourcePdf = async (id: string, file: File): Promise<any> => {
  const formData = new FormData()
  formData.append('pdfFile', file)
  formData.append('sourceContributionId', id)
  const { data } = await apiClient.post<any>(
    '/moderation/sources/upload-pdf',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  )
  return data
}

/**
 * Deletes cached original PDF for moderation sources.
 */
export const deleteModerationSourceOriginalPdf = async (id: string): Promise<any> => {
  const { data } = await apiClient.delete<any>(`/moderation/sources/${id}/original-pdf`)
  return data
}

/**
 * Triggers PDF ingestion extraction/compilation processing for moderation contributions.
 */
export const processUploadedPdfForContribution = async (
  id: string,
  forceReplace = false,
  structuredFirst = false,
  signal?: AbortSignal,
): Promise<PdfProcessingResponse> => {
  const { data } = await apiClient.post<PdfProcessingResponse>(
    `/moderation/sources/${id}/process-uploaded-pdf`,
    { forceReplace, structuredFirst },
    { signal },
  )
  return data
}

export const cancelUploadedPdfImportForContribution = async (id: string): Promise<void> => {
  await apiClient.post(`/moderation/sources/${id}/pdf-import-cancel`)
}

export const getUploadedPdfImportProgressForContribution = async (id: string): Promise<PdfImportProgressResponse> => {
  const { data } = await apiClient.get<{ success: boolean; data: PdfImportProgressResponse }>(
    `/moderation/sources/${id}/pdf-import-progress`
  )
  return data.data
}

/**
 * Translates targeted Smart Reader elements for a source contribution preview.
 */
export const translateSourcePreviewText = async (
  id: string,
  payload: TranslateReaderRequest,
  signal?: AbortSignal
): Promise<TranslateReaderResponse> => {
  const { data } = await apiClient.post<TranslateReaderResponse>(
    `/moderation/sources/${id}/preview/translate`,
    payload,
    { signal }
  )
  return data
}
