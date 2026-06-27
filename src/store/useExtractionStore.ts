import { defineStore } from 'pinia'
import { ref } from 'vue'
import { extractRuleCandidates, getAnalyzeProgress } from '@/api/ruleCandidateApi'

export const useExtractionStore = defineStore('extraction', () => {
  const sourceId = ref<string | null>(null)
  const sourceTitle = ref<string>('')
  const isDialogVisible = ref(false)
  const isPinnedVisible = ref(false)
  const progress = ref(0)
  const status = ref<'pending' | 'success' | 'stopped' | 'failed' | 'none'>('none')
  const outcome = ref<string | null>(null)
  const createdCount = ref(0)
  const errorMessage = ref('')
  const hasApproved = ref(false)
  const stepText = ref('Đang khởi tạo...')
  const reasonCode = ref<string | null>(null)
  const message = ref<string>('')

  let pollingInterval: ReturnType<typeof setInterval> | null = null

  function startExtraction(id: string, title: string) {
    stopTracking()

    sourceId.value = id
    sourceTitle.value = title
    isDialogVisible.value = true
    isPinnedVisible.value = false
    progress.value = 0
    status.value = 'pending'
    outcome.value = null
    createdCount.value = 0
    errorMessage.value = ''
    hasApproved.value = false
    reasonCode.value = null
    message.value = ''
    stepText.value = 'Đang khởi tạo tài liệu…'

    // Start polling progress
    startRealProgressPolling(id)

    // Trigger API call
    extractRuleCandidates(id)
      .then((res: any) => {
        clearPolling()
        if (res.success) {
          const created = typeof res.createdCount === 'number' ? res.createdCount : res.data?.createdCount || 0
          const reason = res.reasonCode || res.data?.reasonCode || null
          const msg = res.message || res.data?.message || ''
          const out = res.outcome || null

          if (out && out.startsWith('stopped_')) {
            handleStopped(out, reason, msg)
          } else {
            const hasApprovedVal = res.data?.alreadyApproved || res.data?.alreadyExists || false
            handleSuccess(created, out || 'success_with_new_candidates', hasApprovedVal, reason, msg)
          }
        } else {
          handleFailure(res.message || 'Phân tích tài liệu học thuật thất bại.', res.outcome || 'failed_system_error')
        }
      })
      .catch((err: any) => {
        clearPolling()
        const backendData = err.response?.data
        const rawMsg = backendData?.error || backendData?.message || err.message || 'Lỗi khi phân tích tài liệu học thuật.'
        const out = backendData?.outcome || 'failed_system_error'
        handleFailure(rawMsg, out)
      })
  }

  function startRealProgressPolling(id: string) {
    clearPolling()
    pollingInterval = setInterval(async () => {
      try {
        const res = await getAnalyzeProgress(id)
        if (res.success && res.data) {
          const run = res.data
          // If the run finished (success or failed), let the main promise handle it,
          // but if the run is completed we can stop polling and set progress.
          if (run.status === 'success') {
            progress.value = 100
            stepText.value = 'Hoàn tất phân tích!'
            clearPolling()
            return
          } else if (run.status === 'failed') {
            progress.value = 0
            stepText.value = 'Phân tích thất bại.'
            clearPolling()
            return
          }

          const stage = run.currentStage || 'initializing'
          if (stage === 'initializing') {
            progress.value = 10
            stepText.value = 'Đang khởi tạo tài liệu…'
          } else if (stage === 'domain_check') {
            progress.value = 25
            stepText.value = 'Đang kiểm tra phạm vi nghiên cứu…'
          } else if (stage === 'extracting_candidates') {
            const processed = run.processedSectionGroups || 0
            const total = run.sectionGroupCount || 0
            const ratio = total > 0 ? (processed / total) : 0
            progress.value = 30 + Math.round(ratio * 60)
            stepText.value = `Đang phân tích các phân đoạn học thuật… (${processed}/${total})`
          } else if (stage === 'saving_candidates') {
            progress.value = 95
            stepText.value = 'Đang đối chiếu bằng chứng và lưu quy luật…'
          }
        }
      } catch (err) {
        console.error('Failed to poll extraction progress:', err)
      }
    }, 2000)
  }

  function handleSuccess(count: number, outcomeVal: string, hasApprovedVal: boolean, reason?: string | null, msgText?: string) {
    clearPolling()
    progress.value = 100
    status.value = 'success'
    outcome.value = outcomeVal
    createdCount.value = count
    hasApproved.value = hasApprovedVal
    reasonCode.value = reason || null
    message.value = msgText || 'Hoàn tất phân tích!'
    stepText.value = count > 0 ? 'Hoàn tất phân tích!' : 'Đã có luật tương tự'
    isDialogVisible.value = false
    isPinnedVisible.value = true
  }

  function handleStopped(outcomeVal: string, reason?: string | null, msgText?: string) {
    clearPolling()
    status.value = 'stopped'
    outcome.value = outcomeVal
    reasonCode.value = reason || null
    message.value = msgText || 'Phân tích dừng lại.'

    if (outcomeVal === 'stopped_domain_irrelevant') {
      progress.value = 40
      stepText.value = 'Tài liệu không phù hợp để tạo luật giấc mơ'
    } else if (outcomeVal === 'stopped_no_eligible_chunks') {
      progress.value = 60
      stepText.value = 'Chưa có dữ liệu học thuật hợp lệ'
    } else if (outcomeVal === 'stopped_llm_returned_zero') {
      progress.value = 80
      stepText.value = 'Chưa rút ra được luật rõ ràng'
    } else if (outcomeVal === 'stopped_all_weak_evidence') {
      progress.value = 90
      stepText.value = 'Bằng chứng chưa đủ mạnh'
    } else if (outcomeVal === 'stopped_all_duplicate') {
      progress.value = 90
      stepText.value = 'Không có luật mới'
    } else {
      progress.value = 40
      stepText.value = 'Phân tích dừng lại.'
    }

    isDialogVisible.value = false
    isPinnedVisible.value = true
  }

  function handleFailure(msg: string, outcomeVal: string = 'failed_system_error') {
    clearPolling()
    progress.value = 0
    status.value = 'failed'
    outcome.value = outcomeVal
    errorMessage.value = msg
    stepText.value = 'Phân tích thất bại.'
    isDialogVisible.value = false
    isPinnedVisible.value = true
  }

  function clearPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
  }

  function stopTracking() {
    clearPolling()
    sourceId.value = null
    sourceTitle.value = ''
    isDialogVisible.value = false
    isPinnedVisible.value = false
    progress.value = 0
    status.value = 'none'
    outcome.value = null
    createdCount.value = 0
    errorMessage.value = ''
    hasApproved.value = false
    reasonCode.value = null
    message.value = ''
    stepText.value = ''
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
    errorMessage,
    hasApproved,
    stepText,
    reasonCode,
    message,
    startExtraction,
    stopTracking,
    minimizeDialog,
    openDialog
  }
})
