<template>
  <div class="source-detail-container preview-mode-container">
    <!-- Top Staging/Preview Banner -->
    <div class="preview-banner">
      <div class="banner-title">
        <span class="pulse-dot"></span>
        BẢN XEM TRƯỚC / CHỜ KIỂM DUYỆT
      </div>
      <div class="banner-actions">
        <AppButton variant="secondary" size="sm" @click="goBack">
          Quay lại danh sách
        </AppButton>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="detail-loading">
      <span class="spinner"></span>
      <p>Đang tải thông tin xem trước tài liệu...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="detail-error">
      <p>{{ fetchError }}</p>
      <AppButton variant="secondary" size="sm" @click="fetchPreviewData">Thử lại</AppButton>
    </div>

    <!-- Main Content Grid -->
    <div v-else class="source-detail-workspace">
      <!-- Left Column: Back button & Font controls -->
      <div class="workspace-left">
        <button class="back-link-compact" @click="goBack">
          <svg class="back-arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Quay lại</span>
        </button>

        <!-- Font size controls in left rail -->
        <div v-if="source && source.smartReaderAvailable && activeTab === 'smart'" class="left-rail-size-controls">
          <button class="size-btn" @click="decreaseFontSize" :disabled="fontSize <= 14" title="Thu nhỏ chữ">A-</button>
          <span class="size-val">{{ fontSize }}px</span>
          <button class="size-btn" @click="increaseFontSize" :disabled="fontSize >= 22" title="Phóng to chữ">A+</button>
        </div>
      </div>

      <!-- Center Column: Reader Tabs + Content Area -->
      <div class="workspace-center">
        <!-- Twin Tabs for Reader Mode (only if readable or has PDF) -->
        <div v-if="source.smartReaderAvailable || !!pdfUrl" class="reader-tabs-row">
          <button 
            v-if="source.smartReaderAvailable"
            :class="['bookmark-tab', { active: activeTab === 'smart' }]" 
            @click="activeTab = 'smart'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            Bản đọc thông minh
            <span v-if="extractionQuality === 'low'" class="tab-warning-badge" title="Cấu trúc layout chưa tối ưu">Cần đối chiếu</span>
          </button>
          <button 
            v-if="source.smartReaderAvailable || !!pdfUrl"
            :class="['bookmark-tab', { active: activeTab === 'original' }]" 
            @click="handleSwitchToOriginal"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Bản gốc
          </button>
        </div>

        <!-- Reader Card Content Area -->
        <div class="reader-content-card" :class="{ 'no-tabs': !source.smartReaderAvailable }">
          <div class="reader-scroll-area" :style="source.smartReaderAvailable ? { '--reader-font-size': `${fontSize}px` } : {}">
            
            <!-- Case A: Source is readable or has PDF -> Show reader/PDF directly in the main column -->
            <template v-if="source.smartReaderAvailable || !!pdfUrl">
              <!-- Mode A: Original View -->
              <div v-if="activeTab === 'original' || !source.smartReaderAvailable" class="original-view-container">
                <!-- State: Resolving / loading -->
                <div v-if="originalDocState.status === 'resolving'" class="original-loading">
                  <div class="skeleton-shimmer"></div>
                  <span class="spinner"></span>
                  <p>Đang tải tài liệu gốc...</p>
                </div>

                <!-- State: pdf_inline_ready (Full height viewer) -->
                <div v-else-if="originalDocState.status === 'pdf_inline_ready'" class="original-pdf-viewer-shell">
                  <iframe 
                    :src="iframeUrl" 
                    class="original-iframe"
                    frameborder="0"
                    allow="autoplay"
                  ></iframe>
                </div>
                
                <!-- State: ISBN metadata_only -->
                <div v-else-if="originalDocState.status === 'metadata_only'" class="fallback-card">
                  <div class="fallback-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                  </div>
                  <h3>Tài liệu gốc chỉ có metadata</h3>
                  <p>Nguồn sách hoặc bài viết này hiện chưa có bản đọc PDF.</p>
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
                  <h3>Không thể hiển thị PDF trực tiếp.</h3>
                  <p>Tài liệu này không hỗ trợ xem nhúng trực tiếp. Bạn có thể mở liên kết gốc hoặc tải PDF từ cột bên phải.</p>
                </div>
              </div>

              <!-- Mode B: Smart Reader View -->
              <template v-if="source.smartReaderAvailable && activeTab === 'smart'">
                <!-- Reader Header Area (Title and Top Pagination) -->
                <div class="reader-header-area">
                  <h2 class="reader-title">{{ source.title || 'Tài liệu không có tiêu đề' }}</h2>
                  
                  <div class="reader-source-badge-wrap" v-if="smartReaderSourceType">
                    <span :class="['reader-source-badge', getBadgeClass(smartReaderSourceType)]">
                      Nguồn đọc: {{ getFriendlySourceType(smartReaderSourceType) }}
                    </span>
                  </div>
                  
                  <!-- Top Pagination Controls -->
                  <div v-if="readerPages && readerPages.length > 0" class="reader-pagination reader-pagination--top">
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
                <div v-if="(smartReaderSourceType === 'pdf_text' || smartReaderSourceType === 'uploaded_pdf_text' || extractionEngine === 'pymupdf_text') && extractionQuality === 'low' && !isWarningBannerDismissed" class="reader-low-quality-warning-banner">
                  <div class="warning-banner-content">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 2px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span>Bản đọc thông minh có thể chưa giữ đúng cấu trúc gốc. Hãy xem Bản gốc hoặc tải PDF để đối chiếu.</span>
                  </div>
                  <button class="dismiss-warning-btn" @click="isWarningBannerDismissed = true" title="Đóng cảnh báo">×</button>
                </div>

                <!-- Warnings banner - Moderator/Admin only -->
                <div v-if="readerWarnings && readerWarnings.length > 0" class="reader-warning-banner">
                  <template v-for="(warning, wIdx) in readerWarnings" :key="wIdx">
                    <div v-if="!warning.includes('bố cục') && !warning.includes('cấu trúc') && !warning.includes('thứ tự')" class="warning-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 2px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      <span>{{ warning }}</span>
                    </div>
                  </template>
                </div>

                <!-- Reader Reading Surface -->
                <div v-if="readerPages && readerPages.length > 0" class="reader-reading-surface">
                  <!-- Main Reading Content Page -->
                  <div class="reading-page-content" @click="handleReaderContentClick">
                    <div 
                      v-for="(block, bIdx) in readerPages[currentPageIndex].blocks" 
                      :key="bIdx"
                      :class="[
                        'reader-block',
                        `reader-block--${block.sectionType || block.type}`
                      ]"
                    >
                      <!-- heading -->
                      <h3 
                        v-if="(block.sectionType || block.type) === 'heading'" 
                        :class="['reader-heading-text', `reader-heading--level-${block.headingLevel || 2}`]"
                      >
                        <span v-if="block.html" v-html="getInnerHtml(block.html)"></span>
                        <span v-else>{{ block.text }}</span>
                      </h3>
                      
                      <!-- list_item -->
                      <div v-else-if="block.sectionType === 'list_item'" class="reader-list-item">
                        <span class="list-marker">{{ block.marker || extractListMarker(block.text).marker }}</span>
                        <span v-if="block.html" class="list-text" v-html="getInnerHtml(block.html)"></span>
                        <span v-else class="list-text">{{ block.marker ? block.text : extractListMarker(block.text).restText }}</span>
                      </div>
                      
                      <!-- reference_item / reference -->
                      <div 
                        v-else-if="block.type === 'reference' || block.sectionType === 'reference_item'" 
                        class="reader-reference-card"
                      >
                        <p class="reference-card-text">
                          <span class="reference-number" v-if="block.refNumber">[{{ block.refNumber }}] </span>
                          <span v-if="block.html" v-html="getInnerHtml(block.html)"></span>
                          <span v-else>{{ block.text }}</span>
                        </p>
                        
                        <div v-if="block.actions && block.actions.length > 0" class="reference-actions-row">
                          <a 
                            v-for="(act, actIdx) in block.actions" 
                            :key="actIdx" 
                            :href="act.url" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            class="reference-action-chip"
                          >
                            {{ act.label }}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left: 3px; display: inline-block; vertical-align: middle;">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
                        </div>
                      </div>
                      
                      <!-- caption -->
                      <p v-else-if="block.sectionType === 'caption'" class="reader-caption-text">
                        <span v-if="block.html" v-html="getInnerHtml(block.html)"></span>
                        <span v-else>{{ block.text }}</span>
                      </p>
     
                      <!-- abstract -->
                      <div v-else-if="block.sectionType === 'abstract'" class="reader-abstract-box">
                        <p class="abstract-text">
                          <strong>Abstract: </strong>
                          <span v-if="block.html" v-html="getInnerHtml(block.html)"></span>
                          <span v-else>{{ block.text }}</span>
                        </p>
                      </div>

                      <!-- title -->
                      <h1 v-else-if="block.sectionType === 'title'" class="reader-title-text">
                        <span v-if="block.html" v-html="getInnerHtml(block.html)"></span>
                        <span v-else>{{ block.text }}</span>
                      </h1>

                      <!-- figure / table block -->
                      <div v-else-if="block.type === 'figure' || block.type === 'table'">
                        <div v-if="block.html" class="reader-rich-block" v-html="block.html"></div>
                        <div v-else class="reader-placeholder-card">
                          <div v-if="block.type === 'figure'" class="figure-fallback">
                            <p class="placeholder-error"><em>[Figure image unavailable]</em></p>
                            <p class="placeholder-caption">{{ block.text }}</p>
                          </div>
                          <div v-else class="table-fallback">
                            <p class="placeholder-caption">{{ block.text }}</p>
                            <p class="placeholder-error"><em>[Table data unavailable]</em></p>
                          </div>
                          <div v-if="block.style?.doiUrl" class="placeholder-link-wrapper">
                            <a :href="block.style.doiUrl" target="_blank" rel="noopener noreferrer" class="placeholder-link">
                              Xem chi tiết gốc (DOI) ↗
                            </a>
                          </div>
                        </div>
                      </div>

                      <!-- page_break -->
                      <div v-else-if="block.type === 'page_break'" class="reader-page-break">
                        <div class="page-break-divider"></div>
                        <span class="page-break-text">{{ block.text || `Trang ${block.style?.pageIndex || block.page || ''}` }}</span>
                        <div class="page-break-divider"></div>
                      </div>

                      <!-- supplementary_item -->
                      <div v-else-if="block.type === 'supplementary_item'" class="supplementary-item-card">
                        <div class="supplementary-header">
                          <div class="supplementary-title-wrap">
                            <span class="supplementary-badge">{{ block.supType }}</span>
                            <span class="supplementary-label">{{ block.label }}</span>
                          </div>
                          <div v-if="block.fileTypes && block.fileTypes.length > 0" class="supplementary-file-pills">
                            <span v-for="ft in block.fileTypes" :key="ft" class="file-type-pill">{{ ft }}</span>
                          </div>
                        </div>
                        <p class="supplementary-description">
                          {{ block.description }}
                        </p>
                        <div v-if="block.actions && block.actions.length > 0" class="supplementary-actions">
                          <a 
                            v-for="(act, actIdx) in block.actions" 
                            :key="actIdx" 
                            :href="act.url" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            class="supplementary-action-chip"
                          >
                            {{ act.label }}
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left: 3px; display: inline-block; vertical-align: middle;">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
                        </div>
                      </div>

                      <!-- acknowledgement_item -->
                      <p v-else-if="block.type === 'acknowledgement_item'" class="acknowledgement-paragraph">
                        <span v-if="block.html" v-html="getInnerHtml(block.html)"></span>
                        <span v-else>{{ block.text }}</span>
                      </p>

                      <!-- correction_item -->
                      <div v-else-if="block.type === 'correction_item'" class="correction-notice-card">
                        <div class="correction-header">
                          <svg class="info-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                          <span class="correction-badge">Thông báo đính chính / đính kèm</span>
                        </div>
                        <p v-if="block.html" class="correction-text" v-html="getInnerHtml(block.html)"></p>
                        <p v-else class="correction-text">{{ block.text }}</p>
                      </div>
                      
                      <!-- paragraph or other default -->
                      <p v-else class="reader-paragraph-text">
                        <span v-if="block.html" v-html="getInnerHtml(block.html)"></span>
                        <span v-else>{{ block.text }}</span>
                      </p>
                    </div>
                  </div>

                  <!-- Collapsible metadata card -->
                  <div v-if="(readerMetadata && readerMetadata.length > 0) || (readerMetadataBlocks && readerMetadataBlocks.length > 0)" class="collapsible-metadata-card">
                    <button class="metadata-toggle-btn" @click="isMetadataCollapsed = !isMetadataCollapsed">
                      <span class="btn-label">Thông tin xuất bản</span>
                      <svg :class="['arrow-icon', { rotated: !isMetadataCollapsed }]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <div v-show="!isMetadataCollapsed" class="metadata-card-content">
                      <div v-if="readerMetadata && readerMetadata.length > 0" class="metadata-string-list">
                        <p v-for="(meta, mIdx) in readerMetadata" :key="mIdx" class="metadata-item-text">{{ meta }}</p>
                      </div>
                      <div v-if="readerMetadataBlocks && readerMetadataBlocks.length > 0" class="metadata-blocks-list">
                        <p v-for="(block, bIdx) in readerMetadataBlocks" :key="bIdx" class="metadata-item-text">{{ block.text }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Bottom Pagination controls -->
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

                <div v-else class="reader-error">
                  <p>Tài liệu này không chứa dữ liệu văn bản.</p>
                </div>
              </template>
            </template>

            <!-- Case B: Source is NOT readable -> Show detail info and citation -->
            <div v-else class="detail-info-blocks">
              <h2 class="source-title-inside">{{ source.title || 'Tài liệu không có tiêu đề' }}</h2>
              
              <!-- Reading Availability State Banner -->
              <div class="reading-state-box">
                <!-- Case B.1: available but smartReaderAvailable is false -->
                <div v-if="source.fullTextStatus === 'available'" class="state-notice state-notice--warning">
                  <span class="state-icon"></span>
                  <div class="state-message-wrap">
                    <p class="state-message">
                      Có bản đọc hợp pháp, chờ nhập bản đọc xem trước để kiểm tra chất lượng.
                    </p>
                    <div class="state-actions-row">
                      <AppButton
                        variant="primary"
                        size="sm"
                        :loading="isParsing"
                        @click="triggerPreviewParsing"
                      >
                        Nhập bản đọc xem trước
                      </AppButton>
                    </div>
                  </div>
                </div>

                <!-- Case B.2: failed and smartReaderAvailable is false -->
                <div v-else-if="source.fullTextStatus === 'failed'" class="state-notice state-notice--warning">
                  <span class="state-icon"></span>
                  <div class="state-message-wrap">
                    <p class="state-message">
                      Quá trình nhập bản đọc xem trước tự động thất bại.
                    </p>
                    <div class="state-actions-row">
                      <AppButton
                        variant="primary"
                        size="sm"
                        :loading="isParsing"
                        @click="triggerPreviewParsing"
                      >
                        Thử nhập lại
                      </AppButton>
                    </div>
                  </div>
                </div>

                <!-- Case B.3: paywalled / none / metadata_only -->
                <div v-else class="state-notice state-notice--muted">
                  <span class="state-icon"></span>
                  <div class="state-message-wrap">
                    <p class="state-message">
                      Tài liệu đóng góp này hiện chỉ ở trạng thái metadata (chưa có tệp PDF hoặc liên kết bài viết mở).
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Right Column: Sidebar (Always shown on the right) -->
      <div :class="['workspace-right', { 'with-tabs': source.smartReaderAvailable }]">
        
        <!-- Moderator Controls Widget -->
        <div class="attributes-card">
          <h3 class="card-title">Kiểm duyệt đóng góp</h3>
          <div class="review-actions-column" style="display: flex; flex-direction: column; gap: var(--space-3);">
            <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <label for="reviewNote" class="form-label" style="font-size: 0.75rem; color: var(--color-text-secondary);">Ghi chú kiểm duyệt (Tùy chọn):</label>
              <textarea
                id="reviewNote"
                v-model="reviewNote"
                class="form-control text-area-note"
                placeholder="Nhập lý do duyệt hoặc từ chối..."
                maxlength="1000"
                style="width: 100%; min-height: 80px; padding: 8px 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: #111111; color: var(--color-text-primary); font-size: 0.875rem;"
              ></textarea>
              <span class="char-counter" style="font-size: 10px; color: var(--color-text-muted); text-align: right;">{{ reviewNote.length }}/1000 ký tự</span>
            </div>

            <div class="btn-group-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
              <AppButton
                variant="danger-outline"
                size="md"
                :disabled="isSubmittingReview"
                @click="confirmReview('rejected')"
              >
                Từ chối
              </AppButton>
              <AppButton
                variant="smart"
                size="md"
                :disabled="isSubmittingReview"
                @click="confirmReview('approved')"
              >
                Phê duyệt
              </AppButton>
            </div>
          </div>
        </div>

        <!-- Preview Quality Checklist -->
        <div class="attributes-card" style="margin-top: var(--space-4);">
          <h3 class="card-title">Chỉ số chất lượng bản xem trước</h3>
          <ul class="checklist-items" style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-3);">
            <li class="checklist-item" style="display: flex; align-items: flex-start; gap: var(--space-2);">
              <span :class="['checklist-bullet', { 'bullet-success': source.metadataResolved }]" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #262626; color: var(--color-text-muted); font-size: 11px; font-weight: bold; flex-shrink: 0; margin-top: 2px;">
                {{ source.metadataResolved ? '✓' : '✗' }}
              </span>
              <div class="checklist-text" style="display: flex; flex-direction: column; gap: 2px; font-size: 0.75rem;">
                <strong style="color: var(--color-text-secondary);">Thông tin thư mục:</strong>
                <span style="color: var(--color-text-muted);">{{ source.metadataResolved ? 'Đã phân giải' : 'Chưa chuẩn hóa' }}</span>
              </div>
            </li>
            <li class="checklist-item" style="display: flex; align-items: flex-start; gap: var(--space-2);">
              <span :class="['checklist-bullet', { 'bullet-success': source.fullTextAvailable }]" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #262626; color: var(--color-text-muted); font-size: 11px; font-weight: bold; flex-shrink: 0; margin-top: 2px;">
                {{ source.fullTextAvailable ? '✓' : '✗' }}
              </span>
              <div class="checklist-text" style="display: flex; flex-direction: column; gap: 2px; font-size: 0.75rem;">
                <strong style="color: var(--color-text-secondary);">Hỗ trợ RAG:</strong>
                <span style="color: var(--color-text-muted);">{{ source.fullTextAvailable ? 'Khả dụng (Open Access)' : 'Chỉ lưu metadata' }}</span>
              </div>
            </li>
            <li class="checklist-item" style="display: flex; align-items: flex-start; gap: var(--space-2);">
              <span :class="['checklist-bullet', { 'bullet-success': source.originalPdfAvailable }]" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #262626; color: var(--color-text-muted); font-size: 11px; font-weight: bold; flex-shrink: 0; margin-top: 2px;">
                {{ source.originalPdfAvailable ? '✓' : '✗' }}
              </span>
              <div class="checklist-text" style="display: flex; flex-direction: column; gap: 2px; font-size: 0.75rem;">
                <strong style="color: var(--color-text-secondary);">Tệp PDF gốc:</strong>
                <span style="color: var(--color-text-muted);">{{ source.originalPdfAvailable ? 'Có sẵn để tải/đọc' : 'Không có tệp PDF' }}</span>
              </div>
            </li>
            <li class="checklist-item" style="display: flex; align-items: flex-start; gap: var(--space-2);">
              <span :class="['checklist-bullet', { 'bullet-success': source.smartReaderAvailable }]" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #262626; color: var(--color-text-muted); font-size: 11px; font-weight: bold; flex-shrink: 0; margin-top: 2px;">
                {{ source.smartReaderAvailable ? '✓' : '✗' }}
              </span>
              <div class="checklist-text" style="display: flex; flex-direction: column; gap: 2px; font-size: 0.75rem;">
                <strong style="color: var(--color-text-secondary);">Bản đọc thông minh:</strong>
                <span style="color: var(--color-text-muted);">{{ source.smartReaderAvailable ? 'Đã nhập thành công' : 'Chưa được trích xuất' }}</span>
              </div>
            </li>
          </ul>

          <div v-if="source.smartReaderAvailable" class="chunk-stats-summary" style="margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px dashed var(--color-border); display: flex; flex-wrap: wrap; gap: var(--space-2);">
            <div class="stat-badge" style="font-size: 10px; background: #262626; padding: 4px 8px; border-radius: 4px; color: var(--color-text-secondary);">
              <strong>Reader Chunks:</strong> <span>{{ source.readerChunkCount }}</span>
            </div>
            <div class="stat-badge" style="font-size: 10px; background: #262626; padding: 4px 8px; border-radius: 4px; color: var(--color-text-secondary);">
              <strong>RAG Chunks:</strong> <span>{{ source.ragChunkCount }}</span>
            </div>
            <div class="stat-badge" style="font-size: 10px; background: #262626; padding: 4px 8px; border-radius: 4px; color: var(--color-text-secondary);">
              <strong>Tổng số phân đoạn:</strong> <span>{{ source.totalChunkCount }}</span>
            </div>
          </div>
        </div>

        <!-- Card 3: Thuộc tính tài liệu -->
        <div class="attributes-card" style="margin-top: var(--space-4);">
          <h3 class="card-title">Thuộc tính tài liệu</h3>
          
          <div class="meta-table">
            <div v-if="source.authors && source.authors.length > 0" class="attribute-row">
              <span class="meta-key">Tác giả:</span>
              <span class="attribute-value">{{ source.authors.join(', ') }}</span>
            </div>
            <div v-if="source.year" class="attribute-row">
              <span class="meta-key">Năm xuất bản:</span>
              <span class="attribute-value">{{ source.year }}</span>
            </div>
            <div v-if="source.journal" class="attribute-row">
              <span class="meta-key">Nơi công bố:</span>
              <span class="attribute-value">{{ source.journal }}</span>
            </div>
            <div v-if="source.publisher" class="attribute-row">
              <span class="meta-key">Nhà xuất bản:</span>
              <span class="attribute-value">{{ source.publisher }}</span>
            </div>
            <div v-if="source.smartReaderAvailable && totalPages" class="attribute-row">
              <span class="meta-key">Số trang:</span>
              <span class="attribute-value">{{ totalPages }}</span>
            </div>
            <div v-if="source.doi" class="attribute-row align-center">
              <span class="meta-key">Mã định danh:</span>
              <div class="meta-doi-wrapper">
                <span class="attribute-value code-font">{{ displayDoi }}</span>
                <button class="copy-doi-btn" @click="copyDoi" title="Sao chép DOI">
                  <svg class="copy-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 4: Tài liệu gốc -->
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
              class="sidebar-action-btn sidebar-action-btn--primary"
            >
              Tải PDF
            </button>
            
            <button 
              @click="openPdfInNewTab"
              class="sidebar-action-btn sidebar-action-btn--text"
            >
              Mở PDF trong tab mới ↗
            </button>

            <!-- Original Filename Metadata -->
            <div v-if="source.originalFile?.originalFileName" class="source-link-row" style="font-size: 0.75rem; color: var(--color-text-muted); border-top: 1px solid var(--color-border, #262626); padding-top: var(--space-2); margin-top: 2px;">
              <span>Tên tệp gốc: </span>
              <span style="color: var(--color-text-secondary); word-break: break-all;">
                {{ source.originalFile.originalFileName }}
              </span>
            </div>
          </div>
          
          <!-- If no PDF exists but DOI/url exists -->
          <div v-else-if="source.url" class="sidebar-pdf-section" style="display: flex; flex-direction: column; gap: var(--space-3); width: 100%;">
            <div class="status-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <span style="color: var(--color-text-muted);">Trạng thái:</span>
              <span style="color: #e6a817; font-weight: 600;">Không có PDF</span>
            </div>
            
            <a 
              :href="source.url"
              target="_blank"
              rel="noopener noreferrer"
              class="sidebar-action-btn sidebar-action-btn--primary"
              style="text-align: center; display: block; text-decoration: none;"
            >
              Mở trang nguồn ↗
            </a>
          </div>
        </div>

      </div>
    </div>

    <!-- Confirm Modals -->
    <AppConfirm
      v-model="confirmDialog.show"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-label="confirmDialog.confirmText"
      :cancel-label="confirmDialog.cancelText"
      :danger="confirmDialog.reviewStatus === 'rejected'"
      @confirm="executeReview"
      @cancel="confirmDialog.show = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getSourcePreview, reviewSource, importFullText } from '@/api/moderationApi'
import apiClient from '@/api/client'
import { useSettingsStore } from '@/store/useSettingsStore'
import AppButton from '@/components/common/AppButton.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()

const contributionId = String(route.params.id)

const isLoading = ref(true)
const fetchError = ref('')
const isParsing = ref(false)
const isSubmittingReview = ref(false)

const source = ref<any>(null)
const fullText = ref<any>(null)
const sections = ref<any[]>([])

const activeTab = ref<'smart' | 'original'>('smart')
const fontSize = ref(17)
const currentPageIndex = ref(0)
const isMetadataCollapsed = ref(true)
const isWarningBannerDismissed = ref(false)

const reviewNote = ref('')

const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  reviewStatus: 'approved' as 'approved' | 'rejected',
  confirmText: '',
  cancelText: ''
})

const pdfUrl = computed(() => {
  if (source.value?.originalFile?.cloudinarySecureUrl) {
    return source.value.originalFile.cloudinarySecureUrl
  }
  return source.value?.pdfUrl || ''
})

let activeBlobUrl = ''
const iframeUrl = ref('')

// Original Document Preview State
const originalDocState = ref<{
  status: 'idle' | 'resolving' | 'pdf_ready' | 'pdf_inline_ready' | 'article_only' | 'metadata_only' | 'blocked' | 'failed'
  hasPdf: boolean
  canInlinePdf: boolean
  pdfViewUrl?: string
  pdfDownloadUrl?: string
  sourceArticleUrl?: string
  sourceLabel?: string
  error?: string
  reason?: string
}>({
  status: 'idle',
  hasPdf: false,
  canInlinePdf: false
})

function initOriginalDocState() {
  if (!source.value) {
    originalDocState.value = { status: 'idle', hasPdf: false, canInlinePdf: false }
    return
  }
  const fileUrl = pdfUrl.value
  const hasPdf = !!fileUrl
  const sourceLabel = getDisplaySourceLink(fileUrl || source.value.url || '')
  if (hasPdf) {
    originalDocState.value = {
      status: 'pdf_ready',
      hasPdf: true,
      canInlinePdf: source.value.canInlinePreview !== false,
      pdfDownloadUrl: fileUrl,
      pdfViewUrl: fileUrl,
      sourceArticleUrl: source.value.url || '',
      sourceLabel
    }
  } else {
    originalDocState.value = {
      status: source.value.url ? 'article_only' : 'metadata_only',
      hasPdf: false,
      canInlinePdf: false,
      sourceArticleUrl: source.value.url || '',
      sourceLabel: 'Web URL'
    }
  }
}

function getDisplaySourceLink(url: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return parsed.hostname.includes('cloudinary.com') ? 'Cloudinary Storage' : parsed.hostname
  } catch {
    return url
  }
}

async function loadInlinePdf() {
  if (!source.value) return
  originalDocState.value.status = 'resolving'
  originalDocState.value.error = undefined
  originalDocState.value.reason = undefined

  try {
    if (source.value.canInlinePreview && source.value.inlineProxyUrl) {
      const { data } = await apiClient.get<Blob>(
        source.value.inlineProxyUrl,
        { responseType: 'blob' }
      )

      if (data.type !== 'application/pdf') {
        const text = await data.text()
        try {
          const parsed = JSON.parse(text)
          if (parsed && parsed.success === false) {
            if (parsed.code === 'SSRF_BLOCKED') {
              originalDocState.value.status = 'blocked'
              originalDocState.value.reason = parsed.message || 'URL bị chặn bởi kiểm tra an toàn SSRF.'
            } else {
              originalDocState.value.status = 'failed'
              originalDocState.value.error = parsed.message || 'Lỗi khi tải tài liệu PDF.'
            }
            return
          }
        } catch {}
      }

      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl)
      }
      activeBlobUrl = URL.createObjectURL(data)
      iframeUrl.value = activeBlobUrl.includes('#') ? `${activeBlobUrl}&toolbar=0&navpanes=0` : `${activeBlobUrl}#toolbar=0&navpanes=0`
      originalDocState.value.status = 'pdf_inline_ready'
    } else {
      originalDocState.value.status = 'failed'
      originalDocState.value.error = 'Tài liệu PDF này không hỗ trợ hiển thị trực tiếp. Vui lòng mở bên ngoài hoặc tải về.'
    }
  } catch (err: any) {
    console.error('Error loading preview inline PDF:', err)
    originalDocState.value.status = 'failed'
    originalDocState.value.error = err.message || 'Không thể kết nối đến máy chủ để tải PDF.'
  }
}

async function handleSwitchToOriginal() {
  activeTab.value = 'original'
  if (originalDocState.value.status !== 'pdf_inline_ready' || !iframeUrl.value) {
    await loadInlinePdf()
  }
}

onUnmounted(() => {
  if (activeBlobUrl) {
    URL.revokeObjectURL(activeBlobUrl)
    activeBlobUrl = ''
  }
  iframeUrl.value = ''
})

function downloadPdf() {
  const fileUrl = pdfUrl.value
  if (fileUrl) {
    const link = document.createElement('a')
    link.href = fileUrl
    link.target = '_blank'
    link.download = `${source.value?.title || 'document'}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

function openPdfInNewTab() {
  const fileUrl = pdfUrl.value
  if (fileUrl) {
    window.open(fileUrl, '_blank', 'noopener,noreferrer')
  }
}

// ----------------- Smart Reader Parsing Utilities -----------------
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
      'co', 'pre', 'post', 'non', 'self', 'anti', 'multi', 'semi', 'sub', 'cross',
      'inter', 'intra', 'pro', 'pseudo', 'ex', 'ultra', 'micro', 'macro', 'bio',
      'geo', 'eco', 'cyber', 'neuro', 'psycho', 'socio'
    ]).has(n) ||
    new Set([
      'well', 'ill', 'good', 'bad', 'high', 'low', 'long', 'short', 'full', 'part',
      'half', 'first', 'last', 'second', 'third', 'free', 'new', 'old'
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

function sanitizeReferenceHtml(html: string): string {
  if (!html) return ''
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
    const container = doc.querySelector('div')
    if (!container) return ''

    const allowedTags = new Set(['A', 'I', 'EM', 'B', 'STRONG', 'SUB', 'SUP', 'SPAN'])
    
    const cleanNode = (node: Node) => {
      const childNodes = Array.from(node.childNodes)
      for (const child of childNodes) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement
          const tagName = el.tagName.toUpperCase()
          
          if (!allowedTags.has(tagName)) {
            if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'IFRAME' || tagName === 'EMBED' || tagName === 'OBJECT') {
              el.remove()
              continue
            }
            while (el.firstChild) {
              el.parentNode?.insertBefore(el.firstChild, el)
            }
            el.remove()
          } else {
            const attrs = Array.from(el.attributes)
            attrs.forEach(attr => {
              const name = attr.name.toLowerCase()
              if (tagName === 'A' && name === 'href') {
                const val = attr.value.trim().toLowerCase()
                if (val.startsWith('javascript:')) {
                  el.removeAttribute(attr.name)
                }
              } else if (tagName === 'A' && (name === 'target' || name === 'rel')) {
                // Keep target and rel
              } else {
                el.removeAttribute(attr.name)
              }
            })
            cleanNode(el)
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          // Keep text nodes
        } else {
          child.remove()
        }
      }
    }

    cleanNode(container)
    return container.innerHTML
  } catch (err) {
    console.error('Error sanitizing HTML:', err)
    return html.replace(/<[^>]*>/g, '')
  }
}

function cleanReferenceBlock(block: any) {
  const actions: any[] = []
  let text = block.text || ''
  let html = block.html || ''

  const derivedBlock = { ...block }

  if (html) {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
      const container = doc.querySelector('div')
      if (container) {
        const anchors = container.querySelectorAll('a')
        anchors.forEach(a => {
          const aText = a.textContent?.trim() || ''
          const href = a.getAttribute('href') || ''
          
          const isViewArticle = aText.toLowerCase().includes('view article')
          const isPubMed = aText.toLowerCase().includes('pubmed')
          const isGoogleScholar = aText.toLowerCase().includes('google scholar')
          const isDoi = href.includes('doi.org')
          const isScholar = href.includes('scholar.google')
          const isPubmedUrl = href.includes('ncbi.nlm.nih.gov/pubmed') || href.includes('pubmed.ncbi')
          
          if (href && (isViewArticle || isPubMed || isGoogleScholar || isDoi || isScholar || isPubmedUrl)) {
            let label = aText
            if (isViewArticle) label = 'View Article'
            else if (isPubMed) label = 'PubMed/NCBI'
            else if (isGoogleScholar) label = 'Google Scholar'
            else if (isDoi) label = 'DOI'
            
            actions.push({
              label,
              url: href
            })
            a.remove()
          }
        })

        let cleanedHtml = container.innerHTML
        let cleanedText = container.textContent || ''

        const cleanTexts = ['View Article', 'PubMed/NCBI', 'Google Scholar', 'PubMed', 'Google', 'Scholar']
        cleanTexts.forEach(t => {
          const regex = new RegExp(t, 'g')
          cleanedText = cleanedText.replace(regex, '')
          cleanedHtml = cleanedHtml.replace(regex, '')
        })
        
        cleanedText = cleanedText.replace(/[\s,\.\-\|•/]+$/, '').trim()
        cleanedHtml = cleanedHtml.replace(/[\s,\.\-\|•/]+$/, '').trim()

        derivedBlock.html = sanitizeReferenceHtml(cleanedHtml)
        derivedBlock.text = cleanedText
        derivedBlock.actions = actions
        return derivedBlock
      }
    } catch (err) {
      console.error('Error cleaning reference HTML:', err)
    }
  }

  const cleanPatterns = [
    /View Article\s*PubMed\/NCBI\s*Google Scholar/i,
    /View Article/i,
    /PubMed\/NCBI/i,
    /Google Scholar/i
  ]
  
  let cleanedText = text
  cleanPatterns.forEach(pat => {
    cleanedText = cleanedText.replace(pat, '')
  })
  cleanedText = cleanedText.replace(/[\s,\.\-\|•/]+$/, '').trim()

  derivedBlock.text = cleanedText
  derivedBlock.actions = actions
  return derivedBlock
}

function processReaderContent(sections: any[], quality = 'low', engine: string) {
  let rawNormalBlocks: any[] = []
  let metadataBlocks: any[] = []
  let metadata: string[] = []

  if (quality === 'high' || quality === 'medium' || ['html', 'xml', 'jats_xml', 'publisher_html', 'sanitized_html'].includes(engine)) {
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
  } else {
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

  let refCounter = 1
  finalNormalBlocks.forEach(block => {
    if (block.type === 'reference' || block.sectionType === 'reference_item') {
      const textVal = block.text || ''
      const startsWithNum = /^\s*\[\s*\d+\s*\]/i.test(textVal) || /^\s*\d+\s*[\.\:]/i.test(textVal)
      if (!startsWithNum) {
        block.refNumber = refCounter++
      }
    }
  })

  return {
    metadata,
    pages: paginateBlocks(finalNormalBlocks),
    metadataBlocks
  }
}

// ----------------- Data Loading & State Handlers -----------------
const fetchPreviewData = async () => {
  isLoading.value = true
  fetchError.value = ''
  try {
    const res = await getSourcePreview(contributionId)
    if (res.success && res.data) {
      source.value = res.data.source
      fullText.value = res.data.fullText
      sections.value = res.data.sections || []
      
      initOriginalDocState()

      if (!source.value.smartReaderAvailable && (source.value.originalFile || source.value.pdfUrl)) {
        activeTab.value = 'original'
      } else {
        activeTab.value = 'smart'
      }
    } else {
      fetchError.value = 'Không thể tải thông tin xem trước nguồn.'
    }
  } catch (err: any) {
    fetchError.value = err.message || 'Lỗi kết nối mạng.'
  } finally {
    isLoading.value = false
  }
}

const triggerPreviewParsing = async () => {
  if (isParsing.value) return
  isParsing.value = true
  try {
    const res = await importFullText(contributionId)
    if (res.success) {
      await fetchPreviewData()
    } else {
      alert(res.message || 'Trích xuất toàn văn thất bại.')
    }
  } catch (err: any) {
    alert(err.message || 'Lỗi khi kết nối đến dịch vụ nạp bản đọc.')
  } finally {
    isParsing.value = false
  }
}

// Processed reader pages
const processedReader = computed(() => {
  if (!sections.value || sections.value.length === 0) {
    return { metadata: [], pages: [], metadataBlocks: [] }
  }
  const quality = fullText.value?.extractionQuality || 'low'
  const engine = fullText.value?.extractionEngine || 'unknown'
  return processReaderContent(sections.value, quality, engine)
})

const readerPages = computed(() => processedReader.value.pages)
const totalPages = computed(() => readerPages.value.length)
const readerMetadata = computed(() => processedReader.value.metadata)
const readerMetadataBlocks = computed(() => processedReader.value.metadataBlocks)

const readerWarnings = computed(() => fullText.value?.warnings || [])
const smartReaderSourceType = computed(() => fullText.value?.smartReaderSourceType || '')
const extractionEngine = computed(() => fullText.value?.extractionEngine || '')
const extractionQuality = computed(() => fullText.value?.extractionQuality || '')

const displayDoi = computed(() => {
  return !source.value || !source.value.doi ? '' : source.value.doi.replace(/^(doi|DOI):\s*/, '').trim()
})

const copyDoi = () => {
  const doi = displayDoi.value
  if (doi) {
    navigator.clipboard.writeText(doi)
    settingsStore.showToast('Đã sao chép DOI.', 'success')
  }
}

const goBack = () => {
  router.push('/moderation/sources')
}

const confirmReview = (status: 'approved' | 'rejected') => {
  confirmDialog.value = {
    show: true,
    title: status === 'approved' ? 'Duyệt đóng góp nguồn học thuật' : 'Từ chối đóng góp nguồn học thuật',
    message: status === 'approved'
      ? 'Bạn có chắc chắn duyệt nguồn đóng góp này? Nguồn sẽ được chuẩn hóa thành AcademicSource chính thức và các bản đọc xem trước (nếu có) sẽ được chuyển giao.'
      : 'Bạn có chắc chắn từ chối đóng góp này? Đóng góp sẽ bị đánh dấu là Rejected và không xuất hiện trong catalog.',
    reviewStatus: status,
    confirmText: status === 'approved' ? 'Xác nhận duyệt' : 'Xác nhận từ chối',
    cancelText: 'Hủy bỏ'
  }
}

const executeReview = async () => {
  confirmDialog.value.show = false
  if (isSubmittingReview.value) return
  isSubmittingReview.value = true
  
  try {
    const status = confirmDialog.value.reviewStatus
    const res = await reviewSource(contributionId, {
      reviewStatus: status,
      reviewNote: reviewNote.value.trim() || undefined
    })

    if (res.success) {
      alert(res.message || 'Xử lý kiểm duyệt thành công.')
      router.push('/moderation/sources')
    } else {
      alert(res.message || 'Cập nhật trạng thái kiểm duyệt thất bại.')
    }
  } catch (err: any) {
    alert(err.message || 'Lỗi kết nối khi cập nhật kiểm duyệt.')
  } finally {
    isSubmittingReview.value = false
  }
}

function increaseFontSize() {
  if (fontSize.value < 22) fontSize.value += 1
}

function decreaseFontSize() {
  if (fontSize.value > 14) fontSize.value -= 1
}

function goToPageIndex(idx: number) {
  currentPageIndex.value = idx
}

function onPageChange(e: Event) {
  const selectEl = e.target as HTMLSelectElement
  const val = parseInt(selectEl.value, 10)
  if (!isNaN(val)) {
    goToPageIndex(val)
  }
}

function handleReaderContentClick() {
  // Empty stub for compatibility
}

function extractListMarker(text: string) {
  let t = text.trim()
  let marker = ''
  if (t.startsWith('•')) {
    marker = '•'
    t = t.substring(1).trim()
  } else if (t.startsWith('-')) {
    marker = '-'
    t = t.substring(1).trim()
  } else if (t.startsWith('*')) {
    marker = '•'
    t = t.substring(1).trim()
  }
  let parenMatch = t.match(/^(\(?[a-zA-Z0-9]+\))\s*(.*)$/)
  if (parenMatch) {
    return { marker: parenMatch[1], restText: parenMatch[2] }
  }
  let dotMatch = t.match(/^(([0-9]+(\.[0-9]+)*\.)|([a-zA-Z]\.))\s*(.*)$/)
  if (dotMatch) {
    return { marker: dotMatch[1], restText: dotMatch[5] }
  }
  return { marker: marker || '-', restText: t }
}

function getFriendlySourceType(type: string): string {
  switch (type) {
    case 'jats_xml': return 'JATS/XML'
    case 'publisher_html': return 'HTML nhà xuất bản'
    case 'sanitized_html': return 'HTML trang web'
    case 'pdf_text':
    case 'uploaded_pdf_text': return 'PDF parser'
    default: return 'PDF parser'
  }
}

function getBadgeClass(type: string): string {
  switch (type) {
    case 'jats_xml': return 'reader-source-badge--xml'
    case 'publisher_html': return 'reader-source-badge--pub-html'
    case 'sanitized_html': return 'reader-source-badge--web-html'
    case 'pdf_text':
    case 'uploaded_pdf_text': return 'reader-source-badge--pdf'
    default: return 'reader-source-badge--pdf'
  }
}

function getInnerHtml(html: string): string {
  if (!html) return ''
  let startIdx = html.indexOf('>')
  let endIdx = html.lastIndexOf('<')
  return startIdx !== -1 && endIdx !== -1 && endIdx > startIdx ? html.substring(startIdx + 1, endIdx) : html
}

onMounted(() => {
  fetchPreviewData()
})
</script>

<style scoped>
.preview-mode-container {
  padding: var(--space-4);
  max-width: 1440px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.preview-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1c1c1e;
  border-left: 4px solid var(--color-accent-teal, #0d9488);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
}

.banner-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: var(--color-text-primary, #ffffff);
  font-size: var(--text-md, 1rem);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: var(--color-accent-teal, #0d9488);
  border-radius: 50%;
  margin-right: var(--space-2);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.9); opacity: 0.9; }
  50% { transform: scale(1.2); opacity: 0.4; }
  100% { transform: scale(0.9); opacity: 0.9; }
}

/* Duplicate original detail workspace styles to guarantee identical layout */
.source-detail-workspace {
  width: 100%;
  max-width: none;
  height: calc(100vh - 120px);
  min-height: 0;
  display: grid;
  grid-template-columns:
    clamp(180px, 13vw, 240px)
    minmax(0, 1fr)
    clamp(280px, 20vw, 340px);
  gap: clamp(16px, 1.6vw, 28px);
  overflow: hidden;
}

@media (min-width: 993px) and (max-width: 1240px) {
  .source-detail-workspace {
    grid-template-columns:
      clamp(140px, 12vw, 200px)
      minmax(0, 1fr)
      clamp(220px, 18vw, 260px);
    gap: var(--space-4);
  }
}

.workspace-left {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding-top: var(--space-4);
  padding-bottom: var(--space-6);
  align-items: flex-start;
  padding-left: clamp(16px, 2vw, 40px);
}

.back-link-compact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--color-text-secondary, #aeaeb2);
  font-size: var(--font-size-sm, 14px);
  font-weight: 600;
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md, 6px);
  transition: color 0.2s, background-color 0.2s;
  width: 100%;
  text-align: left;
}

.back-link-compact:hover {
  color: var(--color-text-primary, #ffffff);
  background: var(--color-bg-hover, #262626);
}

.workspace-center {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  min-width: 0;
}

.reader-tabs-row {
  display: flex;
  gap: 4px;
  margin-bottom: 0;
  padding-left: var(--space-2);
  z-index: 2;
  flex-shrink: 0;
}

.bookmark-tab {
  display: inline-flex;
  align-items: center;
  height: 38px;
  box-sizing: border-box;
  padding: 0 16px;
  font-size: var(--font-size-sm, 14px);
  font-weight: 600;
  color: var(--color-text-secondary, #aeaeb2);
  background: #111111;
  border: 1px solid var(--color-border, #262626);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  margin-bottom: -1px;
}

.bookmark-tab:hover {
  background: var(--color-bg-hover, #222222);
  color: var(--color-text-primary, #ffffff);
}

.bookmark-tab.active {
  background: #181818;
  color: var(--color-text-primary, #ffffff);
  border-bottom: 1px solid #181818;
  z-index: 3;
}

.reader-content-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #181818;
  border: 1px solid var(--color-border, #262626);
  border-radius: var(--radius-lg, 8px);
  overflow: hidden;
  position: relative;
  min-height: 0;
}

.reader-content-card.no-tabs {
  margin-top: var(--space-4);
}

.reader-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  position: relative;
  scroll-behavior: smooth;
}

.original-view-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.original-pdf-viewer-shell {
  width: 100%;
  height: 100%;
  flex: 1;
  border: none;
  overflow: hidden;
  min-height: 0;
  border-radius: var(--radius-md, 6px);
}

.original-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #181818;
}

.fallback-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-10) var(--space-6);
  background: var(--color-bg-elevated, #1c1c1e);
  border: 1px solid var(--color-border, #2c2c2e);
  border-radius: var(--radius-lg, 8px);
  gap: var(--space-3);
  color: var(--color-text-secondary, #aeaeb2);
  margin: var(--space-4);
  max-width: 500px;
  align-self: center;
}

.fallback-icon {
  color: var(--color-text-muted, #8e8e93);
  margin-bottom: var(--space-2);
}

.fallback-card h3 {
  margin: 0;
  font-size: var(--font-size-md, 16px);
  font-weight: 600;
  color: var(--color-text-primary, #ffffff);
}

.fallback-card p {
  margin: 0;
  font-size: var(--font-size-sm, 14px);
  color: var(--color-text-muted, #8e8e93);
}

.reader-header-area {
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--color-border, #262626);
  padding-bottom: var(--space-4);
  flex-shrink: 0;
  max-width: 720px;
  margin-inline: auto;
}

.reader-title {
  font-size: var(--font-size-2xl, 1.5rem);
  font-weight: var(--font-weight-bold, 700);
  line-height: var(--line-height-tight, 1.25);
  color: var(--color-text-primary, #ffffff);
  margin-bottom: var(--space-3);
}

.reader-source-badge-wrap {
  margin-bottom: var(--space-4);
}

.reader-source-badge {
  display: inline-block;
  font-size: var(--font-size-xs, 0.75rem);
  font-weight: var(--font-weight-semibold, 600);
  padding: var(--space-1) 10px;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid transparent;
}

.reader-source-badge--xml {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.reader-source-badge--pub-html {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.reader-source-badge--web-html {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.reader-source-badge--pdf {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}

.reader-pagination {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  max-width: 720px;
  margin-inline: auto;
}

.reader-pagination--top {
  margin-top: var(--space-2);
}

.reader-pagination--bottom {
  margin-top: var(--space-8);
  border-top: 1px solid var(--color-border, #262626);
  padding-top: var(--space-6);
}

.pagination-btn-placeholder {
  min-width: 120px;
}

.pagination-btn-placeholder.text-right {
  text-align: right;
}

.page-selector-container {
  position: relative;
  display: inline-block;
  width: 140px;
}

.page-select-dropdown {
  width: 100%;
  background: var(--color-bg-elevated, #181818);
  border: 1px solid var(--color-border, #262626);
  border-radius: var(--radius-md, 6px);
  padding: 6px 30px 6px 12px;
  color: var(--color-text-primary, #ffffff);
  font-size: var(--font-size-sm, 14px);
  font-weight: 500;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  text-align-last: center;
  transition: background 0.2s, border-color 0.2s;
}

.page-select-dropdown:hover,
.page-select-dropdown:focus {
  background: var(--color-bg-hover, #262626);
  border-color: var(--color-border-input, #3a3a3a);
}

.page-select-arrow {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--color-text-secondary, #aeaeb2);
  display: flex;
  align-items: center;
}

.reader-low-quality-warning-banner {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: #2a1e08;
  border: 1px solid #3d2d10;
  border-radius: var(--radius-md, 6px);
  padding: 10px 12px;
  margin-bottom: var(--space-4);
  color: #f59e0b;
  font-size: var(--font-size-sm, 14px);
  max-width: 720px;
  margin-inline: auto;
}

.warning-banner-content {
  display: flex;
  gap: 8px;
  line-height: 1.4;
}

.dismiss-warning-btn {
  background: transparent;
  border: none;
  color: #f59e0b;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.reader-warning-banner {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(237, 73, 86, 0.1);
  border: 1px solid rgba(237, 73, 86, 0.2);
  border-radius: var(--radius-md, 6px);
  padding: 10px 12px;
  margin-bottom: var(--space-4);
  max-width: 720px;
  margin-inline: auto;
}

.warning-item {
  display: flex;
  gap: 8px;
  color: #ed4956;
  font-size: var(--font-size-sm, 14px);
  line-height: 1.4;
}

.reader-reading-surface {
  min-height: 400px;
}

.reader-block {
  margin-bottom: var(--space-5);
  line-height: var(--line-height-relaxed, 1.6);
  font-size: var(--reader-font-size, 17px);
}

.reader-paragraph-text {
  text-align: justify;
  margin: 0;
  color: var(--color-text-primary, #ffffff);
  text-indent: 0.7cm;
}

.reader-heading-text {
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-text-primary, #ffffff);
  margin-top: var(--space-6);
  margin-bottom: var(--space-3);
  line-height: var(--line-height-tight, 1.25);
}

.reader-heading--level-1 {
  font-size: 1.4em;
  border-bottom: 1px solid var(--color-border, #262626);
  padding-bottom: 0.35rem;
}

.reader-heading--level-2 {
  font-size: 1.25em;
  margin-top: 1.8rem;
}

.reader-heading--level-3 {
  font-size: 1.12em;
  margin-top: 1.5rem;
}

.reader-heading--level-4 {
  font-size: 1.0em;
}

.reader-list-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  margin: 0;
  color: var(--color-text-primary, #ffffff);
}

.list-marker {
  font-weight: bold;
}

.reader-reference-card {
  background: var(--color-bg-elevated, #1c1c1e);
  border: 1px solid var(--color-border, #2c2c2e);
  border-radius: var(--radius-md, 6px);
  padding: var(--space-3) var(--space-4);
  margin-block: var(--space-3);
}

.reference-card-text {
  margin: 0;
  font-size: 0.9em;
  color: var(--color-text-secondary, #aeaeb2);
}

.reference-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.reference-action-chip {
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  background: var(--color-bg-subtle, #262626);
  color: var(--color-text-secondary, #aeaeb2);
  padding: 2px 8px;
  border-radius: 12px;
  text-decoration: none;
  border: 1px solid var(--color-border, #3a3a3a);
  transition: background 0.2s, color 0.2s;
}

.reference-action-chip:hover {
  background: var(--color-bg-hover, #333333);
  color: var(--color-text-primary, #ffffff);
}

.collapsible-metadata-card {
  margin-top: var(--space-6);
  border: 1px solid var(--color-border, #262626);
  border-radius: var(--radius-md, 6px);
  overflow: hidden;
  max-width: 720px;
  margin-inline: auto;
}

.metadata-toggle-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: #111111;
  border: none;
  color: var(--color-text-secondary, #aeaeb2);
  font-weight: 600;
  font-size: var(--font-size-sm, 14px);
  cursor: pointer;
}

.metadata-card-content {
  padding: var(--space-4);
  background: #181818;
  border-top: 1px solid var(--color-border, #262626);
}

.metadata-item-text {
  margin: 0 0 6px 0;
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-muted, #8e8e93);
}

.bullet-success {
  background: rgba(16, 185, 129, 0.15) !important;
  color: #10b981 !important;
}

.workspace-right {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding-right: var(--space-2);
}

.original-loading {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 400px;
  gap: var(--space-3);
  color: var(--color-text-muted, #8e8e93);
  overflow: hidden;
  border-radius: var(--radius-md, 6px);
  background: #181818;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--color-text-primary, #ffffff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.skeleton-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    rgba(38, 38, 38, 0) 0%,
    rgba(38, 38, 38, 0.4) 50%,
    rgba(38, 38, 38, 0) 100%
  );
  background-size: 200% 100%;
  animation: shimmer-anim 1.5s infinite;
  pointer-events: none;
}

@keyframes shimmer-anim {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.reader-rich-block {
  margin: var(--space-6, 1.5rem) 0;
  width: 100%;
}

:deep(.figure-block) {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: var(--space-6, 1.5rem) 0;
  gap: var(--space-3, 0.75rem);
  text-align: center;
  width: 100%;
}

:deep(.figure-block .figure-img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md, 6px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: block;
  margin: 0 auto;
}

:deep(.figure-block .caption),
:deep(.table-block .caption) {
  font-size: var(--font-size-sm, 14px);
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-text-secondary, #aeaeb2);
  margin: var(--space-2, 0.5rem) 0 0 0;
  line-height: 1.4;
  text-align: center;
}

:deep(.figure-block .legend) {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-muted, #8e8e93);
  margin: 0;
  max-width: 800px;
  line-height: 1.4;
  text-align: center;
}

:deep(.table-block) {
  margin: var(--space-6, 1.5rem) 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

:deep(.table-wrapper) {
  overflow-x: auto;
  width: 100%;
  max-width: 100%;
  background: var(--color-bg-base, #101010);
  box-sizing: border-box;
}

@media (min-width: 640px) {
  :deep(.table-wrapper) {
    width: calc(100% + 40px);
    max-width: calc(100% + 40px);
    margin-left: -20px;
    margin-right: -20px;
  }
}

:deep(.table-wrapper table) {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm, 14px);
  color: var(--color-text-secondary, #aeaeb2);
  text-align: left;
  border: 1px solid var(--color-border-input, #3a3a3a);
}

:deep(.table-wrapper th),
:deep(.table-wrapper td) {
  padding: 8px 10px;
  border: 1px solid var(--color-border-input, #3a3a3a);
  line-height: 1.45;
  word-break: normal;
  overflow-wrap: anywhere;
  vertical-align: top;
}

:deep(.table-wrapper th) {
  background: var(--color-bg-surface, #1e1e1e);
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-text-primary, #ffffff);
  border-bottom: 2px solid var(--color-border-input, #3a3a3a);
}

.placeholder-error {
  color: var(--color-error, #ef4444);
  font-size: var(--font-size-sm, 14px);
  margin: 0;
}

.reader-placeholder-card {
  border: 1px dashed var(--color-border-input, #3a3a3a);
  border-radius: var(--radius-lg, 8px);
  padding: var(--space-5);
  background: var(--color-bg-base, #101010);
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.placeholder-caption {
  font-size: var(--font-size-sm, 14px);
  color: var(--color-text-secondary, #aeaeb2);
  margin: 0;
  line-height: 1.5;
}

.placeholder-link-wrapper {
  margin-top: var(--space-1);
}

.placeholder-link {
  color: var(--color-primary, #60a5fa);
  font-size: var(--font-size-xs, 12px);
  text-decoration: underline;
  font-weight: 600;
  cursor: pointer;
}

.placeholder-link:hover {
  color: #3b82f6;
  text-decoration: none;
}

.reference-number {
  font-weight: 700;
  color: var(--color-primary, #60a5fa);
  margin-right: 6px;
  user-select: none;
}
</style>
