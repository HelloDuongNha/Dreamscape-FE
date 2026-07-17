import { defineStore } from 'pinia'
import { ref } from 'vue'
import { importFullText, reimportFullText, cacheModerationSourceOriginalPdf, processUploadedPdfForContribution } from '@/api/moderationApi'
import { processUploadedPdfForApprovedSource } from '@/api/sourceApi'

export const useSourceProgressStore = defineStore('sourceProgress', () => {
  const contributionId = ref<string | null>(null)
  const sourceTitle = ref<string>('')
  const isDialogVisible = ref(false)
  const isPinnedVisible = ref(false)
  const progress = ref(0)
  const status = ref<'pending' | 'success' | 'failed' | 'none'>('none')
  const stepText = ref('Đang khởi tạo...')
  const pipelineKind = ref<'submission' | 'pdf' | 'structured' | 'none'>('none')
  
  const smartReaderResult = ref<'success' | 'failed' | 'limited' | 'ocr_needed'>('limited')
  const pdfResult = ref<'success' | 'failed' | 'blocked' | 'external_only' | 'no_candidate' | 'none'>('none')
  const selectedSource = ref<'jats' | 'html' | 'pdf_text' | 'docling_pdf' | 'none'>('none')
  const detectedIdentifiers = ref<{ doi?: string; isbn?: string; pmcid?: string } | null>(null)

  async function startPdfOnlyPipeline(id: string, title: string, targetType: 'contribution' | 'approved_source' = 'contribution', forceReplace = false, structuredFirst = false) {
    contributionId.value = id
    sourceTitle.value = title
    isDialogVisible.value = true
    isPinnedVisible.value = false
    progress.value = 0
    status.value = 'pending'
    stepText.value = 'Đã tải PDF gốc lên hệ thống.'
    pipelineKind.value = 'pdf'
    smartReaderResult.value = 'limited'
    pdfResult.value = 'success'
    selectedSource.value = 'none'
    detectedIdentifiers.value = null

    // Step 1: Upload is done (0 - 20)
    await new Promise((resolve) => setTimeout(resolve, 300))
    progress.value = 20

    // Step 2: Check text layer (20 - 40)
    stepText.value = 'Đang kiểm tra lớp văn bản...'
    progress.value = 40

    // Step 3: Run processing (40 - 85)
    stepText.value = 'Đang nhận diện thông tin tài liệu...'
    let finalStatus: 'success' | 'failed' = 'failed'
    let finalSmartReaderResult: 'success' | 'failed' | 'limited' | 'ocr_needed' = 'failed'
    let finalStepText = 'Lỗi xử lý tệp PDF.'
    try {
      const runRes = targetType === 'contribution'
        ? await processUploadedPdfForContribution(id, forceReplace, structuredFirst)
        : await processUploadedPdfForApprovedSource(id, forceReplace, structuredFirst)
      progress.value = 85
      if (runRes.success && runRes.readerCreated) {
        finalStatus = 'success'
        finalSmartReaderResult = 'success'
        selectedSource.value = runRes.selectedSource || 'pdf_text'
        detectedIdentifiers.value = runRes.detectedIdentifiers || null
        finalStepText = runRes.message || 'Dựng bản đọc thông minh thành công.'
      } else if (runRes.requiresOcr) {
        finalStatus = 'failed'
        finalSmartReaderResult = 'ocr_needed'
        selectedSource.value = 'none'
        finalStepText = 'Tài liệu gốc đã được lưu (Original Document was preserved) nhưng cần OCR để tạo Bản đọc thông minh (OCR is required to create the Smart Reader).'
      } else if (runRes.success && !runRes.readerCreated) {
        finalStatus = 'failed'
        finalSmartReaderResult = 'failed'
        selectedSource.value = 'none'
        finalStepText = runRes.message || 'Lỗi: Tệp PDF đã được lưu nhưng không tạo được Bản đọc thông minh.'
      } else {
        finalStatus = 'failed'
        finalSmartReaderResult = 'failed'
        selectedSource.value = 'none'
        finalStepText = runRes.message || 'Lỗi khi xử lý tệp PDF.'
      }
    } catch (err: any) {
      console.warn('PDF-only processing failed:', err)
      progress.value = 85
      finalStatus = 'failed'
      finalSmartReaderResult = 'failed'
      selectedSource.value = 'none'
      finalStepText = err.response?.data?.message || err.message || 'Lỗi kết nối hoặc xử lý tệp PDF.'
    }

    // Step 4: Finalizing (85 - 100)
    await new Promise((resolve) => setTimeout(resolve, 800))
    progress.value = 100
    status.value = finalStatus
    smartReaderResult.value = finalSmartReaderResult
    stepText.value = finalStepText
    isDialogVisible.value = false
    isPinnedVisible.value = true // Show completion notification
  }

  async function startPipeline(id: string, title: string) {
    contributionId.value = id
    sourceTitle.value = title
    isDialogVisible.value = true
    isPinnedVisible.value = false
    progress.value = 0
    status.value = 'pending'
    stepText.value = 'Đang gửi nguồn vào hàng chờ duyệt...'
    pipelineKind.value = 'submission'
    smartReaderResult.value = 'limited'
    pdfResult.value = 'none'

    // Step 1: Submission is already done, advance to 20%
    progress.value = 20

    // Step 2: Import Smart Reader (20% - 45%)
    stepText.value = 'Đang nhập bản đọc thông minh...'
    try {
      const importRes = await importFullText(id)
      if (importRes.success) {
        smartReaderResult.value = 'success'
      } else {
        smartReaderResult.value = 'failed'
      }
    } catch (err) {
      console.warn('Smart reader import failed in preprocessing:', err)
      smartReaderResult.value = 'failed'
    }
    progress.value = 45

    // Step 3: Cache PDF (45% - 75%)
    // Always attempt — backend resolves candidates dynamically from DOI/PMCID/URLs
    stepText.value = 'Đang tìm và lưu PDF gốc online...'
    try {
      const cacheRes = await cacheModerationSourceOriginalPdf(id)
      if (cacheRes.success) {
        const st = cacheRes.status as string
        if (st === 'cached' || st === 'already_cached' || st === 'recached') {
          pdfResult.value = 'success'
        } else if (st === 'external_only') {
          pdfResult.value = 'external_only'
        } else {
          // cache_failed — inspect attemptedCandidates for blocked reasons
          const attempts = (cacheRes.attemptedCandidates || []) as any[]
          const isBlocked = attempts.some((a: any) =>
            a.reason === 'publisher_blocked' ||
            a.reason === 'recaptcha_challenge_page'
          )
          pdfResult.value = isBlocked ? 'blocked' : (attempts.length === 0 ? 'no_candidate' : 'failed')
        }
      } else {
        pdfResult.value = 'failed'
      }
    } catch (err: any) {
      console.warn('PDF cache failed in preprocessing:', err)
      const errMsg = (err.response?.data?.message || err.message || '').toLowerCase()
      if (errMsg.includes('403') || errMsg.includes('block') || errMsg.includes('captcha') || errMsg.includes('wiley') || errMsg.includes('embargo')) {
        pdfResult.value = 'blocked'
      } else {
        pdfResult.value = 'failed'
      }
    }
    progress.value = 75

    // Structured DOI/PMCID/URL import remains first. Only when it failed and a
    // real Original PDF was cached do we invoke the PDF Docling fallback once.
    if (smartReaderResult.value === 'failed' && pdfResult.value === 'success') {
      stepText.value = 'Không có bản đọc HTML/JATS; đang dựng từ PDF bằng Docling...'
      try {
        const doclingRes = await processUploadedPdfForContribution(id, false, false)
        if (doclingRes.success && doclingRes.readerCreated) {
          smartReaderResult.value = 'success'
          selectedSource.value = doclingRes.selectedSource || 'pdf_text'
          detectedIdentifiers.value = doclingRes.detectedIdentifiers || null
          stepText.value = doclingRes.message || 'Dựng bản đọc từ PDF bằng Docling thành công.'
        } else if (doclingRes.requiresOcr) {
          smartReaderResult.value = 'ocr_needed'
          stepText.value = doclingRes.message || 'PDF cần OCR để tạo Bản đọc thông minh.'
        } else {
          smartReaderResult.value = 'failed'
          stepText.value = doclingRes.message || 'Không tạo được Bản đọc thông minh từ PDF.'
        }
      } catch (err: any) {
        smartReaderResult.value = 'failed'
        stepText.value = err.response?.data?.message || err.message || 'Không thể xử lý PDF bằng Docling.'
      }
    }

    // Step 4: Finalizing metadata (75% - 95%)
    if (smartReaderResult.value !== 'failed' && smartReaderResult.value !== 'ocr_needed') {
      stepText.value = 'Đang cập nhật trạng thái xem trước...'
    }
    await new Promise((resolve) => setTimeout(resolve, 800))
    progress.value = 95

    // Complete (100%)
    progress.value = 100
    status.value = 'success'
    stepText.value = 'Hoàn tất xử lý nguồn.'
    isDialogVisible.value = false
    isPinnedVisible.value = true // Show completion notification
  }

  async function startStructuredReader(id: string, title: string, reimport = true) {
    const startedAt = Date.now()
    contributionId.value = id
    sourceTitle.value = title
    isDialogVisible.value = true
    isPinnedVisible.value = false
    progress.value = 10
    status.value = 'pending'
    pipelineKind.value = 'structured'
    stepText.value = reimport
      ? 'Đang nhập lại từ DOI / HTML / XML...'
      : 'Đang nhập từ DOI / HTML / XML...'
    smartReaderResult.value = 'limited'
    pdfResult.value = 'none'
    selectedSource.value = 'none'
    detectedIdentifiers.value = null

    try {
      progress.value = 35
      const response: any = reimport
        ? await reimportFullText(id)
        : await importFullText(id)
      progress.value = 90

      const succeeded = response?.success === true && (!reimport || response?.reimported === true)
      if (!succeeded) {
        throw new Error(
          response?.importResult?.message || response?.message || 'Không thể nhập bản đọc từ nguồn có cấu trúc.'
        )
      }

      const chosen = String(
        response?.importResult?.report?.chosenCandidate ||
        response?.data?.report?.chosenCandidate ||
        ''
      ).toLowerCase()
      selectedSource.value = chosen.includes('xml')
        ? 'jats'
        : chosen.includes('html')
          ? 'html'
          : chosen.includes('pdf')
            ? 'pdf_text'
            : 'none'
      smartReaderResult.value = 'success'
      status.value = 'success'
      stepText.value = reimport
        ? 'Nhập lại bản đọc từ nguồn có cấu trúc thành công.'
        : 'Nhập bản đọc từ nguồn có cấu trúc thành công.'
      return response
    } catch (err: any) {
      status.value = 'failed'
      smartReaderResult.value = 'failed'
      stepText.value = err.response?.data?.message || err.message || 'Không thể nhập bản đọc từ nguồn có cấu trúc.'
      return null
    } finally {
      const minimumVisibleMs = 600
      const remainingMs = minimumVisibleMs - (Date.now() - startedAt)
      if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs))
      }
      progress.value = 100
      isDialogVisible.value = false
      isPinnedVisible.value = true
    }
  }

  function minimizeDialog() {
    isDialogVisible.value = false
    if (status.value === 'pending') {
      isPinnedVisible.value = true
    }
  }

  function openDialog() {
    if (status.value === 'pending') {
      isDialogVisible.value = true
      isPinnedVisible.value = false
    }
  }

  function stopTracking() {
    contributionId.value = null
    sourceTitle.value = ''
    isDialogVisible.value = false
    isPinnedVisible.value = false
    progress.value = 0
    status.value = 'none'
    pipelineKind.value = 'none'
    smartReaderResult.value = 'limited'
    pdfResult.value = 'none'
  }

  return {
    contributionId,
    sourceTitle,
    isDialogVisible,
    isPinnedVisible,
    progress,
    status,
    stepText,
    pipelineKind,
    smartReaderResult,
    pdfResult,
    selectedSource,
    detectedIdentifiers,
    startPipeline,
    startPdfOnlyPipeline,
    startStructuredReader,
    minimizeDialog,
    openDialog,
    stopTracking
  }
})
