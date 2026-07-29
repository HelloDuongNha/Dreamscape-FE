export interface ReaderImportReport {
  chosenCandidate?: string
}

export interface ReaderImportResult {
  message?: string
  report?: ReaderImportReport
}

export interface StructuredReaderImportResponse {
  success: boolean
  message?: string
  data?: {
    report?: ReaderImportReport
  }
}

export interface StructuredReaderReimportResponse {
  success: boolean
  reimported: boolean
  cleared: unknown
  importResult?: ReaderImportResult
  warnings: string[]
  message?: string
}

export interface PdfCacheAttempt {
  reason?: string
}

export interface PdfCacheResponse {
  success: boolean
  status?: 'cached' | 'already_cached' | 'recached' | 'external_only' | 'cache_failed'
  attemptedCandidates?: PdfCacheAttempt[]
}

export interface PdfProcessingResponse {
  success: boolean
  cancelled?: boolean
  readerCreated?: boolean
  requiresOcr?: boolean
  message?: string
  resolvedTitle?: string
  selectedSource?: 'jats' | 'html' | 'pdf_text' | 'docling_pdf' | 'none'
  detectedIdentifiers?: {
    doi?: string
    isbn?: string
    pmcid?: string
  }
  timing?: {
    expectedDurationSeconds?: number
    timingDeltaSeconds?: number
  }
}
