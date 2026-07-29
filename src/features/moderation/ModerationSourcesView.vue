<template>
  <div class="settings-section">
    <!-- Unauthorized Fallback Screen -->
    <div v-if="isUnauthorized" class="unauthorized-container">
      <div class="unauthorized-card">
        <AppIcon class="unauthorized-icon" name="lock" :size="34" />
        <h3 class="unauthorized-title">{{ t('library.moderation.unauthorizedTitle') }}</h3>
        <p class="unauthorized-desc">{{ t('library.moderation.unauthorizedDesc') }}</p>
      </div>
    </div>

    <!-- Main Moderation Panel -->
    <div v-else class="moderation-panel">
      <div class="moderation-header">
        <div class="moderation-header__left">
          <h2 class="settings-section__title">{{ t('library.moderation.title') }}</h2>
          <p class="settings-section__desc">
            {{ t('library.moderation.description') }}
          </p>
        </div>
        <div class="moderation-header__right">
          <AppButton variant="primary" size="sm" @click="showContributionModal = true">
            {{ t('library.contribute') }}
          </AppButton>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="moderation-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.status"
          :class="['moderation-tab', { 'moderation-tab--active': activeStatus === tab.status }]"
          @click="changeTab(tab.status)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="moderation-loading">
        <span class="spinner"></span>
        <p>{{ activeStatus === 'evidence_gaps' ? t('oracle.evidenceLoading') : t('library.moderation.loading') }}</p>
      </div>

      <div v-else-if="activeStatus === 'evidence_gaps'" class="evidence-gap-panel">
        <div class="evidence-gap-toolbar">
          <div class="evidence-gap-filters" :aria-label="t('oracle.evidenceStatus')">
            <button
              v-for="filter in evidenceGapFilters"
              :key="filter.value"
              :class="{ active: evidenceGapStatus === filter.value }"
              @click="changeEvidenceGapStatus(filter.value)"
            >
              {{ t(filter.labelKey) }}
            </button>
          </div>
          <AppCopyButton
            v-if="evidenceGaps.some(gap => gap.status !== 'resolved')"
            class="evidence-gap-copy-all"
            :text="allEvidenceResearchPrompts"
            :resolve-text="loadAllEvidenceResearchPrompts"
            :label="t('oracle.evidenceCopyAll')"
            :copied-label="t('oracle.evidenceCopiedShort')"
            :success-message="t('oracle.evidenceCopiedAll', { count: pagination.total })"
            :error-message="t('oracle.evidenceCopyFailed')"
            show-label
          />
        </div>

        <div v-if="evidenceGaps.length === 0" class="moderation-empty">
          <AppIcon class="moderation-empty__icon" name="check" :size="28" />
          <h3 class="moderation-empty__title">{{ t('oracle.evidenceEmptyTitle') }}</h3>
          <p class="moderation-empty__desc">{{ t('oracle.evidenceEmptyDescription') }}</p>
        </div>

        <div v-else class="evidence-gap-list">
          <article v-for="gap in evidenceGaps" :key="gap._id" class="evidence-gap-card">
            <header class="evidence-gap-card__header">
              <div>
                <span :class="['evidence-gap-status', `evidence-gap-status--${gap.status}`]">
                  {{ evidenceGapStatusLabel(gap.status) }}
                </span>
                <h3>{{ evidenceGapClaim(gap) }}</h3>
              </div>
              <div v-if="gap.status !== 'resolved'" class="evidence-gap-card__tools">
                <AppCopyButton
                  :text="evidenceResearchPrompt(gap)"
                  :label="t('oracle.evidenceCopyOne')"
                  :copied-label="t('oracle.evidenceCopiedShort')"
                  :success-message="t('oracle.evidenceCopied')"
                  :error-message="t('oracle.evidenceCopyFailed')"
                />
                <button
                  type="button"
                  class="evidence-gap-help"
                  :aria-expanded="helpGapId === gap._id"
                  :aria-label="t('oracle.evidencePromptHelpTitle')"
                  @click="helpGapId = helpGapId === gap._id ? null : gap._id"
                >
                  ?
                </button>
                <div
                  v-if="helpGapId === gap._id"
                  class="evidence-gap-help__popover"
                  role="tooltip"
                >
                  <strong>{{ t('oracle.evidencePromptHelpTitle') }}</strong>
                  <p>{{ t('oracle.evidencePromptHelp') }}</p>
                </div>
              </div>
            </header>

            <section v-if="gap.status !== 'resolved'">
              <h4>{{ t('oracle.evidenceMeaning') }}</h4>
              <p>{{ t('oracle.evidenceMeaningText', { claim: evidenceGapClaim(gap) }) }}</p>
            </section>

            <section v-if="gap.resolvedRules.length">
              <h4>{{ t('oracle.evidenceResolvedBy') }}</h4>
              <div
                v-for="rule in gap.resolvedRules"
                :key="rule._id"
                class="evidence-gap-rule"
              >
                <strong>{{ rule.ruleCode }}</strong>
                <span>{{ rule.statement }}</span>
                <small>{{ t('oracle.evidenceMatchedExcerpt') }}</small>
              </div>
              <button
                v-for="source in gap.resolvedSources"
                :key="source.sourceId"
                type="button"
                class="evidence-gap-source-link"
                @click="openResolvedEvidenceSource(source.sourceId)"
              >
                <span class="evidence-gap-source-link__content">
                  <strong>
                    {{ source.title }}
                    <small v-if="source.year">({{ source.year }})</small>
                  </strong>
                  <q>{{ source.excerpt }}</q>
                </span>
              <small>{{ t('oracle.evidenceInspectLinkedSource') }}</small>
              </button>
            </section>

            <details v-if="gap.usageExcerpts.length" class="evidence-gap-usage">
              <summary>
                {{
                  t(
                    gap.status === 'resolved'
                      ? 'oracle.evidenceUsageTitle'
                      : 'oracle.evidencePendingUsageTitle',
                    { count: gap.usageExcerpts.length },
                  )
                }}
              </summary>
              <p>{{ t('oracle.evidenceUsagePrivacy') }}</p>
              <div class="evidence-gap-usage__list">
                <article
                  v-for="(usage, index) in gap.usageExcerpts"
                  :key="`${usage.surfaceType}-${usage.citationIndex ?? 'pending'}-${index}`"
                >
                  <header>
                    <span>{{ usage.surfaceType === 'oracle' ? t('oracle.evidenceUsageOracle') : t('oracle.evidenceUsageDream') }}</span>
                    <strong>[{{ usage.citationIndex ?? '?' }}]</strong>
                  </header>
                  <blockquote>{{ usage.excerpt }}</blockquote>
                </article>
              </div>
            </details>

            <details v-if="gap.status !== 'resolved'" class="deep-research-preview">
              <summary>{{ t('oracle.evidenceViewPrompt') }}</summary>
              <div class="deep-research-preview__languages" :aria-label="t('oracle.evidencePromptLanguage')">
                <button
                  type="button"
                  :class="{ active: researchPromptLanguage === 'vi' }"
                  @click.prevent="researchPromptLanguage = 'vi'"
                >
                  {{ t('oracle.evidencePromptVietnamese') }}
                </button>
                <button
                  type="button"
                  :class="{ active: researchPromptLanguage === 'en' }"
                  @click.prevent="researchPromptLanguage = 'en'"
                >
                  {{ t('oracle.evidencePromptEnglish') }}
                </button>
              </div>
              <pre>{{ evidenceResearchPrompt(gap) }}</pre>
            </details>
          </article>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="sources.length === 0" class="moderation-empty">
        <AppIcon class="moderation-empty__icon" name="folder" :size="28" />
        <h3 class="moderation-empty__title">{{ t('library.moderation.emptyTitle') }}</h3>
        <p class="moderation-empty__desc">
          {{ t('library.moderation.emptyDesc', { tab: activeTabLabel }) }}
        </p>
      </div>

      <!-- Content Grid List -->
      <div v-else class="sources-list">
        <div
          v-for="source in sources"
          :key="source._id"
          :class="['source-card', { 'source-card--clickable': source.reviewStatus === 'pending' }]"
          :role="source.reviewStatus === 'pending' ? 'link' : undefined"
          :tabindex="source.reviewStatus === 'pending' ? 0 : undefined"
          @click="openSourcePreview(source, $event)"
          @keydown="handleSourceCardKeydown(source, $event)"
        >
          <!-- Card Header -->
          <div class="source-card__header">
            <h4 class="source-card__title">
              {{ source.title || source.metadata?.title || t('library.moderation.untitled') }}
            </h4>
            <div style="display: flex; gap: var(--space-2); align-items: center;">
              <span v-if="source.originalFile" class="pdf-badge">{{ t('library.moderation.pdfBadge') }}</span>
              <AppStatusBadge :status="source.reviewStatus" kind="moderation" />
            </div>
          </div>

          <!-- Metadata Details Grid -->
          <div class="source-card__grid">
            <div v-if="source.doi" class="grid-item">
              <span class="grid-label">DOI:</span>
              <span class="grid-value mono">{{ source.doi }}</span>
            </div>
            <div v-if="source.url" class="grid-item">
              <span class="grid-label">{{ t('library.moderation.card.sourceLink') }}</span>
              <a :href="source.url" target="_blank" rel="noopener noreferrer" class="grid-value preview-link">
                {{ source.url }}
              </a>
            </div>
            <div v-if="source.metadata?.authors && source.metadata.authors.length > 0" class="grid-item">
              <span class="grid-label">{{ t('library.moderation.card.authors') }}</span>
              <span class="grid-value">{{ source.metadata.authors.join(', ') }}</span>
            </div>
            <div v-if="source.metadata?.year" class="grid-item">
              <span class="grid-label">{{ t('library.moderation.card.year') }}</span>
              <span class="grid-value">{{ source.metadata.year }}</span>
            </div>
            <div v-if="source.metadata?.journal || source.metadata?.publisher" class="grid-item">
              <span class="grid-label">{{ t('library.moderation.card.journal') }}</span>
              <span class="grid-value">{{ source.metadata?.journal || source.metadata?.publisher }}</span>
            </div>
            
            <div v-if="source.submittedNote" class="grid-item grid-item--full">
              <span class="grid-label">{{ t('library.moderation.card.contributionNote') }}</span>
              <p class="grid-value note-box">{{ source.submittedNote }}</p>
            </div>

            <!-- Bản đọc thông minh row -->
            <div class="grid-item">
              <span class="grid-label">{{ t('library.moderation.card.smartReader') }}</span>
              <div class="grid-value inline-flex-center">
                <template v-if="sourceProgressStore.contributionId === source._id && sourceProgressStore.status === 'pending'">
                  <span class="spinner spinner-xs" style="margin-right: var(--space-2);"></span>
                  <span class="processing-status-text">{{ t('library.moderation.status.importing') }}</span>
                </template>
                <template v-else-if="source.readableInApp || (source.smartReaderStats && source.smartReaderStats.pageCount > 0)">
                  <span>{{ t('library.moderation.status.available') }}</span>
                </template>
                <template v-else-if="source.fullTextStatus === 'failed'">
                  <span>{{ t('library.moderation.status.failed') }}</span>
                </template>
                <template v-else>
                  <span>{{ t('library.moderation.status.none') }}</span>
                </template>
              </div>
            </div>

            <!-- PDF gốc / PDF online row -->
            <div class="grid-item">
              <span class="grid-label">{{ t('library.moderation.card.pdfOriginal') }}</span>
              <div class="grid-value inline-flex-center">
                <template v-if="sourceProgressStore.contributionId === source._id && sourceProgressStore.status === 'pending'">
                  <span class="spinner spinner-xs" style="margin-right: var(--space-2);"></span>
                  <span class="processing-status-text">{{ t('library.moderation.status.checking') }}</span>
                </template>
                <template v-else-if="source.originalFile">
                  <span>{{ t('library.moderation.status.storedPdf') }}</span>
                </template>
                <template v-else-if="source.pdfUrl">
                  <span>{{ t('library.moderation.status.onlineLink') }}</span>
                </template>
                <template v-else-if="source.fullTextStatus === 'failed' && source.submittedNote?.toLowerCase().includes('pdf')">
                  <span>{{ t('library.moderation.status.blocked') }}</span>
                </template>
                <template v-else>
                  <span>{{ t('library.moderation.status.none') }}</span>
                </template>
              </div>
            </div>

            <!-- Stats rows (Only shown when preprocessing is finished and readableInApp is true) -->
            <template v-if="!(sourceProgressStore.contributionId === source._id && sourceProgressStore.status === 'pending') && (source.readableInApp || (source.smartReaderStats && source.smartReaderStats.pageCount > 0))">
              <div class="grid-item">
                <span class="grid-label">{{ t('library.moderation.card.pageCount') }}</span>
                <span class="grid-value">
                  {{ source.smartReaderStats?.pageCount || t('library.moderation.status.updating') }}
                </span>
              </div>
              <div class="grid-item">
                <span class="grid-label">{{ t('library.moderation.card.figures') }}</span>
                <span class="grid-value">
                  {{ source.smartReaderStats?.figureCount ?? 0 }}
                </span>
              </div>
              <div class="grid-item">
                <span class="grid-label">{{ t('library.moderation.card.tables') }}</span>
                <span class="grid-value">
                  {{ source.smartReaderStats?.tableCount ?? 0 }}
                </span>
              </div>
              <div class="grid-item">
                <span class="grid-label">{{ t('library.moderation.card.references') }}</span>
                <span class="grid-value">
                  {{ source.smartReaderStats?.referenceCount ?? 0 }}
                </span>
              </div>
            </template>

            <div v-if="source.originalFile" class="grid-item grid-item--full">
              <span class="grid-label">{{ t('library.moderation.card.uploadedPdf') }}</span>
              <div class="pdf-info-box">
                <div class="pdf-info-header">
                  <AppIcon class="pdf-file-icon" name="document" :size="20" />
                  <div class="pdf-file-details">
                    <span class="pdf-file-name" :title="source.originalFile.originalFileName">
                      {{ source.originalFile.originalFileName }}
                    </span>
                    <span class="pdf-file-meta">
                      {{ t('library.moderation.card.fileSize', { size: formatBytes(source.originalFile.fileSize) }) }}
                      <span v-if="source.originalFile.fileHash" class="pdf-file-hash">
                        | Hash: <span class="mono text-xs">{{ source.originalFile.fileHash.substring(0, 10) }}...</span>
                      </span>
                    </span>
                  </div>
                </div>
                <div class="pdf-info-actions">
                  <button
                    v-if="source.originalFile"
                    type="button"
                    class="pdf-action-btn pdf-action-btn--primary"
                    :disabled="activePdfActionId === source._id"
                    @click="openStoredPdf(source)"
                  >
                    {{ activePdfActionId === source._id ? t('library.moderation.pdf.opening') : t('library.moderation.pdf.openPdf') }}
                  </button>
                  <button
                    v-if="source.originalFile"
                    type="button"
                    class="pdf-action-btn pdf-action-btn--secondary"
                    :disabled="activePdfActionId === source._id"
                    @click="requestPdfDownload(source)"
                  >
                    {{ t('library.moderation.pdf.downloadPdf') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Reviewer Info Block (if approved or rejected) -->
          <div v-if="source.reviewStatus !== 'pending'" class="source-card__reviewer-info">
            <h5 class="reviewer-title">{{ t('library.moderation.reviewer.title') }}</h5>
            <div class="reviewer-grid">
              <div>
                <span class="grid-label">{{ t('library.moderation.reviewer.reviewedBy') }}</span>
                <span class="grid-value">{{ source.reviewedBy?.display_name || source.reviewedBy?.username || t('library.moderation.reviewer.system') }}</span>
              </div>
              <div>
                <span class="grid-label">{{ t('library.moderation.reviewer.reviewedAt') }}</span>
                <span class="grid-value">{{ formatDate(source.reviewedAt) }}</span>
              </div>
              <div v-if="source.reviewNote" class="grid-item--full">
                <span class="grid-label">{{ t('library.moderation.reviewer.reviewNote') }}</span>
                <p class="grid-value note-box">{{ source.reviewNote }}</p>
              </div>
            </div>
          </div>

          <!-- Actions Footer (pending only) -->
          <div v-if="source.reviewStatus === 'pending'" class="source-card__actions">
            <RouterLink
              :to="`/moderation/sources/${source._id}/preview`"
              class="app-btn app-btn--secondary app-btn--sm"
              style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;"
            >
              {{ t('library.moderation.actions.preview') }}
            </RouterLink>
            <AppButton
              variant="danger-outline"
              size="sm"
              :loading="isReaderBuildInProgress(source)"
              :disabled="isReaderBuildInProgress(source)"
              :title="isReaderBuildInProgress(source) ? t('library.moderation.actions.waitForReader') : undefined"
              @click="openReviewModal(source, 'rejected')"
            >
              {{ t('library.moderation.actions.reject') }}
            </AppButton>
            <AppButton
              variant="smart"
              size="sm"
              :loading="isReaderBuildInProgress(source)"
              :disabled="isReaderBuildInProgress(source)"
              :title="isReaderBuildInProgress(source) ? t('library.moderation.actions.waitForReader') : undefined"
              @click="openReviewModal(source, 'approved')"
            >
              {{ t('library.moderation.actions.approve') }}
            </AppButton>
          </div>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div v-if="pagination.pages > 1 && !isLoading" class="moderation-pagination">
        <button
          :disabled="pagination.page === 1"
          class="pagination-btn"
          @click="changePage(pagination.page - 1)"
        >
          {{ t('library.moderation.pagination.previous') }}
        </button>
        <span class="pagination-info">
          {{ t('library.moderation.pagination.summary', { page: pagination.page, pages: pagination.pages, total: pagination.total, unit: activeStatus === 'evidence_gaps' ? t('library.moderation.pagination.unitGaps') : t('library.moderation.pagination.unitSources') }) }}
        </span>
        <button
          :disabled="pagination.page === pagination.pages"
          class="pagination-btn"
          @click="changePage(pagination.page + 1)"
        >
          {{ t('library.moderation.pagination.next') }}
        </button>
      </div>
    </div>

    <!-- Review Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showReviewModal"
          class="modal-overlay"
          role="dialog"
          aria-modal="true"
          :aria-label="t('library.moderation.review.ariaLabel')"
          @click.self.prevent
        >
          <div class="modal-container" tabindex="-1">
            <div class="modal-header">
              <h3 class="modal-header__title">
                {{ reviewAction === 'approved' ? t('library.moderation.review.approveTitle') : t('library.moderation.review.rejectTitle') }}
              </h3>
              <button
                class="modal-close-btn"
                :aria-label="t('library.moderation.review.close')"
                @click="closeReviewModal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="modal-body">
              <p class="modal-confirm-text">
                {{ reviewAction === 'approved'
                  ? t('library.moderation.review.confirmApprove')
                  : t('library.moderation.review.confirmReject') }}
              </p>
              <div class="selected-source-preview">
                <strong>{{ selectedSource?.title || selectedSource?.metadata?.title || t('library.moderation.untitled') }}</strong>
                <div v-if="selectedSource?.doi" class="mono text-xs">{{ selectedSource.doi }}</div>
                <div v-if="selectedSource?.originalFile" class="text-xs" style="margin-top: 4px; color: var(--color-text-muted);">
                  {{ t('library.moderation.review.fileLabel', { name: selectedSource.originalFile.originalFileName, size: formatBytes(selectedSource.originalFile.fileSize) }) }}
                </div>
              </div>
              
              <div class="form-fields">
                <AppInput
                  id="review-note-input"
                  v-model="reviewNote"
                  type="textarea"
                  :label="t('library.moderation.review.noteLabel')"
                  :placeholder="t('library.moderation.review.notePlaceholder')"
                  maxlength="1000"
                  :rows="3"
                />
              </div>

              <div class="wizard-actions wizard-actions--split">
                <AppButton
                  variant="secondary"
                  size="md"
                  :disabled="isSubmitting"
                  @click="closeReviewModal"
                >
                  {{ t('library.moderation.review.cancel') }}
                </AppButton>
                
                <AppButton
                  :variant="reviewAction === 'approved' ? 'smart' : 'danger'"
                  size="md"
                  :disabled="isSubmitting"
                  :loading="isSubmitting"
                  @click="submitReview"
                >
                  {{ t('library.moderation.review.confirm') }}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <AppConfirm
      v-model="showPdfDownloadConfirm"
      :title="t('library.moderation.pdfDownload.title')"
      :message="pdfDownloadConfirmMessage"
      :confirm-label="t('library.moderation.pdfDownload.confirm')"
      :cancel-label="t('library.moderation.pdfDownload.cancel')"
      :loading="isDownloadingPdf"
      @confirm="confirmPdfDownload"
      @cancel="cancelPdfDownload"
    />
    <AcademicContributionModal
      :open="showContributionModal"
      :is-admin="true"
      @close="showContributionModal = false"
      @submitted="handleContributionSubmitted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/store/useSettingsStore'
import {
  getModerationSources,
  getModerationSourcePdfInline,
  getOracleEvidenceGaps,
  reviewSource,
  type OracleEvidenceGapItem,
  type SourceContribution,
} from '@/api/moderationApi'
import { useSourceProgressStore } from '@/store/useSourceProgressStore'
import { useExtractionStore } from '@/store/useExtractionStore'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppStatusBadge from '@/components/common/AppStatusBadge.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import AppCopyButton from '@/components/common/AppCopyButton.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import AcademicContributionModal from '@/components/academic/AcademicContributionModal.vue'
import {
  buildEvidenceResearchPrompt,
  type EvidenceResearchLanguage,
} from './services/evidenceResearchPrompt.service'
import { isSourceReaderBuildInProgress } from './services/sourceReviewAvailability.service'
import { getApiErrorMessage, getApiErrorStatus } from '@/utils/apiError'

const settingsStore = useSettingsStore()
const sourceProgressStore = useSourceProgressStore()
const extractionStore = useExtractionStore()
const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const showContributionModal = ref(false)

function handleContributionSubmitted(): void {
  showContributionModal.value = false
  fetchSources()
}

watch(() => sourceProgressStore.status, (newStatus) => {
  if (newStatus === 'success' && activeStatus.value === 'pending') {
    fetchSources()
  }
})

function formatBytes(bytes?: number, decimals = 2) {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

const isUnauthorized = ref(false)
const isLoading = ref(false)
const isSubmitting = ref(false)
type ModerationTab = 'pending' | 'approved' | 'rejected' | 'evidence_gaps'
type EvidenceGapStatus = 'active' | 'resolved'

const activeStatus = ref<ModerationTab>('pending')
const currentPage = ref(1)

const sources = ref<SourceContribution[]>([])
const evidenceGaps = ref<OracleEvidenceGapItem[]>([])
const evidenceGapStatus = ref<EvidenceGapStatus>('active')
const researchPromptLanguage = ref<EvidenceResearchLanguage>(String(locale.value).startsWith('en') ? 'en' : 'vi')
const helpGapId = ref<string | null>(null)
const pagination = ref({
  total: 0,
  page: 1,
  limit: 20,
  pages: 1,
})

// Review Modal States
const showReviewModal = ref(false)
const selectedSource = ref<SourceContribution | null>(null)
const reviewAction = ref<'approved' | 'rejected'>('approved')
const reviewNote = ref('')
const showPdfDownloadConfirm = ref(false)
const pendingPdfDownload = ref<SourceContribution | null>(null)
const isDownloadingPdf = ref(false)
const activePdfActionId = ref<string | null>(null)

const pdfDownloadConfirmMessage = computed(() => {
  const name = pendingPdfDownload.value?.originalFile?.originalFileName || t('library.moderation.pdfDownload.fallbackName')
  return t('library.moderation.pdfDownload.message', { name })
})

const tabs = computed(() => [
  { status: 'pending' as const, label: t('library.moderation.tabs.pending') },
  { status: 'approved' as const, label: t('library.moderation.tabs.approved') },
  { status: 'rejected' as const, label: t('library.moderation.tabs.rejected') },
  { status: 'evidence_gaps' as const, label: t('oracle.evidenceTab') },
])
const evidenceGapFilters: Array<{ value: EvidenceGapStatus; labelKey: string }> = [
  { value: 'active', labelKey: 'oracle.evidenceNeedsSource' },
  { value: 'resolved', labelKey: 'oracle.evidenceResolved' },
]

const activeTabLabel = computed(() => {
  return tabs.value.find(tab => tab.status === activeStatus.value)?.label ?? ''
})

async function fetchSources() {
  if (activeStatus.value === 'evidence_gaps') return
  isLoading.value = true
  try {
    const res = await getModerationSources({
      status: activeStatus.value,
      page: currentPage.value,
      limit: 20,
    })
    sources.value = res.sources
    pagination.value = res.pagination
  } catch (error: unknown) {
    if (getApiErrorStatus(error) === 403) {
      isUnauthorized.value = true
    } else {
      settingsStore.showToast(
        getApiErrorMessage(error, t('library.moderation.toast.networkError')),
        'error',
      )
    }
  } finally {
    isLoading.value = false
  }
}

async function fetchEvidenceGaps() {
  isLoading.value = true
  try {
    const result = await getOracleEvidenceGaps({
      status: evidenceGapStatus.value,
      page: currentPage.value,
      limit: 20,
    })
    evidenceGaps.value = result.gaps
    pagination.value = result.pagination
  } catch (error: unknown) {
    if (getApiErrorStatus(error) === 403) {
      isUnauthorized.value = true
    } else {
      settingsStore.showToast(
        getApiErrorMessage(error, t('library.moderation.toast.evidenceLoadError')),
        'error',
      )
    }
  } finally {
    isLoading.value = false
  }
}

function changeTab(status: ModerationTab) {
  activeStatus.value = status
  currentPage.value = 1
  persistModerationView()
  if (status === 'evidence_gaps') fetchEvidenceGaps()
  else fetchSources()
}

function changePage(page: number) {
  currentPage.value = page
  persistModerationView()
  if (activeStatus.value === 'evidence_gaps') fetchEvidenceGaps()
  else fetchSources()
}

function changeEvidenceGapStatus(status: EvidenceGapStatus) {
  evidenceGapStatus.value = status
  currentPage.value = 1
  persistModerationView()
  fetchEvidenceGaps()
}

function persistModerationView(): void {
  router.replace({
    query: {
      ...route.query,
      tab: activeStatus.value,
      evidenceStatus: evidenceGapStatus.value,
      page: String(currentPage.value),
    },
  })
}

function evidenceGapStatusLabel(status: OracleEvidenceGapItem['status']) {
  if (status === 'resolved') return t('oracle.evidenceResolved')
  if (status === 'candidate_found') return t('oracle.evidenceCandidateFound')
  return t('oracle.evidenceNeedsSource')
}

function evidenceGapClaim(gap: OracleEvidenceGapItem): string {
  const language = String(locale.value).startsWith('en') ? 'en' : 'vi'
  return gap.localizedClaims?.[language] || gap.claim
}

function evidenceResearchPrompt(gap: OracleEvidenceGapItem): string {
  return buildEvidenceResearchPrompt(gap, researchPromptLanguage.value)
}

function openResolvedEvidenceSource(sourceId: string): void {
  router.push(`/library/sources/${sourceId}`)
}

const allEvidenceResearchPrompts = computed(() => evidenceGaps.value
  .filter(gap => gap.status !== 'resolved')
  .map((gap, index) => `${t('oracle.evidencePromptNumber', { number: index + 1 })}\n${evidenceResearchPrompt(gap)}`)
  .join('\n\n---\n\n'))

async function loadAllEvidenceResearchPrompts(): Promise<string> {
  const allGaps: OracleEvidenceGapItem[] = []
  const limit = 50
  let page = 1
  let pages = 1
  do {
    const result = await getOracleEvidenceGaps({ status: 'active', page, limit })
    allGaps.push(...result.gaps)
    pages = Math.max(1, result.pagination.pages)
    page += 1
  } while (page <= pages)
  return allGaps
    .filter(gap => gap.status !== 'resolved')
    .map((gap, index) => `${t('oracle.evidencePromptNumber', { number: index + 1 })}\n${evidenceResearchPrompt(gap)}`)
    .join('\n\n---\n\n')
}

watch(locale, (value) => {
  researchPromptLanguage.value = String(value).startsWith('en') ? 'en' : 'vi'
})

function openReviewModal(source: SourceContribution, action: 'approved' | 'rejected') {
  if (isReaderBuildInProgress(source)) {
    settingsStore.showToast(t('library.moderation.actions.waitForReader'), 'error')
    return
  }
  selectedSource.value = source
  reviewAction.value = action
  reviewNote.value = ''
  showReviewModal.value = true
}

function isReaderBuildInProgress(source: SourceContribution): boolean {
  return isSourceReaderBuildInProgress(source, sourceProgressStore)
}

function openSourcePreview(source: SourceContribution, event?: MouseEvent): void {
  if (source.reviewStatus !== 'pending') return
  const target = event?.target
  if (target instanceof Element && target.closest('a, button, input, textarea, select, summary')) {
    return
  }
  router.push(`/moderation/sources/${source._id}/preview`)
}

function handleSourceCardKeydown(source: SourceContribution, event: KeyboardEvent): void {
  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  openSourcePreview(source)
}

function closeReviewModal() {
  showReviewModal.value = false
  selectedSource.value = null
  reviewNote.value = ''
}

async function submitReview() {
  if (!selectedSource.value) return
  isSubmitting.value = true

  const id = selectedSource.value._id
  const payload = {
    reviewStatus: reviewAction.value,
    reviewNote: reviewNote.value.trim() || undefined,
    title: selectedSource.value.title || selectedSource.value.metadata?.title,
  }

  try {
    const res = await reviewSource(id, payload)
    if (res.success) {
      if (reviewAction.value === 'approved') {
        extractionStore.trackApprovalResult(
          res,
          selectedSource.value.title || t('library.local.academicDocument'),
        )
      }
      let msg = res.message
      let toastType: 'success' | 'error' = 'success'
      
      if (res.warning) {
        toastType = 'success'
        const warnCode = res.code
        const warnError = res.details?.error || ''
        
        if (warnCode === 'FULLTEXT_IMPORT_SSRF_BLOCKED' || warnError.includes('SSRF')) {
          msg = t('library.moderation.toast.warnSsrf')
        } else if (warnError.includes('403') || msg?.includes('403')) {
          msg = t('library.moderation.toast.warn403')
        } else if (warnCode === 'APPROVED_METADATA_ONLY' || warnError.includes('Tài liệu không có tệp')) {
          msg = t('library.moderation.toast.warnMetadataOnly')
        } else {
          msg = t('library.moderation.toast.warnGeneric')
        }
      } else if (!msg) {
        msg = reviewAction.value === 'approved' ? t('library.moderation.toast.approved') : t('library.moderation.toast.rejected')
      }
      
      settingsStore.showToast(msg, toastType)
      closeReviewModal()
      fetchSources()
    }
  } catch (error: unknown) {
    const status = getApiErrorStatus(error)
    if (status === 409) {
      settingsStore.showToast(
        getApiErrorMessage(error, t('library.moderation.toast.alreadyProcessed')),
        'error',
      )
    } else if (status === 403) {
      settingsStore.showToast(t('library.moderation.toast.noPermission'), 'error')
      isUnauthorized.value = true
      closeReviewModal()
    } else {
      settingsStore.showToast(
        getApiErrorMessage(error, t('library.moderation.toast.reviewError')),
        'error',
      )
    }
  } finally {
    isSubmitting.value = false
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    const loc = String(locale.value).startsWith('en') ? 'en-US' : 'vi-VN'
    return d.toLocaleString(loc, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

async function fetchStoredPdf(source: SourceContribution): Promise<Blob> {
  const blob = await getModerationSourcePdfInline(source._id)
  if (blob.type !== 'application/pdf') {
    let message = t('library.moderation.toast.notValidPdf')
    try {
      const parsed = JSON.parse(await blob.text())
      message = parsed?.message || message
    } catch {}
    throw new Error(message)
  }
  return blob
}

async function openStoredPdf(source: SourceContribution) {
  const previewWindow = window.open('', '_blank')
  activePdfActionId.value = source._id
  try {
    const blob = await fetchStoredPdf(source)
    const blobUrl = URL.createObjectURL(blob)
    if (!previewWindow) throw new Error(t('library.moderation.toast.popupBlocked'))
    previewWindow.opener = null
    previewWindow.location.href = blobUrl
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  } catch (error: unknown) {
    previewWindow?.close()
    settingsStore.showToast(
      getApiErrorMessage(error, t('library.moderation.toast.openPdfFailed')),
      'error',
    )
  } finally {
    activePdfActionId.value = null
  }
}

function requestPdfDownload(source: SourceContribution) {
  pendingPdfDownload.value = source
  showPdfDownloadConfirm.value = true
}

function cancelPdfDownload() {
  showPdfDownloadConfirm.value = false
  pendingPdfDownload.value = null
}

async function confirmPdfDownload() {
  const source = pendingPdfDownload.value
  if (!source) return
  isDownloadingPdf.value = true
  activePdfActionId.value = source._id
  try {
    const blob = await fetchStoredPdf(source)
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = source.originalFile?.originalFileName || `${source.title || 'document'}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
    settingsStore.showToast(t('library.moderation.toast.downloadStarted'), 'success')
    cancelPdfDownload()
  } catch (error: unknown) {
    settingsStore.showToast(
      getApiErrorMessage(error, t('library.moderation.toast.downloadFailed')),
      'error',
    )
  } finally {
    isDownloadingPdf.value = false
    activePdfActionId.value = null
  }
}

onMounted(() => {
  const requestedTab = String(route.query.tab || '')
  if (['pending', 'approved', 'rejected', 'evidence_gaps'].includes(requestedTab)) {
    activeStatus.value = requestedTab as ModerationTab
  }
  if (route.query.evidenceStatus === 'resolved') evidenceGapStatus.value = 'resolved'
  const requestedPage = Number(route.query.page)
  if (Number.isInteger(requestedPage) && requestedPage > 0) currentPage.value = requestedPage
  if (activeStatus.value === 'evidence_gaps') fetchEvidenceGaps()
  else fetchSources()
})
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: var(--space-6);
  min-height: calc(100vh - var(--header-height) - var(--space-10));
}

.moderation-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.moderation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-5);
  gap: var(--space-4);
}

.moderation-header__left {
  flex: 1;
}

.moderation-header__right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.settings-section__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: var(--letter-spacing-tight);
  margin-bottom: var(--space-1);
}

.settings-section__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
}

/* Tabs Bar */
.moderation-tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-6);
  overflow-x: auto;
}

.moderation-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--transition-fast), border-color var(--transition-fast);
  margin-bottom: -1px;
}

.moderation-tab:hover {
  color: var(--color-text-secondary);
}

.moderation-tab--active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.evidence-gap-panel,
.evidence-gap-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.evidence-gap-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.evidence-gap-filters {
  display: flex;
  gap: 4px;
  padding: 4px;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
}

.evidence-gap-filters button {
  border: 0;
  border-radius: var(--radius-md);
  padding: 7px 11px;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
}

.evidence-gap-filters button.active {
  color: var(--color-text-primary);
  background: var(--color-bg-active);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

.evidence-gap-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-left: 3px solid #f59e0b;
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface, #1e1e1e);
}

.evidence-gap-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.evidence-gap-card h3 {
  margin: var(--space-2) 0 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-relaxed);
}

.evidence-gap-card__header small {
  display: block;
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: 10px;
}

.evidence-gap-related {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: 11px;
}

.evidence-gap-related summary {
  width: fit-content;
  cursor: pointer;
}

.evidence-gap-related ul {
  display: grid;
  gap: 6px;
  margin: var(--space-2) 0 0;
  padding-left: 18px;
}

.evidence-gap-card h4 {
  margin: 0 0 var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.035em;
  text-transform: uppercase;
}

.evidence-gap-card p,
.evidence-gap-card li {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.evidence-gap-card ul {
  margin: 0;
  padding-left: 20px;
}

.evidence-gap-status {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  color: #fbbf24;
  background: rgb(245 158 11 / 12%);
  font-size: 10px;
  font-weight: 700;
}

.evidence-gap-status--candidate_found {
  color: #60a5fa;
  background: rgb(59 130 246 / 12%);
}

.evidence-gap-status--resolved {
  color: #34d399;
  background: rgb(52 211 153 / 12%);
}

.evidence-gap-rule {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  font-size: var(--font-size-xs);
}

.evidence-gap-rule small {
  color: var(--color-text-muted);
}

.evidence-gap-source-link {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-elevated));
  cursor: pointer;
  text-align: left;
}

.evidence-gap-source-link:hover {
  border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-elevated));
}

.evidence-gap-source-link small {
  color: var(--color-text-muted);
}

.evidence-gap-source-link__content {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.evidence-gap-source-link__content q {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evidence-gap-usage {
  margin-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
}

.evidence-gap-usage > summary {
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 650;
}

.evidence-gap-usage > p {
  margin: var(--space-2) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.evidence-gap-usage__list {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.evidence-gap-usage__list article {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}

.evidence-gap-usage__list header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.evidence-gap-usage__list header strong {
  color: var(--color-primary);
}

.evidence-gap-usage__list blockquote {
  margin: var(--space-2) 0 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.deep-research-preview {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.deep-research-preview summary {
  cursor: pointer;
  font-weight: 600;
}

.deep-research-preview pre {
  overflow-x: auto;
  margin: var(--space-3) 0;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  background: var(--color-bg-base);
  font: inherit;
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}

.deep-research-preview__languages {
  display: inline-flex;
  gap: 4px;
  margin-top: var(--space-3);
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}

.deep-research-preview__languages button {
  border: 0;
  border-radius: calc(var(--radius-md) - 2px);
  padding: 5px 9px;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  font-size: 11px;
}

.deep-research-preview__languages button.active {
  color: var(--color-text-primary);
  background: var(--color-bg-active);
}

.evidence-gap-help {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-left: 6px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-muted);
  background: transparent;
  cursor: help;
  font-size: 11px;
}

.evidence-gap-card__tools {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  vertical-align: middle;
}

.evidence-gap-card__tools .evidence-gap-help {
  margin-left: 0;
}

.evidence-gap-help__popover {
  position: absolute;
  z-index: 5;
  top: calc(100% + 8px);
  right: 0;
  width: min(320px, 80vw);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-relaxed);
}

.evidence-gap-help__popover strong {
  color: var(--color-text-primary);
}

.evidence-gap-help__popover p {
  margin: var(--space-1) 0 0;
  font-size: inherit;
}

/* Loading & Empty state */
.moderation-loading,
.moderation-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-12) var(--space-6);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  flex: 1;
}

.moderation-loading {
  gap: var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--color-text-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.moderation-empty__icon {
  font-size: 40px;
  margin-bottom: var(--space-4);
}

.moderation-empty__title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.moderation-empty__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  max-width: 400px;
  line-height: var(--line-height-relaxed);
}

/* Grid List of Sources */
.sources-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.source-card {
  background: var(--color-bg-surface, #1e1e1e);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.source-card--clickable {
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);
}

.source-card--clickable:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-hover);
}

.source-card--clickable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.source-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.source-card__title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  line-height: var(--line-height-normal);
  flex: 1;
}

.source-card__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
  font-size: var(--font-size-sm);
}

.grid-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.grid-item--full {
  grid-column: 1 / -1;
}

.grid-label {
  color: var(--color-text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: var(--font-weight-semibold);
}

.grid-value {
  color: var(--color-text-primary);
  word-break: break-all;
}

.mono {
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-xs);
}

.preview-link {
  color: var(--color-primary, #60a5fa);
  text-decoration: none;
}

.preview-link:hover {
  text-decoration: underline;
}

.user-info-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.user-avatar-mini {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background-size: cover;
  background-position: center;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.user-display-name {
  font-weight: var(--font-weight-medium);
}

.user-email-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.note-box {
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
  margin: 0;
}

.code-font {
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-xs);
  background: var(--color-bg-elevated);
  padding: 2px 6px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  width: fit-content;
}

/* Reviewer block */
.source-card__reviewer-info {
  background: var(--color-bg-elevated);
  border-left: 3px solid var(--color-text-muted);
  padding: var(--space-4);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.reviewer-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3) 0;
}

.reviewer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-3);
  font-size: var(--font-size-sm);
}

/* Actions footer */
.source-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

/* Pagination bar */
.moderation-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-top: var(--space-8);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.pagination-btn {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-input);
  color: var(--color-text-primary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.pagination-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: #3a3a3a;
}

.pagination-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pagination-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* Unauthorized Screen container */
.unauthorized-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: var(--space-12) var(--space-6);
}

.unauthorized-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-10) var(--space-6);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  width: 420px;
  max-width: 100%;
}

.unauthorized-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.unauthorized-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.unauthorized-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
}

/* Confirmation Modal & dialog templates styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.modal-container {
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-xl);
  width: 480px;
  max-width: calc(100vw - 32px);
  display: flex;
  flex-direction: column;
  outline: none;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid #262626;
}

.modal-header__title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.modal-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.modal-close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.modal-body {
  padding: var(--space-5);
  overflow-y: auto;
  max-height: calc(85vh - 70px);
}

.modal-confirm-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  margin-bottom: var(--space-4);
}

.selected-source-preview {
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-5);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.wizard-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-6);
}

.wizard-actions--split {
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-6);
}

/* Modal fade animations */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.modal-fade-enter-from {
  opacity: 0;
}

.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-container {
  transform: translateY(12px);
  opacity: 0;
}

.modal-fade-leave-to .modal-container {
  transform: translateY(12px);
  opacity: 0;
}

.pdf-badge {
  background-color: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pdf-info-box {
  background: var(--color-bg-base, #121212);
  border: 1px solid var(--color-border, #262626);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 6px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4, 16px);
  flex-wrap: wrap;
  margin-top: 4px;
}

.pdf-info-header {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  min-width: 0;
  flex: 1;
}

.pdf-file-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.pdf-file-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pdf-file-name {
  color: var(--color-text-primary, #ffffff);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-sm, 14px);
}

.pdf-file-meta {
  color: var(--color-text-muted, #888888);
  font-size: var(--font-size-xs, 12px);
}

.pdf-file-hash {
  color: var(--color-text-muted, #888888);
}

.pdf-info-actions {
  display: flex;
  gap: var(--space-2, 8px);
}

.pdf-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: var(--radius-md, 6px);
  font-size: var(--font-size-xs, 12px);
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s) ease;
}

.pdf-action-btn--primary {
  background-color: var(--color-primary, #60a5fa);
  color: #0f172a;
}

.pdf-action-btn--primary:hover {
  background-color: #3b82f6;
  color: #ffffff;
}

.pdf-action-btn--secondary {
  background-color: var(--color-bg-elevated, #2a2a2a);
  color: var(--color-text-secondary, #cccccc);
  border: 1px solid var(--color-border, #3a3a3a);
}

.pdf-action-btn--secondary:hover {
  background-color: var(--color-bg-hover, #333333);
  color: var(--color-text-primary, #ffffff);
}

.spinner-xs {
  width: 12px;
  height: 12px;
  border-width: 1.5px;
}

.processing-summary-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-top: var(--space-1);
}

.processing-summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.inline-flex-center {
  display: inline-flex;
  align-items: center;
}

.stats-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.processing-status-text {
  font-size: var(--font-size-xs);
  color: var(--color-primary, #60a5fa);
  font-weight: var(--font-weight-medium);
}
</style>
