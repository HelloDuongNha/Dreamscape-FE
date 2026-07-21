import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { importFullText, reimportFullText, cacheModerationSourceOriginalPdf, processUploadedPdfForContribution } from '@/api/moderationApi'
import { processUploadedPdfForApprovedSource } from '@/api/sourceApi'
import { useAcademicJobQueueStore } from './useAcademicJobQueueStore'

export const useSourceProgressStore = defineStore('sourceProgress', () => {
  const contributionId = ref<string | null>(null)
  const sourceTitle = ref<string>('')
  const isDialogVisible = ref(false)
  const isPinnedVisible = ref(false)
  const progress = ref(0)
  const status = ref<'pending' | 'success' | 'failed' | 'none'>('none')
  const stepText = ref('Đang khởi tạo...')
  const stageDetail = ref('Đang chuẩn bị tác vụ và kiểm tra dữ liệu đầu vào.')
  const elapsedSeconds = ref(0)
  const pipelineKind = ref<'submission' | 'pdf' | 'structured' | 'none'>('none')
  
  const smartReaderResult = ref<'success' | 'failed' | 'limited' | 'ocr_needed'>('limited')
  const pdfResult = ref<'success' | 'failed' | 'blocked' | 'external_only' | 'no_candidate' | 'none'>('none')
  const selectedSource = ref<'jats' | 'html' | 'pdf_text' | 'docling_pdf' | 'none'>('none')
  const detectedIdentifiers = ref<{ doi?: string; isbn?: string; pmcid?: string } | null>(null)
  const expectedTotalSeconds = ref<number | null>(null)
  const estimatedRemainingSeconds = computed<number | null>(() => {
    if (status.value !== 'pending' || expectedTotalSeconds.value === null) return null
    return Math.max(0, expectedTotalSeconds.value - elapsedSeconds.value)
  })
  let clockTimer: ReturnType<typeof setInterval> | null = null
  let smoothTimer: ReturnType<typeof setInterval> | null = null
  let terminalTimer: ReturnType<typeof setTimeout> | null = null
  let clockStartedAt = 0

  function durationStorageKey() {
    return contributionId.value && pipelineKind.value !== 'none'
      ? `dreamscape:academic-duration:${pipelineKind.value}:${contributionId.value}`
      : ''
  }

  function loadExpectedDuration() {
    expectedTotalSeconds.value = null
    const key = durationStorageKey()
    if (!key) return
    try {
      const samples = JSON.parse(localStorage.getItem(key) || '[]')
        .filter((value: unknown) => typeof value === 'number' && value > 0)
        .sort((a: number, b: number) => a - b)
      if (samples.length > 0) expectedTotalSeconds.value = samples[Math.floor(samples.length / 2)]
    } catch {
      expectedTotalSeconds.value = null
    }
  }

  function rememberDuration() {
    const key = durationStorageKey()
    const duration = Math.max(1, Math.round((Date.now() - clockStartedAt) / 1000))
    if (!key || !clockStartedAt) return
    try {
      const previous = JSON.parse(localStorage.getItem(key) || '[]')
      const samples = Array.isArray(previous) ? previous.filter(value => typeof value === 'number' && value > 0) : []
      localStorage.setItem(key, JSON.stringify([...samples, duration].slice(-5)))
    } catch {
      // Timing history is optional and must never affect ingestion.
    }
  }

  function startClock() {
    if (clockTimer) clearInterval(clockTimer)
    elapsedSeconds.value = 0
    clockStartedAt = Date.now()
    loadExpectedDuration()
    clockTimer = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - clockStartedAt) / 1000)
    }, 1000)
  }

  function stopSmoothProgress() {
    if (smoothTimer) clearInterval(smoothTimer)
    smoothTimer = null
  }

  function startSmoothProgress(cap: number, expectedStageMs: number) {
    stopSmoothProgress()
    const startedAt = Date.now()
    const initial = progress.value
    smoothTimer = setInterval(() => {
      const ratio = 1 - Math.exp(-(Date.now() - startedAt) / expectedStageMs)
      progress.value = Math.max(progress.value, Math.round(Math.min(cap - 0.2, initial + (cap - initial) * ratio)))
    }, 500)
  }

  function stopTimers() {
    stopSmoothProgress()
    if (clockTimer) clearInterval(clockTimer)
    clockTimer = null
  }

  function finishTimers() {
    rememberDuration()
    stopTimers()
  }

  async function runPdfOnlyPipeline(id: string, title: string, targetType: 'contribution' | 'approved_source' = 'contribution', forceReplace = false, structuredFirst = false, promotedFromQueue = false) {
    contributionId.value = id
    sourceTitle.value = title
    isDialogVisible.value = !promotedFromQueue
    isPinnedVisible.value = promotedFromQueue
    progress.value = 0
    status.value = 'pending'
    stepText.value = 'Đã tải PDF gốc lên hệ thống.'
    pipelineKind.value = 'pdf'
    smartReaderResult.value = 'limited'
    pdfResult.value = 'success'
    selectedSource.value = 'none'
    detectedIdentifiers.value = null
    startClock()

    // Step 1: Upload is done (0 - 20)
    await new Promise((resolve) => setTimeout(resolve, 300))
    progress.value = 20

    // Step 2: Check text layer (20 - 40)
    stepText.value = 'Đang kiểm tra lớp văn bản...'
    stageDetail.value = 'Đếm trang có text để quyết định dùng parser thường hay OCR.'
    progress.value = 40

    // Step 3: Run processing (40 - 85)
    stepText.value = 'Đang nhận diện thông tin tài liệu...'
    stageDetail.value = 'Đang nhận diện DOI/ISBN, dựng bố cục, bảng và hình ảnh. Sách scan dài có thể cần OCR trong nhiều phút.'
    startSmoothProgress(84, 120_000)
    let finalStatus: 'success' | 'failed' = 'failed'
    let finalSmartReaderResult: 'success' | 'failed' | 'limited' | 'ocr_needed' = 'failed'
    let finalStepText = 'Lỗi xử lý tệp PDF.'
    try {
      const runRes = targetType === 'contribution'
        ? await processUploadedPdfForContribution(id, forceReplace, structuredFirst)
        : await processUploadedPdfForApprovedSource(id, forceReplace, structuredFirst)
      progress.value = 85
      stopSmoothProgress()
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
      stopSmoothProgress()
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
    finishTimers()
    scheduleTerminalDismiss()
  }

  async function runPipeline(id: string, title: string, promotedFromQueue = false) {
    contributionId.value = id
    sourceTitle.value = title
    isDialogVisible.value = !promotedFromQueue
    isPinnedVisible.value = promotedFromQueue
    progress.value = 0
    status.value = 'pending'
    stepText.value = 'Đang gửi nguồn vào hàng chờ duyệt...'
    pipelineKind.value = 'submission'
    smartReaderResult.value = 'limited'
    pdfResult.value = 'none'
    stageDetail.value = 'Đang chuẩn bị nguồn và kiểm tra quyền truy cập nội dung.'
    startClock()

    // Step 1: Submission is already done, advance to 20%
    progress.value = 20

    // Step 2: Import Smart Reader (20% - 45%)
    stepText.value = 'Đang nhập bản đọc thông minh...'
    stageDetail.value = 'Đang thử JATS/XML và HTML có cấu trúc trước để giữ heading, bảng và hình tốt nhất.'
    startSmoothProgress(44, 30_000)
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
    stopSmoothProgress()

    // Step 3: Cache PDF (45% - 75%)
    // Always attempt — backend resolves candidates dynamically from DOI/PMCID/URLs
    stepText.value = 'Đang tìm và lưu PDF gốc online...'
    stageDetail.value = 'Đang thử các nguồn PDF hợp pháp và lưu bản gốc vào Firebase Storage khi tìm thấy.'
    startSmoothProgress(74, 45_000)
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
    stopSmoothProgress()

    // Structured DOI/PMCID/URL import remains first. Only when it failed and a
    // real Original PDF was cached do we invoke the PDF Docling fallback once.
    if (smartReaderResult.value === 'failed' && pdfResult.value === 'success') {
      stepText.value = 'Không có bản đọc HTML/JATS; đang dựng từ PDF bằng Docling...'
      stageDetail.value = 'Docling đang phục hồi thứ tự đọc, heading, table và figure từ PDF.'
      startSmoothProgress(92, 120_000)
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
      stopSmoothProgress()
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
    finishTimers()
    scheduleTerminalDismiss()
  }

  async function runStructuredReader(id: string, title: string, reimport = true, promotedFromQueue = false) {
    const startedAt = Date.now()
    contributionId.value = id
    sourceTitle.value = title
    isDialogVisible.value = !promotedFromQueue
    isPinnedVisible.value = promotedFromQueue
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
    stageDetail.value = 'Đang tìm nguồn có cấu trúc phù hợp và kiểm tra nội dung trả về.'
    startClock()

    try {
      progress.value = 35
      startSmoothProgress(88, 45_000)
      const response: any = reimport
        ? await reimportFullText(id)
        : await importFullText(id)
      progress.value = 90
      stopSmoothProgress()

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
      finishTimers()
      scheduleTerminalDismiss()
    }
  }

  function scheduleTerminalDismiss() {
    if (terminalTimer) clearTimeout(terminalTimer)
    terminalTimer = setTimeout(() => {
      isPinnedVisible.value = false
      terminalTimer = null
    }, 3000)
  }

  function dismissPinned() {
    isPinnedVisible.value = false
    if (status.value !== 'pending' && terminalTimer) {
      clearTimeout(terminalTimer)
      terminalTimer = null
    }
  }

  function minimizeDialog() {
    isDialogVisible.value = false
    if (status.value === 'pending') {
      isPinnedVisible.value = true
    }
  }

  function startPdfOnlyPipeline(id: string, title: string, targetType: 'contribution' | 'approved_source' = 'contribution', forceReplace = false, structuredFirst = false) {
    return useAcademicJobQueueStore().enqueue({
      sourceId: id,
      title,
      kind: 'pdf',
      run: ({ promotedFromQueue }) => runPdfOnlyPipeline(id, title, targetType, forceReplace, structuredFirst, promotedFromQueue),
    })
  }

  function startPipeline(id: string, title: string) {
    return useAcademicJobQueueStore().enqueue({
      sourceId: id,
      title,
      kind: 'submission',
      run: ({ promotedFromQueue }) => runPipeline(id, title, promotedFromQueue),
    })
  }

  function startStructuredReader(id: string, title: string, reimport = true) {
    return useAcademicJobQueueStore().enqueue({
      sourceId: id,
      title,
      kind: 'structured',
      run: ({ promotedFromQueue }) => runStructuredReader(id, title, reimport, promotedFromQueue),
    })
  }

  function openDialog() {
    if (status.value === 'pending') {
      isDialogVisible.value = true
      isPinnedVisible.value = false
    }
  }

  function stopTracking() {
    stopTimers()
    if (terminalTimer) clearTimeout(terminalTimer)
    terminalTimer = null
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
    stageDetail,
    elapsedSeconds,
    estimatedRemainingSeconds,
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
    stopTracking,
    dismissPinned,
  }
})
