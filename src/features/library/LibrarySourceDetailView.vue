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
      <AppButton variant="secondary" size="sm" @click="fetchSource">Tải lại</AppButton>
    </div>

    <!-- Main Content Grid -->
    <div v-else class="source-detail-workspace">
      <!-- Left Column: Back button & Font controls -->
      <div class="workspace-left">
        <button class="back-link-compact" @click="router.push('/library')">
          <svg class="back-arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>Thư viện</span>
        </button>

        <!-- Font size controls in left rail -->
        <div v-if="source && source.readableInApp && activeTab === 'smart'" class="left-rail-size-controls">
          <button class="size-btn" @click="decreaseFontSize" :disabled="fontSize <= 14" title="Thu nhỏ chữ">A-</button>
          <span class="size-val">{{ fontSize }}px</span>
          <button class="size-btn" @click="increaseFontSize" :disabled="fontSize >= 22" title="Phóng to chữ">A+</button>
        </div>
      </div>

      <!-- Center Column: Reader Tabs + Content Area -->
      <div class="workspace-center">
        <!-- Twin Tabs for Reader Mode (only if readable or has PDF) -->
        <div v-if="source.readableInApp || !!getOriginalPdfUrl(source)" class="reader-tabs-row">
          <button 
            v-if="source.readableInApp"
            :class="['bookmark-tab', { active: activeTab === 'smart' }]" 
            @click="activeTab = 'smart'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            Bản đọc thông minh
            <span v-if="extractionQuality === 'low'" class="tab-warning-badge" title="Cấu trúc layout chưa tối ưu">Cần đối chiếu</span>
          </button>
          <button 
            v-if="source.readableInApp || !!getOriginalPdfUrl(source)"
            :class="['bookmark-tab', { active: activeTab === 'original' }]" 
            @click="handleSwitchToOriginal"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Bản gốc
          </button>
        </div>

        <!-- Reader Card Content Area -->
        <div class="reader-content-card" :class="{ 'no-tabs': !source.readableInApp }">
          <div class="reader-scroll-area" :style="source.readableInApp ? { '--reader-font-size': `${fontSize}px` } : {}">
            
            <!-- Case A: Source is readable or has PDF -> Show reader/PDF directly in the main column -->
            <template v-if="source.readableInApp || !!getOriginalPdfUrl(source)">
              <!-- Mode A: Original View -->
              <div v-if="activeTab === 'original' || !source.readableInApp" class="original-view-container">
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
                    ref="pdfIframeRef"
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
                    Mở bài viết gốc ↗
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
              <template v-if="source.readableInApp && activeTab === 'smart'">
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
                <div v-if="isModeratorUser && readerWarnings && readerWarnings.length > 0" class="reader-warning-banner">
                  <template v-for="(warning, wIdx) in readerWarnings" :key="wIdx">
                    <div v-if="!warning.includes('bố cục') && !warning.includes('cấu trúc') && !warning.includes('thứ tự')" class="warning-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 2px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      <span>{{ warning }}</span>
                    </div>
                  </template>
                </div>

                <!-- Reader Content Loading state -->
                <div v-if="isLoadingReader" class="reader-loading">
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
                        <span class="list-marker">{{ extractListMarker(block.text).marker }}</span>
                        <span v-if="block.html" class="list-text" v-html="getInnerHtml(block.html)"></span>
                        <span v-else class="list-text">{{ extractListMarker(block.text).restText }}</span>
                      </div>
                      
                      <!-- reference_item / reference -->
                      <div 
                        v-else-if="block.type === 'reference' || block.sectionType === 'reference_item'" 
                        class="reader-reference-card"
                      >
                        <p v-if="block.html" class="reference-card-text" v-html="getInnerHtml(block.html)"></p>
                        <p v-else class="reference-card-text">{{ block.text }}</p>
                        
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

                      <!-- figure / table placeholder -->
                      <div v-else-if="block.type === 'figure' || block.type === 'table'" class="reader-placeholder-card">
                        <div class="placeholder-header">
                          <span class="placeholder-icon">
                            <svg v-if="block.type === 'figure'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>
                          </span>
                          <span class="placeholder-label">
                            {{ block.type === 'figure' ? 'Hình ảnh / Biểu đồ' : 'Bảng số liệu' }}
                          </span>
                        </div>
                        <p v-if="block.html" class="placeholder-caption" v-html="getInnerHtml(block.html)"></p>
                        <p v-else-if="block.text" class="placeholder-caption">{{ block.text }}</p>
                        <div v-if="block.style?.doiUrl" class="placeholder-link-wrapper">
                          <a :href="block.style.doiUrl" target="_blank" rel="noopener noreferrer" class="placeholder-link">
                            Xem chi tiết gốc (DOI) ↗
                          </a>
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
                <!-- Case B.1: available but readableInApp is false -->
                <div v-if="source.fullTextStatus === 'available' && hasImportCandidate" class="state-notice state-notice--warning">
                  <span class="state-icon"></span>
                  <div class="state-message-wrap">
                    <p class="state-message">
                      Có bản đọc hợp pháp, chờ nhập vào DreamScape.
                    </p>
                    <div class="state-actions-row">
                      <AppButton
                        v-if="isModeratorUser && isEligibleForImport"
                        variant="primary"
                        size="sm"
                        :loading="isImporting"
                        @click="handleImport"
                      >
                        Nhập bản đọc vào DreamScape
                      </AppButton>
                      <a v-if="originalLink" :href="originalLink" target="_blank" rel="noopener noreferrer" class="link-btn">
                        Xem tài liệu gốc ↗
                      </a>
                    </div>
                  </div>
                </div>

                <!-- Case B.2: failed and readableInApp is false -->
                <div v-else-if="source.fullTextStatus === 'failed'" class="state-notice state-notice--warning">
                  <span class="state-icon"></span>
                  <div class="state-message-wrap">
                    <p class="state-message">
                      Quá trình nhập bản đọc tự động thất bại.
                      <span v-if="source.fullTextImportError" class="import-error-msg"><br/>Chi tiết: {{ source.fullTextImportError }}</span>
                    </p>
                    <div class="state-actions-row">
                      <AppButton
                        v-if="isModeratorUser && isEligibleForImport"
                        variant="primary"
                        size="sm"
                        :loading="isImporting"
                        @click="handleImport"
                      >
                        Thử nhập lại
                      </AppButton>
                      <a v-if="originalLink" :href="originalLink" target="_blank" rel="noopener noreferrer" class="link-btn">
                        Xem tài liệu gốc ↗
                      </a>
                    </div>
                  </div>
                </div>

                <!-- Case B.3: paywalled / none / metadata_only -->
                <div v-else class="state-notice state-notice--muted">
                  <span class="state-icon"></span>
                  <div class="state-message-wrap">
                    <p class="state-message">
                      Tài liệu này hiện chỉ có thông tin trích dẫn. Hệ thống không lưu hoặc hiển thị nguyên văn vì chưa có bản đọc hợp pháp.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      <!-- Right Column: Sidebar (Always shown on the right) -->
      <div :class="['workspace-right', { 'with-tabs': source.readableInApp }]">
        <div class="attributes-card">
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
            <div v-if="source.metadata?.publisher || source.publisher" class="attribute-row">
              <span class="meta-key">Nhà xuất bản:</span>
              <span class="attribute-value">{{ source.metadata?.publisher || source.publisher }}</span>
            </div>
            <div v-if="source.readableInApp && totalPages" class="attribute-row">
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

          <!-- Moderator RAG and Re-import actions -->
          <div v-if="isModeratorUser && source.readableInApp" class="sidebar-moderation-row" style="margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-border, #262626);">
            <div class="moderation-tech-info" style="margin-bottom: var(--space-3); font-size: 0.85rem; line-height: 1.4;">
              <div class="tech-row" style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                <span style="color: var(--color-text-muted);">Trạng thái RAG:</span>
                <span :style="statusStyle" style="font-weight: 500;">{{ statusLabel }}</span>
              </div>
              <div v-if="source.chunkCount" class="tech-row" style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                <span style="color: var(--color-text-muted);">Số chunk:</span>
                <span>{{ source.chunkCount }}</span>
              </div>
              <div v-if="source.chunkEmbeddingModel" class="tech-row" style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                <span style="color: var(--color-text-muted);">Model Vector:</span>
                <span style="font-family: monospace;">{{ source.chunkEmbeddingModel }}</span>
              </div>
              <div v-if="extractionEngine" class="tech-row" style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                <span style="color: var(--color-text-muted);">Engine:</span>
                <span style="font-family: monospace;">{{ extractionEngine }}</span>
              </div>
              <div v-if="layoutQuality" class="tech-row" style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                <span style="color: var(--color-text-muted);">Chất lượng layout:</span>
                <span>{{ layoutQuality }}</span>
              </div>
              <div v-if="sourceUrlUsed" class="tech-row" style="display: flex; flex-direction: column; margin-bottom: var(--space-1); gap: 2px;">
                <span style="color: var(--color-text-muted);">Nguồn URL sử dụng:</span>
                <a :href="sourceUrlUsed" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary, #60a5fa); word-break: break-all; font-family: monospace; font-size: 0.75rem;">
                  {{ sourceUrlUsed }}
                </a>
              </div>
            </div>

            <AppButton
              v-if="isModeratorUser && source.readableInApp && source.fullTextStatus === 'imported'"
              variant="secondary"
              size="sm"
              block
              :loading="isCurrentlyExtracting"
              @click="handleExtractCandidates"
              style="margin-bottom: 8px;"
            >
              Phân tích để lấy luật
            </AppButton>

            <AppButton
              v-if="isModeratorUser && source.readableInApp && source.fullTextStatus === 'imported'"
              variant="danger"
              size="sm"
              block
              :loading="isCurrentlyReimporting"
              @click="promptReimport"
              style="margin-bottom: 8px;"
            >
              Nhập lại bản đọc
            </AppButton>

            <div v-if="hasApprovedRules" class="tech-row" style="margin-top: var(--space-2); color: #10b981; font-size: 0.85rem; font-weight: 500;">
              Tài liệu này đã đóng góp các quy luật được phê duyệt.
            </div>
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
              Mở PDF trong tab mới ↗
            </button>

            <!-- Original Filename Metadata -->
            <div v-if="source.originalFile?.originalFileName" class="source-link-row" style="font-size: 0.75rem; color: var(--color-text-muted); border-top: 1px solid var(--color-border, #262626); padding-top: var(--space-2); margin-top: 2px;">
              <span>Tên tệp gốc: </span>
              <span style="color: var(--color-text-secondary); word-break: break-all;">
                {{ source.originalFile.originalFileName }}
              </span>
            </div>
            
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
              Mở trang nguồn ↗
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

      <!-- Re-import confirmation dialog -->
      <AppConfirm
        v-model="showReimportConfirm"
        title="Thiết lập lại & Nhập lại bản đọc"
        message="Thao tác này sẽ xóa vĩnh viễn toàn bộ bản đọc hiện tại, các phân đoạn (sections), chunks, các đề xuất luật (candidates) và bằng chứng liên kết đã trích xuất. Đặc biệt: Nếu quá trình nhập bản đọc mới gặp lỗi thất bại, toàn bộ bản đọc cũ của tài liệu này vẫn sẽ bị mất. Bạn có chắc chắn muốn tiếp tục?"
        confirm-label="Nhập lại"
        cancel-label="Hủy"
        :danger="true"
        :loading="isCurrentlyReimporting"
        @confirm="handleReimportConfirm"
        @cancel="showReimportConfirm = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getApprovedSourceById, getApprovedSourceRead, getApprovedSourceOriginalDocument, getApprovedSourcePdfInline } from '@/api/sourceApi'
import { resolveSourceType } from '@/utils/sourceTypeHelper'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { importFullText, reimportFullText } from '@/api/moderationApi'
import { getRuleCandidates } from '@/api/ruleCandidateApi'
import { useExtractionStore } from '@/store/useExtractionStore'
import AppButton from '@/components/common/AppButton.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'

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
      'co',
      'pre',
      'post',
      'non',
      'self',
      'anti',
      'multi',
      'semi',
      'sub',
      'cross',
      'inter',
      'intra',
      'pro',
      'pseudo',
      'ex',
      'ultra',
      'micro',
      'macro',
      'bio',
      'geo',
      'eco',
      'cyber',
      'neuro',
      'psycho',
      'socio'
    ]).has(n) ||
    new Set([
      'well',
      'ill',
      'good',
      'bad',
      'high',
      'low',
      'long',
      'short',
      'full',
      'part',
      'half',
      'first',
      'last',
      'second',
      'third',
      'free',
      'new',
      'old'
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

  return {
    metadata,
    pages: paginateBlocks(finalNormalBlocks),
    metadataBlocks
  }
}

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const source = ref<any>(null)
const isLoading = ref(true)
const hasError = ref(false)
const isImporting = ref(false)
const extractionStore = useExtractionStore()

// Source Type and dynamic helpers
const sourceType = computed(() => resolveSourceType(source.value))
const isIsbnSource = computed(() => sourceType.value === 'isbn')
const isWebUrlSource = computed(() => sourceType.value === 'web_url')

const iframeUrl = computed(() => {
  const url = originalDocState.value.pdfViewUrl
  if (!url) return ''
  return url.includes('#') ? `${url}&toolbar=0&navpanes=0` : `${url}#toolbar=0&navpanes=0`
})

// Reader state variables
const activeTab = ref<'smart' | 'original'>('smart')

const originalDocState = ref<{
  status: 'idle' | 'resolving' | 'pdf_ready' | 'pdf_inline_ready' | 'article_only' | 'metadata_only' | 'blocked' | 'failed'
  hasPdf: boolean
  canInlinePdf: boolean
  pdfViewUrl?: string
  pdfDownloadUrl?: string
  sourceArticleUrl?: string
  sourceLabel?: string
  reason?: string
  error?: string
}>({
  status: 'idle',
  hasPdf: false,
  canInlinePdf: false
})

const readerWarnings = ref<string[]>([])
const ocrNeeded = ref(false)

let activeBlobUrl: string | null = null

function cleanActiveBlobUrl() {
  if (activeBlobUrl) {
    URL.revokeObjectURL(activeBlobUrl)
    activeBlobUrl = null
  }
}



function getOriginalPdfUrl(source: any) {
  // Priority 1: Explicit pdfUrl field
  if (source?.pdfUrl && source.pdfUrl.trim().startsWith('http')) {
    return source.pdfUrl
  }
  // Priority 2: Uploaded PDF via Cloudinary
  const cloudUrl = source?.originalFile?.cloudinarySecureUrl || source?.originalFile?.secureUrl || source?.originalFile?.url
  if (cloudUrl) return cloudUrl
  // Priority 3: fullTextUrl only if it looks like a PDF
  if (source?.fullTextUrl && source.fullTextUrl.trim().startsWith('http')) {
    const lower = source.fullTextUrl.toLowerCase()
    if (lower.endsWith('.pdf') || lower.includes('/pdf/') || lower.includes('/pdf?')) {
      return source.fullTextUrl
    }
  }
  // Priority 4: Metadata stored PDF URLs from Unpaywall
  const metaPdf = source?.metadata?.pdfUrl || source?.metadata?.best_oa_location?.url_for_pdf || source?.metadata?.bestOaLocation?.url_for_pdf
  if (metaPdf && typeof metaPdf === 'string' && metaPdf.trim().startsWith('http')) {
    return metaPdf
  }
  return ''
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

function initOriginalDocState() {
  if (!source.value) {
    originalDocState.value = { status: 'idle', hasPdf: false, canInlinePdf: false }
    return
  }
  
  const pdfUrl = getOriginalPdfUrl(source.value)
  const hasPdf = !!pdfUrl
  const sourceLabel = getDisplaySourceLink(pdfUrl || source.value.url || source.value.sourceUrl || '')
  
  if (hasPdf) {
    originalDocState.value = {
      status: 'pdf_ready',
      hasPdf: true,
      canInlinePdf: true,
      pdfDownloadUrl: pdfUrl,
      pdfViewUrl: originalDocState.value.pdfViewUrl || pdfUrl,
      sourceArticleUrl: source.value.url || source.value.sourceUrl || source.value.fullTextUrl || (source.value.doi ? `https://doi.org/${source.value.doi.replace(/^(doi|DOI):\s*/, '').trim()}` : ''),
      sourceLabel
    }
  } else {
    const articleUrl = source.value.fullTextUrl || source.value.url || source.value.landingPageUrl || (source.value.doi ? `https://doi.org/${source.value.doi.replace(/^(doi|DOI):\s*/, '').trim()}` : '')
    if (articleUrl && articleUrl.trim().startsWith('http')) {
      originalDocState.value = {
        status: 'article_only',
        hasPdf: false,
        canInlinePdf: false,
        sourceArticleUrl: articleUrl.trim(),
        sourceLabel: getDisplaySourceLink(articleUrl)
      }
    } else {
      originalDocState.value = {
        status: 'metadata_only',
        hasPdf: false,
        canInlinePdf: false
      }
    }
  }
}

async function loadInlinePdf() {
  if (!source.value) return
  originalDocState.value.status = 'resolving'
  originalDocState.value.error = undefined
  originalDocState.value.reason = undefined
  
  try {
    const res = await getApprovedSourceOriginalDocument(source.value._id)
    if (!res || !res.success) {
      originalDocState.value.status = 'failed'
      originalDocState.value.error = res?.message || 'Không thể xác định tài liệu gốc.'
      return
    }
    
    originalDocState.value.hasPdf = !!res.hasPdf
    originalDocState.value.canInlinePdf = !!res.canEmbed
    originalDocState.value.pdfDownloadUrl = res.viewUrl
    originalDocState.value.sourceLabel = getDisplaySourceLink(res.viewUrl || source.value.url || '')
    
    if (res.hasPdf && res.canEmbed) {
      const blob = await getApprovedSourcePdfInline(source.value._id)
      if (blob.type !== 'application/pdf') {
        const text = await blob.text()
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
        originalDocState.value.status = 'failed'
        originalDocState.value.error = 'Định dạng tệp tải về không phải PDF.'
        return
      }
      cleanActiveBlobUrl()
      activeBlobUrl = URL.createObjectURL(blob)
      originalDocState.value.pdfViewUrl = activeBlobUrl
      originalDocState.value.status = 'pdf_inline_ready'
    } else if (res.sourceKind === 'article_only') {
      originalDocState.value.status = 'article_only'
      originalDocState.value.sourceArticleUrl = res.viewUrl
    } else if (res.sourceKind === 'metadata_only') {
      originalDocState.value.status = 'metadata_only'
    } else {
      originalDocState.value.status = 'failed'
      originalDocState.value.error = res.message || 'Không thể hiển thị PDF trong hệ thống.'
    }
  } catch (e: any) {
    console.error('Error loading inline PDF:', e)
    let errorMsg = e.message || 'Không thể tải tài liệu gốc.'
    let isSsrf = false
    if (e.response?.data) {
      try {
        let errData = e.response.data
        if (errData instanceof Blob) {
          const text = await errData.text()
          errData = JSON.parse(text)
        }
        if (errData && errData.success === false) {
          errorMsg = errData.message || errorMsg
          if (errData.code === 'SSRF_BLOCKED') {
            isSsrf = true
          }
        }
      } catch {}
    }
    if (isSsrf) {
      originalDocState.value.status = 'blocked'
      originalDocState.value.reason = errorMsg
    } else {
      originalDocState.value.status = 'failed'
      originalDocState.value.error = errorMsg
    }
  }
}

async function handleSwitchToOriginal() {
  activeTab.value = 'original'
  if (originalDocState.value.status !== 'pdf_inline_ready') {
    await loadInlinePdf()
  }
}

async function downloadPdf() {
  if (!source.value) return
  const pdfUrl = getOriginalPdfUrl(source.value)
  if (pdfUrl) {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.target = '_blank'
    link.download = `${source.value.title || 'document'}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return
  }
  try {
    let blob: Blob
    if (originalDocState.value.status === 'pdf_inline_ready' && activeBlobUrl) {
      blob = await (await fetch(activeBlobUrl)).blob()
    } else {
      settingsStore.showToast('Đang tải PDF về máy...', 'success')
      blob = await getApprovedSourcePdfInline(source.value._id)
    }
    
    if (blob.type !== 'application/pdf') {
      const text = await blob.text()
      try {
        const parsed = JSON.parse(text)
        if (parsed && parsed.success === false) {
          settingsStore.showToast(parsed.message || 'Lỗi khi tải tài liệu PDF.', 'error')
          return
        }
      } catch {}
      settingsStore.showToast('Định dạng tệp không phải PDF.', 'error')
      return
    }
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${source.value.title || 'document'}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (err: any) {
    console.error('Error downloading PDF:', err)
    settingsStore.showToast('Không thể tải PDF về máy.', 'error')
  }
}

async function openPdfInNewTab() {
  if (!source.value) return
  const pdfUrl = getOriginalPdfUrl(source.value)
  if (pdfUrl) {
    window.open(pdfUrl, '_blank', 'noopener,noreferrer')
    return
  }
  try {
    let url = ''
    if (originalDocState.value.status === 'pdf_inline_ready' && originalDocState.value.pdfViewUrl) {
      url = originalDocState.value.pdfViewUrl
    } else {
      settingsStore.showToast('Đang mở PDF...', 'success')
      const blob = await getApprovedSourcePdfInline(source.value._id)
      if (blob.type !== 'application/pdf') {
        const text = await blob.text()
        try {
          const parsed = JSON.parse(text)
          if (parsed && parsed.success === false) {
            settingsStore.showToast(parsed.message || 'Lỗi khi tải tài liệu PDF.', 'error')
            return
          }
        } catch {}
        settingsStore.showToast('Định dạng tệp không phải PDF.', 'error')
        return
      }
      url = URL.createObjectURL(blob)
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (err: any) {
    console.error('Error opening PDF in new tab:', err)
    settingsStore.showToast('Không thể mở PDF trong tab mới.', 'error')
  }
}

onUnmounted(() => {
  cleanActiveBlobUrl()
})

const pdfIframeRef = ref<HTMLIFrameElement | null>(null)
const pdfIframeNavigationGuarded = ref(false)

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

interface ReferenceAction {
  label: string;
  url: string;
}

function cleanReferenceBlock(block: any) {
  const actions: ReferenceAction[] = []
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

function handleIframeLoad() {
  if (!pdfIframeRef.value || !originalDocState.value.pdfViewUrl) return
  
  try {
    const iframeLocation = pdfIframeRef.value.contentWindow?.location.href
    if (iframeLocation && iframeLocation !== 'about:blank' && !iframeLocation.startsWith('blob:')) {
      triggerPdfGuardReset()
    }
  } catch (err) {
    triggerPdfGuardReset()
  }
}

function triggerPdfGuardReset() {
  pdfIframeNavigationGuarded.value = true
  const currentUrl = originalDocState.value.pdfViewUrl
  originalDocState.value.pdfViewUrl = undefined
  setTimeout(() => {
    originalDocState.value.pdfViewUrl = currentUrl
  }, 100)
}

function handleReaderContentClick(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest('a')
  if (!target) return

  const href = target.getAttribute('href') || ''
  
  if (href.startsWith('#')) {
    event.preventDefault()
    const id = href.substring(1)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  } else if (href) {
    event.preventDefault()
    window.open(href, '_blank', 'noopener,noreferrer')
  }
}

const isLoadingReader = ref(false)
const readerError = ref('')
const readerMetadata = ref<string[]>([])
const readerMetadataBlocks = ref<any[]>([])
const isMetadataCollapsed = ref(true)
const isWarningBannerDismissed = ref(sessionStorage.getItem('dreamscape_low_quality_warn_dismissed') === 'true')

function dismissWarningBanner() {
  isWarningBannerDismissed.value = true
  sessionStorage.setItem('dreamscape_low_quality_warn_dismissed', 'true')
}

const readerPages = ref<any[]>([])
const currentPageIndex = ref(0)
const totalPages = ref(1)
const fontSize = ref(17)
const extractionQuality = ref<'high' | 'medium' | 'low'>('low')
const smartReaderSourceType = ref('')
const sourceUrlUsed = ref('')
const parserQuality = ref('')
const layoutQuality = ref('')
const extractionEngine = ref('')

function increaseFontSize() {
  if (fontSize.value < 22) fontSize.value += 1
}

function decreaseFontSize() {
  if (fontSize.value > 14) fontSize.value -= 1
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

async function fetchAllReaderData() {
  if (!source.value) return
  isLoadingReader.value = true
  readerError.value = ''
  let allSections: any[] = []
  let page = 1
  let pages = 1
  let attempts = 0
  let quality: any = 'low'
  let engine = 'unknown'
  
  try {
    while (page <= pages && attempts < 100) {
      attempts++
      let data = await getApprovedSourceRead(source.value._id, page, 50)
      if (!data || !data.sections || data.sections.length === 0) {
        if (page === 1) {
          readerError.value = 'Tài liệu này không chứa dữ liệu văn bản.'
          return
        }
        break
      }
      if (page === 1 && data.fullText) {
        quality = data.fullText.extractionQuality || 'low'
        extractionQuality.value = quality
        engine = data.fullText.extractionEngine || 'unknown'
        extractionEngine.value = engine
        smartReaderSourceType.value = data.fullText.smartReaderSourceType || ''
        sourceUrlUsed.value = data.fullText.sourceUrlUsed || ''
        parserQuality.value = data.fullText.parserQuality || ''
        layoutQuality.value = data.fullText.layoutQuality || ''
        readerWarnings.value = data.fullText.warnings || []
        ocrNeeded.value = data.fullText.ocrNeeded || false
      }
      allSections = [...allSections, ...data.sections]
      pages = data.pagination?.pages || 1
      if (page >= pages) break
      page++
    }
    
    if (allSections.length === 0) {
      readerError.value = 'Tài liệu này không chứa dữ liệu văn bản.'
      return
    }
    
    const processed = processReaderContent(allSections, quality, engine)
    readerMetadata.value = processed.metadata
    readerPages.value = processed.pages
    readerMetadataBlocks.value = processed.metadataBlocks
    totalPages.value = processed.pages.length
    
    const cacheKey = `dreamscape_reader_progress_${source.value._id}`
    const cached = localStorage.getItem(cacheKey)
    let pageIdx = 0
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (typeof parsed.pageIndex === 'number') {
          pageIdx = parsed.pageIndex
        }
      } catch (err) {
        console.error('Failed to parse saved progress:', err)
      }
    }
    if (pageIdx < 0 || pageIdx >= processed.pages.length) {
      pageIdx = 0
    }
    currentPageIndex.value = pageIdx
  } catch (err: any) {
    readerError.value = err.response?.data?.message || err.message || 'Không thể tải nội dung bản đọc.'
  } finally {
    isLoadingReader.value = false
  }
}

function goToPageIndex(pageIdx: number) {
  if (!readerPages.value || readerPages.value.length === 0) return
  const index = Math.max(0, Math.min(pageIdx, readerPages.value.length - 1))
  currentPageIndex.value = index
  if (source.value) {
    const cacheKey = `dreamscape_reader_progress_${source.value._id}`
    localStorage.setItem(cacheKey, JSON.stringify({ pageIndex: index, updatedAt: Date.now() }))
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function onPageChange(e: any) {
  const selectEl = e.target as HTMLSelectElement
  const val = parseInt(selectEl.value, 10)
  if (!isNaN(val)) {
    goToPageIndex(val)
  }
}

const displayDoi = computed(() => {
  return !source.value || !source.value.doi ? '' : source.value.doi.replace(/^(doi|DOI):\s*/, '').trim()
})

async function copyDoi() {
  const doi = displayDoi.value
  if (doi) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      settingsStore.showToast('Không thể sao chép DOI, vui lòng thử thủ công.', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(doi)
      settingsStore.showToast('Đã sao chép DOI.', 'success')
    } catch (err) {
      console.error('Failed to copy DOI:', err)
      settingsStore.showToast('Không thể sao chép DOI, vui lòng thử thủ công.', 'error')
    }
  }
}

const isModeratorUser = computed(() => {
  const moderators = '6a0f43ab4891b428d4bb7729'.split(',')
  const currentUserId = authStore.user?._id
  return !!(currentUserId && moderators.map(e => e.trim().toLowerCase()).includes(currentUserId.toLowerCase()))
})

const hasImportCandidate = computed(() => {
  if (!source.value) return false
  const hasCloudinary = !!(source.value.originalFile?.cloudinaryPublicId && source.value.originalFile?.storageProvider === 'cloudinary')
  const hasUrls = !!(source.value.pdfUrl || source.value.htmlUrl || source.value.sourceUrl || source.value.fullTextUrl)
  return !!(hasCloudinary || hasUrls)
})

const isEligibleForImport = computed(() => {
  if (!source.value) return false
  const isOa = source.value.copyrightStatus === 'copyrighted_with_open_access' || source.value.copyrightStatus === 'public_domain'
  return source.value.allowedUse === 'open_access_fulltext' && !source.value.readableInApp && isOa && hasImportCandidate.value && (source.value.fullTextStatus === 'available' || source.value.fullTextStatus === 'failed')
})

async function handleImport() {
  if (source.value && (isEligibleForImport.value || (isModeratorUser.value && source.value.readableInApp))) {
    isImporting.value = true
    try {
      const res = await importFullText(source.value._id)
      if (res.success) {
        settingsStore.showToast(res.message || 'Nhập bản đọc thành công!', 'success')
      } else {
        settingsStore.showToast(res.message || 'Nhập bản đọc thất bại.', 'error')
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Lỗi khi nhập bản đọc.'
      settingsStore.showToast(errorMsg, 'error')
    } finally {
      await fetchSource()
      isImporting.value = false
    }
  }
}

const hasPendingCandidates = ref(false)
const hasApprovedRules = ref(false)
const isCurrentlyExtracting = computed(() => extractionStore.sourceId === source.value?._id && extractionStore.status === 'pending')

async function checkPendingCandidates() {
  if (source.value) {
    try {
      const pendingRes = await getRuleCandidates({ status: 'pending', academicSourceId: source.value._id })
      const editNeededRes = await getRuleCandidates({ status: 'needs_edit', academicSourceId: source.value._id })
      hasPendingCandidates.value = (pendingRes.data || []).length + (editNeededRes.data || []).length > 0
    } catch (e) {
      console.error('Failed to check pending candidates:', e)
    }
  }
}

async function checkApprovedRules() {
  if (source.value) {
    try {
      const approvedRes = await getRuleCandidates({ status: 'approved', academicSourceId: source.value._id })
      hasApprovedRules.value = (approvedRes.data || []).length > 0
    } catch (e) {
      console.error('Failed to check approved rules:', e)
    }
  }
}

watch(() => isCurrentlyExtracting.value, async (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    await checkPendingCandidates()
    await checkApprovedRules()
  }
})

const showReimportConfirm = ref(false)
const isCurrentlyReimporting = ref(false)

function promptReimport() {
  showReimportConfirm.value = true
}

async function handleReimportConfirm() {
  if (source.value) {
    isCurrentlyReimporting.value = true
    try {
      const res = await reimportFullText(source.value._id)
      if (res.success) {
        if (res.reimported) {
          if (res.warnings && res.warnings.length > 0) {
            settingsStore.showToast(`Nhập lại bản đọc thành công với cảnh báo: ${res.warnings.join(', ')}`, 'success')
          } else {
            settingsStore.showToast('Nhập lại bản đọc thành công.', 'success')
          }
        } else {
          const importErr = res.importResult?.error || res.importResult?.message || ''
          let friendly = 'Không thể kết nối đến máy chủ nhập bản đọc.'
          if (importErr.includes('403')) {
            friendly = 'Máy chủ tài liệu trả về 403. Hãy upload PDF thủ công hoặc dùng link PDF công khai khác.'
          } else if (importErr.includes('SSRF')) {
            friendly = 'URL bị chặn bởi kiểm tra an toàn SSRF. Không tắt bảo vệ này.'
          } else if (importErr.includes('Tài liệu không có tệp') || importErr.includes('không hỗ trợ bản đọc')) {
            friendly = 'Nguồn này chỉ có metadata, chưa có toàn văn để nhập.'
          } else if (importErr) {
            friendly = importErr
          }
          settingsStore.showToast(`Nhập lại bản đọc thất bại: ${friendly}`, 'error')
        }
        showReimportConfirm.value = false
        await fetchSource()
      }
    } catch (err: any) {
      console.error('Reimport source error:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Không thể nhập lại tài liệu.'
      settingsStore.showToast(errorMsg, 'error')
    } finally {
      isCurrentlyReimporting.value = false
    }
  }
}

async function handleExtractCandidates() {
  if (source.value) {
    if (hasPendingCandidates.value) {
      router.push({ path: '/moderation/rule-candidates', query: { sourceId: source.value._id } })
      return
    }
    extractionStore.startExtraction(source.value._id, source.value.title || 'Tài liệu')
  }
}

const statusLabel = computed(() => {
  if (!source.value) return 'Chưa tạo'
  switch (source.value.chunkBuildStatus) {
    case 'completed': return 'Đã xây dựng'
    case 'failed': return 'Thất bại'
    case 'building': return 'Đang xây dựng'
    default: return 'Chưa tạo'
  }
})

const statusStyle = computed(() => {
  if (!source.value) return { color: 'var(--color-text-muted)' }
  switch (source.value.chunkBuildStatus) {
    case 'completed': return { color: '#10b981' }
    case 'failed': return { color: '#ef4444' }
    case 'building': return { color: '#f59e0b' }
    default: return { color: 'var(--color-text-muted)' }
  }
})

async function fetchSource() {
  isLoading.value = true
  hasError.value = false
  activeTab.value = 'smart'
  cleanActiveBlobUrl()
  originalDocState.value = {
    status: 'idle',
    hasPdf: false,
    canInlinePdf: false
  }
  readerWarnings.value = []
  ocrNeeded.value = false
  try {
    const id = route.params.id as string
    source.value = await getApprovedSourceById(id)
    if (source.value) {
      initOriginalDocState()
      await checkPendingCandidates()
      await checkApprovedRules()
      if (source.value.readableInApp) {
        await fetchAllReaderData()
      } else if (getOriginalPdfUrl(source.value)) {
        activeTab.value = 'original'
        await loadInlinePdf()
      }
    }
  } catch (err: any) {
    hasError.value = true
    const errMsg = err.response?.data?.message || err.message || 'Không thể tải thông tin tài liệu.'
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isLoading.value = false
  }
}

const originalLink = computed(() => {
  if (!source.value) return ''
  return source.value.url || source.value.fullTextUrl || ''
})

onMounted(() => {
  fetchSource()
})
</script>

<style scoped>
.source-detail-container {
  width: 100%;
  max-width: none;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  padding-left: clamp(16px, 1.8vw, 32px);
  padding-right: clamp(24px, 2.8vw, 48px);
  padding-block: var(--space-4);
  background: var(--color-bg-base, #121212);
  color: var(--color-text-primary, #ffffff);
  display: flex;
  flex-direction: column;
}

@media (min-width: 993px) {
  .source-detail-container {
    height: calc(100dvh - var(--header-height, 60px)) !important;
    max-height: calc(100dvh - var(--header-height, 60px)) !important;
    overflow: hidden !important;
  }
}

.detail-loading,
.detail-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-10) var(--space-6);
  background: var(--color-bg-elevated, #181818);
  border: 1px solid var(--color-border, #262626);
  border-radius: var(--radius-lg, 8px);
  gap: var(--space-3);
  color: var(--color-text-muted);
  height: calc(100vh - 120px);
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

.source-detail-workspace {
  width: 100%;
  max-width: none;
  height: 100%;
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

.back-arrow-icon {
  flex-shrink: 0;
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

.tab-warning-badge {
  background: rgba(230, 168, 23, 0.15);
  color: #e6a817;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
  text-transform: uppercase;
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

/* Original View Styles */
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

.original-loading {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  gap: var(--space-3);
  color: var(--color-text-muted, #8e8e93);
  overflow: hidden;
  border-radius: var(--radius-lg, 8px);
  background: #181818;
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

/* Reader Typography & Layout */
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

/* Warnings Banners */
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

.reader-loading,
.reader-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-6);
  text-align: center;
  color: var(--color-text-muted, #8e8e93);
  gap: var(--space-3);
  height: 250px;
}

/* Reading Surface Blocks styling */
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
  gap: var(--space-3);
  padding-left: var(--space-4);
  margin-bottom: var(--space-3);
}

.list-marker {
  color: var(--color-primary, #60a5fa);
  font-weight: 700;
}

.list-text {
  color: var(--color-text-primary, #ffffff);
}

.reader-reference-item {
  padding-left: var(--space-6);
  text-indent: -1.5rem;
  margin-bottom: var(--space-4);
  font-size: 0.9em;
  line-height: 1.5;
}

.reference-text {
  color: var(--color-text-secondary, #aeaeb2);
  margin: 0;
}

.reader-caption-text {
  font-size: 0.85em;
  color: var(--color-text-muted, #8e8e93);
  font-style: italic;
  margin-top: var(--space-2);
  margin-bottom: var(--space-4);
  text-align: center;
}

.reader-abstract-box {
  background: var(--color-bg-base, #121212);
  border-left: 3px solid var(--color-primary, #60a5fa);
  padding: var(--space-4);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  margin-bottom: var(--space-6);
}

.abstract-text {
  color: var(--color-text-secondary, #aeaeb2);
  margin: 0;
}

.reader-title-text {
  font-size: 1.5em;
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-text-primary, #ffffff);
  text-align: center;
  margin-bottom: var(--space-6);
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

.placeholder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-muted, #8e8e93);
}

.placeholder-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-label {
  font-weight: 600;
  font-size: var(--font-size-sm, 14px);
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

.reader-page-break {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: var(--space-6) 0;
  color: var(--color-text-muted, #8e8e93);
  font-size: var(--font-size-xs, 12px);
  font-weight: var(--font-weight-medium, 500);
}

.page-break-divider {
  flex: 1;
  height: 1px;
  background: var(--color-border, #262626);
}

.page-break-text {
  padding: 0 var(--space-4);
  background: #181818;
}

/* Collapsible Metadata Card */
.collapsible-metadata-card {
  background: var(--color-bg-base, #121212);
  border: 1px solid var(--color-border, #262626);
  border-radius: var(--radius-lg, 8px);
  margin: var(--space-5) 0;
  overflow: hidden;
  transition: border-color var(--transition-fast, 0.2s);
}

.collapsible-metadata-card:hover {
  border-color: var(--color-border-input, #3a3a3a);
}

.metadata-toggle-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-elevated, #181818);
  border: none;
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-secondary, #aeaeb2);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: background var(--transition-fast, 0.2s), color var(--transition-fast, 0.2s);
}

.metadata-toggle-btn:hover {
  background: var(--color-bg-hover, #222222);
  color: var(--color-text-primary, #ffffff);
}

.metadata-toggle-btn .arrow-icon {
  color: var(--color-text-muted, #8e8e93);
  transition: transform var(--transition-fast, 0.2s);
}

.metadata-toggle-btn .arrow-icon.rotated {
  transform: rotate(180deg);
}

.metadata-card-content {
  padding: var(--space-4);
  border-top: 1px solid var(--color-border, #262626);
}

.metadata-item-text {
  font-size: var(--font-size-sm, 14px);
  color: var(--color-text-secondary, #aeaeb2);
  margin: 0 0 var(--space-2) 0;
  line-height: 1.5;
}

.metadata-item-text:last-child {
  margin-bottom: 0;
}

/* Left Rail Font Size Controls */
.left-rail-size-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--color-bg-surface, #1e1e1e);
  border: 1px solid var(--color-border, #262626);
  border-radius: var(--radius-lg, 8px);
  padding: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10;
}

.left-rail-size-controls .size-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #8e8e93);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs, 12px);
  font-weight: 700;
  cursor: pointer;
  border-radius: var(--radius-sm, 4px);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.left-rail-size-controls .size-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #262626);
  color: var(--color-text-primary, #ffffff);
}

.left-rail-size-controls .size-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.left-rail-size-controls .size-val {
  font-size: var(--font-size-xs, 12px);
  font-weight: 600;
  color: var(--color-text-primary, #ffffff);
  padding: 0 8px;
  min-width: 44px;
  text-align: center;
}

@media (max-width: 992px) {
  .left-rail-size-controls {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;
  }
}

/* Article content constraints */
.reading-page-content {
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.collapsible-metadata-card {
  max-width: 720px;
  margin-inline: auto;
}

/* Case B Details & States */
.detail-info-blocks {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-4) 0;
}

.source-title-inside {
  font-size: var(--font-size-xl, 1.25rem);
  font-weight: var(--font-weight-bold, 700);
  line-height: var(--line-height-tight, 1.25);
  color: var(--color-text-primary, #ffffff);
  margin: 0;
}

.reading-state-box {
  width: 100%;
}

.state-notice {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-lg, 8px);
  border: 1px solid transparent;
}

.state-notice--warning {
  background: rgba(230, 168, 23, 0.05);
  border-color: rgba(230, 168, 23, 0.15);
  color: #e6a817;
}

.state-notice--muted {
  background: var(--color-bg-elevated, #181818);
  border-color: var(--color-border, #262626);
  color: var(--color-text-secondary, #aeaeb2);
}

.state-message-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.state-message {
  margin: 0;
  font-size: var(--font-size-sm, 14px);
  line-height: 1.5;
  color: var(--color-text-secondary, #aeaeb2);
}

.state-notice--warning .state-message {
  color: #e6a817;
}

.import-error-msg {
  color: #ed4956;
  font-family: monospace;
  font-size: 0.82em;
}

.state-actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.link-btn {
  color: var(--color-primary, #60a5fa);
  font-size: var(--font-size-sm, 14px);
  font-weight: 600;
  text-decoration: underline;
}

.link-btn:hover {
  color: #3b82f6;
  text-decoration: none;
}

/* Sidebar attributes card & details */
.workspace-right {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
  overflow-y: auto;
  padding-bottom: var(--space-6);
  min-width: 0;
}

.attributes-card {
  background: var(--color-bg-elevated, #181818);
  border: 1px solid var(--color-border, #262626);
  border-radius: var(--radius-lg, 8px);
  padding: var(--space-5);
  min-width: 0;
}

.card-title {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--font-size-sm, 14px);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary, #aeaeb2);
  border-bottom: 1px solid var(--color-border, #262626);
  padding-bottom: var(--space-2);
}

.meta-table {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.attribute-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.attribute-row.align-center {
  align-items: flex-start;
}

.meta-key {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-muted, #8e8e93);
  font-weight: 500;
}

.attribute-value {
  font-size: var(--font-size-sm, 14px);
  color: var(--color-text-primary, #ffffff);
  line-height: 1.4;
  word-wrap: break-word;
  word-break: break-word;
  text-align: left;
}

.code-font {
  font-family: var(--font-family-mono, monospace);
  font-size: 0.85rem;
}

.meta-doi-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
}

.copy-doi-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted, #8e8e93);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: var(--radius-sm, 4px);
  transition: background var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}

.copy-doi-btn:hover {
  background: var(--color-bg-hover, #262626);
  color: var(--color-text-primary, #ffffff);
}

.copy-icon {
  flex-shrink: 0;
}

/* Sidebar action button styles */
.sidebar-pdf-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

.sidebar-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  text-decoration: none;
  border: none;
}

.sidebar-action-btn--primary {
  background: #3b82f6;
  color: #ffffff !important;
}

.sidebar-action-btn--primary:hover {
  background: #2563eb;
  color: #ffffff !important;
}

.sidebar-action-btn--secondary {
  background: var(--color-bg-elevated, #181818);
  border: 1px solid var(--color-border, #262626);
  color: var(--color-text-primary, #ffffff);
}

.sidebar-action-btn--secondary:hover {
  background: var(--color-bg-hover, #262626);
  border-color: var(--color-border-input, #3a3a3a);
  color: var(--color-text-primary, #ffffff);
}

.sidebar-action-btn--text {
  background: transparent;
  border: none;
  color: var(--color-primary, #60a5fa);
  font-size: 0.8rem;
  text-decoration: underline;
  padding: 4px;
}

.sidebar-action-btn--text:hover {
  color: #3b82f6;
  text-decoration: none;
}

.source-link-row {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border, #262626);
  padding-top: var(--space-2);
  margin-top: 2px;
  text-align: left;
}

/* Tablet & Mobile responsive fallback */
@media (max-width: 992px) {
  .source-detail-container {
    height: auto;
    overflow-y: auto;
    padding: var(--space-4);
  }
  .source-detail-workspace {
    display: flex;
    flex-direction: column;
    height: auto;
    overflow: visible;
    gap: var(--space-4);
  }
  .workspace-left {
    padding-top: 0;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    height: auto;
    width: 100%;
  }
  .workspace-center {
    height: auto;
    overflow: visible;
  }
  .reader-content-card {
    flex: none;
    height: auto;
    min-height: 500px;
  }
  .reader-scroll-area {
    overflow-y: visible;
  }
  .workspace-right {
    height: auto;
    overflow-y: visible;
    padding-bottom: 0;
  }
  .original-pdf-viewer-shell,
  .original-loading {
    min-height: 600px;
    height: 650px;
  }
}

@media (min-width: 993px) {
  .workspace-right.with-tabs {
    margin-top: 38px;
    height: calc(100% - 38px);
    padding-top: 0;
  }
}

/* Original mode styling for reader scroll area */
.reader-scroll-area.original-mode {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.original-pdf-viewer-shell {
  position: relative;
}

/* PDF Guard banner styles */
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

/* Smart Reader inline links style */
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

/* Reference Card Styling */
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

/* Height-based media queries for viewport-responsive compact mode */
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

/* Supplementary Item Cards */
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

/* Acknowledgments Paragraph */
.acknowledgement-paragraph {
  color: var(--color-text-secondary, #aeaeb2);
  margin: 0 0 var(--space-4) 0;
  line-height: var(--line-height-relaxed, 1.6);
  text-align: justify;
}

/* Correction Notices */
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
</style>
