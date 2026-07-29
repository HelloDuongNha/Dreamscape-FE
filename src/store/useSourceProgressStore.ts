import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  importFullText,
  reimportFullText,
  cacheModerationSourceOriginalPdf,
  processUploadedPdfForContribution,
  getUploadedPdfImportProgressForContribution,
  cancelUploadedPdfImportForContribution,
} from '@/api/moderationApi'
import {
  processUploadedPdfForApprovedSource,
  getUploadedPdfImportProgressForApprovedSource,
  cancelUploadedPdfImportForApprovedSource,
} from '@/api/sourceApi'
import {
  estimateStructuredReaderSeconds,
  type ReaderBuildTimingSample,
} from '@/features/library/services/structuredReaderEstimate.service'
import type {
  StructuredReaderImportResponse,
  StructuredReaderReimportResponse,
} from '@/api/academicSourceProcessing.types'
import { getApiErrorMessage } from '@/utils/apiError'
import { useAcademicJobQueueStore } from './useAcademicJobQueueStore'

const SOURCE_TASK_KEY = 'dreamscape:pinned-task:source-progress:v1'

type SourceTaskStatus = 'pending' | 'success' | 'failed' | 'cancelled' | 'none'
type SourcePipelineKind = 'submission' | 'pdf' | 'structured' | 'none'
type SourceTargetType = 'contribution' | 'approved_source'
type SmartReaderResult = 'success' | 'failed' | 'limited' | 'ocr_needed'
type PdfResult = 'success' | 'failed' | 'blocked' | 'external_only' | 'no_candidate' | 'none'
type ReaderSource = 'jats' | 'html' | 'pdf_text' | 'docling_pdf' | 'none'
type PdfStage =
  | 'received'
  | 'inspecting_text'
  | 'ocr_processing'
  | 'parsing_layout'
  | 'cleaning_ocr'
  | 'compiling_reader'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | null

interface BeginSourceTaskOptions {
  id: string
  title: string
  pipeline: Exclude<SourcePipelineKind, 'none'>
  targetType?: SourceTargetType
  promotedFromQueue?: boolean
  initialProgress: number
  step: string
  detail: string
  expectedSeconds?: number | null
  pdfStage?: PdfStage
  startedAt?: number
}

type StructuredReaderResponse =
  | StructuredReaderImportResponse
  | StructuredReaderReimportResponse

function structuredImportSucceeded(
  response: StructuredReaderResponse,
  reimport: boolean,
): boolean {
  if (response.success !== true) return false
  if (!reimport) return true
  return 'reimported' in response && response.reimported === true
}

function structuredImportMessage(response: StructuredReaderResponse): string {
  if ('importResult' in response) return response.importResult?.message || response.message || ''
  return response.message || ''
}

function structuredImportCandidate(response: StructuredReaderResponse): string {
  if ('importResult' in response) {
    return response.importResult?.report?.chosenCandidate || ''
  }
  if ('data' in response) {
    return response.data?.report?.chosenCandidate || ''
  }
  return ''
}

function readerSourceFromCandidate(candidate: string): ReaderSource {
  const normalized = candidate.toLowerCase()
  if (normalized.includes('xml')) return 'jats'
  if (normalized.includes('html')) return 'html'
  if (normalized.includes('pdf')) return 'pdf_text'
  return 'none'
}

export const useSourceProgressStore = defineStore('sourceProgress', () => {
  const contributionId = ref<string | null>(null)
  const sourceTitle = ref<string>('')
  const isDialogVisible = ref(false)
  const isPinnedVisible = ref(false)
  const progress = ref(0)
  const status = ref<SourceTaskStatus>('none')
  const stepText = ref('Đang khởi tạo...')
  const stageDetail = ref('Đang chuẩn bị tác vụ và kiểm tra dữ liệu đầu vào.')
  const elapsedSeconds = ref(0)
  const pipelineKind = ref<SourcePipelineKind>('none')
  const currentTargetType = ref<SourceTargetType>('contribution')
  const isCancelling = ref(false)
  
  const smartReaderResult = ref<SmartReaderResult>('limited')
  const pdfResult = ref<PdfResult>('none')
  const selectedSource = ref<ReaderSource>('none')
  const detectedIdentifiers = ref<{ doi?: string; isbn?: string; pmcid?: string } | null>(null)
  const expectedTotalSeconds = ref<number | null>(null)
  const timingDeltaSeconds = ref<number | null>(null)
  const ocrExpected = ref(false)
  const pdfStage = ref<PdfStage>(null)
  const estimatedRemainingSeconds = computed<number | null>(() => {
    if (status.value !== 'pending' || expectedTotalSeconds.value === null) return null
    return expectedTotalSeconds.value - elapsedSeconds.value
  })
  let clockTimer: ReturnType<typeof setInterval> | null = null
  let smoothTimer: ReturnType<typeof setInterval> | null = null
  let terminalTimer: ReturnType<typeof setTimeout> | null = null
  let clockStartedAt = 0
  let persistedExpiresAt: number | null = null
  let pdfProgressTimer: ReturnType<typeof setInterval> | null = null
  let activeRequestController: AbortController | null = null

  function taskWasCancelled(): boolean {
    return isCancelling.value || status.value === 'cancelled' || activeRequestController?.signal.aborted === true
  }

  function beginSourceTask(options: BeginSourceTaskOptions): AbortController {
    clearTerminalDismissal()
    contributionId.value = options.id
    sourceTitle.value = options.title
    isDialogVisible.value = !options.promotedFromQueue
    isPinnedVisible.value = options.promotedFromQueue === true
    progress.value = options.initialProgress
    status.value = 'pending'
    stepText.value = options.step
    stageDetail.value = options.detail
    pipelineKind.value = options.pipeline
    currentTargetType.value = options.targetType ?? 'contribution'
    smartReaderResult.value = 'limited'
    pdfResult.value = 'none'
    selectedSource.value = 'none'
    detectedIdentifiers.value = null
    expectedTotalSeconds.value = options.expectedSeconds ?? null
    timingDeltaSeconds.value = null
    ocrExpected.value = false
    pdfStage.value = options.pdfStage ?? null
    const requestController = new AbortController()
    activeRequestController = requestController
    startClock(options.startedAt)
    return requestController
  }

  function persistTask() {
    if (!contributionId.value || status.value === 'none') {
      localStorage.removeItem(SOURCE_TASK_KEY)
      return
    }
    localStorage.setItem(SOURCE_TASK_KEY, JSON.stringify({
      contributionId: contributionId.value,
      sourceTitle: sourceTitle.value,
      progress: progress.value,
      status: status.value,
      stepText: stepText.value,
      stageDetail: stageDetail.value,
      pipelineKind: pipelineKind.value,
      smartReaderResult: smartReaderResult.value,
      pdfResult: pdfResult.value,
      selectedSource: selectedSource.value,
      expectedTotalSeconds: expectedTotalSeconds.value,
      timingDeltaSeconds: timingDeltaSeconds.value,
      ocrExpected: ocrExpected.value,
      pdfStage: pdfStage.value,
      currentTargetType: currentTargetType.value,
      startedAt: clockStartedAt,
      expiresAt: persistedExpiresAt,
    }))
  }

  function restoreTracking() {
    try {
      const saved = JSON.parse(localStorage.getItem(SOURCE_TASK_KEY) || 'null')
      if (!saved?.contributionId) return
      if (saved.expiresAt && saved.expiresAt <= Date.now()) {
        localStorage.removeItem(SOURCE_TASK_KEY)
        return
      }
      contributionId.value = saved.contributionId
      sourceTitle.value = saved.sourceTitle || ''
      progress.value = Number(saved.progress) || 0
      status.value = saved.status || 'pending'
      stepText.value = saved.stepText || 'Đang khôi phục trạng thái tác vụ…'
      stageDetail.value = saved.stageDetail || ''
      pipelineKind.value = saved.pipelineKind || 'none'
      smartReaderResult.value = saved.smartReaderResult || 'limited'
      pdfResult.value = saved.pdfResult || 'none'
      selectedSource.value = saved.selectedSource || 'none'
      expectedTotalSeconds.value = typeof saved.expectedTotalSeconds === 'number' ? saved.expectedTotalSeconds : null
      timingDeltaSeconds.value = typeof saved.timingDeltaSeconds === 'number' ? saved.timingDeltaSeconds : null
      ocrExpected.value = saved.ocrExpected === true
      pdfStage.value = saved.pdfStage || null
      currentTargetType.value = saved.currentTargetType === 'approved_source' ? 'approved_source' : 'contribution'
      isDialogVisible.value = false
      isPinnedVisible.value = true
      clockStartedAt = Number(saved.startedAt) || Date.now()
      if (status.value === 'pending') startClock(clockStartedAt)
      else if (saved.expiresAt) {
        persistedExpiresAt = saved.expiresAt
        terminalTimer = setTimeout(() => {
          isPinnedVisible.value = false
          localStorage.removeItem(SOURCE_TASK_KEY)
        }, Math.max(0, saved.expiresAt - Date.now()))
      }
    } catch {
      localStorage.removeItem(SOURCE_TASK_KEY)
    }
  }

  function startClock(startedAt = Date.now()) {
    if (clockTimer) clearInterval(clockTimer)
    clockStartedAt = startedAt
    elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - clockStartedAt) / 1000))
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
    if (pdfProgressTimer) clearInterval(pdfProgressTimer)
    pdfProgressTimer = null
    if (clockTimer) clearInterval(clockTimer)
    clockTimer = null
  }

  function finishTimers() {
    stopTimers()
  }

  function clearTerminalDismissal() {
    if (terminalTimer) clearTimeout(terminalTimer)
    terminalTimer = null
    persistedExpiresAt = null
  }

  function applyPdfStage(stage: typeof pdfStage.value) {
    if (!stage || stage === pdfStage.value) return
    pdfStage.value = stage
    const stageCopy = {
      received: ['Đã tiếp nhận PDF gốc.', 'Tệp nguồn được giữ nguyên để đối chiếu.', 20],
      inspecting_text: ['Đang kiểm tra lớp văn bản và nhu cầu OCR...', 'Đếm trang có văn bản và xác định chiến lược nhận dạng.', 35],
      ocr_processing: ['Đang nhận dạng văn bản tiếng Việt...', 'Docling đang chạy OCR toàn trang với ngôn ngữ tiếng Việt và tiếng Anh.', 52],
      parsing_layout: ['Đang phân tích bố cục bằng Docling...', 'Khôi phục heading, đoạn văn, bảng, hình và thứ tự đọc.', 62],
      cleaning_ocr: ['Đang làm sạch kết quả OCR...', 'Chuẩn hóa Unicode, ghép dòng vỡ và loại bỏ nhiễu số hóa trước khi lưu.', 78],
      compiling_reader: ['Đang dựng Bản đọc thông minh...', 'Chỉ các block đã qua chính sách làm sạch mới được ghi vào bản đọc.', 90],
      completed: ['Đã dựng Bản đọc thông minh.', 'PDF gốc và nội dung đã làm sạch đã được lưu.', 100],
      failed: ['Không thể dựng Bản đọc thông minh.', 'PDF gốc vẫn được giữ để kiểm tra lại.', 100],
      cancelled: ['Đã hủy nhập tài liệu.', 'Phần kết quả chưa hoàn tất không được lưu.', progress.value],
    } as const
    const copy = stageCopy[stage]
    if (!copy) return
    stepText.value = copy[0]
    stageDetail.value = copy[1]
    progress.value = Math.max(progress.value, copy[2])
  }

  async function syncPdfProgress(id: string, targetType: SourceTargetType) {
    const response = targetType === 'contribution'
      ? await getUploadedPdfImportProgressForContribution(id)
      : await getUploadedPdfImportProgressForApprovedSource(id)
    const active = response.progress
    const estimate = Number(active?.expectedDurationSeconds || response.estimateSeconds)
    if (Number.isFinite(estimate) && estimate > 0) expectedTotalSeconds.value = Math.round(estimate)
    if (active?.ocrExpected !== undefined) ocrExpected.value = active.ocrExpected === true
    const serverStartedAt = active?.startedAt ? new Date(active.startedAt).getTime() : Number.NaN
    const belongsToCurrentRun = Number.isFinite(serverStartedAt) && serverStartedAt >= clockStartedAt - 5000
    if (belongsToCurrentRun && status.value === 'pending') {
      if (Number.isFinite(serverStartedAt) && Math.abs(serverStartedAt - clockStartedAt) > 1500) {
        clockStartedAt = serverStartedAt
      }
    }
    if (belongsToCurrentRun && active?.timingDeltaSeconds !== undefined) timingDeltaSeconds.value = active.timingDeltaSeconds
    if (belongsToCurrentRun && active?.stage && status.value === 'pending') {
      applyPdfStage(active.stage)
      if (active.stage === 'failed' && active.failureMessage) {
        stepText.value = active.failureMessage
        stageDetail.value = active.failureCode
          ? `Mã lỗi: ${active.failureCode}. Bản đọc trước đó vẫn được giữ nguyên.`
          : 'Bản đọc trước đó vẫn được giữ nguyên.'
      }
    }
  }

  function startPdfProgressPolling(id: string, targetType: SourceTargetType) {
    if (pdfProgressTimer) clearInterval(pdfProgressTimer)
    void syncPdfProgress(id, targetType).catch(() => {})
    pdfProgressTimer = setInterval(() => {
      void syncPdfProgress(id, targetType).catch(() => {})
    }, 1500)
  }

  async function loadInitialPdfEstimate(
    id: string,
    targetType: SourceTargetType,
  ): Promise<number | null> {
    try {
      const response = targetType === 'contribution'
        ? await getUploadedPdfImportProgressForContribution(id)
        : await getUploadedPdfImportProgressForApprovedSource(id)
      const estimate = Number(
        response.progress?.expectedDurationSeconds || response.estimateSeconds,
      )
      return Number.isFinite(estimate) && estimate > 0 ? Math.round(estimate) : null
    } catch {
      return null
    }
  }

  async function runPdfOnlyPipeline(
    id: string,
    title: string,
    targetType: SourceTargetType = 'contribution',
    forceReplace = false,
    structuredFirst = false,
    promotedFromQueue = false,
  ) {
    const initialEstimate = await loadInitialPdfEstimate(id, targetType)
    const requestController = beginSourceTask({
      id,
      title,
      pipeline: 'pdf',
      targetType,
      promotedFromQueue,
      initialProgress: 0,
      step: 'Đã tải PDF gốc lên hệ thống.',
      detail: 'PDF gốc được giữ nguyên; Bản đọc sẽ chỉ lưu phần văn bản đã qua kiểm tra và làm sạch.',
      expectedSeconds: initialEstimate,
      pdfStage: 'received',
    })
    pdfResult.value = 'success'

    // Step 1: Upload is done (0 - 20)
    await new Promise((resolve) => setTimeout(resolve, 300))
    progress.value = 20

    // Step 2: Check text layer (20 - 40)
    stepText.value = 'Đang kiểm tra lớp văn bản...'
    stageDetail.value = 'Đếm trang có text để quyết định dùng parser thường hay OCR.'
    progress.value = 40

    // Step 3: Run processing (40 - 85)
    stepText.value = 'Đang nhận diện thông tin tài liệu...'
    stageDetail.value = 'Docling đang dựng bố cục, bảng và hình; văn bản OCR sẽ được làm sạch tự động trước khi lưu. Sách scan dài có thể cần nhiều phút.'
    startSmoothProgress(76, 120_000)
    let finalStatus: 'success' | 'failed' = 'failed'
    let finalSmartReaderResult: 'success' | 'failed' | 'limited' | 'ocr_needed' = 'failed'
    let finalStepText = 'Lỗi xử lý tệp PDF.'
    try {
      const request = targetType === 'contribution'
        ? processUploadedPdfForContribution(id, forceReplace, structuredFirst, requestController.signal)
        : processUploadedPdfForApprovedSource(id, forceReplace, structuredFirst, requestController.signal)
      startPdfProgressPolling(id, targetType)
      const runRes = await request
      if (runRes.cancelled || taskWasCancelled()) return
      progress.value = 85
      stopSmoothProgress()
      if (runRes.timing?.expectedDurationSeconds) expectedTotalSeconds.value = runRes.timing.expectedDurationSeconds
      if (typeof runRes.timing?.timingDeltaSeconds === 'number') timingDeltaSeconds.value = runRes.timing.timingDeltaSeconds
      if (runRes.resolvedTitle) sourceTitle.value = runRes.resolvedTitle
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
    } catch (error: unknown) {
      if (taskWasCancelled()) return
      console.warn('PDF-only processing failed:', error)
      progress.value = 85
      stopSmoothProgress()
      finalStatus = 'failed'
      finalSmartReaderResult = 'failed'
      selectedSource.value = 'none'
      finalStepText = getApiErrorMessage(error, 'Lỗi kết nối hoặc xử lý tệp PDF.')
    }

    // Step 4: Finalizing (85 - 100)
    if (taskWasCancelled()) return
    await new Promise((resolve) => setTimeout(resolve, 800))
    progress.value = 100
    status.value = finalStatus
    smartReaderResult.value = finalSmartReaderResult
    stepText.value = finalStepText
    pdfStage.value = finalStatus === 'success' ? 'completed' : 'failed'
    isDialogVisible.value = false
    isPinnedVisible.value = true // Show completion notification
    finishTimers()
    scheduleTerminalDismiss()
  }

  async function runPipeline(id: string, title: string, promotedFromQueue = false) {
    const requestController = beginSourceTask({
      id,
      title,
      pipeline: 'submission',
      promotedFromQueue,
      initialProgress: 0,
      step: 'Đang gửi nguồn vào hàng chờ duyệt...',
      detail: 'Đang chuẩn bị nguồn và kiểm tra quyền truy cập nội dung.',
    })

    // Step 1: Submission is already done, advance to 20%
    progress.value = 20

    // Step 2: Import Smart Reader (20% - 45%)
    stepText.value = 'Đang nhập bản đọc thông minh...'
    stageDetail.value = 'Đang thử JATS/XML và HTML có cấu trúc trước để giữ heading, bảng và hình tốt nhất.'
    startSmoothProgress(44, 30_000)
    try {
      const importRes = await importFullText(id, requestController.signal)
      if (importRes.success) {
        smartReaderResult.value = 'success'
      } else {
        smartReaderResult.value = 'failed'
      }
    } catch (err) {
      console.warn('Smart reader import failed in preprocessing:', err)
      smartReaderResult.value = 'failed'
    }
    if (taskWasCancelled()) return
    progress.value = 45
    stopSmoothProgress()

    // Step 3: Cache PDF (45% - 75%)
    // Always attempt — backend resolves candidates dynamically from DOI/PMCID/URLs
    stepText.value = 'Đang tìm và lưu PDF gốc online...'
    stageDetail.value = 'Đang thử các nguồn PDF hợp pháp và lưu bản gốc vào Firebase Storage khi tìm thấy.'
    startSmoothProgress(74, 45_000)
    try {
      const cacheRes = await cacheModerationSourceOriginalPdf(id, undefined, requestController.signal)
      if (cacheRes.success) {
        const st = cacheRes.status as string
        if (st === 'cached' || st === 'already_cached' || st === 'recached') {
          pdfResult.value = 'success'
        } else if (st === 'external_only') {
          pdfResult.value = 'external_only'
        } else {
          // cache_failed — inspect attemptedCandidates for blocked reasons
          const attempts = cacheRes.attemptedCandidates || []
          const isBlocked = attempts.some(attempt =>
            attempt.reason === 'publisher_blocked' ||
            attempt.reason === 'recaptcha_challenge_page'
          )
          pdfResult.value = isBlocked ? 'blocked' : (attempts.length === 0 ? 'no_candidate' : 'failed')
        }
      } else {
        pdfResult.value = 'failed'
      }
    } catch (error: unknown) {
      console.warn('PDF cache failed in preprocessing:', error)
      const errMsg = getApiErrorMessage(error).toLowerCase()
      if (errMsg.includes('403') || errMsg.includes('block') || errMsg.includes('captcha') || errMsg.includes('wiley') || errMsg.includes('embargo')) {
        pdfResult.value = 'blocked'
      } else {
        pdfResult.value = 'failed'
      }
    }
    if (taskWasCancelled()) return
    progress.value = 75
    stopSmoothProgress()

    // Structured DOI/PMCID/URL import remains first. Only when it failed and a
    // real Original PDF was cached do we invoke the PDF Docling fallback once.
    if (smartReaderResult.value === 'failed' && pdfResult.value === 'success') {
      stepText.value = 'Không có bản đọc HTML/JATS; đang dựng từ PDF bằng Docling...'
      stageDetail.value = 'Docling đang phục hồi thứ tự đọc, heading, table và figure; bước làm sạch OCR chạy tự động trước khi lưu.'
      startSmoothProgress(92, 120_000)
      try {
        const doclingRes = await processUploadedPdfForContribution(id, false, false, requestController.signal)
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
      } catch (error: unknown) {
        smartReaderResult.value = 'failed'
        stepText.value = getApiErrorMessage(error, 'Không thể xử lý PDF bằng Docling.')
      }
      if (taskWasCancelled()) return
      stopSmoothProgress()
    }

    // Step 4: Finalizing metadata (75% - 95%)
    if (smartReaderResult.value !== 'failed' && smartReaderResult.value !== 'ocr_needed') {
      stepText.value = 'Đang cập nhật trạng thái xem trước...'
    }
    await new Promise((resolve) => setTimeout(resolve, 800))
    progress.value = 95

    // Complete only when a readable document was actually persisted.
    progress.value = 100
    status.value = smartReaderResult.value === 'success' ? 'success' : 'failed'
    if (status.value === 'success') {
      stepText.value = 'Hoàn tất xử lý nguồn.'
      stageDetail.value = 'Bản đọc thông minh đã sẵn sàng để xem trước và duyệt.'
    } else if (smartReaderResult.value === 'ocr_needed') {
      stageDetail.value = 'PDF cần được nhận dạng OCR trước khi có thể tạo Bản đọc thông minh.'
    } else {
      stageDetail.value = 'Chưa tạo được Bản đọc thông minh; nguồn vẫn được giữ để bạn thử lại hoặc tải PDF lên.'
    }
    isDialogVisible.value = false
    isPinnedVisible.value = true
    finishTimers()
    scheduleTerminalDismiss()
  }

  async function runStructuredReader(
    id: string,
    title: string,
    reimport = true,
    history: ReaderBuildTimingSample[] = [],
    promotedFromQueue = false,
  ) {
    const startedAt = Date.now()
    const expectedSeconds = estimateStructuredReaderSeconds(history)
    const requestController = beginSourceTask({
      id,
      title,
      pipeline: 'structured',
      promotedFromQueue,
      initialProgress: 10,
      step: reimport
        ? 'Đang nhập lại từ DOI / HTML / XML...'
        : 'Đang nhập từ DOI / HTML / XML...',
      detail: 'Đang tìm nguồn có cấu trúc phù hợp và kiểm tra nội dung trả về.',
      expectedSeconds,
      startedAt,
    })

    try {
      progress.value = 35
      startSmoothProgress(88, expectedSeconds * 1000)
      const response: StructuredReaderResponse = reimport
        ? await reimportFullText(id, requestController.signal)
        : await importFullText(id, requestController.signal)
      progress.value = 90
      stopSmoothProgress()

      if (!structuredImportSucceeded(response, reimport)) {
        throw new Error(
          structuredImportMessage(response) || 'Không thể nhập bản đọc từ nguồn có cấu trúc.'
        )
      }

      selectedSource.value = readerSourceFromCandidate(
        structuredImportCandidate(response),
      )
      smartReaderResult.value = 'success'
      status.value = 'success'
      stepText.value = reimport
        ? 'Nhập lại bản đọc từ nguồn có cấu trúc thành công.'
        : 'Nhập bản đọc từ nguồn có cấu trúc thành công.'
      return response
    } catch (error: unknown) {
      if (taskWasCancelled()) return null
      status.value = 'failed'
      smartReaderResult.value = 'failed'
      stepText.value = getApiErrorMessage(
        error,
        'Không thể nhập bản đọc từ nguồn có cấu trúc.',
      )
      return null
    } finally {
      if (taskWasCancelled()) return
      const minimumVisibleMs = 600
      const remainingMs = minimumVisibleMs - (Date.now() - startedAt)
      if (remainingMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingMs))
      }
      progress.value = 100
      timingDeltaSeconds.value = Math.ceil((Date.now() - startedAt) / 1000)
        - expectedSeconds
      isDialogVisible.value = false
      isPinnedVisible.value = true
      finishTimers()
      scheduleTerminalDismiss()
    }
  }

  function scheduleTerminalDismiss() {
    if (terminalTimer) clearTimeout(terminalTimer)
    persistedExpiresAt = Date.now() + 3000
    persistTask()
    terminalTimer = setTimeout(() => {
      isPinnedVisible.value = false
      localStorage.removeItem(SOURCE_TASK_KEY)
      terminalTimer = null
    }, 3000)
  }

  function dismissPinned() {
    isPinnedVisible.value = false
    if (status.value !== 'pending' && terminalTimer) {
      clearTimeout(terminalTimer)
      terminalTimer = null
    }
    localStorage.removeItem(SOURCE_TASK_KEY)
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

  function startStructuredReader(
    id: string,
    title: string,
    reimport = true,
    history: ReaderBuildTimingSample[] = [],
  ) {
    return useAcademicJobQueueStore().enqueue({
      sourceId: id,
      title,
      kind: 'structured',
      run: ({ promotedFromQueue }) => runStructuredReader(
        id,
        title,
        reimport,
        history,
        promotedFromQueue,
      ),
    })
  }

  function openDialog() {
    if (status.value === 'pending') {
      isDialogVisible.value = true
      isPinnedVisible.value = false
    }
  }

  async function cancelCurrentTask() {
    const id = contributionId.value
    if (!id || status.value !== 'pending' || isCancelling.value) return
    isCancelling.value = true
    try {
      // Mark cancellation locally before waiting for the durable rollback.
      // Otherwise the aborted long-running request can race this endpoint and
      // overwrite the UI with a generic 500/failure state.
      activeRequestController?.abort()
      // The submission pipeline can enter the same Docling fallback as the
      // dedicated PDF pipeline. The endpoint is therefore called for every
      // source task; a 409 simply means no server-side PDF process is active.
      if (currentTargetType.value === 'approved_source') {
        await cancelUploadedPdfImportForApprovedSource(id).catch(() => undefined)
      } else {
        await cancelUploadedPdfImportForContribution(id).catch(() => undefined)
      }
      status.value = 'cancelled'
      stepText.value = 'Đã hủy tác vụ.'
      stageDetail.value = 'Phần kết quả chưa hoàn tất không được lưu.'
      isDialogVisible.value = false
      isPinnedVisible.value = true
      finishTimers()
      scheduleTerminalDismiss()
    } finally {
      isCancelling.value = false
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
    persistedExpiresAt = null
    localStorage.removeItem(SOURCE_TASK_KEY)
    pipelineKind.value = 'none'
    expectedTotalSeconds.value = null
    timingDeltaSeconds.value = null
    ocrExpected.value = false
    pdfStage.value = null
    smartReaderResult.value = 'limited'
    pdfResult.value = 'none'
    currentTargetType.value = 'contribution'
    activeRequestController = null
    isCancelling.value = false
  }

  watch(
    [contributionId, progress, status, stepText, isPinnedVisible],
    () => persistTask(),
  )

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
    expectedTotalSeconds,
    timingDeltaSeconds,
    ocrExpected,
    pdfStage,
    pipelineKind,
    smartReaderResult,
    pdfResult,
    selectedSource,
    detectedIdentifiers,
    isCancelling,
    startPipeline,
    startPdfOnlyPipeline,
    startStructuredReader,
    minimizeDialog,
    openDialog,
    stopTracking,
    dismissPinned,
    restoreTracking,
    cancelCurrentTask,
  }
})
