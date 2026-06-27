<template>
  <div class="settings-section">
    <div class="library-header-row">
      <div class="library-header-left">
        <h2 class="settings-section__title">Thư viện</h2>
        <p class="settings-section__desc">
          Đọc và tra cứu tài liệu nghiên cứu, sách tham khảo, và các nguồn dữ liệu khoa học đã được xác thực về giấc mơ.
        </p>
      </div>
      <div class="library-header-right">
        <!-- Moderator Link -->
        <RouterLink v-if="isModeratorUser" to="/moderation/sources" class="moderator-btn-link">
          <AppButton variant="secondary" size="sm">
            Duyệt nguồn
          </AppButton>
        </RouterLink>
        <AppButton id="open-wizard-btn" variant="primary" size="sm" @click="openWizard">
          + Đóng góp
        </AppButton>
      </div>
    </div>

    <!-- Search Input Row -->
    <div class="library-search-row">
      <div class="catalog-search">
        <AppInput
          id="catalog-search-input"
          v-model="searchQuery"
          placeholder="Tìm kiếm tiêu đề, tác giả, DOI, tạp chí..."
          maxlength="100"
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
        <p>Đang tải danh sách tài liệu...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="hasErrorSources" class="catalog-error">
        <p>Không thể tải danh sách tài liệu học thuật.</p>
        <AppButton variant="secondary" size="sm" @click="fetchApprovedSources">Tải lại</AppButton>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredSources.length === 0" class="catalog-empty">
        <div class="catalog-empty__icon" aria-hidden="true"></div>
        <h4 class="catalog-empty__title">Không tìm thấy tài liệu</h4>
        <p class="catalog-empty__desc">
          {{ searchQuery ? 'Không có tài liệu nào phù hợp với từ khóa của bạn.' : 'Thư viện chưa có tài liệu nào thuộc danh mục này.' }}
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
          <!-- Cover placeholder illustration area -->
          <div class="book-cover-placeholder">
            <span class="book-cover-tag">{{ source.metadata?.category || 'Nguồn học thuật' }}</span>
          </div>

          <!-- Title -->
          <h4 class="catalog-card__title">
            {{ source.title || 'Tài liệu không có tiêu đề' }}
          </h4>
          
          <!-- Metadata details -->
          <div class="catalog-card__meta">
            <div v-if="source.authors && source.authors.length > 0" class="meta-row">
              <span class="meta-label">Tác giả:</span>
              <span class="meta-value">{{ source.authors.join(', ') }}</span>
            </div>
            <div v-if="source.year" class="meta-row">
              <span class="meta-label">Năm XB:</span>
              <span class="meta-value">{{ source.year }}</span>
            </div>
            <div v-if="source.journal" class="meta-row">
              <span class="meta-label">Tạp chí / Nhà XB:</span>
              <span class="meta-value">{{ source.journal }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Định danh:</span>
              <span class="meta-value code-font">{{ source.doi ? `DOI: ${source.doi}` : ((source.sourceOrigin === 'uploaded_pdf' || !!source.originalFile) ? 'Tệp PDF được tải lên' : 'Liên kết nguồn') }}</span>
            </div>
            <div v-if="source.url && !(source.sourceOrigin === 'uploaded_pdf' || !!source.originalFile)" class="meta-row">
              <span class="meta-label">Liên kết:</span>
              <a :href="source.url" target="_blank" rel="noopener noreferrer" class="meta-link" @click.stop>
                Xem tài liệu gốc ↗
              </a>
            </div>
          </div>

          <!-- Badges -->
          <div class="catalog-card__badges">
            <AppStatusBadge :status="source.allowedUse || 'metadata_only'" kind="allowedUse" :source-type="resolveSourceType(source)" :full-text-source-type="source.fullTextSourceType" />
            <AppStatusBadge :status="source.verificationStatus || 'unverified'" kind="verification" :source-type="resolveSourceType(source)" :full-text-source-type="source.fullTextSourceType" />
            <AppStatusBadge :status="source.copyrightStatus || 'paywalled'" kind="copyright" :source-type="resolveSourceType(source)" :full-text-source-type="source.fullTextSourceType" />
            <AppStatusBadge :status="source.fullTextStatus || 'none'" kind="fullTextStatus" :source-type="resolveSourceType(source)" :full-text-source-type="source.fullTextSourceType" />
          </div>

          <!-- Future Reading Progress (Future Use Placeholder) -->
          <div v-if="source.progress !== undefined" class="catalog-card__progress-container">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" :style="{ width: `${source.progress}%` }"></div>
            </div>
            <span class="progress-text">Đã đọc {{ source.progress }}%</span>
          </div>

          <!-- Muted Footnote & Moderator Action -->
          <div class="catalog-card__footer-container" style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-4);">
            <div class="catalog-card__footer-note" style="margin-top: 0;">
              Xem chi tiết tài liệu
            </div>
            <button
              v-if="isModeratorUser"
              class="delete-source-btn"
              style="background: transparent; border: none; color: #ed4956; padding: 4px; cursor: pointer; display: flex; align-items: center; transition: opacity 0.2s;"
              @click.stop="promptDelete(source)"
              title="Xóa tài liệu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
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
          Trước
        </button>
        <span class="pagination-info">
          Trang {{ pagination.page }} / {{ pagination.pages }} (Tổng: {{ pagination.total }})
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


    <!-- Wizard Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showModal"
          id="contribution-wizard-modal"
          class="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Đóng góp tài liệu học thuật"
          @click.self="closeWizard"
        >
          <div class="modal-container" tabindex="-1">
            <!-- Modal Header -->
            <div class="modal-header">
              <div class="modal-header__title-wrap">
                <button
                  v-if="step > 1"
                  class="modal-back-btn"
                  aria-label="Quay lại"
                  @click="goBack"
                >
                  ←
                </button>
                <h3 class="modal-header__title">
                  {{ stepTitle }}
                </h3>
              </div>
              <button
                id="modal-close-btn"
                class="modal-close-btn"
                aria-label="Đóng"
                @click="closeWizard"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <!-- Modal Content Area -->
            <div class="modal-body">
              <!-- Step 1: Selection -->
              <div v-if="step === 1" class="wizard-step-1">
                <p class="step-desc" style="margin-bottom: var(--space-3); font-weight: var(--font-weight-medium); color: var(--color-text-secondary);">
                  Tài liệu đóng góp sẽ được lưu dưới dạng yêu cầu chờ duyệt. Sau khi được kiểm duyệt bởi điều hành viên, tài liệu sẽ xuất hiện tại danh mục Thư viện chính thức.
                </p>
                <p class="step-desc">Chọn hình thức tài liệu bạn muốn đóng góp:</p>
                <div class="wizard-options">
                  <button class="wizard-option" @click="selectType('doi')">
                    <span class="wizard-option__title">DOI (Mã định danh số)</span>
                    <span class="wizard-option__desc">Dùng cho bài báo khoa học chính thức.</span>
                  </button>
                  <button class="wizard-option" @click="selectType('url')">
                    <span class="wizard-option__title">Liên kết bài viết (URL)</span>
                    <span class="wizard-option__desc">Dùng cho trang web bài viết hoặc PDF online.</span>
                  </button>
                  <button class="wizard-option" @click="selectType('pdf')">
                    <span class="wizard-option__title">Tải lên tệp PDF</span>
                    <span class="wizard-option__desc">Tải lên tệp PDF toàn văn trực tiếp từ máy (tối đa 25MB).</span>
                  </button>
                  <button class="wizard-option" @click="selectType('isbn')">
                    <span class="wizard-option__title">ISBN / Sách</span>
                    <span class="wizard-option__desc">Nhập mã ISBN để đóng góp thông tin sách học thuật.</span>
                  </button>
                </div>
              </div>

              <!-- Step 2: Form Inputs -->
              <div v-else-if="step === 2" class="wizard-step-2">
                <div class="form-fields">
                  <!-- DOI input -->
                  <AppInput
                    v-if="contribType === 'doi'"
                    id="input-doi"
                    v-model="doi"
                    label="DOI"
                    placeholder="Ví dụ: 10.3389/fpsyg.2016.00332"
                    :error="doiError"
                    maxlength="100"
                    required
                  />

                  <!-- URL input -->
                  <AppInput
                    v-if="contribType === 'url'"
                    id="input-url"
                    v-model="url"
                    label="Link tài liệu"
                    placeholder="Ví dụ: https://example.com/sleep-study.pdf"
                    :error="urlError"
                    maxlength="500"
                    required
                  />

                  <!-- ISBN input -->
                  <AppInput
                    v-if="contribType === 'isbn'"
                    id="input-isbn"
                    v-model="isbn"
                    label="ISBN"
                    placeholder="Ví dụ: 978-0-19-852442-7 hoặc 019852442X"
                    :error="isbnError"
                    maxlength="50"
                    required
                  />

                  <!-- PDF upload selection & optional fields -->
                  <div v-if="contribType === 'pdf'" class="pdf-upload-fields">
                    <div class="file-select-container">
                      <label class="app-input__label">Tệp PDF tài liệu <span style="color: var(--color-error, #ed4956);">*</span></label>
                      <div class="file-dropzone" :class="{ 'file-dropzone--has-file': !!selectedFile, 'file-dropzone--error': !!pdfFileError }">
                        <input
                          id="input-pdf-file"
                          type="file"
                          accept=".pdf"
                          class="file-input-hidden"
                          @change="onFileChange"
                        />
                        <div class="file-dropzone-content">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="file-icon" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                          </svg>
                          <div v-if="selectedFile" class="file-info-text">
                            <span class="file-name">{{ selectedFile.name }}</span>
                            <span class="file-size">({{ formatBytes(selectedFile.size) }})</span>
                          </div>
                          <div v-else class="file-prompt-text">
                            Kéo thả hoặc nhấp để chọn tệp PDF (Tối đa 25MB)
                          </div>
                        </div>
                      </div>
                      <span v-if="pdfFileError" class="app-input__error" style="display: block; margin-top: 4px;">{{ pdfFileError }}</span>
                    </div>

                    <div style="margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4);">
                      <p style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-weight: var(--font-weight-semibold); text-transform: uppercase; margin-bottom: 2px;">
                        Thông tin tài liệu (Không bắt buộc)
                      </p>
                      
                      <AppInput
                        id="input-pdf-title"
                        v-model="pdfTitle"
                        label="Tiêu đề tài liệu"
                        placeholder="Ví dụ: Dream analysis and neurobiology"
                        maxlength="200"
                      />

                      <AppInput
                        id="input-pdf-authors"
                        v-model="pdfAuthors"
                        label="Các tác giả"
                        placeholder="Nguyễn Văn A, Trần Thị B (phân tách bằng dấu phẩy)"
                        maxlength="200"
                      />

                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                        <AppInput
                          id="input-pdf-year"
                          v-model="pdfYear"
                          label="Năm xuất bản"
                          placeholder="Ví dụ: 2024"
                          maxlength="4"
                        />
                        <AppInput
                          id="input-pdf-journal"
                          v-model="pdfJournal"
                          label="Tạp chí / Nhà XB"
                          placeholder="Ví dụ: Nature"
                          maxlength="150"
                        />
                      </div>

                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                        <AppInput
                          id="input-pdf-doi"
                          v-model="pdfDoi"
                          label="Mã DOI liên kết"
                          placeholder="Ví dụ: 10.1000/xyz123"
                        />
                        <AppInput
                          id="input-pdf-url"
                          v-model="pdfUrl"
                          label="Link nguồn liên kết"
                          placeholder="Ví dụ: https://doi.org/..."
                        />
                      </div>
                    </div>
                  </div>

                  <!-- General Note input -->
                  <AppInput
                    id="input-note"
                    v-model="submittedNote"
                    type="textarea"
                    label="Ghi chú đóng góp"
                    placeholder="Giải thích vì sao tài liệu này liên quan đến giấc mơ (Không bắt buộc)..."
                    :error="noteError"
                    maxlength="1000"
                    :rows="3"
                  />
                </div>

                <div class="wizard-actions">
                  <AppButton
                    id="search-metadata-btn"
                    variant="smart"
                    size="md"
                    :disabled="!isInputValid || isFetchingPreview"
                    :loading="isFetchingPreview"
                    @click="fetchPreview"
                  >
                    {{ contribType === 'pdf' ? 'Xem trước đóng góp' : 'Tìm tài liệu' }}
                  </AppButton>
                </div>
              </div>

              <!-- Step 3: Metadata Preview -->
              <div v-else-if="step === 3 && previewData" class="wizard-step-3">
                <p class="preview-prompt">Đây có phải tài liệu bạn muốn gửi không?</p>
                
                <div class="preview-grid">
                  <div class="preview-row">
                    <span class="preview-label">Tiêu đề:</span>
                    <span class="preview-value preview-value--bold">{{ previewData.title }}</span>
                  </div>
                  <div v-if="previewData.authors && previewData.authors.length > 0" class="preview-row">
                    <span class="preview-label">Tác giả:</span>
                    <span class="preview-value">{{ previewData.authors.join(', ') }}</span>
                  </div>
                  <div v-if="previewData.year" class="preview-row">
                    <span class="preview-label">Năm xuất bản:</span>
                    <span class="preview-value">{{ previewData.year }}</span>
                  </div>
                  <div v-if="previewData.journal" class="preview-row">
                    <span class="preview-label">Tạp chí / Nhà XB:</span>
                    <span class="preview-value">{{ previewData.journal }}</span>
                  </div>
                  <div v-if="previewData.doi" class="preview-row">
                    <span class="preview-label">DOI:</span>
                    <span class="preview-value code-font">{{ previewData.doi }}</span>
                  </div>
                  <div v-if="previewData.isbn" class="preview-row">
                    <span class="preview-label">ISBN:</span>
                    <span class="preview-value code-font">{{ previewData.isbn }}</span>
                  </div>
                  <div v-if="previewData.url" class="preview-row">
                    <span class="preview-label">Liên kết URL:</span>
                    <a :href="previewData.url" target="_blank" rel="noopener noreferrer" class="preview-value preview-link">{{ previewData.url }}</a>
                  </div>
                  <div v-if="previewData.fileName" class="preview-row">
                    <span class="preview-label">Tên tệp:</span>
                    <span class="preview-value">{{ previewData.fileName }}</span>
                  </div>
                  <div v-if="previewData.fileSize" class="preview-row">
                    <span class="preview-label">Dung lượng:</span>
                    <span class="preview-value">{{ formatBytes(previewData.fileSize) }}</span>
                  </div>
                  <div class="preview-row">
                    <span class="preview-label">Nguồn dữ liệu:</span>
                    <span class="preview-value tag-value">
                      {{ 
                        previewData.sourceProvider === 'pdf_upload'
                          ? 'Tải lên PDF trực tiếp'
                          : previewData.metadataProvider === 'crossref'
                          ? 'Crossref API'
                          : previewData.metadataProvider === 'open_library'
                          ? 'Open Library (ISBN)'
                          : previewData.metadataProvider === 'google_books'
                          ? 'Google Books (ISBN)'
                          : 'Phân tích liên kết trực tiếp'
                      }}
                    </span>
                  </div>
                  <div class="preview-row">
                    <span class="preview-label">Trạng thái xác thực:</span>
                    <span v-if="contribType === 'pdf'" class="preview-value badge-status badge-status--unverified">
                      Chờ kiểm tra thủ công
                    </span>
                    <span v-else :class="['preview-value', 'badge-status', previewData.verificationStatus === 'verified_doi' ? 'badge-status--verified' : 'badge-status--unverified']">
                      {{ 
                        previewData.verificationStatus === 'verified_doi' 
                          ? 'Đã xác thực DOI' 
                          : 'Chưa xác thực' 
                      }}
                    </span>
                  </div>
                  <div class="preview-row">
                    <span class="preview-label">Trạng thái Open Access:</span>
                    <span v-if="contribType === 'pdf'" class="preview-value">Chờ duyệt</span>
                    <span v-else class="preview-value code-font">{{ previewData.oaStatus || 'closed' }}</span>
                  </div>
                  <div class="preview-row">
                    <span class="preview-label">Giấy phép bản quyền:</span>
                    <span v-if="contribType === 'pdf'" class="preview-value">Chưa xác minh</span>
                    <span v-else class="preview-value code-font">{{ previewData.license || 'all-rights-reserved' }}</span>
                  </div>
                  <div class="preview-row">
                    <span class="preview-label">Quyền sử dụng:</span>
                    <span v-if="contribType === 'pdf'" class="preview-value">Chờ duyệt / chỉ metadata tạm thời</span>
                    <span v-else class="preview-value">
                      <AppStatusBadge :status="previewData.allowedUse || 'metadata_only'" kind="allowedUse" :source-type="resolveSourceType(previewData)" :full-text-source-type="previewData.fullTextSourceType" />
                    </span>
                  </div>
                  <div class="preview-row">
                    <span class="preview-label">Trạng thái bản quyền:</span>
                    <span v-if="contribType === 'pdf'" class="preview-value">Cần moderator kiểm tra</span>
                    <span v-else class="preview-value">
                      <AppStatusBadge :status="previewData.copyrightStatus || 'paywalled'" kind="copyright" :source-type="resolveSourceType(previewData)" :full-text-source-type="previewData.fullTextSourceType" />
                    </span>
                  </div>
                  <div class="preview-row">
                    <span class="preview-label">Trạng thái bản đọc:</span>
                    <span v-if="contribType === 'pdf'" class="preview-value">PDF người dùng cung cấp — chờ kiểm tra quyền sử dụng</span>
                    <span v-else class="preview-value">
                      <AppStatusBadge :status="previewData.fullTextStatus || 'none'" kind="fullTextStatus" :source-type="resolveSourceType(previewData)" :full-text-source-type="previewData.fullTextSourceType" />
                    </span>
                  </div>
                </div>

                <!-- Vietnamese User-Facing Warnings alert boxes -->
                <div v-if="previewData.allowedUse === 'metadata_only' && contribType !== 'pdf'" class="preview-warning-alert preview-warning-alert--info">
                  * Nguồn này chỉ có metadata, chưa có toàn văn để nhập.
                </div>

                <div v-if="hasSsrfWarning" class="preview-warning-alert preview-warning-alert--danger">
                  * URL bị chặn bởi kiểm tra an toàn SSRF. Không tắt bảo vệ này.
                </div>

                <div v-if="has403Warning" class="preview-warning-alert preview-warning-alert--warning">
                  * Máy chủ tài liệu trả về 403. Hãy upload PDF thủ công nếu bạn có quyền sử dụng.
                </div>

                <div v-if="contribType === 'isbn'" class="preview-warning-alert preview-warning-alert--info">
                  * ISBN chỉ cung cấp metadata sách, không tự động lấy toàn văn.
                </div>

                <div v-if="contribType === 'pdf'" class="preview-warning-alert preview-warning-alert--warning">
                  * PDF sẽ được tải lên khi bạn xác nhận gửi nguồn. Metadata và quyền sử dụng có thể cần kiểm tra thủ công.
                </div>

                <!-- Upload progress bar -->
                <div v-if="isSubmitting && contribType === 'pdf'" class="upload-progress-container" style="margin-bottom: var(--space-4);">
                  <div class="progress-bar-bg" style="height: 8px;">
                    <div class="progress-bar-fill" :style="{ width: `${uploadProgress}%` }"></div>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 4px;">
                    <span>Đang tải tệp lên...</span>
                    <span>{{ uploadProgress }}%</span>
                  </div>
                </div>

                <!-- Open Access available notice -->
                <div v-if="previewData.fullTextStatus === 'available' && contribType !== 'pdf'" class="preview-warning-alert">
                  * Tài liệu này có bản đọc mở, tuy nhiên hệ thống sẽ chờ quản trị viên duyệt trước khi có thể đọc trực tiếp.
                </div>

                <!-- Duplicate DOI alert with direct redirect link -->
                <div v-if="duplicateSourceId" class="preview-warning-alert preview-warning-alert--danger" style="margin-top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-start;">
                  <span>* {{ duplicateSourceError || 'Tài liệu đã tồn tại trong hệ thống.' }}</span>
                  <router-link
                    :to="`/library/sources/${duplicateSourceId}`"
                    class="pdf-action-btn pdf-action-btn--primary"
                    style="display: inline-flex; text-decoration: none; text-align: center; margin-top: 4px;"
                    @click="closeWizard"
                  >
                    Mở tài liệu đã tồn tại
                  </router-link>
                </div>

                <div class="wizard-actions wizard-actions--split">
                  <AppButton
                    id="reject-preview-btn"
                    variant="secondary"
                    size="md"
                    :disabled="isSubmitting"
                    @click="step = 2"
                  >
                    Không đúng, nhập lại
                  </AppButton>
                  
                  <AppButton
                    id="confirm-submit-btn"
                    variant="smart"
                    size="md"
                    :disabled="isSubmitting"
                    :loading="isSubmitting"
                    @click="submitContribution"
                  >
                    Đúng, gửi nguồn này
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <!-- AppConfirm Deletion Dialog -->
    <AppConfirm
      v-model="showDeleteConfirm"
      title="Xóa tài liệu học thuật"
      message="Thao tác này sẽ xóa vĩnh viễn tài liệu, bản đọc đã nhập, phân đoạn RAG, các luật phân tích đã trích xuất và bằng chứng liên kết. Bạn có chắc chắn không?"
      confirm-label="Xóa"
      cancel-label="Hủy"
      :danger="true"
      :loading="isDeleting"
      @confirm="handleDeleteConfirm"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { resolveSourceType } from '@/utils/sourceTypeHelper'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { previewSource, contributeSource, contributePdfSource, getApprovedSources } from '@/api/sourceApi'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppStatusBadge from '@/components/common/AppStatusBadge.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import apiClient from '@/api/client'

const router = useRouter()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()

// Moderator check
const isModeratorUser = computed(() => {
  const allowlist = (import.meta.env.VITE_MODERATOR_USER_IDS || '').split(',')
  const myId = authStore.user?._id
  return !!(myId && allowlist.map((id: string) => id.trim().toLowerCase()).includes(myId.toLowerCase()))
})

// Category filter tabs
const activeTab = ref('all')
const categoryTabs = [
  { id: 'all', label: 'Tất cả' },
  { id: 'science', label: 'Khoa học' },
  { id: 'psychology', label: 'Tâm lý' },
  { id: 'symbol', label: 'Biểu tượng' },
  { id: 'culture', label: 'Văn hóa' },
  { id: 'community', label: 'Cộng đồng' },
]

// Approved Sources catalog states
const isLoadingSources = ref(false)
const hasErrorSources = ref(false)
const searchQuery = ref('')
const sources = ref<any[]>([])
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
  return sources.value.filter((source) => {
    const category = (source.metadata?.category || '').toLowerCase()
    const title = (source.title || '').toLowerCase()
    const journal = (source.journal || '').toLowerCase()
    const txt = `${title} ${journal}`

    if (activeTab.value === 'science') {
      return category === 'science' || category === 'khoa học' || 
             /sleep|neuro|brain|science|clinical|medical|biology|physiol|y học|khoa học|thần kinh/i.test(txt)
    }
    if (activeTab.value === 'psychology') {
      return category === 'psychology' || category === 'tâm lý' ||
             /psych|cognit|behavior|mental|therapy|tâm lý|hành vi|nhận thức/i.test(txt)
    }
    if (activeTab.value === 'symbol') {
      return category === 'symbol' || category === 'biểu tượng' ||
             /symbol|archetype|meaning|biểu tượng|mẫu gốc|giải mã/i.test(txt)
    }
    if (activeTab.value === 'culture') {
      return category === 'culture' || category === 'văn hóa' ||
             /cultur|myth|anthropo|history|văn hóa|thần thoại|lịch sử/i.test(txt)
    }
    if (activeTab.value === 'community') {
      return category === 'community' || category === 'cộng đồng' ||
             /communit|social|cộng đồng|xã hội/i.test(txt)
    }
    return false
  })
})

async function fetchApprovedSources() {
  isLoadingSources.value = true
  hasErrorSources.value = false
  try {
    const res = await getApprovedSources({
      q: searchQuery.value,
      page: currentPage.value,
      limit: 12,
    })
    sources.value = res.items
    pagination.value = res.pagination
  } catch (err: any) {
    hasErrorSources.value = true
    const errMsg = err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tải danh sách tài liệu.'
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isLoadingSources.value = false
  }
}

function changePage(page: number) {
  currentPage.value = page
  fetchApprovedSources()
}

let searchTimeout: any = null
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchApprovedSources()
  }, 350)
})

onMounted(() => {
  fetchApprovedSources()
})

const showDeleteConfirm = ref(false)
const sourceToDelete = ref<any>(null)
const isDeleting = ref(false)

function promptDelete(source: any) {
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
        settingsStore.showToast(`Xóa tài liệu thành công với cảnh báo: ${data.warnings.join(', ')}`, 'success')
      } else {
        settingsStore.showToast('Xóa tài liệu thành công.', 'success')
      }
      showDeleteConfirm.value = false
      sourceToDelete.value = null
      await fetchApprovedSources()
    }
  } catch (err: any) {
    console.error('Delete source error:', err)
    const errMsg = err.response?.data?.message || err.message || 'Không thể xóa tài liệu.'
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isDeleting.value = false
  }
}


const showModal = ref(false)
const step = ref(1)
const contribType = ref<'doi' | 'url' | 'pdf' | 'isbn' | null>(null)

const doi = ref('')
const url = ref('')
const isbn = ref('')
const submittedNote = ref('')

// PDF-specific states
const selectedFile = ref<File | null>(null)
const pdfFileError = ref('')
const pdfTitle = ref('')
const pdfAuthors = ref('')
const pdfYear = ref('')
const pdfJournal = ref('')
const pdfPublisher = ref('')
const pdfDoi = ref('')
const pdfUrl = ref('')
const uploadProgress = ref(0)
const duplicateSourceId = ref<string | null>(null)
const duplicateSourceError = ref<string | null>(null)

const isFetchingPreview = ref(false)
const isSubmitting = ref(false)
const previewData = ref<any>(null)

// Step titles
const stepTitle = computed(() => {
  if (step.value === 1) return 'Đóng góp nguồn học thuật'
  if (step.value === 2) {
    if (contribType.value === 'doi') return 'Nhập thông tin DOI'
    if (contribType.value === 'url') return 'Nhập liên kết nguồn'
    if (contribType.value === 'pdf') return 'Tải lên tài liệu PDF'
    if (contribType.value === 'isbn') return 'Nhập mã ISBN'
  }
  return 'Xác nhận thông tin tài liệu'
})

// DOI validation
const doiError = computed(() => {
  const d = doi.value.trim()
  if (step.value === 2 && contribType.value === 'doi') {
    if (!d) return 'Vui lòng điền mã DOI.'
    if (d.length > 100) return 'Mã DOI không được vượt quá 100 ký tự.'
    if (!d.startsWith('10.')) return 'Mã DOI phải bắt đầu bằng "10."'
    if (!d.includes('/')) return 'Mã DOI phải chứa ký tự phân tách "/"'
  }
  return ''
})

// URL validation
const urlError = computed(() => {
  const u = url.value.trim()
  if (step.value === 2 && contribType.value === 'url') {
    if (!u) return 'Vui lòng điền link nguồn.'
    if (u.length > 500) return 'URL nguồn không được vượt quá 500 ký tự.'
    if (!/^https?:\/\//i.test(u)) return 'URL phải bắt đầu bằng http:// hoặc https://'
  }
  return ''
})

// ISBN helper & validation
function normalizeIsbn(val: string): string {
  return val.replace(/[^0-9Xx]/g, '')
}

const isbnError = computed(() => {
  const raw = isbn.value.trim()
  if (step.value === 2 && contribType.value === 'isbn') {
    if (!raw) return 'Vui lòng điền mã ISBN.'
    const clean = normalizeIsbn(raw)
    if (clean.length !== 10 && clean.length !== 13) {
      return 'Mã ISBN phải có 10 hoặc 13 chữ số (chấp nhận ký tự X cuối đối với ISBN-10).'
    }
  }
  return ''
})

const noteError = computed(() => {
  const n = submittedNote.value.trim()
  if (n.length > 1000) return 'Ghi chú không được vượt quá 1000 ký tự.'
  return ''
})

// Input check for Step 2
const isInputValid = computed(() => {
  if (noteError.value) return false
  if (contribType.value === 'doi') {
    return doi.value.trim().length > 0 && !doiError.value
  }
  if (contribType.value === 'url') {
    return url.value.trim().length > 0 && !urlError.value
  }
  if (contribType.value === 'isbn') {
    return isbn.value.trim().length > 0 && !isbnError.value
  }
  if (contribType.value === 'pdf') {
    return !!selectedFile.value && !pdfFileError.value
  }
  return false
})

// Vietnamese warning computations for Step 3
const hasSsrfWarning = computed(() => {
  if (!previewData.value || !previewData.value.warnings) return false
  return previewData.value.warnings.some((w: string) => 
    w.toLowerCase().includes('ssrf') || 
    w.toLowerCase().includes('bị chặn')
  )
})

const has403Warning = computed(() => {
  if (!previewData.value || !previewData.value.warnings) return false
  return previewData.value.warnings.some((w: string) => 
    w.toLowerCase().includes('403')
  )
})

function onFileChange(event: any) {
  const file = event.target.files?.[0]
  if (!file) {
    selectedFile.value = null
    pdfFileError.value = 'Vui lòng chọn một tệp PDF.'
    return
  }
  
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'pdf') {
    selectedFile.value = null
    pdfFileError.value = 'Chỉ chấp nhận tệp có định dạng .pdf.'
    return
  }
  
  if (file.size > 25 * 1024 * 1024) {
    selectedFile.value = null
    pdfFileError.value = 'Kích thước tệp vượt quá giới hạn cho phép (25MB).'
    return
  }
  
  selectedFile.value = file
  pdfFileError.value = ''
}

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function openWizard() {
  showModal.value = true
  step.value = 1
  contribType.value = null
  doi.value = ''
  url.value = ''
  isbn.value = ''
  submittedNote.value = ''
  selectedFile.value = null
  pdfFileError.value = ''
  pdfTitle.value = ''
  pdfAuthors.value = ''
  pdfYear.value = ''
  pdfJournal.value = ''
  pdfPublisher.value = ''
  pdfDoi.value = ''
  pdfUrl.value = ''
  uploadProgress.value = 0
  previewData.value = null
}

function closeWizard() {
  showModal.value = false
  // Complete state cleanup to prevent leaks or stale states
  selectedFile.value = null
  pdfFileError.value = ''
  pdfTitle.value = ''
  pdfAuthors.value = ''
  pdfYear.value = ''
  pdfJournal.value = ''
  pdfPublisher.value = ''
  pdfDoi.value = ''
  pdfUrl.value = ''
  uploadProgress.value = 0
  isbn.value = ''
  doi.value = ''
  url.value = ''
  submittedNote.value = ''
  previewData.value = null
  duplicateSourceId.value = null
  duplicateSourceError.value = null
}

function goBack() {
  if (step.value > 1) {
    step.value -= 1
  }
}

function selectType(type: 'doi' | 'url' | 'pdf' | 'isbn') {
  contribType.value = type
  step.value = 2
}

async function fetchPreview() {
  if (!isInputValid.value) return

  if (contribType.value === 'pdf') {
    // Generate mock preview locally for uploaded PDF to defer file uploads to step 3 confirm
    const titleVal = pdfTitle.value.trim() || selectedFile.value?.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ') || 'Tài liệu PDF tải lên'
    const authorsArr = pdfAuthors.value.trim() ? pdfAuthors.value.split(',').map((a: string) => a.trim()).filter(Boolean) : []
    const yearNum = pdfYear.value ? parseInt(String(pdfYear.value), 10) : undefined

    previewData.value = {
      title: titleVal,
      authors: authorsArr,
      year: isNaN(Number(yearNum)) ? undefined : yearNum,
      journal: pdfJournal.value.trim() || undefined,
      publisher: pdfPublisher.value.trim() || undefined,
      doi: pdfDoi.value.trim() || undefined,
      url: pdfUrl.value.trim() || undefined,
      sourceProvider: 'pdf_upload',
      verificationStatus: 'manual',
      allowedUse: 'metadata_only',
      copyrightStatus: 'paywalled',
      fullTextStatus: 'available',
      fullTextUrl: '',
      fileName: selectedFile.value?.name || '',
      fileSize: selectedFile.value?.size || 0
    }
    step.value = 3
    return
  }

  isFetchingPreview.value = true
  
  try {
    const payload = {
      doi: contribType.value === 'doi' ? doi.value.trim() : undefined,
      url: contribType.value === 'url' ? url.value.trim() : undefined,
      isbn: contribType.value === 'isbn' ? normalizeIsbn(isbn.value) : undefined
    }
    
    const res = await previewSource(payload)
    if (res.success && res.data) {
      previewData.value = res.data
      step.value = 3
    }
  } catch (err: any) {
    let errMsg = 'Có lỗi xảy ra khi tìm tài liệu.'
    if (err.response) {
      const status = err.response.status
      if (status === 404) {
        errMsg = 'Không tìm thấy thông tin cho mã này.'
      } else if (status === 408) {
        errMsg = 'Yêu cầu phản hồi quá lâu, vui lòng thử lại sau.'
      } else if (status === 502) {
        errMsg = 'Không thể kết nối tới máy chủ lúc này, vui lòng thử lại sau.'
      } else {
        errMsg = err.response.data?.message || 'Không thể tìm thấy thông tin tài liệu. Vui lòng kiểm tra lại.'
      }
    } else {
      errMsg = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng.'
    }
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isFetchingPreview.value = false
  }
}

async function submitContribution() {
  if (!previewData.value) return
  isSubmitting.value = true
  
  try {
    if (contribType.value === 'pdf' && selectedFile.value) {
      uploadProgress.value = 0
      const payload = {
        doi: previewData.value.doi || undefined,
        url: previewData.value.url || undefined,
        title: previewData.value.title || undefined,
        authors: previewData.value.authors || undefined,
        year: previewData.value.year || undefined,
        journal: previewData.value.journal || undefined,
        publisher: previewData.value.publisher || undefined,
        submittedNote: submittedNote.value.trim() || undefined
      }
      
      const res = await contributePdfSource(
        selectedFile.value,
        payload,
        (progressEvent) => {
          if (progressEvent.total) {
            uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          }
        }
      )
      if (res.success) {
        settingsStore.showToast('PDF đã được tải lên, đang chờ duyệt nguồn.', 'success')
        closeWizard()
        await fetchApprovedSources()
      }
    } else {
      const payload = {
        doi: previewData.value.doi || undefined,
        url: previewData.value.url || undefined,
        isbn: previewData.value.isbn || undefined,
        submittedNote: submittedNote.value.trim() || undefined,
        metadata: previewData.value
      }
      
      const res = await contributeSource(payload)
      if (res.success) {
        settingsStore.showToast('Nguồn đã được gửi và đang chờ duyệt. Bạn sẽ nhận điểm đóng góp nếu nguồn được duyệt.', 'success')
        closeWizard()
        await fetchApprovedSources()
      }
    }
  } catch (err: any) {
    if (err.response && err.response.status === 409) {
      const data = err.response.data
      if (data && data.code === 'DUPLICATE_SOURCE' && data.existingSourceId) {
        duplicateSourceId.value = data.existingSourceId
        duplicateSourceError.value = data.message || 'Nguồn này đã tồn tại trong hệ thống.'
        settingsStore.showToast(duplicateSourceError.value || 'Nguồn này đã tồn tại trong hệ thống.', 'error')
      } else {
        settingsStore.showToast('Nguồn này đã được gửi hoặc đã tồn tại trong hệ thống.', 'error')
      }
    } else {
      const errMsg = err.response?.data?.message || 'Có lỗi xảy ra khi đóng góp nguồn.'
      settingsStore.showToast(errMsg, 'error')
    }
  } finally {
    isSubmitting.value = false
  }
}
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
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
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

/* Cover placeholder design */
.book-cover-placeholder {
  height: 120px;
  background: #141416;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  margin-bottom: var(--space-2);
}

.book-cover-icon {
  font-size: 2.2rem;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
}

.book-cover-tag {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: var(--color-bg-sidebar, #0a0a0a);
  color: var(--color-text-secondary);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  letter-spacing: 0.5px;
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
