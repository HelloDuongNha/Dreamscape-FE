import apiClient from './client'

export interface ContributeSourcePayload {
  doi?: string
  url?: string
  isbn?: string
  submittedNote?: string
  metadata?: any
}

export interface PreviewSourcePayload {
  doi?: string
  url?: string
  isbn?: string
}

/**
 * Fetches preview metadata for a DOI or URL without saving.
 */
export const previewSource = async (payload: PreviewSourcePayload) => {
  const { data } = await apiClient.post<{ success: boolean; message?: string; data?: any }>(
    '/sources/preview',
    payload
  )
  return data
}

/**
 * Submits a DOI or URL as a new academic source contribution.
 */
export const contributeSource = async (payload: ContributeSourcePayload) => {
  const { data } = await apiClient.post<{ success: boolean; message?: string; data?: any }>(
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
  onUploadProgress?: (progressEvent: any) => void
) => {
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

  const { data } = await apiClient.post<{ success: boolean; message?: string; data?: any }>(
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
  page?: number
  limit?: number
}

export interface ApprovedSourcesResponse {
  items: any[]
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
  params: GetApprovedSourcesParams
): Promise<ApprovedSourcesResponse> => {
  const { data } = await apiClient.get<{ success: boolean; data: ApprovedSourcesResponse }>(
    '/sources/approved',
    { params }
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

export const cacheOriginalPdf = async (id: string): Promise<any> => {
  const { data } = await apiClient.post<any>(`/sources/approved/${id}/cache-original-pdf`)
  return data
}

