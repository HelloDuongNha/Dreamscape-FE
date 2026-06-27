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
        <p>Đang tải danh sách nguồn...</p>
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
        <div v-for="source in sources" :key="source._id" class="source-card">
          <!-- Card Header -->
          <div class="source-card__header">
            <h4 class="source-card__title">
              {{ source.metadata?.title || 'Tài liệu không có tiêu đề' }}
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
            <div class="grid-item">
              <span class="grid-label">Người gửi:</span>
              <span class="grid-value user-info-row">
                <span
                  v-if="source.submittedBy?.avatar"
                  class="user-avatar-mini"
                  :style="{ backgroundImage: `url(${source.submittedBy.avatar})` }"
                ></span>
                <span class="user-display-name">
                  {{ source.submittedBy?.display_name || source.submittedBy?.username || 'Ẩn danh' }}
                </span>
                <span v-if="source.submittedBy?.email" class="user-email-text">
                  ({{ source.submittedBy.email }})
                </span>
              </span>
            </div>
            <div v-if="source.submittedNote" class="grid-item grid-item--full">
              <span class="grid-label">Ghi chú đóng góp:</span>
              <p class="grid-value note-box">{{ source.submittedNote }}</p>
            </div>
            <div class="grid-item">
              <span class="grid-label">Quyền sử dụng:</span>
              <div class="grid-value">
                <AppStatusBadge :status="source.reviewStatus === 'pending' ? 'pending_allowed_use' : (source.allowedUse || 'metadata_only')" kind="allowedUse" :is-uploaded-pdf="!!source.originalFile" />
              </div>
            </div>
            <div class="grid-item">
              <span class="grid-label">Trạng thái bản quyền:</span>
              <div class="grid-value">
                <AppStatusBadge :status="source.reviewStatus === 'pending' ? 'pending_copyright' : (source.copyrightStatus || 'paywalled')" kind="copyright" :is-uploaded-pdf="!!source.originalFile" />
              </div>
            </div>
            <div class="grid-item">
              <span class="grid-label">Xác thực:</span>
              <div class="grid-value">
                <AppStatusBadge :status="source.reviewStatus === 'pending' ? 'pending_verification' : (source.verificationStatus || 'unverified')" kind="verification" :is-uploaded-pdf="!!source.originalFile" />
              </div>
            </div>
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
                  <a
                    v-if="source.originalFile.cloudinarySecureUrl"
                    :href="source.originalFile.cloudinarySecureUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="pdf-action-btn pdf-action-btn--primary"
                  >
                    Mở PDF ↗
                  </a>
                  <a
                    v-if="source.originalFile.cloudinarySecureUrl"
                    :href="source.originalFile.cloudinarySecureUrl"
                    download
                    class="pdf-action-btn pdf-action-btn--secondary"
                  >
                    Tải PDF
                  </a>
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
          Trang {{ pagination.page }} / {{ pagination.pages }} (Tổng: {{ pagination.total }} nguồn)
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
                <strong>{{ selectedSource?.metadata?.title || 'Tài liệu không có tiêu đề' }}</strong>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/store/useSettingsStore'
import { getModerationSources, reviewSource, type SourceContribution } from '@/api/moderationApi'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppStatusBadge from '@/components/common/AppStatusBadge.vue'

const settingsStore = useSettingsStore()

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
const activeStatus = ref<'pending' | 'approved' | 'rejected'>('pending')
const currentPage = ref(1)

const sources = ref<SourceContribution[]>([])
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

const tabs = [
  { status: 'pending' as const, label: 'Chờ duyệt' },
  { status: 'approved' as const, label: 'Đã duyệt' },
  { status: 'rejected' as const, label: 'Từ chối' },
]

const activeTabLabel = computed(() => {
  return tabs.find(t => t.status === activeStatus.value)?.label ?? ''
})

async function fetchSources() {
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

function changeTab(status: 'pending' | 'approved' | 'rejected') {
  activeStatus.value = status
  currentPage.value = 1
  fetchSources()
}

function changePage(page: number) {
  currentPage.value = page
  fetchSources()
}

function openReviewModal(source: SourceContribution, action: 'approved' | 'rejected') {
  selectedSource.value = source
  reviewAction.value = action
  reviewNote.value = ''
  showReviewModal.value = true
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
</style>
