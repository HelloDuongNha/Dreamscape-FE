import apiClient from './client'

export interface ReviewSourcePayload {
  reviewStatus: 'approved' | 'rejected'
  reviewNote?: string
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

export interface SourceContribution {
  _id: string
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
  license?: string
  allowedUse?: 'metadata_only' | 'abstract_only' | 'open_access_fulltext'
  verificationStatus?: 'unverified' | 'verified_doi' | 'manual'
  sourceQuality?: 'peer_reviewed' | 'preprint' | 'informal'
  copyrightStatus?: 'public_domain' | 'copyrighted_with_open_access' | 'paywalled'
  createdAt: string
  updatedAt: string
  originalFile?: {
    storageProvider: 'cloudinary' | 'local' | 'gridfs'
    originalFileName: string
    mimeType: string
    fileSize: number
    cloudinaryPublicId?: string
    cloudinarySecureUrl?: string
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

/**
 * Triggers manual open-access fulltext import for one AcademicSource.
 */
export const importFullText = async (
  id: string
): Promise<{ success: boolean; message?: string; data?: any }> => {
  const { data } = await apiClient.post<{
    success: boolean
    message?: string
    data?: any
  }>(`/moderation/sources/${id}/import-fulltext`)
  return data
}

/**
 * Triggers destructive re-import of fulltext for one AcademicSource.
 */
export const reimportFullText = async (
  id: string
): Promise<{ success: boolean; reimported: boolean; cleared: any; importResult: any; warnings: string[] }> => {
  const { data } = await apiClient.post<{
    success: boolean
    reimported: boolean
    cleared: any
    importResult: any
    warnings: string[]
  }>(`/moderation/sources/${id}/reimport-fulltext`)
  return data
}

