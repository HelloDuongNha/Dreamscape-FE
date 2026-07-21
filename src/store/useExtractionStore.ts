import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getRuleV3ExtractionProgress, startRuleV3Extraction } from '@/api/ruleCandidateApi'
import { useAcademicJobQueueStore } from './useAcademicJobQueueStore'

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

  let clockInterval: ReturnType<typeof setInterval> | null = null
  let terminalTimer: ReturnType<typeof setTimeout> | null = null
  let localStartedAt = 0
  let etaAnchorAt = 0
  let etaAnchorSeconds: number | null = null
  let lastProcessedBatches = 0
  let lastBatchObservationAt = 0
  let historicalSecondsPerBatch: number | null = null
  const batchDurationSamples: number[] = []

  function startClock() {
    if (clockInterval) clearInterval(clockInterval)
    localStartedAt = Date.now()
    elapsedSeconds.value = 0
    clockInterval = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - localStartedAt) / 1000)
      if (etaAnchorSeconds !== null) {
        estimatedRemainingSeconds.value = Math.ceil(etaAnchorSeconds - (Date.now() - etaAnchorAt) / 1000)
      }
    }, 1000)
  }

  function stopClock() {
    if (clockInterval) clearInterval(clockInterval)
    clockInterval = null
  }

  function setEtaAnchor(seconds: number | null) {
    etaAnchorSeconds = seconds
    etaAnchorAt = Date.now()
    estimatedRemainingSeconds.value = seconds === null ? null : Math.ceil(seconds)
  }

  function median(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  }

  async function runExtraction(id: string, title: string, promotedFromQueue = false, replaceExisting = false, baselineSecondsPerBatch: number | null = null) {
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
    lastProcessedBatches = 0
    lastBatchObservationAt = Date.now()
    historicalSecondsPerBatch = baselineSecondsPerBatch && baselineSecondsPerBatch > 0 ? baselineSecondsPerBatch : null
    batchDurationSamples.length = 0
    processedLabel.value = ''
    startClock()

    try {
      const started = await startRuleV3Extraction(id, replaceExisting)
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

  function startExtraction(id: string, title: string, replaceExisting = false, baselineSecondsPerBatch: number | null = null) {
    return useAcademicJobQueueStore().enqueue({
      sourceId: id,
      title,
      kind: 'rules',
      run: ({ promotedFromQueue }) => runExtraction(id, title, promotedFromQueue, replaceExisting, baselineSecondsPerBatch),
    })
  }

  async function pollRuleV3Run(runId: string, replaceExisting: boolean) {
    while (true) {
      await new Promise(resolve => window.setTimeout(resolve, 1500))
      const response = await getRuleV3ExtractionProgress(runId)
      const run = response.data
      const total = Math.max(0, run.totalBatches || 0)
      const processed = Math.max(0, run.processedBatches || 0)

      if (processed > lastProcessedBatches) {
        const now = Date.now()
        const completedSinceLastPoll = processed - lastProcessedBatches
        const observedSeconds = (now - lastBatchObservationAt) / 1000 / completedSinceLastPoll
        if (observedSeconds > 0) {
          batchDurationSamples.push(observedSeconds)
          if (batchDurationSamples.length > 7) batchDurationSamples.shift()
        }
        lastProcessedBatches = processed
        lastBatchObservationAt = now
      }

      if (run.currentStage === 'initializing') {
        progress.value = 5
        stepText.value = 'Đang lập kế hoạch phân tích Rule V3…'
        stageDetail.value = 'Đang xác định loại tài liệu, section mục tiêu và các lô bằng chứng.'
      } else if (run.currentStage === 'extracting_candidates') {
        const ratio = total > 0 ? processed / total : 0
        progress.value = 10 + Math.round(ratio * 80)
        stepText.value = `Đang trích xuất và kiểm tra trích dẫn… (${processed}/${total})`
        processedLabel.value = total > 0 ? `${processed}/${total} lô bằng chứng` : ''
        stageDetail.value = `Đã nhận ${run.rawCandidateCount} kết luận thô; giữ ${run.verifiedCandidateCount} quy luật có dẫn chứng hợp lệ.`
        const measured = batchDurationSamples.length ? median(batchDurationSamples) : null
        const secondsPerBatch = measured !== null && historicalSecondsPerBatch !== null
          ? measured * 0.7 + historicalSecondsPerBatch * 0.3
          : measured ?? historicalSecondsPerBatch
        if (secondsPerBatch !== null && total > processed) {
          setEtaAnchor(secondsPerBatch * (total - processed) + 8)
        } else if (total === processed && total > 0) {
          setEtaAnchor(8)
        } else {
          setEtaAnchor(null)
        }
      } else if (run.currentStage === 'saving_candidates') {
        progress.value = 95
        stepText.value = 'Đang gộp quy luật và lưu bằng chứng…'
        stageDetail.value = replaceExisting
          ? 'Bộ kết quả cũ chỉ được thay khi toàn bộ quy luật đã kiểm chứng lưu thành công.'
          : 'Quy luật không đáp ứng hợp đồng lưu trữ sẽ bị loại và ghi rõ lý do.'
        setEtaAnchor(8)
      }

      if (run.status === 'success') {
        completeFromRun(run, false, replaceExisting)
        return
      }
      if (run.status === 'failed') {
        const code = run.sanitizedErrorCode || 'failed_system_error'
        const safeFailureMessages: Record<string, string> = {
          all_verified_candidates_rejected: 'Các quy luật có dẫn chứng hợp lệ nhưng không quy luật nào vượt qua hợp đồng lưu trữ. Hệ thống không ghi dữ liệu rỗng.',
          replacement_persistence_incomplete: 'Bộ quy luật thay thế lưu không đầy đủ. Hệ thống đã khôi phục nguyên trạng các quy luật trước lần chạy này.',
          provider_unavailable: 'Mô hình trích xuất hiện không khả dụng.',
          provider_timeout: 'Mô hình trích xuất phản hồi quá thời gian cho phép.',
          provider_schema_invalid: 'Mô hình trả về dữ liệu không đúng cấu trúc Rule V3.',
          input_too_large: 'Lô văn bản vượt quá giới hạn xử lý an toàn.'
        }
        handleFailure(safeFailureMessages[code] || 'Phân tích Rule V3 thất bại.', code)
        return
      }
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
      handleSuccess(saved, 'success_with_new_candidates', `Đã tạo ${saved} quy luật mới${merged > 0 ? ` và bổ sung bằng chứng vào ${merged} quy luật tương tự` : ''}.`)
    } else if (resultCount > 0 || merged > 0) {
      handleSuccess(0, 'success_with_existing_candidates', reused
        ? `Kết quả đã có sẵn: ${resultCount} quy luật từ đúng bản đọc và cấu hình mô hình này.`
        : `Không tạo bản trùng; đã bổ sung bằng chứng vào ${Math.max(merged, resultCount)} quy luật hiện có.`)
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
        `Không có quy luật nào vượt qua kiểm chứng dẫn chứng. Đã loại ${rejected} đề xuất.${reasonSummary ? ` Lý do chính: ${reasonSummary}` : ''}${replacementRequested ? ' Kết quả Rule V3 cũ được giữ nguyên.' : ''}`
      )
    } else {
      handleFailure('Có quy luật đã kiểm chứng nhưng không quy luật nào lưu được.', 'all_verified_candidates_rejected')
    }
  }

  function handleSuccess(count: number, outcomeVal: string, msgText: string) {
    progress.value = 100
    status.value = 'success'
    outcome.value = outcomeVal
    createdCount.value = count
    message.value = msgText
    stepText.value = outcomeVal === 'success_no_verified_candidates'
      ? 'Không có quy luật đạt kiểm chứng'
      : 'Hoàn tất phân tích!'
    isDialogVisible.value = false
    isPinnedVisible.value = true
    stopClock()
    scheduleTerminalDismiss()
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
    processedLabel.value = ''
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
    startExtraction,
    stopTracking,
    dismissPinned,
    minimizeDialog,
    openDialog
  }
})
