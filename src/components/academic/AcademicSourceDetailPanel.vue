<template>
  <div class="source-detail-container">
    <!-- Loading State -->
    <div v-if="isLoading" class="detail-loading">
      <span class="spinner"></span>
      <p>Đang tải thông tin tài liệu...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="hasError || !source" class="detail-error">
      <p>Không thể tải thông tin chi tiết tài liệu học thuật.</p>
      <slot name="error-retry-action"></slot>
    </div>

    <!-- Main Content Grid -->
    <div v-else class="source-detail-workspace">
      <!-- Left Column: Back button & Font controls -->
      <div class="workspace-left">
        <slot name="back-button"></slot>

        <!-- Font size controls in left rail -->
        <div v-if="source && (source.readableInApp || source.smartReaderAvailable) && activeTab === 'smart'" class="left-rail-size-controls">
          <button class="size-btn" @click="decreaseFontSize" :disabled="fontSize <= 14" title="Thu nhỏ chữ">A-</button>
          <span class="size-val">{{ fontSize }}px</span>
          <button class="size-btn" @click="increaseFontSize" :disabled="fontSize >= 22" title="Phóng to chữ">A+</button>
        </div>
      </div>

      <!-- Center Column: Reader Tabs + Content Area -->
      <div class="workspace-center">
        <!-- Twin Tabs for Reader Mode (only if readable or has PDF) -->
        <div v-if="(source.readableInApp || source.smartReaderAvailable) || originalDocState.hasPdf || getOriginalPdfUrl(source)" class="reader-tabs-row">
          <button 
            v-if="source.readableInApp || source.smartReaderAvailable"
            :class="['bookmark-tab', { active: activeTab === 'smart' }]" 
            @click="activeTab = 'smart'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            Bản đọc thông minh
            <span v-if="extractionQuality === 'low'" class="tab-warning-badge" title="Cấu trúc layout chưa tối ưu">Cần đối chiếu</span>
          </button>
          <button 
            v-if="(source.readableInApp || source.smartReaderAvailable) || originalDocState.hasPdf || getOriginalPdfUrl(source)"
            :class="['bookmark-tab', { active: activeTab === 'original' }]" 
            @click="handleSwitchToOriginal"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Bản gốc
          </button>
        </div>

        <!-- Reader Card Content Area -->
        <div class="reader-content-card" :class="{ 'no-tabs': !(source.readableInApp || source.smartReaderAvailable) }">
          <div class="reader-scroll-area" :style="(source.readableInApp || source.smartReaderAvailable) ? { '--reader-font-size': `${fontSize}px` } : {}">
            
            <!-- Case A: Source is readable or has PDF -> Show reader/PDF directly in the main column -->
            <template v-if="(source.readableInApp || source.smartReaderAvailable) || originalDocState.hasPdf || getOriginalPdfUrl(source)">
              <!-- Mode A: Original View -->
              <div v-if="activeTab === 'original' || !(source.readableInApp || source.smartReaderAvailable)" class="original-view-container">
                <!-- State: Resolving / loading -->
                <div v-if="originalDocState.status === 'resolving'" class="original-loading">
                  <div class="skeleton-shimmer"></div>
                  <span class="spinner"></span>
                  <p>Đang tải tài liệu gốc...</p>
                </div>
                
                <!-- State: pdf_inline_ready (Full height viewer) -->
                <div v-else-if="originalDocState.status === 'pdf_inline_ready'" class="original-pdf-viewer-shell">
                  <div v-if="pdfIframeNavigationGuarded" class="pdf-guard-banner">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="guard-icon">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>Một số liên kết trong PDF có thể làm trình xem nhúng bị điều hướng. Hãy mở PDF trong tab mới nếu cần tương tác với liên kết.</span>
                    <button class="dismiss-guard-btn" @click="pdfIframeNavigationGuarded = false" title="Đóng">×</button>
                  </div>
                  <iframe 
                    v-if="originalDocState.status === 'pdf_inline_ready'"
                    :src="iframeUrl" 
                    class="original-iframe"
                    frameborder="0"
                    allow="autoplay"
                    @load="handleIframeLoad"
                  ></iframe>
                </div>
                
                <!-- State: ISBN metadata_only -->
                <div v-else-if="isIsbnSource && !originalDocState.hasPdf" class="fallback-card">
                  <div class="fallback-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                  </div>
                  <h3>Nguồn sách học thuật</h3>
                  <p>Nguồn sách này hiện chỉ có metadata. Chưa có bản đọc toàn văn.</p>
                </div>

                <!-- State: Web/article URL source (normal article web pages) -->
                <div v-else-if="isWebUrlSource && !originalDocState.hasPdf" class="fallback-card">
                  <div class="fallback-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                  </div>
                  <h3>Liên kết nguồn bài viết</h3>
                  <div class="web-source-details" style="margin-block: var(--space-3); text-align: left; width: 100%; max-width: 400px; font-size: 0.9rem; display: flex; flex-direction: column; gap: 8px;">
                    <div v-if="source.title"><strong>Tiêu đề:</strong> {{ source.title }}</div>
                    <div v-if="originalDocState.sourceLabel"><strong>Trang web:</strong> {{ originalDocState.sourceLabel }}</div>
                    <div v-if="originalDocState.sourceArticleUrl" style="word-break: break-all;"><strong>Địa chỉ URL:</strong> <a :href="originalDocState.sourceArticleUrl" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary, #60a5fa);">{{ originalDocState.sourceArticleUrl }}</a></div>
                    <div><strong>Trạng thái bản đọc:</strong> {{ source.fullTextStatus === 'imported' ? 'Đã nhập bản đọc vào ứng dụng' : 'Chưa nhập bản đọc' }}</div>
                  </div>
                  <a 
                    v-if="originalDocState.sourceArticleUrl"
                    :href="originalDocState.sourceArticleUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="sidebar-action-btn sidebar-action-btn--primary"
                    style="text-align: center; display: block; width: 100%; max-width: 400px; text-decoration: none; margin-top: var(--space-2);"
                  >
                    Mở bài viết gốc
                  </a>
                </div>

                <!-- State: pdf_ready but not loaded (idle / before loading) -->
                <div v-else-if="originalDocState.status === 'pdf_ready' || originalDocState.status === 'idle'" class="fallback-card">
                  <div class="fallback-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                  <h3>PDF gốc đã sẵn sàng.</h3>
                  <p>Dùng bảng thông tin bên phải để xem, tải hoặc mở PDF.</p>
                </div>
                
                <!-- State: article_only -->
                <div v-else-if="originalDocState.status === 'article_only'" class="fallback-card">
                  <div class="fallback-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                  </div>
                  <h3>Tài liệu này không có PDF gốc trong hệ thống.</h3>
                  <p>Bạn có thể mở trang nguồn từ bảng thông tin bên phải.</p>
                </div>
                
                <!-- State: metadata_only -->
                <div v-else-if="originalDocState.status === 'metadata_only'" class="fallback-card">
                  <div class="fallback-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                  </div>
                  <h3>Không có file gốc để hiển thị.</h3>
                  <p>Hãy upload PDF hoặc dùng nguồn công khai khác.</p>
                </div>
                
                <!-- State: blocked / failed -->
                <div v-else-if="originalDocState.status === 'blocked' || originalDocState.status === 'failed'" class="fallback-card">
                  <div class="fallback-icon" style="color: #ed4956;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <h3>Không thể hiển thị PDF trực tiếp trong hệ thống.</h3>
                  <p>Bạn có thể tải PDF hoặc mở PDF trong tab mới từ bảng thông tin bên phải.</p>
                  <div v-if="originalDocState.error || originalDocState.reason" style="font-size: 0.8rem; color: #ed4956; background: rgba(237, 73, 86, 0.1); border: 1px solid rgba(237, 73, 86, 0.2); padding: 8px 12px; border-radius: var(--radius-sm); max-width: 400px; word-break: break-word; margin-top: var(--space-2);">
                    Chi tiết: {{ originalDocState.error || originalDocState.reason }}
                  </div>
                </div>
              </div>

              <!-- Mode B: Smart Reader View -->
              <template v-if="(source.readableInApp || source.smartReaderAvailable) && activeTab === 'smart'">
                <!-- Reader Header Area (Title and Top Pagination) -->
                <div class="reader-header-area">
                  <h2 class="reader-title">{{ source.title || 'Tài liệu không có tiêu đề' }}</h2>
                  
                  <div class="reader-source-badge-wrap" v-if="smartReaderSourceType">
                    <span :class="['reader-source-badge', getBadgeClass(smartReaderSourceType)]">
                      Nguồn đọc: {{ getFriendlySourceType(smartReaderSourceType) }}
                    </span>
                  </div>
                  
                  <!-- Top Pagination Controls -->
                  <div v-if="!isLoadingReader && !readerError && readerPages && readerPages.length > 0" class="reader-pagination reader-pagination--top">
                    <div class="pagination-btn-placeholder">
                      <AppButton 
                        v-if="currentPageIndex > 0"
                        variant="secondary" 
                        size="sm" 
                        @click="goToPageIndex(currentPageIndex - 1)"
                      >
                        ‹ Trang trước
                      </AppButton>
                    </div>
                    
                    <div class="page-selector-container">
                      <select 
                        :value="currentPageIndex" 
                        @change="onPageChange"
                        class="page-select-dropdown"
                      >
                        <option 
                          v-for="(_, pIdx) in readerPages" 
                          :key="pIdx" 
                          :value="pIdx"
                        >
                          Trang {{ pIdx + 1 }}
                        </option>
                      </select>
                      <div class="page-select-arrow" aria-hidden="true">
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </div>

                    <div class="pagination-btn-placeholder text-right">
                      <AppButton 
                        v-if="currentPageIndex < totalPages - 1"
                        variant="secondary" 
                        size="sm" 
                        @click="goToPageIndex(currentPageIndex + 1)"
                      >
                        Trang sau ›
                      </AppButton>
                    </div>
                  </div>
                </div>

                <!-- Low-quality layout warning banner -->
                <div v-if="(smartReaderSourceType === 'pdf_text' || smartReaderSourceType === 'uploaded_pdf_text' || extractionEngine === 'pymupdf_text' || extractionEngine === 'pdf_parse_fallback') && extractionQuality === 'low' && !isWarningBannerDismissed" class="reader-low-quality-warning-banner">
                  <div class="warning-banner-content">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 2px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span>Bản đọc thông minh có thể chưa giữ đúng cấu trúc gốc. Hãy xem Bản gốc hoặc tải PDF để đối chiếu.</span>
                  </div>
                  <button class="dismiss-warning-btn" @click="dismissWarningBanner" title="Đóng cảnh báo">×</button>
                </div>

                <!-- Warnings banner - Moderator/Admin only -->
                <div v-if="hasAdminAccess && readerWarnings && readerWarnings.length > 0" class="reader-warning-banner">
                  <template v-for="(warning, wIdx) in readerWarnings" :key="wIdx">
                    <div v-if="!warning.includes('bố cục') && !warning.includes('cấu trúc') && !warning.includes('thứ tự')" class="warning-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 2px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      <span>{{ warning }}</span>
                    </div>
                  </template>
                </div>

                <!-- Reader Content Loading state -->
                <div v-slot:reader-loading v-if="isLoadingReader" class="reader-loading">
                  <span class="spinner"></span>
                  <p>Đang tải toàn bộ nội dung...</p>
                </div>

                <!-- Reader Content Error state -->
                <div v-else-if="readerError" class="reader-error">
                  <p>{{ readerError }}</p>
                  <AppButton variant="secondary" size="sm" @click="fetchAllReaderData">Thử lại</AppButton>
                </div>

                <!-- Reader Reading Surface -->
                <div v-else-if="readerPages && readerPages.length > 0" class="reader-reading-surface">
                  <!-- Main Reading Content Page -->
                  <div class="reading-page-content" @click="handleReaderContentClick">
                    <div 
                      v-for="(block, bIdx) in readerPages[currentPageIndex].blocks" 
                      :key="bIdx"
                      v-show="(block.sectionType || block.type) !== 'title'"
                      :class="[
                        'reader-block',
                        `reader-block--${block.sectionType || block.type}`
                      ]"
                    >
                      <!-- 1. Headings (H1 to H4) -->
                      <h2 v-if="(block.sectionType || block.type) === 'heading' && block.headingLevel === 1" class="reader-heading reader-heading--h1">{{ block.text }}</h2>
                      <h3 v-else-if="(block.sectionType || block.type) === 'heading' && block.headingLevel === 2" class="reader-heading reader-heading--h2">{{ block.text }}</h3>
                      <h4 v-else-if="(block.sectionType || block.type) === 'heading' && block.headingLevel === 3" class="reader-heading reader-heading--h3">{{ block.text }}</h4>
                      <h5 v-else-if="(block.sectionType || block.type) === 'heading'" class="reader-heading reader-heading--h4">{{ block.text }}</h5>

                      <!-- 2. Regular Paragraphs -->
                      <p v-else-if="(block.sectionType || block.type) === 'paragraph'" class="reader-paragraph-text" v-html="block.html || block.text"></p>

                      <!-- 3. Bullet list items -->
                      <div v-else-if="(block.sectionType || block.type) === 'list_item'" class="reader-list-item">
                        <span class="bullet-marker">•</span>
                        <p class="reader-paragraph-text" v-html="block.html || block.text"></p>
                      </div>

                      <!-- 4. Tables and Figures -->
                      <div v-else-if="(block.sectionType || block.type) === 'table' || (block.sectionType || block.type) === 'figure'" class="reader-figure-wrapper">
                        <div class="figure-caption">{{ block.text }}</div>
                        <div v-if="block.html" class="figure-html-table" v-html="block.html"></div>
                        <div v-else-if="block.style" class="figure-style-rendered" :style="block.style"></div>
                      </div>

                      <!-- 5. Supplementary Items -->
                      <div v-else-if="(block.sectionType || block.type) === 'supplementary_item'" class="supplementary-item-card">
                        <div class="supplementary-header">
                          <div class="supplementary-title-wrap">
                            <span class="supplementary-badge">{{ block.supType || 'Tệp đính kèm' }}</span>
                            <span class="supplementary-label">{{ block.label || 'Supplementary File' }}</span>
                          </div>
                          <div v-if="block.fileTypes && block.fileTypes.length > 0" class="supplementary-file-pills">
                            <span v-for="ftype in block.fileTypes" :key="ftype" class="file-type-pill">{{ ftype }}</span>
                          </div>
                        </div>
                        <p class="supplementary-description">{{ block.description }}</p>
                        <div v-if="block.actions && block.actions.length > 0" class="supplementary-actions">
                          <a 
                            v-for="act in block.actions" 
                            :key="act.url" 
                            :href="act.url" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            class="supplementary-action-chip"
                          >
                            {{ act.label }}
                          </a>
                        </div>
                      </div>

                      <!-- 6. Acknowledgements -->
                      <p v-else-if="(block.sectionType || block.type) === 'acknowledgement_item'" class="acknowledgement-paragraph" v-html="block.html || block.text"></p>

                      <!-- 7. Correction notices -->
                      <div v-else-if="(block.sectionType || block.type) === 'correction_item'" class="correction-notice-card">
                        <div class="correction-header">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                          <span class="correction-badge">Hiệu đính / Correction</span>
                        </div>
                        <p class="correction-text" v-html="block.html || block.text"></p>
                      </div>

                      <!-- 8. References list items -->
                      <div v-else-if="(block.sectionType || block.type) === 'reference' || (block.sectionType || block.type) === 'reference_item'" class="reader-reference-card">
                        <p class="reference-card-text" v-html="block.html || block.text"></p>
                        <div v-if="block.actions && block.actions.length > 0" class="reference-actions-row">
                          <a 
                            v-for="act in block.actions" 
                            :key="act.url" 
                            :href="act.url" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            class="reference-action-chip"
                          >
                              {{ act.label }}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Bottom Pagination Controls -->
                  <div class="reader-pagination reader-pagination--bottom">
                    <div class="pagination-btn-placeholder">
                      <AppButton 
                        v-if="currentPageIndex > 0"
                        variant="secondary" 
                        size="sm" 
                        @click="goToPageIndex(currentPageIndex - 1)"
                      >
                        ‹ Trang trước
                      </AppButton>
                    </div>
                    
                    <div class="page-info">
                      Trang {{ currentPageIndex + 1 }} / {{ totalPages }}
                    </div>

                    <div class="pagination-btn-placeholder text-right">
                      <AppButton 
                        v-if="currentPageIndex < totalPages - 1"
                        variant="secondary" 
                        size="sm" 
                        @click="goToPageIndex(currentPageIndex + 1)"
                      >
                        Trang sau ›
                      </AppButton>
                    </div>
                  </div>
                </div>

                <!-- Case B: Empty page array fallback -->
                <div v-else class="fallback-card">
                  <div class="fallback-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <h3>Không có dữ liệu bản đọc thông minh.</h3>
                  <p>Tài liệu này chưa được xử lý thành công hoặc định dạng không khả dụng.</p>
                </div>
              </template>
            </template>
            
            <!-- Case C: Document has no reader chunks nor PDF -->
            <div v-else class="fallback-card no-tabs-fallback">
              <div class="fallback-icon" style="color: #ed4956;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3>Tài liệu không khả dụng</h3>
              <p>Tài liệu học thuật này chưa có tệp bản đọc thông minh và không có tệp PDF gốc để hiển thị.</p>
              <div v-if="source.fullTextImportError" style="font-size: 0.8rem; color: #ed4956; background: rgba(237, 73, 86, 0.1); border: 1px solid rgba(237, 73, 86, 0.2); padding: 8px 12px; border-radius: var(--radius-sm); max-width: 400px; word-break: break-word; margin-top: var(--space-2);">
                Lỗi nạp bản đọc: {{ source.fullTextImportError }}
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Right Column: Sidebar (Always shown on the right) -->
      <div :class="['workspace-right', { 'with-tabs': (source.readableInApp || source.smartReaderAvailable) }]">
        <div class="attributes-card">
          <h3 class="card-title">Thuộc tính tài liệu</h3>
          
          <div class="meta-table">
            <div class="attribute-row">
              <span class="meta-key">Tác giả:</span>
              <span class="attribute-value">{{ displaySourceAuthors }}</span>
            </div>
            <div v-if="source.year" class="attribute-row">
              <span class="meta-key">Năm xuất bản:</span>
              <span class="attribute-value">{{ source.year }}</span>
            </div>
            <div v-if="source.journal" class="attribute-row">
              <span class="meta-key">Nơi công bố:</span>
              <span class="attribute-value">{{ source.journal }}</span>
            </div>
            <div v-slot:publisher v-if="source.metadata?.publisher || source.publisher" class="attribute-row">
              <span class="meta-key">Nhà xuất bản:</span>
              <span class="attribute-value">{{ source.metadata?.publisher || source.publisher }}</span>
            </div>
            <div v-slot:pages-count v-if="(source.readableInApp || source.smartReaderAvailable) && totalPages" class="attribute-row">
              <span class="meta-key">Số trang:</span>
              <span class="attribute-value">{{ totalPages }}</span>
            </div>
            <div v-slot:doi-section v-if="source.doi" class="attribute-row align-center">
              <span class="meta-key">Mã định danh:</span>
              <div class="meta-doi-wrapper">
                <span class="attribute-value code-font">{{ displayDoi }}</span>
                <AppCopyButton
                  class="copy-doi-btn"
                  :text="displayDoi"
                  label="Sao chép DOI"
                  copied-label="Đã sao chép"
                  success-message="Đã sao chép mã DOI."
                  error-message="Không thể sao chép mã DOI."
                />
              </div>
            </div>
          </div>

          <!-- Actions Slot (Phân tích, Duyệt, Từ chối, Nhập lại) -->
          <div class="sidebar-moderation-row" style="margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-border, #262626);">
            <slot name="actions" :source="source"></slot>
          </div>
        </div>

        <!-- Card: Tài liệu gốc -->
        <div class="attributes-card" style="margin-top: var(--space-4);">
          <h3 class="card-title">Tài liệu gốc</h3>
          
          <!-- If PDF exists -->
          <div v-if="originalDocState.hasPdf" class="sidebar-pdf-section" style="display: flex; flex-direction: column; gap: var(--space-3); width: 100%;">
            <div class="status-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <span style="color: var(--color-text-muted);">Trạng thái:</span>
              <span style="color: #10b981; font-weight: 600;">Có PDF gốc</span>
            </div>
            
            <button 
              @click="downloadPdf"
              :disabled="originalDocState.status === 'resolving'"
              class="sidebar-action-btn sidebar-action-btn--primary"
            >
              Tải PDF
            </button>
            
            <button 
              @click="openPdfInNewTab"
              :disabled="originalDocState.status === 'resolving'"
              class="sidebar-action-btn sidebar-action-btn--text"
            >
                  Mở PDF trong tab mới
            </button>

            <div v-if="originalDocState.sourceLabel" class="source-link-row" style="font-size: 0.75rem; color: var(--color-text-muted); border-top: 1px solid var(--color-border, #262626); padding-top: var(--space-2); margin-top: 2px;">
              <span>Nguồn PDF: </span>
              <span style="color: var(--color-text-secondary); word-break: break-all;">
                {{ originalDocState.sourceLabel }}
              </span>
            </div>
          </div>
          
          <!-- If no PDF exists but DOI/sourceUrl exists -->
          <div v-else-if="originalDocState.sourceArticleUrl && !isIsbnSource" class="sidebar-pdf-section" style="display: flex; flex-direction: column; gap: var(--space-3); width: 100%;">
            <div class="status-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <span style="color: var(--color-text-muted);">Trạng thái:</span>
              <span style="color: #e6a817; font-weight: 600;">Không có PDF</span>
            </div>
            
            <a 
              :href="originalDocState.sourceArticleUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="sidebar-action-btn sidebar-action-btn--primary"
              style="text-align: center; display: block;"
            >
                  Mở trang nguồn
            </a>
            
            <div v-if="originalDocState.sourceLabel" class="source-link-row" style="font-size: 0.75rem; color: var(--color-text-muted); border-top: 1px solid var(--color-border, #262626); padding-top: var(--space-2); margin-top: 2px;">
              <span>Nguồn bài viết: </span>
              <span style="color: var(--color-text-secondary); word-break: break-all;">
                {{ originalDocState.sourceLabel }}
              </span>
            </div>
          </div>
          
          <!-- If metadata-only / ISBN without PDF -->
          <div v-else class="sidebar-pdf-section" style="display: flex; flex-direction: column; gap: var(--space-2); width: 100%;">
            <div class="status-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <span style="color: var(--color-text-muted);">Trạng thái:</span>
              <span style="color: #ed4956; font-weight: 600;">Không có tài liệu gốc</span>
            </div>
            <p style="font-size: 0.75rem; color: var(--color-text-muted); margin: 0; line-height: 1.4; text-align: left;">
              {{ isIsbnSource ? 'Hãy bổ sung bản đọc PDF cho sách này hoặc dùng nguồn công khai khác.' : 'Hãy upload PDF hoặc dùng nguồn công khai khác.' }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOriginalPdfViewer } from '@/composables/useOriginalPdfViewer'
import { resolveSourceType } from '@/utils/sourceTypeHelper'
import AppButton from '@/components/common/AppButton.vue'
import AppCopyButton from '@/components/common/AppCopyButton.vue'
import { useAuthStore } from '@/store/useAuthStore'
import { isAdminUser } from '@/utils/adminAccess'

// Helpers duplicate of LibrarySourceDetailView to process content
function countWords(str: string): number {
  return str ? str.trim().split(/\s+/).filter(Boolean).length : 0
}

function classifyHeading(text: string): string {
  const clean = text.toLowerCase()
    .replace(/[0-9\.\-\:\(\)\*•\s]+/g, ' ')
    .trim();
  
  if (/(^| )(references|bibliography|tài liệu tham khảo|literatures? cited)(s?|$)/.test(clean)) {
    return 'references';
  }
  if (/(^| )(supporting information|supplementary|additional files?|appendices|appendix)(s?|$)/.test(clean)) {
    return 'supporting_information';
  }
  if (/(^| )(acknowledgements?|funding|competing interests?|conflict of interest|author contributions)(s?|$)/.test(clean)) {
    return 'acknowledgement';
  }
  if (/(^| )(correction|corrigendum|erratum)(s?|$)/.test(clean)) {
    return 'correction_notice';
  }
  return 'general';
}

function isMajorGeneralHeading(text: string): boolean {
  const clean = text.toLowerCase()
    .replace(/[0-9\.\-\:\(\)\*•\s]+/g, ' ')
    .trim();
  const majorHeadings = [
    'introduction', 'methods', 'methodology', 'results', 'discussion',
    'conclusion', 'conclusions', 'background', 'related work', 'abstract',
    'tóm tắt', 'giới thiệu', 'phương pháp', 'kết quả', 'thảo luận', 'kết luận'
  ];
  return majorHeadings.includes(clean);
}

function isNewSupplementaryItemStart(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  if (/^s\d+\s+(fig|table|file|video|text|doc|audio|dataset|appendix|picture|map|raw)/i.test(lower)) {
    return true;
  }
  if (/^appendix\s+[a-z0-9]+/i.test(lower)) {
    return true;
  }
  if (/^supplementary\s+(file|table|figure|video|text|data|doc|raw|material)\s+[a-z0-9]+/i.test(lower)) {
    return true;
  }
  if (/^s\d+[\s\.\:]/i.test(lower)) {
    return true;
  }
  return false;
}

function parseSupplementaryItem(text: string) {
  const t = text.trim();
  const match = t.match(/^(s\d+\s+(fig|table|file|video|text|doc|audio|dataset|appendix|picture|map|raw)|appendix\s+[a-z0-9]+|supplementary\s+(file|table|figure|video|text|data|doc|raw|material)\s+[a-z0-9]+|s\d+)/i);
  
  let label = '';
  let restText = t;
  if (match) {
    label = match[0];
    restText = t.substring(match[0].length).replace(/^[\s\.\,\:\-\|•\/]+/g, '').trim();
  } else {
    const firstWords = t.split(/\s+/).slice(0, 2).join(' ');
    label = firstWords;
    restText = t.substring(label.length).replace(/^[\s\.\,\:\-\|•\/]+/g, '').trim();
  }
  
  label = label.replace(/\b[a-z]/g, char => char.toUpperCase());

  let type = 'File';
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('table')) {
    type = 'Table';
  } else if (lowerLabel.includes('fig') || lowerLabel.includes('picture')) {
    type = 'Figure';
  } else if (lowerLabel.includes('appendix')) {
    type = 'Appendix';
  } else if (lowerLabel.includes('dataset') || lowerLabel.includes('data')) {
    type = 'Dataset';
  }

  return { label, type, restText };
}

function detectFileType(text: string): string | null {
  const supported = ['docx', 'doc', 'tiff', 'tif', 'pdf', 'xlsx', 'xls', 'csv', 'zip', 'rar', 'txt', 'png', 'jpg', 'jpeg', 'mp4', 'tsv'];
  const clean = text.toLowerCase();
  for (const ext of supported) {
    const regex = new RegExp(`(\\b|\\.)(${ext})\\b`, 'i');
    if (regex.test(clean)) {
      return ext.toUpperCase();
    }
  }
  return null;
}

function getLinkLabel(url: string, linkText?: string): string {
  const lowerUrl = url.toLowerCase();
  const lowerText = (linkText || '').toLowerCase();
  
  if (lowerUrl.includes('doi.org')) {
    return 'DOI';
  }
  
  const fileExtensions = ['docx', 'doc', 'tiff', 'tif', 'pdf', 'xlsx', 'xls', 'csv', 'zip', 'rar', 'txt', 'png', 'jpg', 'jpeg', 'mp4', 'tsv'];
  const isFile = fileExtensions.some(ext => lowerUrl.endsWith('.' + ext) || lowerUrl.includes('.' + ext + '?') || lowerUrl.includes('.' + ext + '#') || lowerText.includes(ext));
  
  if (isFile) {
    return 'Mở tệp';
  }
  
  if (lowerUrl.includes('download') || lowerText.includes('download') || lowerText.includes('tải xuống')) {
    const looksLikeDownload = lowerUrl.includes('/download/') || lowerUrl.includes('download=') || isFile;
    if (looksLikeDownload) {
      return 'Tải xuống';
    }
  }
  
  return 'Mở liên kết';
}

function extractUrlsAndFileTypes(item: any, text: string, html?: string) {
  const ext = detectFileType(text);
  if (ext && !item.fileTypes.includes(ext)) {
    item.fileTypes.push(ext);
  }
  
  if (html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
      const anchors = doc.querySelectorAll('a');
      anchors.forEach(a => {
        const href = a.getAttribute('href');
        const aText = a.textContent || '';
        if (href && href.startsWith('http')) {
          const label = getLinkLabel(href, aText);
          if (!item.actions.some((act: any) => act.url === href)) {
            item.actions.push({ label, url: href });
          }
          const linkExt = detectFileType(href) || detectFileType(aText);
          if (linkExt && !item.fileTypes.includes(linkExt)) {
            item.fileTypes.push(linkExt);
          }
        }
      });
    } catch (e) {
      console.error('Error parsing HTML for URLs:', e);
    }
  }
  
  const urlRegex = /(https?:\/\/[^\s\)\(]+)/g;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0].replace(/[\,\.\:\;]+$/, '');
    const label = getLinkLabel(url);
    if (!item.actions.some((act: any) => act.url === url)) {
      item.actions.push({ label, url });
    }
    const urlExt = detectFileType(url);
    if (urlExt && !item.fileTypes.includes(urlExt)) {
      item.fileTypes.push(urlExt);
    }
  }
}

function cleanDescription(desc: string): string {
  let d = desc;
  d = d.replace(/https?:\/\/[^\s\)\(]+/g, '');
  d = d.replace(/\((docx?|tiff?|pdf|xlsx?|csv|zip|rar|txt|png|jpe?g|mp4|mov|avi|wmv|wav|mp3|tsv)\)/gi, '');
  d = d.replace(/\b(docx?|tiff?|pdf|xlsx?|csv|zip|rar|txt|png|jpe?g|mp4|mov|avi|wmv|wav|mp3|tsv)\b/gi, '');
  d = d.replace(/^[\s\.\,\:\-\|•\/]+/g, '').replace(/[\s\.\,\:\-\|•\/]+$/g, '').trim();
  return d;
}

function isHeadingLike(text: string): boolean {
  let t = text.trim()
  if (!t || t.length > 100) return false
  let n = t.toLowerCase()
  return !!(
    `introduction.abstract.methods.methodology.results.discussion.conclusion.conclusions.references.literature review.background.related work.discussion and conclusion.acknowledgements.appendix.tóm tắt.giới thiệu.phương pháp.kết quả.thảo luận.kết luận.tài liệu tham khảo.statements.author contributions.conflict of interest.funding.acknowledgments.data availability statement.ethics statement.supplementary material.publisher's note.copyright`
      .split('.')
      .includes(n) ||
    (/[a-zA-Z]/.test(t) && t === t.toUpperCase()) ||
    /^\d+(\.\d+)*\s+[A-Z]/.test(t) ||
    /^(section|mục|chương|chapter|bài|phần)\s+\d+/i.test(t) ||
    /^\d+(\.\d+)*\s+[A-Z][a-z]/.test(t)
  )
}

function getHeadingLevel(text: string): number {
  let t = text.trim()
  if (!t) return 2
  let n = t.match(/^(\d+(?:\.\d+)*)\s/)
  if (n) {
    let e = (n[1].match(/\./g) || []).length
    return e === 0 ? 1 : e === 1 ? 2 : e === 2 ? 3 : 4
  }
  let r = t.toLowerCase()
  if (
    [
      `author contributions`,
      `conflict of interest`,
      `funding`,
      `acknowledgments`,
      `acknowledgements`,
      `data availability statement`,
      `ethics statement`,
      `supplementary material`,
      `publisher's note`,
      `conflict of interest statement`
    ].includes(r)
  ) {
    return 2
  }
  if (
    [
      `abstract`,
      `introduction`,
      `conclusion`,
      `conclusions`,
      `references`,
      `statements`,
      `dreaming and memory consolidation`,
      `the strengths of self-organization theory of dreaming`
    ].includes(r) ||
    (/[a-zA-Z]/.test(t) && t === t.toUpperCase()) ||
    [
      `methods`,
      `methodology`,
      `results`,
      `discussion`,
      `literature review`,
      `background`,
      `related work`,
      `discussion and conclusion`,
      `appendix`,
      `tóm tắt`,
      `giới thiệu`,
      `phương pháp`,
      `kết quả`,
      `thảo luận`,
      `kết luận`,
      `tài liệu tham khảo`
    ].includes(r)
  ) {
    return 1
  }
  return 2
}

function isMetadataLike(text: string): boolean {
  let t = text.trim()
  if (t.length > 200) return false
  return [
    /^(doi|mã định danh)\s*:/i,
    /^doi\s+https?:\/\//i,
    /^(published|ngày xuất bản|xuất bản)\s*:/i,
    /^(edited\s+by|biên\s+tập\s+bởi)\s*:/i,
    /^(reviewed\s+by|phản\s+biện\s+bởi)\s*:/i,
    /^(correspondence|tác\s+giả\s+liên\s+hệ)\s*:/i,
    /^(citation|trích\s+dẫn)\s*:/i,
    /^(received|accepted|ngày nhận|ngày chấp nhận)\s*:/i,
    /^(copyright|bản quyền|license|giấy phép)\s*:/i,
    /^journal\s*:/i
  ].some(e => e.test(t))
}

function isHyphenatedWordPrefix(prefix: string, _suffix: string): boolean {
  let n = prefix.toLowerCase()
  return !(
    new Set([
      'co', 'pre', 'post', 'non', 'self', 'anti', 'multi', 'semi', 'sub', 'cross', 'inter', 'intra', 'pro', 'pseudo', 'ex', 'ultra', 'micro', 'macro', 'bio', 'geo', 'eco', 'cyber', 'neuro', 'psycho', 'socio'
    ]).has(n) ||
    new Set([
      'well', 'ill', 'good', 'bad', 'high', 'low', 'long', 'short', 'full', 'part', 'half', 'first', 'last', 'second', 'third', 'free', 'new', 'old'
    ]).has(n) ||
    n.length <= 2
  )
}

function isValidTextFlow(text: string): boolean {
  let t = text.trim()
  return !(
    !t ||
    /^[-•*+]\s+/.test(t) ||
    /^\[\d+\]\s+/.test(t) ||
    /^\(\d+\)\s+/.test(t) ||
    /^\d+\.\s+/.test(t) ||
    isHeadingLike(t) ||
    isMetadataLike(t)
  )
}

function cleanRepeatedLines(lines: string[]): string[] {
  if (lines.length === 0) return lines
  let firstLineCounts = new Map<string, number>()
  let lastLineCounts = new Map<string, number>()
  let splitLines = lines.map(e => (e || '').split('\n').map(e => e.trim()).filter(Boolean))
  
  splitLines.forEach(e => {
    if (e.length > 0) {
      let first = e[0]
      firstLineCounts.set(first, (firstLineCounts.get(first) || 0) + 1)
      if (e.length > 1) {
        let second = e[1]
        firstLineCounts.set(second, (firstLineCounts.get(second) || 0) + 1)
      }
      let last = e[e.length - 1]
      lastLineCounts.set(last, (lastLineCounts.get(last) || 0) + 1)
      if (e.length > 1) {
        let secondLast = e[e.length - 2]
        lastLineCounts.set(secondLast, (lastLineCounts.get(secondLast) || 0) + 1)
      }
    }
  })
  
  let repeatedLines = new Set<string>()
  let isPageNumPattern = (val: string) => {
    let t = val.toLowerCase()
    return /^\d+$/.test(t) || /^(page|trang)\s+\d+/i.test(t) || /^\d+\s*\|\s*/.test(t) || /\|\s*\d+$/.test(t) ? true : !isHeadingLike(val)
  }
  
  firstLineCounts.forEach((count, text) => {
    if (count > 1 && text.length < 150 && isPageNumPattern(text)) {
      repeatedLines.add(text)
    }
  })
  lastLineCounts.forEach((count, text) => {
    if (count > 1 && text.length < 150 && isPageNumPattern(text)) {
      repeatedLines.add(text)
    }
  })
  
  let isStandardNoise = (text: string) => {
    let t = text.trim()
    return !t || t.length > 180 || isHeadingLike(text) ? false : [
      /frontiersin\.org/i,
      /frontiers\s+in\s+[a-zA-Z]/i,
      /volume\s+\d+\s*\|\s*article\s+\d+/i,
      /article\s+\d+/i,
      /copyright\s+©/i,
      /www\s*\.\s*[a-zA-Z0-9-]+\s*\.\s*(org|com|net|edu)/i,
      /^\d+\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
      /^(page|trang)\s+\d+/i,
      /^\d+$/
    ].some(e => e.test(t))
  }
  
  return splitLines.map(e => {
    let startIdx = 0
    let endIdx = e.length
    while (startIdx < endIdx && startIdx < 4) {
      let line = e[startIdx]
      if (repeatedLines.has(line) || isStandardNoise(line)) {
        startIdx++
      } else {
        break
      }
    }
    while (endIdx > startIdx && endIdx > e.length - 4) {
      let line = e[endIdx - 1]
      if (repeatedLines.has(line) || isStandardNoise(line)) {
        endIdx--
      } else {
        break
      }
    }
    return e.slice(startIdx, endIdx).join('\n')
  })
}

function parseSectionsIntoMetadataAndClean(sections: string[]) {
  let metadata: string[] = []
  let cleanedSections: string[] = []
  let lineCount = 0
  for (let i = 0; i < sections.length; i++) {
    let lines = (sections[i] || '').split('\n')
    let keepLines: string[] = []
    for (let line of lines) {
      let t = line.trim()
      if (!t) {
        keepLines.push(line)
        continue
      }
      if (i < 3 && lineCount < 200 && isMetadataLike(t)) {
        metadata.push(t)
      } else {
        keepLines.push(line)
      }
      if (t) lineCount++
    }
    cleanedSections.push(keepLines.join('\n'))
  }
  return { metadata, cleanedSections }
}

function flowSectionLines(sectionText: string, sectionIndex: number) {
  let lines = sectionText.split('\n').map(e => e.trim())
  let result: any[] = []
  let paragraphBuffer: string[] = []
  
  let flushBuffer = () => {
    if (paragraphBuffer.length > 0) {
      let text = paragraphBuffer.join(' ')
      if (isHeadingLike(text)) {
        result.push({ type: 'heading', text, sectionIndex, headingLevel: getHeadingLevel(text) })
      } else {
        result.push({ type: 'paragraph', text, sectionIndex })
      }
      paragraphBuffer = []
    }
  }
  
  for (let line of lines) {
    if (!line) {
      flushBuffer()
      continue
    }
    if (isHeadingLike(line)) {
      flushBuffer()
      result.push({ type: 'heading', text: line, sectionIndex, headingLevel: getHeadingLevel(line) })
      continue
    }
    if (isMetadataLike(line)) {
      flushBuffer()
      result.push({ type: 'paragraph', text: line, sectionIndex })
      continue
    }
    if (paragraphBuffer.length === 0) {
      paragraphBuffer.push(line)
    } else {
      let lastLine = paragraphBuffer[paragraphBuffer.length - 1]
      let endsWithPunctuation = /[\.\?!:;]['\"”\)]*$/.test(lastLine)
      let isFlowLine = isValidTextFlow(line)
      if (endsWithPunctuation || !isFlowLine) {
        flushBuffer()
        paragraphBuffer.push(line)
      } else {
        let hyphenMatch = lastLine.match(/([a-zA-Z]+)-$/)
        if (hyphenMatch && isHyphenatedWordPrefix(hyphenMatch[1], line.split(/\s+/)[0])) {
          paragraphBuffer[paragraphBuffer.length - 1] = lastLine.slice(0, -1) + line
        } else {
          paragraphBuffer[paragraphBuffer.length - 1] = lastLine + ' ' + line
        }
      }
    }
  }
  flushBuffer()
  return result
}

function mergeHeadingBlocks(blocks: any[]): any[] {
  if (blocks.length <= 1) return blocks
  let result: any[] = []
  let idx = 0
  while (idx < blocks.length) {
    let block = blocks[idx]
    if (block.type === 'heading') {
      let mergedText = block.text
      let nextIdx = idx + 1
      while (nextIdx < blocks.length && blocks[nextIdx].type === 'heading') {
        let nextBlock = blocks[nextIdx]
        let isCurrentUpper = block.text === block.text.toUpperCase() && /[A-Z]/.test(block.text)
        let isNextUpper = nextBlock.text === nextBlock.text.toUpperCase() && /[A-Z]/.test(nextBlock.text)
        let sameSection = block.sectionIndex === nextBlock.sectionIndex
        if (isCurrentUpper && isNextUpper && block.text.length < 100 && nextBlock.text.length < 100 && sameSection) {
          mergedText += ' ' + nextBlock.text
          nextIdx++
        } else {
          break
        }
      }
      result.push({ type: 'heading', text: mergedText, sectionIndex: block.sectionIndex, headingLevel: getHeadingLevel(mergedText) })
      idx = nextIdx
    } else {
      result.push(block)
      idx++
    }
  }
  return result
}

function paginateBlocks(blocks: any[]) {
  if (blocks.length === 0) return []
  let pages: any[] = []
  let currentPageBlocks: any[] = []
  let wordCount = 0
  let flushPage = () => {
    if (currentPageBlocks.length > 0) {
      pages.push({ pageIndex: pages.length, blocks: [...currentPageBlocks], wordCount })
      currentPageBlocks = []
      wordCount = 0
    }
  }
  for (let block of blocks) {
    let words = countWords(block.text)
    if (block.type === 'heading') {
      if (wordCount >= 1000) flushPage()
      currentPageBlocks.push(block)
      wordCount += words
    } else {
      currentPageBlocks.push(block)
      wordCount += words
      if (wordCount >= 1500) flushPage()
    }
  }
  flushPage()
  return pages
}

function cleanReferenceBlock(block: any) {
  let text = (block.text || '').replace(/\s+/g, ' ').trim()
  let html = block.html || ''
  let actions: any[] = []
  let fileTypes: any[] = []
  
  const item = { text, html, actions, fileTypes }
  extractUrlsAndFileTypes(item, text, html)
  item.text = cleanDescription(item.text)
  return item
}

function processReaderContent(sections: any[], quality = 'low', engine: string) {
  void quality;
  void engine;
  let rawNormalBlocks: any[] = []
  let metadataBlocks: any[] = []
  let metadata: string[] = []

  sections.forEach(block => {
    let text = (block.text || '').replace(/\s+/g, ' ').trim()
    if (!text) return
    let type = 'paragraph'
    if (block.sectionType === 'heading') type = 'heading'
    else if (block.sectionType === 'reference_item' || block.sectionType === 'reference') type = 'reference'
    else if (block.sectionType === 'figure') type = 'figure'
    else if (block.sectionType === 'table') type = 'table'
    else if (block.sectionType === 'page_break') type = 'page_break'
    else if (block.sectionType === 'metadata') type = 'metadata'
    
    let mappedBlock = {
      type,
      sectionType: block.sectionType || 'paragraph',
      text,
      html: block.html || undefined,
      marker: block.marker || undefined,
      sectionIndex: block.sectionIndex,
      headingLevel: block.sectionType === 'heading' ? getHeadingLevel(text) : undefined,
      style: block.style || undefined
    }

    if (type === 'metadata') {
      metadataBlocks.push(mappedBlock)
    } else {
      rawNormalBlocks.push(mappedBlock)
    }
  })

  if (rawNormalBlocks.length === 0 && sections.length > 0) {
    let textList = sections.map(e => e.text || '')
    let parsed = parseSectionsIntoMetadataAndClean(cleanRepeatedLines(textList))
    metadata = parsed.metadata
    let rawParsedBlocks: any[] = []
    parsed.cleanedSections.forEach((secText, secIdx) => {
      let blocks = flowSectionLines(secText, secIdx)
      rawParsedBlocks.push(...blocks)
    })
    rawParsedBlocks = mergeHeadingBlocks(rawParsedBlocks)
    
    rawParsedBlocks.forEach(block => {
      if (block.type === 'metadata' || block.sectionType === 'metadata') {
        metadataBlocks.push(block)
      } else {
        let processedBlock = { ...block }
        if (processedBlock.type === 'paragraph' && (processedBlock.text?.includes('View Article') || processedBlock.text?.includes('PubMed/NCBI') || processedBlock.text?.includes('Google Scholar'))) {
          processedBlock.type = 'reference'
        }
        rawNormalBlocks.push(processedBlock)
      }
    })
  }

  // Unified End-Matter Processing Pass
  let finalNormalBlocks: any[] = []
  let activeState = 'body'
  let lastHeadingClean = ''
  let hasContentSinceLastHeading = false
  let lastValidReference: any = null
  let currentSupItem: any = null

  function flushCurrentSupItem() {
    if (currentSupItem) {
      currentSupItem.description = cleanDescription(currentSupItem.description)
      finalNormalBlocks.push(currentSupItem)
      currentSupItem = null
    }
  }

  rawNormalBlocks.forEach(block => {
    // 1. Heading Deduplication
    if (block.type === 'heading') {
      const currentHeadingClean = block.text.toLowerCase().replace(/[^a-z]/g, '').trim()
      if (currentHeadingClean === lastHeadingClean && !hasContentSinceLastHeading) {
        // Skip duplicate heading
        return
      }
      lastHeadingClean = currentHeadingClean
      hasContentSinceLastHeading = false
    } else {
      if (block.text && block.text.trim().length >= 20) {
        hasContentSinceLastHeading = true
      }
    }

    // 2. State Machine Transitions
    if (block.type === 'heading') {
      const headingClass = classifyHeading(block.text)
      if (headingClass !== 'general') {
        flushCurrentSupItem()
        activeState = headingClass
      } else if (isMajorGeneralHeading(block.text)) {
        flushCurrentSupItem()
        activeState = 'body'
      }
    }

    // 3. Process block based on activeState
    if (activeState === 'supporting_information') {
      if (block.type === 'heading') {
        finalNormalBlocks.push(block)
      } else {
        if (isNewSupplementaryItemStart(block.text)) {
          flushCurrentSupItem()
          const parsed = parseSupplementaryItem(block.text)
          currentSupItem = {
            type: 'supplementary_item',
            label: parsed.label,
            supType: parsed.type,
            description: parsed.restText,
            html: block.html || '',
            actions: [],
            fileTypes: []
          }
          extractUrlsAndFileTypes(currentSupItem, block.text, block.html)
        } else {
          if (currentSupItem) {
            if (currentSupItem.description) {
              currentSupItem.description += ' ' + block.text
            } else {
              currentSupItem.description = block.text
            }
            if (block.html) {
              currentSupItem.html += ' ' + block.html
            }
            extractUrlsAndFileTypes(currentSupItem, block.text, block.html)
          } else {
            finalNormalBlocks.push(block)
          }
        }
      }
    } else if (activeState === 'acknowledgement') {
      if (block.type === 'heading') {
        finalNormalBlocks.push(block)
      } else {
        finalNormalBlocks.push({
          ...block,
          type: 'acknowledgement_item'
        })
      }
    } else if (activeState === 'correction_notice') {
      if (block.type === 'heading') {
        finalNormalBlocks.push(block)
      } else {
        finalNormalBlocks.push({
          ...block,
          type: 'correction_item'
        })
      }
    } else if (activeState === 'references') {
      if (block.type === 'heading') {
        finalNormalBlocks.push(block)
      } else {
        let refBlock = { ...block, type: 'reference' }
        refBlock = cleanReferenceBlock(refBlock)
        
        const strippedText = refBlock.text
          .replace(/(View Article|PubMed\/NCBI|Google Scholar|CrossRef|Download|Article|Full Text)/gi, '')
          .replace(/[\s\.\,\:\-\|•\/\[\]\(\)]+/g, '')
          .trim()
        const isEmpty = strippedText.length === 0

        if (isEmpty) {
          if (lastValidReference && refBlock.actions && refBlock.actions.length > 0) {
            refBlock.actions.forEach((act: any) => {
              if (!lastValidReference.actions.some((existing: any) => existing.url === act.url)) {
                lastValidReference.actions.push(act)
              }
            })
          }
        } else {
          lastValidReference = refBlock
          finalNormalBlocks.push(refBlock)
        }
      }
    } else {
      // activeState === 'body'
      if (block.type === 'reference') {
        let refBlock = cleanReferenceBlock(block)
        const strippedText = refBlock.text
          .replace(/(View Article|PubMed\/NCBI|Google Scholar|CrossRef|Download|Article|Full Text)/gi, '')
          .replace(/[\s\.\,\:\-\|•\/\[\]\(\)]+/g, '')
          .trim()
        const isEmpty = strippedText.length === 0

        if (isEmpty) {
          if (lastValidReference && refBlock.actions && refBlock.actions.length > 0) {
            refBlock.actions.forEach((act: any) => {
              if (!lastValidReference.actions.some((existing: any) => existing.url === act.url)) {
                lastValidReference.actions.push(act)
              }
            })
          }
        } else {
          lastValidReference = refBlock
          finalNormalBlocks.push(refBlock)
        }
      } else {
        finalNormalBlocks.push(block)
      }
    }
  })

  flushCurrentSupItem()

  return {
    metadata,
    pages: paginateBlocks(finalNormalBlocks),
    metadataBlocks
  }
}

const props = defineProps<{
  mode: 'approved' | 'preview'
  source: any
  sections: any[]
  isLoading: boolean
  hasError: boolean
}>()

const { t } = useI18n({ useScope: 'global' })
const authStore = useAuthStore()
const hasAdminAccess = computed(() => isAdminUser(authStore.user))
const displaySourceAuthors = computed(() => {
  const authors = Array.isArray(props.source?.authors) && props.source.authors.length
    ? props.source.authors
    : Array.isArray(props.source?.metadata?.authors)
      ? props.source.metadata.authors
      : []
  return authors.map(String).filter(Boolean).join(', ') || t('library.unknownAuthor')
})

// Font size control
const fontSize = ref(16)
function increaseFontSize() {
  if (fontSize.value < 22) fontSize.value += 2
}
function decreaseFontSize() {
  if (fontSize.value > 14) fontSize.value -= 2
}

// Tabs state
const activeTab = ref<'smart' | 'original'>('smart')

// Warning Banner State
const isWarningBannerDismissed = ref(false)
function dismissWarningBanner() {
  isWarningBannerDismissed.value = true
}

// PDF original logic using the shared composable
const { originalDocState, loadPdf, iframeUrl } = useOriginalPdfViewer()
const pdfIframeNavigationGuarded = ref(true)

function handleIframeLoad() {
  // Setup standard PDF frame loads
}

watch(
  () => props.source,
  (newSrc) => {
    if (newSrc && newSrc._id) {
      loadPdf(newSrc._id, props.mode)
      // Reset warnings banner on source change
      isWarningBannerDismissed.value = false
    }
  },
  { immediate: true }
)

function handleSwitchToOriginal() {
  activeTab.value = 'original'
}

// PDF helper duplicate to find static URL from source
function getOriginalPdfUrl(source: any) {
  if (!source) return ''
  if (source.pdfUrl && source.pdfUrl.trim().startsWith('http')) {
    return source.pdfUrl
  }
  const cloudUrl = source.originalFile?.cloudinarySecureUrl || source.originalFile?.secureUrl || source.originalFile?.url
  if (cloudUrl) return cloudUrl
  if (source.fullTextUrl && source.fullTextUrl.trim().startsWith('http')) {
    const lower = source.fullTextUrl.toLowerCase()
    if (lower.endsWith('.pdf') || lower.includes('/pdf/') || lower.includes('/pdf?')) {
      return source.fullTextUrl
    }
  }
  const metaPdf = source.metadata?.pdfUrl || source.metadata?.best_oa_location?.url_for_pdf || source.metadata?.bestOaLocation?.url_for_pdf
  if (metaPdf && typeof metaPdf === 'string' && metaPdf.trim().startsWith('http')) {
    return metaPdf
  }
  return ''
}

// Source type helpers
const sourceType = computed(() => resolveSourceType(props.source))
const isIsbnSource = computed(() => sourceType.value === 'isbn')
const isWebUrlSource = computed(() => sourceType.value === 'web_url')

// Display Doi helper
const displayDoi = computed(() => {
  if (!props.source?.doi) return ''
  return props.source.doi.replace(/^(doi|DOI):\s*/, '')
})

// Technical metadata fields mapping
const extractionEngine = computed(() => {
  return props.source?.metadata?.extractionEngine || props.source?.metadata?.parserEngine || ''
})

// Reader content reactive processing
const processedReaderData = computed(() => {
  if (!props.sections || props.sections.length === 0) {
    return { pages: [], metadata: [], metadataBlocks: [] }
  }
  const quality = props.source?.metadata?.extractionQuality || 'low'
  const engine = props.source?.metadata?.extractionEngine || 'unknown'
  return processReaderContent(props.sections, quality, engine)
})

const readerPages = computed(() => processedReaderData.value.pages)
const totalPages = computed(() => readerPages.value.length)
const currentPageIndex = ref(0)
const isLoadingReader = computed(() => props.isLoading)
const readerError = ref<string | null>(null)

const smartReaderSourceType = computed(() => {
  return props.source?.fullTextSourceType || 'unknown'
})

const extractionQuality = computed(() => {
  return props.source?.metadata?.extractionQuality || 'low'
})

const readerWarnings = computed(() => {
  const warnings: string[] = []
  if (props.source?.metadata?.warnings) {
    return props.source.metadata.warnings
  }
  return warnings
})

function getBadgeClass(type: string): string {
  if (type === 'jats_xml') return 'badge--xml'
  if (type === 'publisher_html' || type === 'generic_html') return 'badge--html'
  if (type === 'pdf' || type === 'uploaded_pdf') return 'badge--pdf'
  return 'badge--unknown'
}

function getFriendlySourceType(type: string): string {
  if (type === 'jats_xml') return 'JATS XML'
  if (type === 'publisher_html') return 'Publisher HTML'
  if (type === 'generic_html') return 'Generic HTML'
  if (type === 'pdf') return 'PDF Document'
  if (type === 'uploaded_pdf') return 'Uploaded PDF File'
  return 'Bản quét / Khác'
}

function goToPageIndex(idx: number) {
  if (idx >= 0 && idx < totalPages.value) {
    currentPageIndex.value = idx
  }
}

function onPageChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  goToPageIndex(Number(val))
}

function handleReaderContentClick() {
  // Handle any inline links click actions
}

function fetchAllReaderData() {
  if (props.source?._id) {
    loadPdf(props.source._id, props.mode)
  }
}

function downloadPdf() {
  if (originalDocState.value.pdfDownloadUrl) {
    window.open(originalDocState.value.pdfDownloadUrl, '_blank')
  }
}

function openPdfInNewTab() {
  if (props.source?._id) {
    const url = props.mode === 'approved' 
      ? `/api/sources/approved/${props.source._id}/pdf-inline`
      : `/api/moderation/sources/${props.source._id}/pdf-inline`
    window.open(url, '_blank')
  }
}
</script>

<style scoped>
.source-detail-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.detail-loading,
.detail-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: var(--space-8);
  gap: var(--space-4);
  color: var(--color-text-muted);
}

.source-detail-workspace {
  display: grid;
  grid-template-columns: 80px 1fr 340px;
  gap: var(--space-4);
  flex: 1;
  height: 100%;
  min-height: 0;
  text-align: left;
}

/* Left Column Rail */
.workspace-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: var(--space-4);
  gap: var(--space-6);
  border-right: 1px solid var(--color-border, #1c1c1e);
}

.back-link-compact {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  background: transparent;
  border: none;
  color: var(--color-text-secondary, #aeaeb2);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: color 0.2s;
  padding: var(--space-2) 0;
  width: 100%;
}

.back-link-compact:hover {
  color: var(--color-text-primary, #ffffff);
}

.left-rail-size-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-elevated, #1c1c1e);
  border: 1px solid var(--color-border, #2c2c2e);
  padding: 8px 4px;
  border-radius: var(--radius-lg, 8px);
}

.size-btn {
  background: transparent;
  border: none;
  color: var(--color-text-secondary, #aeaeb2);
  font-weight: bold;
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}

.size-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #2c2c2e);
  color: #ffffff;
}

.size-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.size-val {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted, #8e8e93);
}

/* Center Column workspace */
.workspace-center {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}

.reader-tabs-row {
  display: flex;
  gap: 4px;
  margin-bottom: -1px;
  z-index: 2;
}

.bookmark-tab {
  display: inline-flex;
  align-items: center;
  background: #141414;
  border: 1px solid var(--color-border, #262626);
  border-bottom: none;
  color: var(--color-text-muted, #8e8e93);
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.bookmark-tab.active {
  background: var(--color-bg-elevated, #1c1c1e);
  color: var(--color-text-primary, #ffffff);
  border-color: var(--color-border, #2c2c2e);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.2);
}

.bookmark-tab:hover:not(.active) {
  background: #1c1c1c;
  color: var(--color-text-secondary, #aeaeb2);
}

.tab-warning-badge {
  font-size: 9px;
  background: rgba(230, 168, 23, 0.1);
  color: #e6a817;
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid rgba(230, 168, 23, 0.2);
  margin-left: 6px;
  font-weight: 700;
  text-transform: uppercase;
}

.reader-content-card {
  flex: 1;
  background: var(--color-bg-elevated, #1c1c1e);
  border: 1px solid var(--color-border, #2c2c2e);
  border-radius: var(--radius-lg, 8px);
  border-top-left-radius: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
}

.reader-content-card.no-tabs {
  border-top-left-radius: var(--radius-lg, 8px);
}

.reader-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6) var(--space-8);
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Original View Styles */
.original-view-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  flex: 1;
}

.original-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--space-4);
  position: relative;
}

.original-pdf-viewer-shell {
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
  min-height: 0;
}

.original-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #2a2a2a;
  border-radius: 4px;
}

.fallback-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: var(--space-8);
  text-align: center;
  color: var(--color-text-secondary, #aeaeb2);
  gap: var(--space-3);
  background: var(--color-bg-base, #121212);
  border-radius: 6px;
  border: 1px dashed var(--color-border, #2c2c2e);
  margin-block: var(--space-4);
}

.fallback-icon {
  font-size: 3rem;
  color: var(--color-text-muted, #8e8e93);
}

.fallback-card h3 {
  color: var(--color-text-primary, #ffffff);
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0;
}

.fallback-card p {
  font-size: 0.9rem;
  max-width: 400px;
  margin: 0;
  line-height: 1.5;
}

/* Reader Header styling */
.reader-header-area {
  border-bottom: 1px solid var(--color-border, #2c2c2e);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-5);
}

.reader-title {
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--color-text-primary, #ffffff);
  margin: 0 0 12px 0;
  text-align: left;
}

.reader-source-badge-wrap {
  display: flex;
  margin-bottom: 12px;
}

.reader-source-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.badge--xml {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.badge--html {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.badge--pdf {
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.2);
}

.badge--unknown {
  background: rgba(142, 142, 147, 0.1);
  color: #8e8e93;
  border: 1px solid rgba(142, 142, 147, 0.2);
}

/* Pagination Row */
.reader-pagination {
  display: grid;
  grid-template-columns: 120px 1fr 120px;
  align-items: center;
  gap: var(--space-4);
}

.reader-pagination--top {
  margin-top: var(--space-4);
}

.reader-pagination--bottom {
  border-top: 1px solid var(--color-border, #2c2c2e);
  padding-top: var(--space-5);
  margin-top: var(--space-5);
}

.pagination-btn-placeholder {
  min-height: 32px;
}

.page-selector-container {
  display: inline-flex;
  position: relative;
  align-items: center;
  justify-self: center;
}

.page-select-dropdown {
  appearance: none;
  background: var(--color-bg-base, #121212);
  border: 1px solid var(--color-border, #2c2c2e);
  border-radius: 4px;
  color: var(--color-text-secondary, #aeaeb2);
  padding: 6px 32px 6px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  min-width: 110px;
  text-align: center;
}

.page-select-dropdown:hover {
  border-color: var(--color-primary, #60a5fa);
  color: #ffffff;
}

.page-select-arrow {
  position: absolute;
  right: 12px;
  pointer-events: none;
  color: var(--color-text-muted);
}

.page-info {
  justify-self: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted, #8e8e93);
}

.text-right {
  text-align: right;
}

/* Warnings layout */
.reader-warning-banner {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.warning-item {
  display: flex;
  gap: 8px;
  color: #ef4444;
  font-size: 12px;
  line-height: 1.4;
}

/* Surface reader layout */
.reader-reading-surface {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.reading-page-content {
  font-size: var(--reader-font-size, 16px);
  line-height: 1.7;
  color: var(--color-text-secondary, #aeaeb2);
  display: flex;
  flex-direction: column;
  gap: 1.25em;
  text-align: left;
}

.reader-block {
  margin: 0;
  padding: 0;
  word-break: break-word;
}

.reader-block--heading {
  margin-top: 0.8em;
  margin-bottom: 0.2em;
}

.reader-heading {
  font-weight: 700;
  color: var(--color-text-primary, #ffffff);
  line-height: 1.3;
  margin: 0;
}

.reader-heading--h1 {
  font-size: 1.45em;
  border-bottom: 1px solid var(--color-border, #2c2c2e);
  padding-bottom: 6px;
}

.reader-heading--h2 {
  font-size: 1.25em;
}

.reader-heading--h3 {
  font-size: 1.12em;
}

.reader-heading--h4 {
  font-size: 1.02em;
}

.reader-paragraph-text {
  margin: 0;
  text-align: justify;
  text-justify: inter-word;
  white-space: pre-wrap;
}

.reader-list-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.bullet-marker {
  color: var(--color-primary, #60a5fa);
  font-weight: bold;
  flex-shrink: 0;
}

/* Figures and tables wrapper */
.reader-figure-wrapper {
  background: var(--color-bg-base, #121212);
  border: 1px solid var(--color-border, #2c2c2e);
  border-radius: 6px;
  padding: var(--space-4);
  margin-block: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.figure-caption {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted, #8e8e93);
  text-align: left;
}

.figure-html-table {
  overflow-x: auto;
  width: 100%;
}

.figure-html-table :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.figure-html-table :deep(th),
.figure-html-table :deep(td) {
  border: 1px solid var(--color-border, #2c2c2e);
  padding: 6px 10px;
  text-align: left;
}

.figure-html-table :deep(th) {
  background: var(--color-bg-elevated);
  font-weight: 700;
}

.figure-style-rendered {
  width: 100%;
  height: 250px;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
}

/* Right Column Sidebar */
.workspace-right {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
  overflow-y: auto;
  padding-top: var(--space-4);
  min-width: 0;
}

.workspace-right.with-tabs {
  padding-top: calc(var(--space-4) + 38px);
}

.attributes-card {
  background: var(--color-bg-elevated, #1c1c1e);
  border: 1px solid var(--color-border, #2c2c2e);
  border-radius: var(--radius-lg, 8px);
  padding: var(--space-5, 20px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-primary, #ffffff);
  border-bottom: 1px solid var(--color-border, #2c2c2e);
  width: 100%;
  padding-bottom: 10px;
  margin: 0 0 var(--space-4) 0;
}

.meta-table {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.attribute-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.attribute-row.align-center {
  flex-direction: column;
  align-items: flex-start;
}

.meta-key {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted, #8e8e93);
}

.attribute-value {
  font-size: 13px;
  color: var(--color-text-secondary, #aeaeb2);
  line-height: 1.45;
  word-break: break-word;
}

.attribute-value.code-font {
  font-family: monospace;
}

.meta-doi-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.copy-doi-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}

.copy-doi-btn:hover {
  background: var(--color-bg-hover, #2c2c2e);
  color: var(--color-primary, #60a5fa);
}

.sidebar-action-btn {
  width: 100%;
  padding: 8px 16px;
  border-radius: var(--radius-md, 6px);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sidebar-action-btn--primary {
  background: var(--color-primary, #60a5fa);
  color: #000000;
}

.sidebar-action-btn--primary:hover {
  opacity: 0.9;
}

.sidebar-action-btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sidebar-action-btn--text {
  background: transparent;
  border-color: var(--color-border, #2c2c2e);
  color: var(--color-text-secondary);
}

.sidebar-action-btn--text:hover {
  background: var(--color-bg-hover);
  color: #ffffff;
}

.sidebar-action-btn--text:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Guard Banner and styles */
.pdf-guard-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #2a1e08;
  border: 1px solid #3d2d10;
  border-radius: var(--radius-md, 6px);
  padding: 8px 12px;
  margin-bottom: 8px;
  color: #f59e0b;
  font-size: 13px;
  line-height: 1.4;
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.guard-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.dismiss-guard-btn {
  background: transparent;
  border: none;
  color: #f59e0b;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  margin-left: auto;
}

.reader-paragraph-text a,
.reader-block a {
  color: var(--color-text-secondary, #aeaeb2);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--color-text-muted, #8e8e93);
  transition: color 0.2s, text-decoration-color 0.2s;
}

.reader-paragraph-text a:hover,
.reader-block a:hover {
  color: var(--color-primary, #60a5fa);
  text-decoration-color: var(--color-primary, #60a5fa);
}

.reader-reference-card {
  background: var(--color-bg-elevated, #1c1c1e);
  border: 1px solid var(--color-border, #2c2c2e);
  border-radius: var(--radius-md, 6px);
  padding: var(--space-4, 16px);
  margin-bottom: var(--space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.reference-card-text {
  font-size: 0.9em;
  line-height: 1.5;
  color: var(--color-text-secondary, #aeaeb2);
  margin: 0;
  text-align: left;
}

.reference-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.reference-action-chip {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-bg-base, #121212);
  border: 1px solid var(--color-border, #2c2c2e);
  color: var(--color-primary, #60a5fa) !important;
  padding: 4px 10px;
  border-radius: 20px;
  text-decoration: none !important;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.reference-action-chip:hover {
  background: var(--color-bg-hover, #262626);
  border-color: var(--color-primary, #60a5fa);
  color: #ffffff !important;
}

.supplementary-item-card {
  background: var(--color-bg-elevated, #1c1c1e);
  border: 1px solid var(--color-border, #2c2c2e);
  border-radius: var(--radius-md, 6px);
  padding: var(--space-4, 16px);
  margin-bottom: var(--space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.supplementary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid var(--color-border, #262626);
  padding-bottom: 8px;
}

.supplementary-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.supplementary-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(96, 165, 250, 0.1);
  color: var(--color-primary, #60a5fa);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(96, 165, 250, 0.2);
}

.supplementary-label {
  font-weight: 600;
  color: var(--color-text-primary, #ffffff);
  font-size: var(--font-size-sm, 14px);
}

.supplementary-file-pills {
  display: flex;
  gap: 6px;
}

.file-type-pill {
  font-size: 10px;
  font-weight: 700;
  background: #2a2a2c;
  color: #aeaeb2;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #3a3a3c;
}

.supplementary-description {
  font-size: 0.9em;
  line-height: 1.5;
  color: var(--color-text-secondary, #aeaeb2);
  margin: 0;
  text-align: left;
}

.supplementary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.supplementary-action-chip {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  background: var(--color-bg-base, #121212);
  border: 1px solid var(--color-border, #2c2c2e);
  color: var(--color-primary, #60a5fa) !important;
  padding: 4px 10px;
  border-radius: 20px;
  text-decoration: none !important;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.supplementary-action-chip:hover {
  background: var(--color-bg-hover, #262626);
  border-color: var(--color-primary, #60a5fa);
  color: #ffffff !important;
}

.acknowledgement-paragraph {
  color: var(--color-text-secondary, #aeaeb2);
  margin: 0 0 var(--space-4) 0;
  line-height: var(--line-height-relaxed, 1.6);
  text-align: justify;
}

.correction-notice-card {
  background: rgba(245, 158, 11, 0.04);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: var(--radius-lg, 8px);
  padding: var(--space-4, 16px);
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.correction-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #f59e0b;
  font-weight: 700;
  font-size: var(--font-size-sm, 14px);
}

.correction-badge {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.correction-text {
  color: var(--color-text-secondary, #aeaeb2);
  margin: 0;
  font-size: 0.95em;
  line-height: 1.5;
  text-align: justify;
}

.reader-low-quality-warning-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #2a1e08;
  border: 1px solid #3d2d10;
  border-radius: var(--radius-md, 6px);
  padding: 8px 12px;
  margin-bottom: var(--space-4);
  color: #f59e0b;
  font-size: 13px;
  line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.warning-banner-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.dismiss-warning-btn {
  background: transparent;
  border: none;
  color: #f59e0b;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  margin-left: auto;
}

@media (min-width: 993px) and (max-height: 820px) {
  .workspace-right {
    gap: var(--space-3, 12px);
  }
  .attributes-card {
    padding: var(--space-4, 16px);
  }
  .meta-table {
    gap: 10px;
  }
  .attribute-row {
    gap: 2px;
  }
  .card-title {
    margin-bottom: var(--space-3, 12px);
    padding-bottom: 6px;
  }
  .sidebar-action-btn {
    padding: 6px 12px;
    font-size: 0.8rem;
  }
  .sidebar-pdf-section {
    gap: var(--space-2, 8px);
  }
}

@media (min-width: 993px) and (max-height: 720px) {
  .workspace-right {
    gap: 8px;
  }
  .attributes-card {
    padding: 10px 12px;
    border-radius: var(--radius-md, 6px);
  }
  .meta-table {
    gap: 6px;
  }
  .attribute-row {
    gap: 1px;
  }
  .meta-key {
    font-size: 11px;
  }
  .attribute-value {
    font-size: 12px;
  }
  .card-title {
    font-size: 12px;
    margin-bottom: 8px;
    padding-bottom: 4px;
  }
  .sidebar-action-btn {
    padding: 5px 10px;
    font-size: 0.78rem;
    border-radius: var(--radius-sm, 4px);
  }
  .sidebar-pdf-section {
    gap: 6px;
  }
}
</style>
