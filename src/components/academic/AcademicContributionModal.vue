<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        class="academic-contribution-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('library.wizard.aria')"
        @click.self.prevent
      >
        <div class="academic-contribution-modal" tabindex="-1">
          <header class="academic-contribution-modal__header">
            <div class="academic-contribution-modal__title-wrap">
              <button v-if="step > 1" class="modal-back-btn" :aria-label="t('library.wizard.back')" @click="step = 1">←</button>
              <h3>{{ step === 1 ? t('library.wizard.step1') : t('library.wizard.stepConfirm') }}</h3>
            </div>
            <button class="modal-close-btn" :aria-label="t('library.wizard.close')" @click="close">×</button>
          </header>

          <div class="academic-contribution-modal__body">
            <template v-if="step === 1">
              <div class="form-fields">
                <div class="file-select-container">
                  <label class="app-input__label">{{ t('library.wizard.pdfFileLabel') }}</label>
                  <div class="file-dropzone" :class="{ 'file-dropzone--has-file': !!selectedFile, 'file-dropzone--error': !!pdfFileError }">
                    <input id="input-pdf-file" type="file" accept=".pdf" class="file-input-hidden" @change="onFileChange" />
                    <div class="file-dropzone-content">
                      <span class="file-icon" aria-hidden="true">↑</span>
                      <span v-if="selectedFile" class="file-name">{{ selectedFile.name }}</span>
                      <span v-else class="file-prompt-text">{{ t('library.wizard.pdfDrop', { maxSize: PDF_MAX_FILE_SIZE_LABEL }) }}</span>
                    </div>
                  </div>
                  <span v-if="pdfFileError" class="app-input__error">{{ pdfFileError }}</span>
                </div>

                <div class="lookup-fields">
                  <AppInput
                    id="input-academic-source"
                    v-model="lookupValue"
                    :label="t('library.wizard.lookupLabel')"
                    :placeholder="t('library.wizard.lookupPlaceholder')"
                    :error="lookupError"
                    maxlength="500"
                    @keydown.enter.prevent="findDocument"
                  />
                  <div class="lookup-action">
                    <AppButton variant="smart" size="md" :disabled="!lookupCanSearch || isFetchingPreview" :loading="isFetchingPreview && lookupMode === 'lookup'" @click="findDocument">
                      {{ t('library.wizard.submit') }}
                    </AppButton>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="previewData">
              <p class="preview-prompt">{{ t('library.wizard.confirmPrompt') }}</p>
              <div class="preview-grid">
                <div class="preview-row"><span class="preview-label">{{ t('library.labels.title') }}</span><span class="preview-value preview-value--bold">{{ previewData.title }}</span></div>
                <div v-if="previewData.authors?.length" class="preview-row"><span class="preview-label">{{ t('library.labels.authors') }}</span><span class="preview-value">{{ previewData.authors.join(', ') }}</span></div>
                <div v-if="previewData.year" class="preview-row"><span class="preview-label">{{ t('library.labels.year') }}</span><span class="preview-value">{{ previewData.year }}</span></div>
                <div v-if="previewData.journal" class="preview-row"><span class="preview-label">{{ t('library.labels.journal') }}</span><span class="preview-value">{{ previewData.journal }}</span></div>
                <div v-if="previewData.doi" class="preview-row"><span class="preview-label">DOI</span><span class="preview-value code-font">{{ previewData.doi }}</span></div>
                <div v-if="previewData.fileName" class="preview-row"><span class="preview-label">{{ t('library.labels.fileName') }}</span><span class="preview-value">{{ previewData.fileName }}</span></div>
              </div>
              <div v-if="isSubmitting && lookupMode === 'pdf'" class="progress-bar-bg"><div class="progress-bar-fill" :style="{ width: `${uploadProgress}%` }"></div></div>
              <div v-if="duplicateSourceId" class="preview-warning-alert preview-warning-alert--danger">{{ duplicateSourceError || t('library.wizard.duplicate') }}</div>
              <div class="wizard-actions wizard-actions--split">
                <AppButton variant="secondary" size="md" :disabled="isSubmitting" @click="step = 1">{{ t('library.wizard.wrong') }}</AppButton>
                <AppButton variant="smart" size="md" :disabled="isSubmitting" :loading="isSubmitting" @click="submitContribution">{{ t('library.wizard.submit') }}</AppButton>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useSourceProgressStore } from '@/store/useSourceProgressStore'
import { previewSource, contributeSource, contributePdfSource } from '@/api/sourceApi'
import { parseAcademicLookupInput, type AcademicLookupError } from '@/features/library/utils/academicContributionLookup'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import { PDF_MAX_FILE_SIZE_BYTES, PDF_MAX_FILE_SIZE_LABEL } from '@/utils/pdfUploadLimits'

const props = defineProps<{ open: boolean; isAdmin?: boolean }>()
const emit = defineEmits<{ close: []; submitted: [] }>()
const { t } = useI18n({ useScope: 'global' })
const settingsStore = useSettingsStore()
const sourceProgressStore = useSourceProgressStore()

const step = ref(1)
const lookupMode = ref<'lookup' | 'pdf' | null>(null)
const lookupValue = ref('')
const lookupAttempted = ref(false)
const lookupRequestError = ref('')
const selectedFile = ref<File | null>(null)
const pdfFileError = ref('')
const previewData = ref<any>(null)
const isFetchingPreview = ref(false)
const isSubmitting = ref(false)
const uploadProgress = ref(0)
const duplicateSourceId = ref<string | null>(null)
const duplicateSourceError = ref('')

const lookupError = computed(() => {
  if (!lookupAttempted.value) return ''
  if (lookupRequestError.value) return lookupRequestError.value
  const parsed = parseAcademicLookupInput(lookupValue.value)
  return parsed.error ? lookupErrorMessage(parsed.error) : ''
})
const lookupCanSearch = computed(() => {
  const result = parseAcademicLookupInput(lookupValue.value)
  return !result.error
})

function reset(): void {
  step.value = 1
  lookupMode.value = null
  lookupValue.value = ''
  lookupAttempted.value = false
  lookupRequestError.value = ''
  selectedFile.value = null
  pdfFileError.value = ''
  previewData.value = null
  isFetchingPreview.value = false
  isSubmitting.value = false
  uploadProgress.value = 0
  duplicateSourceId.value = null
  duplicateSourceError.value = ''
}

function close(): void {
  reset()
  emit('close')
}

function onFileChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (!file) {
    selectedFile.value = null
    pdfFileError.value = t('library.validation.pdfRequired')
  } else if (!file.name.toLowerCase().endsWith('.pdf')) {
    selectedFile.value = null
    pdfFileError.value = t('library.validation.pdfOnly')
  } else if (file.size > PDF_MAX_FILE_SIZE_BYTES) {
    selectedFile.value = null
    pdfFileError.value = t('library.validation.pdfTooLarge', { maxSize: PDF_MAX_FILE_SIZE_LABEL })
  } else {
    selectedFile.value = file
    pdfFileError.value = ''
    void previewPdf()
  }
}

function lookupErrorMessage(error: AcademicLookupError): string {
  if (error === 'required') return t('library.validation.lookupRequired')
  if (error === 'too_long') return t('library.validation.lookupTooLong')
  return t('library.validation.lookupFormat')
}

async function findDocument(): Promise<void> {
  lookupAttempted.value = true
  lookupRequestError.value = ''
  const lookup = parseAcademicLookupInput(lookupValue.value)
  if (lookup.error) {
    settingsStore.showToast(lookupErrorMessage(lookup.error), 'error')
    return
  }
  await loadPreview('lookup', () => previewSource(lookup.payload))
}

async function previewPdf(): Promise<void> {
  if (!selectedFile.value || pdfFileError.value) return
  const title = selectedFile.value.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim()
  previewData.value = { title: title || t('library.local.uploadedTitle'), authors: [], fileName: selectedFile.value.name, fileSize: selectedFile.value.size, sourceProvider: 'pdf_upload', fullTextAvailable: true }
  lookupMode.value = 'pdf'
  step.value = 2
}

async function loadPreview(mode: 'lookup' | 'pdf', loader: () => Promise<any>): Promise<void> {
  isFetchingPreview.value = true
  lookupMode.value = mode
  try {
    const result = await loader()
    if (result.success && result.data) {
      previewData.value = result.data
      step.value = 2
    }
  } catch (error: any) {
    const message = error.response?.data?.message || t('library.local.noMetadata')
    lookupRequestError.value = message
    settingsStore.showToast(message, 'error')
  } finally {
    isFetchingPreview.value = false
  }
}

async function submitContribution(): Promise<void> {
  if (!previewData.value) return
  isSubmitting.value = true
  try {
    const result = lookupMode.value === 'pdf' && selectedFile.value
      ? await contributePdfSource(selectedFile.value, { title: previewData.value.title, authors: previewData.value.authors || undefined }, event => {
          if (event.total) uploadProgress.value = Math.round(event.loaded * 100 / event.total)
        })
      : await contributeSource({ doi: previewData.value.doi || undefined, pmcid: previewData.value.pmcid || undefined, url: previewData.value.url || undefined, metadata: previewData.value })
    if (result.success) {
      settingsStore.showToast(lookupMode.value === 'pdf' ? t('library.local.pdfSubmitted') : t('library.local.sourceSubmitted'), 'success')
      const contributionId = result.data?._id || result.data?.data?._id
      if (props.isAdmin && contributionId) {
        if (lookupMode.value === 'pdf') sourceProgressStore.startPdfOnlyPipeline(contributionId, previewData.value.title, 'contribution', false, true)
        else sourceProgressStore.startPipeline(contributionId, previewData.value.title)
      }
      emit('submitted')
      close()
    }
  } catch (error: any) {
    const data = error.response?.data
    if (error.response?.status === 409 && data?.existingSourceId) {
      duplicateSourceId.value = data.existingSourceId
      duplicateSourceError.value = data.message || t('library.local.duplicate')
    }
    settingsStore.showToast(data?.message || t('library.local.contributionError'), 'error')
  } finally {
    isSubmitting.value = false
  }
}

watch(() => props.open, value => {
  if (value) reset()
})
watch(lookupValue, () => {
  lookupAttempted.value = false
  lookupRequestError.value = ''
})
</script>

<style scoped>
.academic-contribution-overlay { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: var(--space-4); background: rgba(0, 0, 0, .82); }
.academic-contribution-modal { width: 540px; max-width: calc(100vw - 32px); max-height: 85vh; overflow: hidden; background: #181818; border: 1px solid #262626; border-radius: var(--radius-xl); }
.academic-contribution-modal__header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5); border-bottom: 1px solid #262626; }
.academic-contribution-modal__title-wrap { display: flex; align-items: center; gap: var(--space-3); }
.academic-contribution-modal__header h3 { color: var(--color-text-primary); font-size: var(--font-size-base); }
.academic-contribution-modal__body { padding: var(--space-5); overflow-y: auto; max-height: calc(85vh - 70px); }
.modal-back-btn, .modal-close-btn { border: 0; background: transparent; color: var(--color-text-muted); cursor: pointer; }
.modal-back-btn { font-size: var(--font-size-lg); }
.modal-close-btn { font-size: 26px; line-height: 1; }
.step-desc { color: var(--color-text-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-4); }
.form-fields, .lookup-fields, .file-select-container { display: flex; flex-direction: column; gap: var(--space-3); }
.lookup-action { display: flex; justify-content: flex-end; }
.file-dropzone { position: relative; padding: var(--space-6); text-align: center; border: 2px dashed var(--color-border); border-radius: var(--radius-lg); background: #141416; transition: border-color .25s ease, background-color .25s ease, box-shadow .25s ease; }
.file-dropzone:hover { border-color: rgba(255, 255, 255, .45); background: #1a1a1e; box-shadow: 0 0 12px rgba(255, 255, 255, .04); }
.file-dropzone--has-file { border-color: #4ade80; }
.file-dropzone--error { border-color: #ed4956; }
.file-input-hidden { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.file-dropzone-content { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); pointer-events: none; }
.file-name { color: var(--color-text-primary); font-weight: var(--font-weight-semibold); word-break: break-all; }
.file-prompt-text, .file-icon { color: var(--color-text-muted); }
.app-input__error { display: block; color: var(--color-error, #ed4956); font-size: var(--font-size-xs); }
.wizard-actions { display: flex; justify-content: flex-end; margin-top: var(--space-6); }
.wizard-actions--split { justify-content: space-between; gap: var(--space-4); }
.preview-prompt { color: var(--color-text-primary); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-4); }
.preview-grid { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); margin-bottom: var(--space-5); background: #1e1e1e; border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.preview-row { display: grid; grid-template-columns: 140px 1fr; gap: var(--space-3); font-size: var(--font-size-sm); }
.preview-label { color: var(--color-text-muted); }
.preview-value { color: var(--color-text-primary); word-break: break-word; }
.preview-value--bold { font-weight: var(--font-weight-bold); }
.code-font { font-family: var(--font-family-mono, monospace); }
.preview-warning-alert--danger { margin-bottom: var(--space-4); padding: var(--space-3); color: #f87171; background: #1a0f0f; border: 1px solid #450a0a; border-radius: var(--radius-md); }
.progress-bar-bg { height: 8px; margin-bottom: var(--space-4); overflow: hidden; background: #27272a; border-radius: var(--radius-full); }
.progress-bar-fill { height: 100%; background: var(--color-primary); border-radius: inherit; }
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity .18s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
@media (max-width: 600px) { .academic-contribution-modal { width: 100%; } .preview-row { grid-template-columns: 1fr; gap: 2px; } }
</style>
