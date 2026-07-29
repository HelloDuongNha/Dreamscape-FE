<template>
  <div class="settings-section">
    <div class="library-header-row">
      <div class="library-header-left">
        <h2 class="settings-section__title">{{ t('library.title') }}</h2>
        <p class="settings-section__desc">
          {{ t('library.description') }}
        </p>
      </div>
      <div v-if="hasAdminAccess" class="library-header-right">
        <AppButton id="open-wizard-btn" variant="primary" size="sm" @click="showModal = true">
          {{ t('library.contribute') }}
        </AppButton>
      </div>
    </div>

    <!-- Search Input Row -->
    <div class="library-search-row">
      <div class="catalog-search">
        <AppInput
          id="catalog-search-input"
          v-model="searchQuery"
          :placeholder="t('library.searchPlaceholder')"
          :error="searchValidationError"
          maxlength="140"
        />
      </div>
    </div>

    <!-- Category Filter Tabs -->
    <div class="library-tabs">
      <button
        v-for="tab in categoryTabs"
        :key="tab.id"
        :class="['library-tab', { 'library-tab--active': activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Catalog Section -->
    <div class="catalog-section">
      <!-- Loading State -->
      <div v-if="isLoadingSources" class="catalog-loading">
        <span class="spinner"></span>
        <p>{{ t('library.loadingList') }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="hasErrorSources" class="catalog-error">
        <p>{{ t('library.loadListError') }}</p>
        <AppButton variant="secondary" size="sm" @click="fetchApprovedSources">{{ t('library.retry') }}</AppButton>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredSources.length === 0 && !searchValidationError" class="catalog-empty">
        <div class="catalog-empty__icon" aria-hidden="true"></div>
        <h4 class="catalog-empty__title">{{ t('library.emptyTitle') }}</h4>
        <p class="catalog-empty__desc">
          {{ searchQuery ? t('library.emptySearch') : t('library.emptyCategory') }}
        </p>
      </div>

      <!-- Grid Catalog of Sources -->
      <div v-else class="catalog-grid">
        <div 
          v-for="source in filteredSources" 
          :key="source._id" 
          class="catalog-card"
          @click="router.push('/library/sources/' + source._id)"
        >
          <div class="catalog-card__heading">
            <span :class="['catalog-card__source-icon', { 'catalog-card__source-icon--pdf': isPdfSource(source) }]" aria-hidden="true">
              <svg v-if="isPdfSource(source)" viewBox="0 0 24 24">
                <path d="M6 2.75h8l4 4V21.25H6z" />
                <path d="M14 2.75v4h4M8.5 16.5h7M8.5 13h7M8.5 9.5h2.5" />
              </svg>
              <svg v-else viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M3.5 12h17M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5S14.2 18.2 12 20.5C9.8 18.2 8.8 15.4 8.8 12S9.8 5.8 12 3.5Z" />
              </svg>
            </span>
            <h4 class="catalog-card__title">
              <span translate="no">{{ source.title || t('library.untitled') }}</span>
            </h4>
            <AcademicCategoryBadge :category="resolveAcademicSourceCategory(source)" />
          </div>
          
          <!-- Metadata details -->
          <div class="catalog-card__meta">
            <div class="meta-row">
              <span class="meta-label">{{ t('library.labels.authors') }}</span>
              <span class="meta-value" translate="no">{{ displayAuthors(source) }}</span>
            </div>
            <div v-if="source.year" class="meta-row">
              <span class="meta-label">{{ t('library.labels.yearShort') }}</span>
              <span class="meta-value">{{ source.year }}</span>
            </div>
            <div v-if="source.journal" class="meta-row">
              <span class="meta-label">{{ t('library.labels.journal') }}</span>
              <span class="meta-value" translate="no">{{ source.journal }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">{{ t('library.labels.identifier') }}</span>
              <span class="meta-value code-font" translate="no">{{ source.doi ? `DOI: ${source.doi}` : ((source.sourceOrigin === 'uploaded_pdf' || !!source.originalFile) ? t('library.uploadedPdf') : t('library.sourceLink')) }}</span>
            </div>
            <div v-if="source.url && !(source.sourceOrigin === 'uploaded_pdf' || !!source.originalFile)" class="meta-row">
              <span class="meta-label">{{ t('library.labels.link') }}</span>
              <a :href="source.url" target="_blank" rel="noopener noreferrer" class="meta-link" @click.stop>
                {{ t('library.viewOriginal') }}
              </a>
            </div>
          </div>

          <!-- Badges -->
          <div class="catalog-card__badges">
            <AppStatusBadge :status="source.allowedUse || 'metadata_only'" kind="allowedUse" :source-type="resolveSourceType(source)" :full-text-source-type="source.fullTextSourceType" />
            <AppStatusBadge :status="source.verificationStatus || 'unverified'" kind="verification" :source-type="resolveSourceType(source)" :full-text-source-type="source.fullTextSourceType" />
            <AppStatusBadge :status="source.copyrightStatus || 'paywalled'" kind="copyright" :source-type="resolveSourceType(source)" :full-text-source-type="source.fullTextSourceType" />
          </div>

          <!-- Future Reading Progress (Future Use Placeholder) -->
          <div v-if="source.progress !== undefined" class="catalog-card__progress-container">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" :style="{ width: `${source.progress}%` }"></div>
            </div>
            <span class="progress-text">{{ t('library.readProgress', { progress: source.progress }) }}</span>
          </div>

          <!-- Clear reading affordance; moderation action stays on the right. -->
          <div class="catalog-card__footer-container">
            <button
              v-if="hasAdminAccess"
              class="delete-source-btn"
              @click.stop="promptDelete(source)"
              :title="t('library.deleteDocument')"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
            <span v-else aria-hidden="true"></span>
            <span class="catalog-card__read-cta">{{ t('library.readNow') }} →</span>
          </div>
        </div>
      </div>

      <!-- Pagination bar -->
      <div v-if="pagination.pages > 1 && !isLoadingSources" class="catalog-pagination">
        <button
          :disabled="pagination.page === 1"
          class="pagination-btn"
          @click="changePage(pagination.page - 1)"
        >
          {{ t('library.pagination.previous') }}
        </button>
        <span class="pagination-info">
          {{ t('library.pagination.summary', { page: pagination.page, pages: pagination.pages, total: formatNumber(pagination.total) }) }}
        </span>
        <button
          :disabled="pagination.page === pagination.pages"
          class="pagination-btn"
          @click="changePage(pagination.page + 1)"
        >
          {{ t('library.pagination.next') }}
        </button>
      </div>
    </div>


    <AcademicContributionModal
      :open="showModal"
      :is-admin="hasAdminAccess"
      @close="showModal = false"
      @submitted="fetchApprovedSources"
    />
    <!-- AppConfirm Deletion Dialog -->
    <AppConfirm
      v-model="showDeleteConfirm"
      :title="t('library.deleteConfirm.title')"
      :message="t('library.deleteConfirm.message')"
      :confirm-label="t('library.deleteConfirm.confirm')"
      :cancel-label="t('library.deleteConfirm.cancel')"
      :danger="true"
      :loading="isDeleting"
      @confirm="handleDeleteConfirm"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { resolveSourceType } from '@/utils/sourceTypeHelper'
import { parseDoiSearchInput } from './utils/academicContributionLookup'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { isAdminUser } from '@/utils/adminAccess'
import {
  getApprovedSources,
  type ApprovedSourceCatalogItem,
} from '@/api/sourceApi'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppStatusBadge from '@/components/common/AppStatusBadge.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import AcademicContributionModal from '@/components/academic/AcademicContributionModal.vue'
import AcademicCategoryBadge from '@/components/academic/AcademicCategoryBadge.vue'
import { resolveAcademicSourceCategory } from './utils/academicSourceCategory'
import apiClient from '@/api/client'
import { getApiErrorMessage } from '@/utils/apiError'

const router = useRouter()
const { t, n } = useI18n({ useScope: 'global' })
const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const hasAdminAccess = computed(() => isAdminUser(authStore.user))

// Category filter tabs
const activeTab = ref('all')
const categoryTabs = computed(() => [
  { id: 'all', label: t('library.tabs.all') },
  { id: 'science', label: t('library.tabs.science') },
  { id: 'psychology', label: t('library.tabs.psychology') },
  { id: 'symbol', label: t('library.tabs.symbol') },
  { id: 'culture', label: t('library.tabs.culture') },
])

function formatNumber(value: number) {
  return n(value)
}

// Approved Sources catalog states
const isLoadingSources = ref(false)
const hasErrorSources = ref(false)
const searchQuery = ref('')
const searchValidationErrorCode = ref<'invalid_doi' | null>(null)
const searchValidationError = computed(() => (
  searchValidationErrorCode.value
    ? t('library.validation.doiSearchFormat')
    : ''
))
const sources = ref<ApprovedSourceCatalogItem[]>([])
const currentPage = ref(1)
const pagination = ref({
  page: 1,
  limit: 12,
  total: 0,
  pages: 1,
})

// Local categorization matching fallback
const filteredSources = computed(() => {
  if (activeTab.value === 'all') {
    return sources.value
  }
  return sources.value.filter(source => resolveAcademicSourceCategory(source) === activeTab.value)
})

function isPdfSource(source: ApprovedSourceCatalogItem): boolean {
  return source.sourceOrigin === 'uploaded_pdf'
    || Boolean(source.originalFile)
    || String(source.fullTextSourceType || '').toLowerCase().includes('pdf')
}

function displayAuthors(source: ApprovedSourceCatalogItem): string {
  const authors = Array.isArray(source.authors) && source.authors.length
    ? source.authors
    : Array.isArray(source.metadata?.authors)
      ? source.metadata.authors
      : []
  return authors.map(String).filter(Boolean).join(', ') || t('library.unknownAuthor')
}

async function fetchApprovedSources() {
  const parsedSearch = parseDoiSearchInput(searchQuery.value)
  if (parsedSearch.error) {
    searchValidationErrorCode.value = 'invalid_doi'
    hasErrorSources.value = false
    isLoadingSources.value = false
    sources.value = []
    pagination.value = { page: 1, limit: 12, total: 0, pages: 1 }
    return
  }

  searchValidationErrorCode.value = null
  const requestId = ++sourceListRequestId
  sourceListAbortController?.abort()
  sourceListAbortController = new AbortController()
  isLoadingSources.value = true
  hasErrorSources.value = false
  try {
    const res = await getApprovedSources({
      ...(parsedSearch.doi ? { doi: parsedSearch.doi } : {}),
      page: currentPage.value,
      limit: 12,
    }, sourceListAbortController.signal)
    if (requestId !== sourceListRequestId) return
    sources.value = res.items
    pagination.value = res.pagination
  } catch (error) {
    if (
      requestId !== sourceListRequestId
      || (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_CANCELED')
    ) return
    hasErrorSources.value = true
    settingsStore.showToast(getApiErrorMessage(error, t('library.local.listLoadError')), 'error')
  } finally {
    if (requestId === sourceListRequestId) {
      isLoadingSources.value = false
    }
  }
}

function changePage(page: number) {
  currentPage.value = page
  fetchApprovedSources()
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null
let sourceListAbortController: AbortController | null = null
let sourceListRequestId = 0

watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  sourceListAbortController?.abort()
  sourceListRequestId += 1
  searchValidationErrorCode.value = null
  isLoadingSources.value = true
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchApprovedSources()
  }, 350)
})

onMounted(() => {
  fetchApprovedSources()
})

onBeforeUnmount(() => {
  if (searchTimeout) clearTimeout(searchTimeout)
  sourceListAbortController?.abort()
  sourceListRequestId += 1
})

const showDeleteConfirm = ref(false)
const sourceToDelete = ref<ApprovedSourceCatalogItem | null>(null)
const isDeleting = ref(false)

function promptDelete(source: ApprovedSourceCatalogItem) {
  sourceToDelete.value = source
  showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
  if (!sourceToDelete.value) return
  isDeleting.value = true
  try {
    const { data } = await apiClient.delete(`/moderation/sources/${sourceToDelete.value._id}`)
    if (data.success) {
      if (data.warnings && data.warnings.length > 0) {
        settingsStore.showToast(t('library.local.deleteWarnings', { warnings: data.warnings.join(', ') }), 'success')
      } else {
        settingsStore.showToast(t('library.local.deleteSuccess'), 'success')
      }
      showDeleteConfirm.value = false
      sourceToDelete.value = null
      await fetchApprovedSources()
    }
  } catch (error) {
    settingsStore.showToast(getApiErrorMessage(error, t('library.local.deleteError')), 'error')
  } finally {
    isDeleting.value = false
  }
}


const showModal = ref(false)
</script>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: var(--space-6);
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-6);
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

/* Intro card styling */
.library-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-10) var(--space-6);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-top: var(--space-4);
}

.library-intro__icon {
  font-size: 40px;
  margin-bottom: var(--space-4);
}

.library-intro__title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.library-intro__desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  max-width: 520px;
  line-height: var(--line-height-relaxed);
  margin-bottom: var(--space-6);
}

/* Modal and wizard style overrides */
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
  width: 540px;
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

.modal-header__title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.modal-back-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  cursor: pointer;
  padding: 0;
}

.modal-back-btn:hover {
  color: var(--color-text-primary);
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

.step-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

/* Grid layout for step 1 options */
.wizard-options {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}

.wizard-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: var(--space-4);
  background: var(--color-bg-surface, #1e1e1e);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.wizard-option:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: #4a4a4a;
}

.wizard-option__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: 4px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.wizard-option__desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

.wizard-option--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.badge-upcoming {
  font-size: 10px;
  background: #2a1e08;
  color: #f59e0b;
  border: 1px solid #3d2d10;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-weight: normal;
  text-transform: uppercase;
}

/* Form layouts */
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
}

/* Preview key-value grid */
.preview-prompt {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: var(--space-4);
  border-left: 2px solid var(--color-primary);
  padding-left: var(--space-2);
}

.preview-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: #1e1e1e;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.preview-warning-alert {
  font-size: var(--font-size-xs, 0.75rem);
  color: #f59e0b;
  background: #2a1e08;
  border: 1px solid #3d2d10;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  line-height: var(--line-height-normal);
}

.preview-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: var(--space-3);
  align-items: flex-start;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}

.preview-label {
  color: var(--color-text-muted);
  font-weight: var(--font-weight-medium);
}

.preview-value {
  color: var(--color-text-primary);
  word-break: break-all;
}

.preview-value--bold {
  font-weight: var(--font-weight-bold);
}

.preview-link {
  color: var(--color-primary, #60a5fa);
  text-decoration: none;
}

.preview-link:hover {
  text-decoration: underline;
}

.code-font {
  font-family: var(--font-family-mono, monospace);
  font-size: var(--font-size-xs);
}

.tag-value {
  font-size: var(--font-size-xs);
  background: var(--color-bg-elevated);
  padding: 2px 6px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  width: fit-content;
}

/* Verification state badges inside preview */
.badge-status {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  width: fit-content;
  border: 1px solid transparent;
}

.badge-status--verified {
  background: #0e2a1c;
  color: #4ade80;
  border-color: #1a3d2e;
}

.badge-status--unverified {
  background: #2a1e08;
  color: #f59e0b;
  border-color: #3d2d10;
}

/* Modal fade animations */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.18s ease; }
.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container          { transition: transform 0.18s ease, opacity 0.18s ease; }
.modal-fade-enter-from { opacity: 0; }
.modal-fade-leave-to   { opacity: 0; }
.modal-fade-enter-from .modal-container { transform: translateY(12px); opacity: 0; }
.modal-fade-leave-to   .modal-container { transform: translateY(12px); opacity: 0; }

/* Catalog Section Styles */
.catalog-section {
  display: flex;
  flex-direction: column;
  margin-top: var(--space-8);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-6);
}

.catalog-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

@media (max-width: 768px) {
  .catalog-header-row {
    flex-direction: column;
    align-items: stretch;
  }
}

.catalog-header-text {
  flex: 1;
}

.catalog-section-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.catalog-section-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.catalog-search {
  width: 300px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .catalog-search {
    width: 100%;
  }
}

/* Catalog Card list grid */
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: var(--space-5);
  margin-bottom: var(--space-8);
}

.catalog-card {
  background: var(--color-bg-surface, #1e1e1e);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  cursor: pointer;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.catalog-card:hover {
  border-color: #3a3a3a;
  background-color: var(--color-bg-hover, #262626);
}
.catalog-card__footer-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  margin-top: auto;
  padding-top: var(--space-2);
}
.catalog-card__read-cta {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-primary) 58%, transparent);
  text-underline-offset: 3px;
  transition: color var(--transition-fast), text-decoration-color var(--transition-fast);
}
.catalog-card:hover .catalog-card__read-cta {
  color: var(--color-text-primary);
  text-decoration-color: currentColor;
}
.delete-source-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border: 0;
  background: transparent;
  color: #ed4956;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.delete-source-btn:hover { opacity: 0.72; }

.catalog-card__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: var(--line-height-normal);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.catalog-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  flex: 1;
}

.meta-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  color: var(--color-text-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: var(--font-weight-semibold);
}

.meta-value {
  color: var(--color-text-primary);
  word-break: break-all;
}

.meta-link {
  color: var(--color-primary, #60a5fa);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  width: fit-content;
}

.meta-link:hover {
  text-decoration: underline;
}

.catalog-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

/* Loading, Error and Empty states */
.catalog-loading,
.catalog-error,
.catalog-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-10) var(--space-6);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-8);
}

.catalog-loading {
  gap: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.catalog-loading .spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--color-text-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.catalog-empty__icon {
  font-size: 36px;
  margin-bottom: var(--space-3);
}

.catalog-empty__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.catalog-empty__desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  max-width: 320px;
  line-height: var(--line-height-relaxed);
}

/* Pagination */
.catalog-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.catalog-pagination .pagination-btn {
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

.catalog-pagination .pagination-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: #3a3a3a;
}

.catalog-pagination .pagination-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.catalog-pagination .pagination-info {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.catalog-card__footer-note {
  font-size: var(--font-size-xs, 0.75rem);
  color: var(--color-text-muted, #8e8e93);
  font-style: italic;
  margin-top: auto;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

/* ── Refactored Library Styles ──────────────────────────────────────── */
.library-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-5);
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .library-header-row {
    flex-direction: column;
    align-items: stretch;
  }

  .library-header-right {
    flex-wrap: wrap;
  }
}

@media (max-width: 600px) {
  .catalog-grid {
    gap: 12px;
    margin-bottom: 24px;
  }

  .catalog-card {
    gap: 12px;
    padding: 14px;
  }

  .library-tabs {
    margin-bottom: 16px;
    scrollbar-width: none;
  }

  .library-tabs::-webkit-scrollbar {
    display: none;
  }

  .library-tab {
    min-height: 44px;
    flex: 0 0 auto;
  }

  .catalog-pagination {
    gap: 10px;
  }

  .catalog-pagination .pagination-btn {
    min-height: 42px;
    padding-right: 12px;
    padding-left: 12px;
  }
}

.library-header-left {
  flex: 1;
}

.library-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.moderator-btn-link {
  text-decoration: none;
}

.library-search-row {
  margin-bottom: var(--space-5);
  width: 100%;
}

.library-search-row .catalog-search {
  width: 100%;
}

/* Tabs */
.library-tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-6);
  overflow-x: auto;
  padding-bottom: 1px;
}

.library-tab {
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

.library-tab:hover {
  color: var(--color-text-secondary);
}

.library-tab--active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.catalog-card__heading {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-3);
}

.catalog-card__source-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #73b8ff;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.28);
  border-radius: var(--radius-sm);
}

.catalog-card__source-icon--pdf {
  color: #ff7d88;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.28);
}

.catalog-card__source-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Future Reading Progress styles */
.catalog-card__progress-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
}

.progress-bar-bg {
  height: 4px;
  background: var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
}

.progress-text {
  font-size: 10px;
  color: var(--color-text-muted);
}

/* File input and dropzone styling */
.file-select-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.file-dropzone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  text-align: center;
  background: #141416;
  cursor: pointer;
  position: relative;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.file-dropzone:hover {
  border-color: var(--color-primary);
  background-color: var(--color-bg-hover);
}

.file-dropzone--has-file {
  border-color: #4ade80;
  background-color: rgba(74, 222, 128, 0.05);
}

.file-dropzone--error {
  border-color: #ed4956;
  background-color: rgba(237, 73, 86, 0.05);
}

.file-input-hidden {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.file-dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  pointer-events: none;
}

.file-icon {
  color: var(--color-text-muted);
}

.file-dropzone--has-file .file-icon {
  color: #4ade80;
}

.file-info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  word-break: break-all;
}

.file-size {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.file-prompt-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.pdf-upload-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Warnings modification */
.preview-warning-alert--info {
  color: #60a5fa;
  background: #0f172a;
  border-color: #1e3a8a;
}

.preview-warning-alert--warning {
  color: #fbbf24;
  background: #1c1917;
  border-color: #451a03;
}

.preview-warning-alert--danger {
  color: #f87171;
  background: #1a0f0f;
  border-color: #450a0a;
}
</style>
