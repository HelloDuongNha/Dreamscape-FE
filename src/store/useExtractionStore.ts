import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cancelRuleV3Extraction, getRuleV3ExtractionProgress, startRuleV3Extraction } from '@/api/ruleCandidateApi'
import { estimateRuleDurationSeconds } from '@/features/library/services/ruleExtractionTiming.service'
import { useAcademicJobQueueStore } from './useAcademicJobQueueStore'

const EXTRACTION_TASK_KEY = 'dreamscape:pinned-task:rule-extraction:v1'

export const useExtractionStore = defineStore('extraction', () => {
  const sourceId = ref<string | null>(null)
  const sourceTitle = ref<string>('')
  const isDialogVisible = ref(false)
  const isPinnedVisible = ref(false)
  const progress = ref(0)
  const status = ref<'pending' | 'success' | 'stopped' | 'failed' | 'none'>('none')
  const outcome = ref<string | null>(null)
  const createdCount = ref(0)
  const mergedCount = ref(0)
  const rejectedCount = ref(0)
  const verifiedCount = ref(0)
  const errorMessage = ref('')
  const stepText = ref('Đang khởi tạo...')
  const reasonCode = ref<string | null>(null)
  const message = ref<string>('')
  const stageDetail = ref('Đang đọc cấu trúc tài liệu và chuẩn bị phạm vi bằng chứng.')
  const elapsedSeconds = ref(0)
  const estimatedRemainingSeconds = ref<number | null>(null)
  const processedLabel = ref('')
  const currentStage = ref<'initializing' | 'extracting_candidates' | 'saving_candidates' | 'merging_candidates' | 'completed'>('initializing')
  const totalBatches = ref(0)
  const processedBatches = ref(0)
  const rawCandidateCount = ref(0)
  const verifiedCandidateCount = ref(0)
  const timingDeltaSeconds = ref<number | null>(null)
  const currentRunId = ref<string | null>(null)
  const isCancelling = ref(false)

  let clockInterval: ReturnType<typeof setInterval> | null = null
  let terminalTimer: ReturnType<typeof setTimeout> | null = null
  let localStartedAt = 0
  let etaAnchorAt = 0
  let etaAnchorSeconds: number | null = null
  let etaExpectedTotalSeconds: number | null = null
  let plannedSecondsPerBatch = 12

  function startClock(startedAt = Date.now()) {
    if (clockInterval) clearInterval(clockInterval)
    localStartedAt = startedAt
    elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - localStartedAt) / 1000))
    clockInterval = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - localStartedAt) / 1000)
      if (etaAnchorSeconds !== null) {
        estimatedRemainingSeconds.value = Math.ceil(etaAnchorSeconds - (Date.now() - etaAnchorAt) / 1000)
      }
    }, 1000)
  }

  function persistTask(expiresAt?: number) {
    if (!sourceId.value || !currentRunId.value) {
      localStorage.removeItem(EXTRACTION_TASK_KEY)
      return
    }
    localStorage.setItem(EXTRACTION_TASK_KEY, JSON.stringify({
      sourceId: sourceId.value,
      sourceTitle: sourceTitle.value,
      runId: currentRunId.value,
      startedAt: localStartedAt,
      progress: progress.value,
      status: status.value,
      stepText: stepText.value,
      expiresAt: expiresAt || null,
    }))
  }

  async function restoreTracking() {
    try {
      const saved = JSON.parse(localStorage.getItem(EXTRACTION_TASK_KEY) || 'null')
      if (!saved?.sourceId || !saved?.runId) return
      if (saved.expiresAt && saved.expiresAt <= Date.now()) {
        localStorage.removeItem(EXTRACTION_TASK_KEY)
        return
      }
      sourceId.value = saved.sourceId
      sourceTitle.value = saved.sourceTitle || ''
      currentRunId.value = saved.runId
      progress.value = Number(saved.progress) || 0
      status.value = saved.status || 'pending'
      stepText.value = saved.stepText || 'Đang khôi phục trạng thái…'
      isDialogVisible.value = false
      isPinnedVisible.value = true
      if (status.value === 'pending') {
        startClock(Number(saved.startedAt) || Date.now())
        await pollRuleV3Run(saved.runId, false)
      } else if (saved.expiresAt) {
        scheduleTerminalDismiss(saved.expiresAt - Date.now())
      }
    } catch {
      // Keep page startup independent from optional notification restoration.
    }
  }

  function stopClock() {
    if (clockInterval) clearInterval(clockInterval)
    clockInterval = null
  }

  function setEtaAnchor(seconds: number | null) {
    etaAnchorSeconds = seconds
    etaAnchorAt = Date.now()
    estimatedRemainingSeconds.value = seconds === null ? null : Math.ceil(seconds)
    etaExpectedTotalSeconds = seconds === null ? null : elapsedSeconds.value + seconds
  }

  async function runExtraction(id: string, title: string, promotedFromQueue = false, replaceExisting = false, secondsPerBatch = 12) {
    stopTracking()

    sourceId.value = id
    sourceTitle.value = title
    isDialogVisible.value = !promotedFromQueue
    isPinnedVisible.value = promotedFromQueue
    progress.value = 0
    status.value = 'pending'
    outcome.value = null
    createdCount.value = 0
    mergedCount.value = 0
    rejectedCount.value = 0
    verifiedCount.value = 0
    errorMessage.value = ''
    reasonCode.value = null
    message.value = ''
    stepText.value = 'Đang khởi tạo tài liệu…'
    stageDetail.value = 'Đang đọc cấu trúc section, ngôn ngữ và loại hình nghiên cứu.'
    estimatedRemainingSeconds.value = null
    etaAnchorSeconds = null
    etaExpectedTotalSeconds = null
    plannedSecondsPerBatch = Number.isFinite(secondsPerBatch) && secondsPerBatch > 0 ? secondsPerBatch : 12
    processedLabel.value = ''
    currentStage.value = 'initializing'
    totalBatches.value = 0
    processedBatches.value = 0
    rawCandidateCount.value = 0
    verifiedCandidateCount.value = 0
    timingDeltaSeconds.value = null
    startClock()

    try {
      const started = await startRuleV3Extraction(id, replaceExisting)
      currentRunId.value = started.data.runId
      persistTask()
      if (started.data.status === 'success') {
        const existing = await getRuleV3ExtractionProgress(started.data.runId)
        completeFromRun(existing.data, true, replaceExisting)
        return
      }
      await pollRuleV3Run(started.data.runId, replaceExisting)
    } catch (err: any) {
      const backendData = err.response?.data
      handleFailure(
        backendData?.message || err.message || 'Lỗi khi phân tích Rule V3.',
        backendData?.errorCode || 'failed_system_error'
      )
    }
  }

  function startExtraction(id: string, title: string, replaceExisting = false, secondsPerBatch = 12) {
    return useAcademicJobQueueStore().enqueue({
      sourceId: id,
      title,
      kind: 'rules',
      run: ({ promotedFromQueue }) => runExtraction(id, title, promotedFromQueue, replaceExisting, secondsPerBatch),
    })
  }

  async function pollRuleV3Run(runId: string, replaceExisting: boolean) {
    while (true) {
      await new Promise(resolve => window.setTimeout(resolve, 1500))
      if (status.value !== 'pending') return
      const response = await getRuleV3ExtractionProgress(runId)
      const run = response.data
      const total = Math.max(0, run.totalBatches || 0)
      const processed = Math.max(0, run.processedBatches || 0)
      currentStage.value = run.currentStage === 'merging_candidates' ? 'merging_candidates'
        : run.currentStage === 'saving_candidates' ? 'saving_candidates'
        : run.currentStage === 'extracting_candidates' ? 'extracting_candidates' : 'initializing'
      totalBatches.value = total
      processedBatches.value = processed
      rawCandidateCount.value = Math.max(0, run.rawCandidateCount || 0)
      verifiedCandidateCount.value = Math.max(0, run.verifiedCandidateCount || 0)
      persistTask()

      if (run.currentStage === 'initializing') {
        progress.value = 5
        stepText.value = 'Đang lập kế hoạch phân tích Rule V3…'
        stageDetail.value = 'Đang xác định loại tài liệu, section mục tiêu và các lô bằng chứng.'
      } else if (run.currentStage === 'extracting_candidates') {
        const ratio = total > 0 ? processed / total : 0
        progress.value = 10 + Math.round(ratio * 80)
        stepText.value = `Đang trích xuất và kiểm tra trích dẫn… (${processed}/${total})`
        processedLabel.value = total > 0 ? `${processed}/${total} lô bằng chứng` : ''
        stageDetail.value = `Đã nhận ${run.rawCandidateCount} kết luận thô; giữ ${run.verifiedCandidateCount} lập luận có dẫn chứng hợp lệ.`
        // Freeze one honest schedule for the entire run. A completed run for
        // this exact source becomes the next run's baseline; first runs use a
        // conservative per-batch estimate. Progress observations never make
        // the countdown jump around.
        if (etaAnchorSeconds === null && total > 0) {
          setEtaAnchor(Math.max(
            1,
            estimateRuleDurationSeconds(total, plannedSecondsPerBatch) - elapsedSeconds.value,
          ))
        }
      } else if (run.currentStage === 'saving_candidates') {
        progress.value = 94
        stepText.value = 'Đang lưu lập luận và bằng chứng…'
        stageDetail.value = replaceExisting
          ? 'Bộ kết quả cũ chỉ được thay khi toàn bộ lập luận đã kiểm chứng lưu thành công.'
          : 'Lập luận không đáp ứng hợp đồng lưu trữ sẽ bị loại và ghi rõ lý do.'
        if (etaAnchorSeconds === null) {
          setEtaAnchor(Math.max(1, 8 - elapsedSeconds.value))
        }
      } else if (run.currentStage === 'merging_candidates') {
        progress.value = 98
        stepText.value = 'Đang tự động gộp các lập luận tương thích…'
        stageDetail.value = 'Mỗi mệnh đề và liên kết dẫn chứng được giữ nguyên trong lập luận tổng hợp.'
      }

      if (run.status === 'success') {
        completeFromRun(run, false, replaceExisting)
        return
      }
      if (run.status === 'failed') {
        const code = run.sanitizedErrorCode || 'failed_system_error'
        const safeFailureMessages: Record<string, string> = {
          all_verified_candidates_rejected: 'Các lập luận có dẫn chứng hợp lệ nhưng không lập luận nào vượt qua hợp đồng lưu trữ. Hệ thống không ghi dữ liệu rỗng.',
          replacement_persistence_incomplete: 'Bộ lập luận thay thế lưu không đầy đủ. Hệ thống đã khôi phục nguyên trạng các lập luận trước lần chạy này.',
          provider_unavailable: 'Mô hình trích xuất hiện không khả dụng.',
          provider_timeout: 'Mô hình trích xuất phản hồi quá thời gian cho phép.',
          provider_schema_invalid: 'Mô hình trả về dữ liệu không đúng cấu trúc Rule V3.',
          input_too_large: 'Lô văn bản vượt quá giới hạn xử lý an toàn.'
        }
        handleFailure(safeFailureMessages[code] || 'Phân tích Rule V3 thất bại.', code)
        return
      }
      if (run.status === 'cancelled') {
        handleCancelled()
        return
      }
    }
  }

  function handleCancelled() {
    status.value = 'stopped'
    outcome.value = 'user_cancelled'
    stepText.value = 'Đã hủy phân tích.'
    stageDetail.value = 'Không có lập luận chưa hoàn tất nào được lưu.'
    isDialogVisible.value = false
    isPinnedVisible.value = true
    stopClock()
    scheduleTerminalDismiss()
    persistTask(Date.now() + 3000)
  }

  async function cancelExtraction() {
    if (!currentRunId.value || status.value !== 'pending' || isCancelling.value) return
    isCancelling.value = true
    try {
      await cancelRuleV3Extraction(currentRunId.value)
      handleCancelled()
    } finally {
      isCancelling.value = false
    }
  }

  function completeFromRun(run: {
    savedCandidateCount: number
    mergedCandidateCount: number
    rejectedCandidateCount: number
    verifiedCandidateCount: number
    resultRuleIds: string[]
    rejectionDiagnostics?: Array<{ reasonCode: string; safeMessage: string }>
  }, reused: boolean, replacementRequested: boolean) {
    const saved = Math.max(0, run.savedCandidateCount || 0)
    const merged = Math.max(0, run.mergedCandidateCount || 0)
    const rejected = Math.max(0, run.rejectedCandidateCount || 0)
    const verified = Math.max(0, run.verifiedCandidateCount || 0)
    const resultCount = run.resultRuleIds?.length || 0
    mergedCount.value = merged
    rejectedCount.value = rejected
    verifiedCount.value = verified

    if (saved > 0) {
      handleSuccess(saved, 'success_with_new_candidates', `Đã tạo ${saved} lập luận mới${merged > 0 ? ` và bổ sung bằng chứng vào ${merged} lập luận tương tự` : ''}.`)
    } else if (resultCount > 0 || merged > 0) {
      handleSuccess(0, 'success_with_existing_candidates', reused
        ? `Kết quả đã có sẵn: ${resultCount} lập luận từ đúng bản đọc và cấu hình mô hình này.`
        : `Không tạo bản trùng; đã bổ sung bằng chứng vào ${Math.max(merged, resultCount)} lập luận hiện có.`)
    } else if (verified === 0) {
      const reasonCounts = new Map<string, { message: string; count: number }>()
      for (const item of run.rejectionDiagnostics || []) {
        const current = reasonCounts.get(item.reasonCode)
        reasonCounts.set(item.reasonCode, { message: item.safeMessage, count: (current?.count || 0) + 1 })
      }
      const reasonSummary = [...reasonCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(item => `${item.count}× ${item.message}`)
        .join(' ')
      handleSuccess(
        0,
        'success_no_verified_candidates',
        `Không có lập luận nào vượt qua kiểm chứng dẫn chứng. Đã loại ${rejected} đề xuất.${reasonSummary ? ` Lý do chính: ${reasonSummary}` : ''}${replacementRequested ? ' Kết quả Rule V3 cũ được giữ nguyên.' : ''}`
      )
    } else {
      handleFailure('Có lập luận đã kiểm chứng nhưng không lập luận nào lưu được.', 'all_verified_candidates_rejected')
    }
  }

  function handleSuccess(count: number, outcomeVal: string, msgText: string) {
    progress.value = 100
    status.value = 'success'
    outcome.value = outcomeVal
    createdCount.value = count
    message.value = msgText
    stepText.value = outcomeVal === 'success_no_verified_candidates'
      ? 'Không có lập luận đạt kiểm chứng'
      : 'Hoàn tất phân tích!'
    currentStage.value = 'completed'
    timingDeltaSeconds.value = etaExpectedTotalSeconds === null
      ? null
      : Math.round(elapsedSeconds.value - etaExpectedTotalSeconds)
    isDialogVisible.value = false
    isPinnedVisible.value = true
    stopClock()
    scheduleTerminalDismiss()
    persistTask(Date.now() + 3000)
  }

  function handleFailure(msg: string, outcomeVal: string = 'failed_system_error') {
    progress.value = 0
    status.value = 'failed'
    outcome.value = outcomeVal
    errorMessage.value = msg
    stepText.value = 'Phân tích thất bại.'
    isDialogVisible.value = false
    isPinnedVisible.value = true
    stopClock()
    scheduleTerminalDismiss()
    persistTask(Date.now() + 3000)
  }

  function scheduleTerminalDismiss(delayMs = 3000) {
    if (terminalTimer) clearTimeout(terminalTimer)
    terminalTimer = setTimeout(() => {
      isPinnedVisible.value = false
      localStorage.removeItem(EXTRACTION_TASK_KEY)
      terminalTimer = null
    }, Math.max(0, delayMs))
  }

  function dismissPinned() {
    isPinnedVisible.value = false
    if (status.value !== 'pending' && terminalTimer) {
      clearTimeout(terminalTimer)
      terminalTimer = null
    }
    localStorage.removeItem(EXTRACTION_TASK_KEY)
  }

  function stopTracking() {
    stopClock()
    if (terminalTimer) clearTimeout(terminalTimer)
    terminalTimer = null
    sourceId.value = null
    sourceTitle.value = ''
    isDialogVisible.value = false
    isPinnedVisible.value = false
    progress.value = 0
    status.value = 'none'
    outcome.value = null
    createdCount.value = 0
    mergedCount.value = 0
    rejectedCount.value = 0
    verifiedCount.value = 0
    errorMessage.value = ''
    reasonCode.value = null
    message.value = ''
    stepText.value = ''
    stageDetail.value = ''
    elapsedSeconds.value = 0
    estimatedRemainingSeconds.value = null
    etaAnchorSeconds = null
    etaExpectedTotalSeconds = null
    processedLabel.value = ''
    currentStage.value = 'initializing'
    totalBatches.value = 0
    processedBatches.value = 0
    rawCandidateCount.value = 0
    verifiedCandidateCount.value = 0
    timingDeltaSeconds.value = null
    currentRunId.value = null
    isCancelling.value = false
    localStorage.removeItem(EXTRACTION_TASK_KEY)
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

  return {
    sourceId,
    sourceTitle,
    isDialogVisible,
    isPinnedVisible,
    progress,
    status,
    outcome,
    createdCount,
    mergedCount,
    rejectedCount,
    verifiedCount,
    errorMessage,
    stepText,
    reasonCode,
    message,
    stageDetail,
    elapsedSeconds,
    estimatedRemainingSeconds,
    processedLabel,
    currentStage,
    totalBatches,
    processedBatches,
    rawCandidateCount,
    verifiedCandidateCount,
    timingDeltaSeconds,
    isCancelling,
    startExtraction,
    stopTracking,
    dismissPinned,
    minimizeDialog,
    openDialog,
    restoreTracking,
    cancelExtraction,
  }
})
