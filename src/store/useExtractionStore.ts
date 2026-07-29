import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cancelRuleV3Extraction, getRuleV3ExtractionProgress, startRuleV3Extraction } from '@/api/ruleCandidateApi'
import type { RuleV3ExtractionRun } from '@/api/ruleCandidateApi'
import { estimateRuleDurationSeconds } from '@/features/library/services/ruleExtractionTiming.service'
import { useAcademicJobQueueStore } from './useAcademicJobQueueStore'

const EXTRACTION_TASK_KEY = 'dreamscape:pinned-task:rule-extraction:v1'
const DEFAULT_SECONDS_PER_BATCH = 12

type ExtractionStatus = 'pending' | 'success' | 'stopped' | 'failed' | 'none'
type ExtractionStage =
  | 'queued'
  | 'initializing'
  | 'extracting_candidates'
  | 'saving_candidates'
  | 'merging_candidates'
  | 'completed'

interface StartedExtraction {
  runId: string
  status: 'pending' | 'success'
}

interface ApprovalTrackingResponse {
  data?: {
    academicSource?: {
      _id?: string
      title?: string
    }
    ruleExtraction?: StartedExtraction | {
      status: 'failed'
      errorCode?: string
    }
  }
}

function readApiErrorCode(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback
  const response = 'response' in error ? error.response : undefined
  if (!response || typeof response !== 'object' || !('data' in response)) return fallback
  const data = response.data
  if (!data || typeof data !== 'object' || !('errorCode' in data)) return fallback
  return typeof data.errorCode === 'string' && data.errorCode ? data.errorCode : fallback
}

function hasHttpStatus(error: unknown, expectedStatus: number): boolean {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = error.response
  return Boolean(response && typeof response === 'object' && 'status' in response
    && response.status === expectedStatus)
}

function normalizeExtractionStage(stage: RuleV3ExtractionRun['currentStage']): ExtractionStage {
  if (stage === 'queued') return 'queued'
  if (stage === 'extracting_candidates') return 'extracting_candidates'
  if (stage === 'saving_candidates') return 'saving_candidates'
  if (stage === 'merging_candidates') return 'merging_candidates'
  if (stage === 'completed') return 'completed'
  return 'initializing'
}

export const useExtractionStore = defineStore('extraction', () => {
  const sourceId = ref<string | null>(null)
  const sourceTitle = ref<string>('')
  const isDialogVisible = ref(false)
  const isPinnedVisible = ref(false)
  const progress = ref(0)
  const status = ref<ExtractionStatus>('none')
  const outcome = ref<string | null>(null)
  const createdCount = ref(0)
  const mergedCount = ref(0)
  const rejectedCount = ref(0)
  const verifiedCount = ref(0)
  const elapsedSeconds = ref(0)
  const estimatedRemainingSeconds = ref<number | null>(null)
  const currentStage = ref<ExtractionStage>('initializing')
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
  let plannedSecondsPerBatch = DEFAULT_SECONDS_PER_BATCH

  function beginTracking(
    id: string,
    title: string,
    showDialog: boolean,
    secondsPerBatch = DEFAULT_SECONDS_PER_BATCH,
  ) {
    stopTracking()
    sourceId.value = id
    sourceTitle.value = title
    isDialogVisible.value = showDialog
    isPinnedVisible.value = !showDialog
    progress.value = 0
    status.value = 'pending'
    outcome.value = null
    createdCount.value = 0
    mergedCount.value = 0
    rejectedCount.value = 0
    verifiedCount.value = 0
    estimatedRemainingSeconds.value = null
    etaAnchorSeconds = null
    etaExpectedTotalSeconds = null
    plannedSecondsPerBatch = Number.isFinite(secondsPerBatch) && secondsPerBatch > 0
      ? secondsPerBatch
      : DEFAULT_SECONDS_PER_BATCH
    currentStage.value = 'initializing'
    totalBatches.value = 0
    processedBatches.value = 0
    rawCandidateCount.value = 0
    verifiedCandidateCount.value = 0
    timingDeltaSeconds.value = null
    startClock()
  }

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
      isDialogVisible.value = false
      isPinnedVisible.value = true
      if (status.value === 'pending') {
        startClock(Number(saved.startedAt) || Date.now())
        await pollRuleV3Run(saved.runId)
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

  async function runExtraction(
    id: string,
    title: string,
    promotedFromQueue = false,
    replaceExisting = false,
    secondsPerBatch = DEFAULT_SECONDS_PER_BATCH,
  ) {
    beginTracking(id, title, !promotedFromQueue, secondsPerBatch)

    try {
      const started = await startRuleV3Extraction(id, replaceExisting)
      currentRunId.value = started.data.runId
      persistTask()
      if (started.data.status === 'success') {
        const existing = await getRuleV3ExtractionProgress(started.data.runId)
        completeFromRun(existing.data, true)
        return
      }
      await pollRuleV3Run(started.data.runId)
    } catch (error: unknown) {
      handleFailure(readApiErrorCode(error, 'failed_system_error'))
    }
  }

  function startExtraction(
    id: string,
    title: string,
    replaceExisting = false,
    secondsPerBatch = DEFAULT_SECONDS_PER_BATCH,
  ) {
    return useAcademicJobQueueStore().enqueue({
      sourceId: id,
      title,
      kind: 'rules',
      run: ({ promotedFromQueue }) => runExtraction(id, title, promotedFromQueue, replaceExisting, secondsPerBatch),
    })
  }

  function trackAutomaticExtraction(
    id: string,
    title: string,
    started: StartedExtraction,
  ) {
    return useAcademicJobQueueStore().enqueue({
      sourceId: id,
      title,
      kind: 'rules',
      run: async () => {
        beginTracking(id, title, false)
        try {
          await observeAutomaticRun(id, started)
        } catch (error: unknown) {
          handleFailure(readApiErrorCode(error, 'failed_system_error'))
          throw error
        }
      },
    })
  }

  async function observeAutomaticRun(
    id: string,
    started: StartedExtraction,
  ): Promise<void> {
    try {
      await observeStartedRun(started)
    } catch (error: unknown) {
      if (!hasHttpStatus(error, 404)) throw error
      const restarted = await startRuleV3Extraction(id, false)
      await observeStartedRun(restarted.data)
    }
  }

  async function observeStartedRun(started: StartedExtraction): Promise<void> {
    currentRunId.value = started.runId
    persistTask()
    if (started.status === 'success') {
      const existing = await getRuleV3ExtractionProgress(started.runId)
      completeFromRun(existing.data, true)
      return
    }
    await pollRuleV3Run(started.runId)
  }

  function trackApprovalResult(
    response: ApprovalTrackingResponse,
    fallbackTitle: string,
  ): boolean {
    const approvedSource = response?.data?.academicSource
    const automaticRun = response?.data?.ruleExtraction
    if (!approvedSource?._id || !automaticRun) return false
    const title = approvedSource.title || fallbackTitle
    const task = automaticRun.status === 'failed'
      ? trackAutomaticFailure(approvedSource._id, title, automaticRun.errorCode)
      : trackAutomaticExtraction(approvedSource._id, title, automaticRun)
    void task.catch(() => undefined)
    return true
  }

  function trackAutomaticFailure(id: string, title: string, errorCode?: string) {
    return useAcademicJobQueueStore().enqueue({
      sourceId: id,
      title,
      kind: 'rules',
      run: async () => {
        beginTracking(id, title, false)
        handleFailure(errorCode || 'automatic_start_failed')
        throw new Error(errorCode || 'automatic_start_failed')
      },
    })
  }

  async function pollRuleV3Run(runId: string) {
    while (true) {
      await new Promise(resolve => window.setTimeout(resolve, 1500))
      if (status.value !== 'pending') return
      const { data: run } = await getRuleV3ExtractionProgress(runId)
      syncRunProgress(run)
      applyStageProgress(run)
      persistTask()
      if (handleTerminalRun(run)) return
    }
  }

  function syncRunProgress(run: RuleV3ExtractionRun) {
    currentStage.value = normalizeExtractionStage(run.currentStage)
    totalBatches.value = Math.max(0, run.totalBatches || 0)
    processedBatches.value = Math.max(0, run.processedBatches || 0)
    rawCandidateCount.value = Math.max(0, run.rawCandidateCount || 0)
    verifiedCandidateCount.value = Math.max(0, run.verifiedCandidateCount || 0)
  }

  function applyStageProgress(run: RuleV3ExtractionRun) {
    if (run.currentStage === 'queued') {
      applyQueuedProgress(run)
      return
    }
    if (run.currentStage === 'initializing') {
      applyInitializingProgress()
      return
    }
    if (run.currentStage === 'extracting_candidates') {
      applyExtractionProgress()
      return
    }
    if (run.currentStage === 'saving_candidates') {
      applySavingProgress()
      return
    }
    if (run.currentStage === 'merging_candidates') {
      progress.value = 98
    }
  }

  function applyQueuedProgress(run: RuleV3ExtractionRun) {
    const position = Math.max(1, Number(run.queuePosition) || 1)
    progress.value = 0
    if (etaAnchorSeconds !== null || totalBatches.value <= 0) return
    setEtaAnchor(
      estimateRuleDurationSeconds(totalBatches.value, plannedSecondsPerBatch) * (position + 1),
    )
  }

  function applyInitializingProgress() {
    progress.value = 5
    if (etaAnchorSeconds !== null || totalBatches.value <= 0) return
    setEtaAnchor(estimateRuleDurationSeconds(totalBatches.value, plannedSecondsPerBatch))
  }

  function applyExtractionProgress() {
    const ratio = totalBatches.value > 0
      ? processedBatches.value / totalBatches.value
      : 0
    progress.value = 10 + Math.round(ratio * 80)
    if (etaAnchorSeconds !== null || totalBatches.value <= 0) return
    setEtaAnchor(Math.max(
      1,
      estimateRuleDurationSeconds(totalBatches.value, plannedSecondsPerBatch) - elapsedSeconds.value,
    ))
  }

  function applySavingProgress() {
    progress.value = 94
    if (etaAnchorSeconds !== null) return
    setEtaAnchor(Math.max(1, 8 - elapsedSeconds.value))
  }

  function handleTerminalRun(run: RuleV3ExtractionRun): boolean {
    if (run.status === 'success') {
      completeFromRun(run, false)
      return true
    }
    if (run.status === 'failed') {
      handleFailure(run.sanitizedErrorCode || 'failed_system_error')
      return true
    }
    if (run.status === 'cancelled') {
      handleCancelled()
      return true
    }
    return false
  }

  function handleCancelled() {
    status.value = 'stopped'
    outcome.value = 'user_cancelled'
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

  function completeFromRun(run: RuleV3ExtractionRun, reused: boolean) {
    const saved = Math.max(0, run.savedCandidateCount || 0)
    const merged = Math.max(0, run.mergedCandidateCount || 0)
    const rejected = Math.max(0, run.rejectedCandidateCount || 0)
    const verified = Math.max(0, run.verifiedCandidateCount || 0)
    const resultCount = run.resultRuleIds?.length || 0
    mergedCount.value = merged
    rejectedCount.value = rejected
    verifiedCount.value = verified

    if (saved > 0) {
      handleSuccess(saved, 'success_with_new_candidates')
    } else if (resultCount > 0 || merged > 0) {
      handleSuccess(0, reused
        ? 'success_reused_candidates'
        : 'success_with_existing_candidates')
    } else if (verified === 0) {
      handleSuccess(
        0,
        'success_no_verified_candidates',
      )
    } else {
      handleFailure('all_verified_candidates_rejected')
    }
  }

  function handleSuccess(count: number, outcomeVal: string) {
    progress.value = 100
    status.value = 'success'
    outcome.value = outcomeVal
    createdCount.value = count
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

  function handleFailure(outcomeVal: string = 'failed_system_error') {
    progress.value = 0
    status.value = 'failed'
    outcome.value = outcomeVal
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
    elapsedSeconds.value = 0
    estimatedRemainingSeconds.value = null
    etaAnchorSeconds = null
    etaExpectedTotalSeconds = null
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
    elapsedSeconds,
    estimatedRemainingSeconds,
    currentStage,
    totalBatches,
    processedBatches,
    rawCandidateCount,
    verifiedCandidateCount,
    timingDeltaSeconds,
    isCancelling,
    startExtraction,
    trackAutomaticExtraction,
    trackApprovalResult,
    stopTracking,
    dismissPinned,
    minimizeDialog,
    openDialog,
    restoreTracking,
    cancelExtraction,
  }
})
