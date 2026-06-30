import { computed, ref } from 'vue'

type OriginalDocStatus =
  | 'idle'
  | 'resolving'
  | 'pdf_ready'
  | 'pdf_inline_ready'
  | 'article_only'
  | 'metadata_only'
  | 'blocked'
  | 'failed'

type OriginalDocState = {
  status: OriginalDocStatus
  hasPdf: boolean
  pdfViewUrl: string
  pdfDownloadUrl: string
  sourceArticleUrl: string
  sourceLabel: string
  reason: string
  error: string
}

const initialState = (): OriginalDocState => ({
  status: 'idle',
  hasPdf: false,
  pdfViewUrl: '',
  pdfDownloadUrl: '',
  sourceArticleUrl: '',
  sourceLabel: '',
  reason: '',
  error: ''
})

export function useOriginalPdfViewer() {
  const originalDocState = ref<OriginalDocState>(initialState())
  const iframeUrl = computed(() => originalDocState.value.pdfViewUrl)

  // Temporary compile-only stub for the unfinished shared detail panel extraction.
  async function loadPdf(_sourceId?: string, _mode?: 'approved' | 'preview') {
    originalDocState.value = initialState()
  }

  function cleanup() {
    originalDocState.value = initialState()
  }

  return {
    originalDocState,
    iframeUrl,
    loadPdf,
    cleanup
  }
}
