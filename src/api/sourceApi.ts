import apiClient from './client'
import type { TranslateReaderRequest, TranslateReaderResponse } from '../features/library/services/smartReaderTranslation.types'
import type { PdfImportProgressResponse } from './moderationApi'
import type { PdfProcessingResponse } from './academicSourceProcessing.types'
import type { AxiosProgressEvent } from 'axios'

export interface AcademicSourcePreview {
  title: string
  authors?: string[]
  year?: number
  journal?: string
  publisher?: string
  doi?: string
  pmcid?: string
  url?: string
  fileName?: string
  fileSize?: number
  sourceProvider?: string
  fullTextAvailable?: boolean
}

export interface SourceContributionResult {
  success: boolean
  message?: string
  data?: {
    _id?: string
    data?: { _id?: string }
  }
}

export interface ContributeSourcePayload {
  doi?: string
  pmcid?: string
  url?: string
  submittedNote?: string
  metadata?: AcademicSourcePreview
}

export interface PreviewSourcePayload {
  doi?: string
  pmcid?: string
  url?: string
}

/**
 * Fetches preview metadata for a DOI or URL without saving.
 */
export const previewSource = async (payload: PreviewSourcePayload): Promise<{
  success: boolean
  message?: string
  data?: AcademicSourcePreview
}> => {
  const { data } = await apiClient.post<{
    success: boolean
    message?: string
    data?: AcademicSourcePreview
  }>(
    '/sources/preview',
    payload
  )
  return data
}

/**
 * Submits a DOI or URL as a new academic source contribution.
 */
export const contributeSource = async (
  payload: ContributeSourcePayload,
): Promise<SourceContributionResult> => {
  const { data } = await apiClient.post<SourceContributionResult>(
    '/sources/contribute',
    payload
  )
  return data
}

/**
 * Submits a PDF file as a new academic source contribution.
 * Supports progress tracking callback for the UI.
 */
export const contributePdfSource = async (
  file: File,
  payload: {
    doi?: string
    url?: string
    title?: string
    authors?: string[]
    year?: number
    journal?: string
    publisher?: string
    submittedNote?: string
  },
  onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
): Promise<SourceContributionResult> => {
  const formData = new FormData()
  formData.append('pdfFile', file)
  if (payload.doi) formData.append('doi', payload.doi)
  if (payload.url) formData.append('url', payload.url)
  if (payload.title) formData.append('title', payload.title)
  if (payload.authors && payload.authors.length > 0) {
    formData.append('authors', JSON.stringify(payload.authors))
  }
  if (payload.year) formData.append('year', String(payload.year))
  if (payload.journal) formData.append('journal', payload.journal)
  if (payload.publisher) formData.append('publisher', payload.publisher)
  if (payload.submittedNote) formData.append('submittedNote', payload.submittedNote)

  const { data } = await apiClient.post<SourceContributionResult>(
    '/sources/contribute-pdf',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    }
  )
  return data
}

export interface GetApprovedSourcesParams {
  q?: string
  doi?: string
  page?: number
  limit?: number
}

export interface ApprovedSourceCatalogItem {
  _id: string
  title?: string
  authors?: string[]
  year?: number
  journal?: string
  doi?: string
  url?: string
  sourceOrigin?: string
  originalFile?: Record<string, unknown>
  fullTextSourceType?: string
  allowedUse?: string
  verificationStatus?: string
  copyrightStatus?: string
  progress?: number
  metadata?: {
    authors?: string[]
    category?: string
  }
}

export interface ApprovedSourcesResponse {
  items: ApprovedSourceCatalogItem[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

/**
 * Fetches approved academic sources catalog with pagination and optional query search.
 */
export const getApprovedSources = async (
  params: GetApprovedSourcesParams,
  signal?: AbortSignal
): Promise<ApprovedSourcesResponse> => {
  const { data } = await apiClient.get<{ success: boolean; data: ApprovedSourcesResponse }>(
    '/sources/approved',
    { params, signal }
  )
  return data.data
}

/**
 * Fetches a single approved academic source by ID.
 */
export const getApprovedSourceById = async (id: string): Promise<any> => {
  const { data } = await apiClient.get<{ success: boolean; data: any }>(
    `/sources/approved/${id}`
  )
  return data.data
}

/**
 * Fetches the paginated full text sections for an approved source reader.
 */
export const getApprovedSourceRead = async (
  id: string,
  page = 1,
  limit = 20
): Promise<any> => {
  const { data } = await apiClient.get<{ success: boolean; data: any }>(
    `/sources/approved/${id}/read`,
    { params: { page, limit } }
  )
  return data.data
}

/**
 * Fetches the original document details and embeddability.
 */
export const getApprovedSourceOriginalDocument = async (id: string): Promise<any> => {
  const { data } = await apiClient.get<{
    success: boolean
    viewUrl?: string
    canEmbed?: boolean
    sourceKind?: string
    message?: string
  }>(`/sources/approved/${id}/original-document`)
  return data
}

/**
 * Fetches the raw PDF blob securely.
 */
export const getApprovedSourcePdfInline = async (id: string): Promise<Blob> => {
  const { data } = await apiClient.get<Blob>(
    `/sources/approved/${id}/pdf-inline`,
    { responseType: 'blob' }
  )
  return data
}

export const cacheOriginalPdf = async (id: string, options?: { force?: boolean }): Promise<any> => {
  const { data } = await apiClient.post<any>(`/sources/approved/${id}/cache-original-pdf`, options)
  return data
}

export const uploadApprovedSourcePdf = async (id: string, file: File): Promise<any> => {
  const formData = new FormData()
  formData.append('pdfFile', file)
  const { data } = await apiClient.post<any>(
    `/sources/approved/${id}/upload-pdf`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  )
  return data
}

export const deleteApprovedSourceOriginalPdf = async (id: string): Promise<any> => {
  const { data } = await apiClient.delete<any>(`/sources/approved/${id}/original-pdf`)
  return data
}

/**
 * Triggers PDF ingestion processing for approved academic sources.
 */
export const processUploadedPdfForApprovedSource = async (
  id: string,
  forceReplace = false,
  structuredFirst = false,
  signal?: AbortSignal,
): Promise<PdfProcessingResponse> => {
  const { data } = await apiClient.post<PdfProcessingResponse>(
    `/sources/approved/${id}/process-uploaded-pdf`,
    { forceReplace, structuredFirst },
    { signal },
  )
  return data
}

export const cancelUploadedPdfImportForApprovedSource = async (id: string): Promise<void> => {
  await apiClient.post(`/sources/approved/${id}/pdf-import-cancel`)
}

export const getUploadedPdfImportProgressForApprovedSource = async (id: string): Promise<PdfImportProgressResponse> => {
  const { data } = await apiClient.get<{ success: boolean; data: PdfImportProgressResponse }>(
    `/sources/approved/${id}/pdf-import-progress`
  )
  return data.data
}

/**
 * Translates targeted Smart Reader elements for an approved source.
 */
export const translateApprovedSourceText = async (
  id: string,
  payload: TranslateReaderRequest,
  signal?: AbortSignal
): Promise<TranslateReaderResponse> => {
  const { data } = await apiClient.post<TranslateReaderResponse>(
    `/sources/approved/${id}/read/translate`,
    payload,
    { signal }
  )
  return data
}
