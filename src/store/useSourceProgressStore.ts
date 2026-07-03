import { defineStore } from 'pinia'
import { ref } from 'vue'
import { importFullText, cacheModerationSourceOriginalPdf } from '@/api/moderationApi'

export const useSourceProgressStore = defineStore('sourceProgress', () => {
  const contributionId = ref<string | null>(null)
  const sourceTitle = ref<string>('')
  const isDialogVisible = ref(false)
  const isPinnedVisible = ref(false)
  const progress = ref(0)
  const status = ref<'pending' | 'success' | 'failed' | 'none'>('none')
  const stepText = ref('Đang khởi tạo...')
  
  const smartReaderResult = ref<'success' | 'failed' | 'limited'>('limited')
  const pdfResult = ref<'success' | 'failed' | 'blocked' | 'external_only' | 'no_candidate' | 'none'>('none')

  async function startPipeline(id: string, title: string) {
    contributionId.value = id
    sourceTitle.value = title
    isDialogVisible.value = true
    isPinnedVisible.value = false
    progress.value = 0
    status.value = 'pending'
    stepText.value = 'Đang gửi nguồn vào hàng chờ duyệt...'
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

    // Step 4: Finalizing metadata (75% - 95%)
    stepText.value = 'Đang cập nhật trạng thái xem trước...'
    await new Promise((resolve) => setTimeout(resolve, 800))
    progress.value = 95

    // Complete (100%)
    progress.value = 100
    status.value = 'success'
    stepText.value = 'Hoàn tất xử lý nguồn.'
    isDialogVisible.value = false
    isPinnedVisible.value = true // Show completion notification
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
    smartReaderResult,
    pdfResult,
    startPipeline,
    minimizeDialog,
    openDialog,
    stopTracking
  }
})
