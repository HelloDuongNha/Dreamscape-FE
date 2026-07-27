<template>
  <div class="settings-section">
    <!-- Unauthorized Fallback Screen -->
    <div v-if="isUnauthorized" class="unauthorized-container">
      <div class="unauthorized-card">
        <div class="unauthorized-icon" aria-hidden="true">🔒</div>
        <h3 class="unauthorized-title">Không có quyền truy cập</h3>
        <p class="unauthorized-desc">Bạn không có quyền truy cập trang duyệt nguồn.</p>
      </div>
    </div>

    <!-- Main Moderation Panel -->
    <div v-else class="moderation-panel">
      <div class="moderation-header">
        <div>
          <h2 class="settings-section__title">Duyệt nguồn học thuật</h2>
          <p class="settings-section__desc">
            Quản lý và kiểm duyệt các bài báo, nghiên cứu khoa học được đóng góp bởi thành viên.
          </p>
        </div>
        <AppButton variant="primary" size="sm" @click="showContributionModal = true">
          {{ t('library.contribute') }}
        </AppButton>
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
        <p>{{ activeStatus === 'evidence_gaps' ? t('oracle.evidenceLoading') : 'Đang tải danh sách nguồn...' }}</p>
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
            v-if="evidenceGaps.length"
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
          <div class="moderation-empty__icon" aria-hidden="true">✓</div>
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
                <small v-if="gap.occurrenceCount > 1">
                  {{ t('oracle.evidenceMergedOccurrences', { count: gap.occurrenceCount }) }}
                </small>
                <details v-if="gap.relatedClaims?.length > 1" class="evidence-gap-related">
                  <summary>{{ t('oracle.evidenceViewMergedClaims') }}</summary>
                  <ul>
                    <li v-for="claim in localizedRelatedClaims(gap)" :key="claim">{{ claim }}</li>
                  </ul>
                </details>
              </div>
              <AppCopyButton
                class="evidence-gap-copy"
                :text="evidenceResearchPrompt(gap)"
                :label="t('oracle.evidenceCopyOne')"
                :copied-label="t('oracle.evidenceCopiedShort')"
                :success-message="t('oracle.evidenceCopied')"
                :error-message="t('oracle.evidenceCopyFailed')"
              />
            </header>

            <section>
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
                <small>{{ rule.evidenceScore }}/100 · {{ rule.supportingSourceCount }} {{ t('oracle.evidenceSources') }}</small>
              </div>
            </section>

            <details class="deep-research-preview">
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
        <div class="moderation-empty__icon" aria-hidden="true">🗂️</div>
        <h3 class="moderation-empty__title">Không có dữ liệu</h3>
        <p class="moderation-empty__desc">
          Không tìm thấy nguồn tài liệu nào trong mục "{{ activeTabLabel }}".
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
              {{ source.title || source.metadata?.title || 'Tài liệu không có tiêu đề' }}
            </h4>
            <div style="display: flex; gap: var(--space-2); align-items: center;">
              <span v-if="source.originalFile" class="pdf-badge">PDF Upload</span>
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
              <span class="grid-label">Link nguồn:</span>
              <a :href="source.url" target="_blank" rel="noopener noreferrer" class="grid-value preview-link">
                {{ source.url }}
              </a>
            </div>
            <div v-if="source.metadata?.authors && source.metadata.authors.length > 0" class="grid-item">
              <span class="grid-label">Tác giả:</span>
              <span class="grid-value">{{ source.metadata.authors.join(', ') }}</span>
            </div>
            <div v-if="source.metadata?.year" class="grid-item">
              <span class="grid-label">Năm XB:</span>
              <span class="grid-value">{{ source.metadata.year }}</span>
            </div>
            <div v-if="source.metadata?.journal || source.metadata?.publisher" class="grid-item">
              <span class="grid-label">Tạp chí / Nhà XB:</span>
              <span class="grid-value">{{ source.metadata?.journal || source.metadata?.publisher }}</span>
            </div>
            
            <div v-if="source.submittedNote" class="grid-item grid-item--full">
              <span class="grid-label">Ghi chú đóng góp:</span>
              <p class="grid-value note-box">{{ source.submittedNote }}</p>
            </div>

            <!-- Bản đọc thông minh row -->
            <div class="grid-item">
              <span class="grid-label">Bản đọc thông minh:</span>
              <div class="grid-value inline-flex-center">
                <template v-if="sourceProgressStore.contributionId === source._id && sourceProgressStore.status === 'pending'">
                  <span class="spinner spinner-xs" style="margin-right: var(--space-2);"></span>
                  <span class="processing-status-text">Đang nhập...</span>
                </template>
                <template v-else-if="source.readableInApp || (source.smartReaderStats && source.smartReaderStats.pageCount > 0)">
                  <span>Có</span>
                </template>
                <template v-else-if="source.fullTextStatus === 'failed'">
                  <span>Lỗi</span>
                </template>
                <template v-else>
                  <span>Chưa có</span>
                </template>
              </div>
            </div>

            <!-- PDF gốc / PDF online row -->
            <div class="grid-item">
              <span class="grid-label">PDF gốc / PDF online:</span>
              <div class="grid-value inline-flex-center">
                <template v-if="sourceProgressStore.contributionId === source._id && sourceProgressStore.status === 'pending'">
                  <span class="spinner spinner-xs" style="margin-right: var(--space-2);"></span>
                  <span class="processing-status-text">Đang kiểm tra...</span>
                </template>
                <template v-else-if="source.originalFile">
                  <span>Đã lưu PDF gốc</span>
                </template>
                <template v-else-if="source.pdfUrl">
                  <span>Có link online</span>
                </template>
                <template v-else-if="source.fullTextStatus === 'failed' && source.submittedNote?.toLowerCase().includes('pdf')">
                  <span>Bị chặn / Lỗi tải</span>
                </template>
                <template v-else>
                  <span>Chưa có</span>
                </template>
              </div>
            </div>

            <!-- Stats rows (Only shown when preprocessing is finished and readableInApp is true) -->
            <template v-if="!(sourceProgressStore.contributionId === source._id && sourceProgressStore.status === 'pending') && (source.readableInApp || (source.smartReaderStats && source.smartReaderStats.pageCount > 0))">
              <div class="grid-item">
                <span class="grid-label">Số trang:</span>
                <span class="grid-value">
                  {{ source.smartReaderStats?.pageCount || 'Đang cập nhật' }}
                </span>
              </div>
              <div class="grid-item">
                <span class="grid-label">Figure:</span>
                <span class="grid-value">
                  {{ source.smartReaderStats?.figureCount ?? 0 }}
                </span>
              </div>
              <div class="grid-item">
                <span class="grid-label">Table:</span>
                <span class="grid-value">
                  {{ source.smartReaderStats?.tableCount ?? 0 }}
                </span>
              </div>
              <div class="grid-item">
                <span class="grid-label">Tài liệu tham khảo:</span>
                <span class="grid-value">
                  {{ source.smartReaderStats?.referenceCount ?? 0 }}
                </span>
              </div>
            </template>

            <div v-if="source.originalFile" class="grid-item grid-item--full">
              <span class="grid-label">Tài liệu đã tải lên (PDF):</span>
              <div class="pdf-info-box">
                <div class="pdf-info-header">
                  <span class="pdf-file-icon" aria-hidden="true">📄</span>
                  <div class="pdf-file-details">
                    <span class="pdf-file-name" :title="source.originalFile.originalFileName">
                      {{ source.originalFile.originalFileName }}
                    </span>
                    <span class="pdf-file-meta">
                      Kích thước: {{ formatBytes(source.originalFile.fileSize) }}
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
                    {{ activePdfActionId === source._id ? 'Đang mở...' : 'Mở PDF ↗' }}
                  </button>
                  <button
                    v-if="source.originalFile"
                    type="button"
                    class="pdf-action-btn pdf-action-btn--secondary"
                    :disabled="activePdfActionId === source._id"
                    @click="requestPdfDownload(source)"
                  >
                    Tải PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Reviewer Info Block (if approved or rejected) -->
          <div v-if="source.reviewStatus !== 'pending'" class="source-card__reviewer-info">
            <h5 class="reviewer-title">Thông tin kiểm duyệt</h5>
            <div class="reviewer-grid">
              <div>
                <span class="grid-label">Người duyệt:</span>
                <span class="grid-value">{{ source.reviewedBy?.display_name || source.reviewedBy?.username || 'Hệ thống' }}</span>
              </div>
              <div>
                <span class="grid-label">Thời gian:</span>
                <span class="grid-value">{{ formatDate(source.reviewedAt) }}</span>
              </div>
              <div v-if="source.reviewNote" class="grid-item--full">
                <span class="grid-label">Ghi chú duyệt:</span>
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
              Xem trước
            </RouterLink>
            <AppButton
              variant="danger-outline"
              size="sm"
              @click="openReviewModal(source, 'rejected')"
            >
              Từ chối
            </AppButton>
            <AppButton
              variant="smart"
              size="sm"
              @click="openReviewModal(source, 'approved')"
            >
              Duyệt
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
          Trước
        </button>
        <span class="pagination-info">
          Trang {{ pagination.page }} / {{ pagination.pages }}
          (Tổng: {{ pagination.total }} {{ activeStatus === 'evidence_gaps' ? 'khoảng trống' : 'nguồn' }})
        </span>
        <button
          :disabled="pagination.page === pagination.pages"
          class="pagination-btn"
          @click="changePage(pagination.page + 1)"
        >
          Sau
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
          aria-label="Xử lý kiểm duyệt"
          @click.self="closeReviewModal"
        >
          <div class="modal-container" tabindex="-1">
            <div class="modal-header">
              <h3 class="modal-header__title">
                {{ reviewAction === 'approved' ? 'Phê duyệt nguồn đóng góp' : 'Từ chối nguồn đóng góp' }}
              </h3>
              <button
                class="modal-close-btn"
                aria-label="Đóng"
                @click="closeReviewModal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="modal-body">
              <p class="modal-confirm-text">
                Bạn có chắc chắn muốn <strong>{{ reviewAction === 'approved' ? 'duyệt' : 'từ chối' }}</strong> nguồn đóng góp này?
              </p>
              <div class="selected-source-preview">
                <strong>{{ selectedSource?.title || selectedSource?.metadata?.title || 'Tài liệu không có tiêu đề' }}</strong>
                <div v-if="selectedSource?.doi" class="mono text-xs">{{ selectedSource.doi }}</div>
                <div v-if="selectedSource?.originalFile" class="text-xs" style="margin-top: 4px; color: var(--color-text-muted);">
                  Tệp: {{ selectedSource.originalFile.originalFileName }} ({{ formatBytes(selectedSource.originalFile.fileSize) }})
                </div>
              </div>
              
              <div class="form-fields">
                <AppInput
                  id="review-note-input"
                  v-model="reviewNote"
                  type="textarea"
                  label="Ghi chú kiểm duyệt (Không bắt buộc)"
                  placeholder="Nhập lý do duyệt hoặc từ chối nguồn tài liệu này (tối đa 1000 ký tự)..."
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
                  Hủy
                </AppButton>
                
                <AppButton
                  :variant="reviewAction === 'approved' ? 'smart' : 'danger'"
                  size="md"
                  :disabled="isSubmitting"
                  :loading="isSubmitting"
                  @click="submitReview"
                >
                  Xác nhận
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <AppConfirm
      v-model="showPdfDownloadConfirm"
      title="Tải tài liệu PDF"
      :message="pdfDownloadConfirmMessage"
      confirm-label="Tải về"
      cancel-label="Hủy"
      :loading="isDownloadingPdf"
      @confirm="confirmPdfDownload"
      @cancel="cancelPdfDownload"
    />
    <AcademicContributionModal
      :open="showContributionModal"
      :is-moderator="true"
      @close="showContributionModal = false"
      @submitted="handleContributionSubmitted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppStatusBadge from '@/components/common/AppStatusBadge.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import AppCopyButton from '@/components/common/AppCopyButton.vue'
import AcademicContributionModal from '@/components/academic/AcademicContributionModal.vue'

const settingsStore = useSettingsStore()
const sourceProgressStore = useSourceProgressStore()
const { t, locale } = useI18n()
const router = useRouter()
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
const researchPromptLanguage = ref<'vi' | 'en'>(String(locale.value).startsWith('en') ? 'en' : 'vi')
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
  const name = pendingPdfDownload.value?.originalFile?.originalFileName || 'tài liệu này'
  return `Tải “${name}” về thiết bị của bạn?`
})

const tabs = computed(() => [
  { status: 'pending' as const, label: 'Chờ duyệt' },
  { status: 'approved' as const, label: 'Đã duyệt' },
  { status: 'rejected' as const, label: 'Từ chối' },
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
  } catch (err: any) {
    if (err.response && err.response.status === 403) {
      isUnauthorized.value = true
    } else {
      const errMsg = err.response?.data?.message || err.message || 'Không thể kết nối với hệ thống.'
      settingsStore.showToast(errMsg, 'error')
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
  } catch (err: any) {
    if (err.response?.status === 403) isUnauthorized.value = true
    else settingsStore.showToast(err.response?.data?.message || 'Không thể tải khoảng trống bằng chứng.', 'error')
  } finally {
    isLoading.value = false
  }
}

function changeTab(status: ModerationTab) {
  activeStatus.value = status
  currentPage.value = 1
  if (status === 'evidence_gaps') fetchEvidenceGaps()
  else fetchSources()
}

function changePage(page: number) {
  currentPage.value = page
  if (activeStatus.value === 'evidence_gaps') fetchEvidenceGaps()
  else fetchSources()
}

function changeEvidenceGapStatus(status: EvidenceGapStatus) {
  evidenceGapStatus.value = status
  currentPage.value = 1
  fetchEvidenceGaps()
}

function evidenceGapStatusLabel(status: OracleEvidenceGapItem['status']) {
  return status === 'resolved' ? t('oracle.evidenceResolved') : t('oracle.evidenceNeedsSource')
}

function evidenceGapClaim(gap: OracleEvidenceGapItem): string {
  const language = String(locale.value).startsWith('en') ? 'en' : 'vi'
  return gap.localizedClaims?.[language] || gap.claim
}

function localizedRelatedClaims(gap: OracleEvidenceGapItem): string[] {
  const language = String(locale.value).startsWith('en') ? 'en' : 'vi'
  return gap.localizedRelatedClaims?.[language] || gap.relatedClaims
}

function evidenceResearchPrompt(gap: OracleEvidenceGapItem): string {
  return gap.deepResearchPrompts?.[researchPromptLanguage.value] || gap.deepResearchPrompt
}

const allEvidenceResearchPrompts = computed(() => evidenceGaps.value
  .map((gap, index) => `${t('oracle.evidencePromptNumber', { number: index + 1 })}\n${evidenceResearchPrompt(gap)}`)
  .join('\n\n---\n\n'))

async function loadAllEvidenceResearchPrompts(): Promise<string> {
  const allGaps: OracleEvidenceGapItem[] = []
  const limit = 50
  let page = 1
  let pages = 1

  do {
    const result = await getOracleEvidenceGaps({
      status: evidenceGapStatus.value,
      page,
      limit,
    })
    allGaps.push(...result.gaps)
    pages = Math.max(1, result.pagination.pages)
    page += 1
  } while (page <= pages)

  return allGaps
    .map((gap, index) => `${t('oracle.evidencePromptNumber', { number: index + 1 })}\n${evidenceResearchPrompt(gap)}`)
    .join('\n\n---\n\n')
}

watch(locale, (value) => {
  researchPromptLanguage.value = String(value).startsWith('en') ? 'en' : 'vi'
})

function openReviewModal(source: SourceContribution, action: 'approved' | 'rejected') {
  selectedSource.value = source
  reviewAction.value = action
  reviewNote.value = ''
  showReviewModal.value = true
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
  }

  try {
    const res = await reviewSource(id, payload)
    if (res.success) {
      let msg = res.message
      let toastType: 'success' | 'error' = 'success'
      
      if (res.warning) {
        toastType = 'success'
        const warnCode = res.code
        const warnError = res.details?.error || ''
        
        if (warnCode === 'FULLTEXT_IMPORT_SSRF_BLOCKED' || warnError.includes('SSRF')) {
          msg = 'Nguồn đã được lưu, nhưng không thể nhập bản đọc tự động. URL bị chặn bởi kiểm tra an toàn SSRF. Không tắt bảo vệ này.'
        } else if (warnError.includes('403') || msg?.includes('403')) {
          msg = 'Nguồn đã được lưu, nhưng không thể nhập bản đọc tự động. Máy chủ tài liệu trả về 403. Hãy upload PDF thủ công hoặc dùng link PDF công khai khác.'
        } else if (warnCode === 'APPROVED_METADATA_ONLY' || warnError.includes('Tài liệu không có tệp')) {
          msg = 'Nguồn đã được lưu, nhưng không thể nhập bản đọc tự động. Nguồn này chỉ có metadata, chưa có toàn văn để nhập.'
        } else {
          msg = 'Nguồn đã được lưu, nhưng không thể nhập bản đọc tự động.'
        }
      } else if (!msg) {
        msg = reviewAction.value === 'approved' ? 'Nguồn đã được duyệt.' : 'Nguồn đã bị từ chối.'
      }
      
      settingsStore.showToast(msg, toastType)
      closeReviewModal()
      fetchSources()
    }
  } catch (err: any) {
    if (err.response && err.response.status === 409) {
      settingsStore.showToast(err.response.data?.message || 'Yêu cầu kiểm duyệt đã được xử lý trước đó.', 'error')
    } else if (err.response && err.response.status === 403) {
      settingsStore.showToast('Bạn không có quyền thực hiện hành động này.', 'error')
      isUnauthorized.value = true
      closeReviewModal()
    } else {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Có lỗi xảy ra khi phê duyệt nguồn.'
      settingsStore.showToast(errMsg, 'error')
    }
  } finally {
    isSubmitting.value = false
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('vi-VN', {
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
    let message = 'Tệp trả về không phải PDF hợp lệ.'
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
    if (!previewWindow) throw new Error('Trình duyệt đã chặn tab xem PDF.')
    previewWindow.opener = null
    previewWindow.location.href = blobUrl
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  } catch (error: any) {
    previewWindow?.close()
    settingsStore.showToast(error.message || 'Không thể mở PDF.', 'error')
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
    settingsStore.showToast('Đã bắt đầu tải PDF.', 'success')
    cancelPdfDownload()
  } catch (error: any) {
    settingsStore.showToast(error.message || 'Không thể tải PDF.', 'error')
  } finally {
    isDownloadingPdf.value = false
    activePdfActionId.value = null
  }
}

onMounted(() => {
  fetchSources()
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
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-5);
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
  margin: var(--space-3) 0 0;
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
