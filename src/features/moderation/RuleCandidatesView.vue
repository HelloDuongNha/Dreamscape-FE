<template>
  <div class="settings-section">
    <!-- Unauthorized Fallback Screen -->
    <div v-if="isUnauthorized" class="unauthorized-container">
      <div class="unauthorized-card">
        <div class="unauthorized-icon" aria-hidden="true"></div>
        <h3 class="unauthorized-title">Không có quyền truy cập</h3>
        <p class="unauthorized-desc">Bạn không có quyền truy cập trang duyệt ứng viên quy luật.</p>
      </div>
    </div>

    <!-- Main Panel -->
    <div v-else class="moderation-panel">
      <div class="moderation-header">
        <div>
          <h2 class="settings-section__title">Duyệt tri thức học thuật</h2>
          <p class="settings-section__desc">
            Xem các kết luận được rút ra từ tài liệu trước khi đưa vào phân tích giấc mơ.
          </p>
        </div>
      </div>

      <!-- Main Columns Layout -->
      <div class="candidates-layout">
        
        <!-- Left Column: Compact List Sidebar -->
        <div class="layout-left">
          <!-- Filter Pill if sourceId exists -->
          <div v-if="sourceIdFilter" class="filter-pill">
            <span class="filter-pill-text">Đang lọc theo tài liệu</span>
            <button @click="clearSourceFilter" class="clear-pill-btn" aria-label="Bỏ lọc">&times;</button>
          </div>

          <!-- Status Tabs -->
          <div class="moderation-tabs">
            <button
              v-for="tab in statusTabs"
              :key="tab.status"
              :class="['moderation-tab', { 'moderation-tab--active': activeStatus === tab.status }]"
              @click="changeTab(tab.status)"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Loading State -->
          <div v-if="isLoadingList" class="moderation-loading">
            <span class="spinner"></span>
            <p>Đang tải ứng viên...</p>
          </div>

          <!-- Empty State -->
          <div v-else-if="candidates.length === 0" class="moderation-empty">
            <div class="moderation-empty__icon" aria-hidden="true"></div>
            <h3 class="moderation-empty__title">Không có dữ liệu</h3>
            <p class="moderation-empty__desc">
              {{ emptyStateMessage }}
            </p>
          </div>

          <!-- List Items -->
          <div v-else class="candidates-list-scroll">
            <div
              v-for="(groupCands, sourceTitle) in groupedCandidates"
              :key="sourceTitle"
              class="source-group-section"
            >
              <h4 class="source-group-header" :title="sourceTitle">{{ sourceTitle }}</h4>
              <div class="source-group-cards">
                <div
                  v-for="cand in groupCands"
                  :key="cand._id"
                  :class="['candidate-list-card', { 'candidate-list-card--active': selectedId === cand._id }]"
                  @click="selectCandidate(cand._id)"
                >
                  <div class="cand-card-row">
                    <span class="cand-card-title" :title="cand.label">{{ cand.label || 'Không có nhãn' }}</span>
                  </div>
                  <div class="cand-card-row footer-row">
                    <span :class="['status-badge', getStatusClass(cand.status)]">
                      {{ getStatusLabel(cand.status) }}
                    </span>
                    <span class="cand-card-date">{{ formatDate(cand.createdAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Clear all button for rejected list at the bottom -->
          <div v-if="activeStatus === 'rejected' && candidates.length > 0" class="clear-all-row-bottom">
            <button
              type="button"
              class="action-link-btn text-danger-underline"
              style="font-size: 0.8rem;"
              @click="triggerClearAll"
            >
              Xóa tất cả bị từ chối
            </button>
          </div>
        </div>

        <!-- Right Column: Human-First Zero-Input Document Review -->
        <div class="layout-right">
          <!-- Loading Detail State -->
          <div v-if="isLoadingDetail" class="detail-placeholder">
            <span class="spinner"></span>
            <p>Đang tải chi tiết ứng viên...</p>
          </div>

          <!-- No selection state -->
          <div v-else-if="!selectedCandidate" class="detail-placeholder">
            <div class="placeholder-icon"></div>
            <h3>Chọn ứng viên từ danh sách</h3>
            <p>Nhấp vào một ứng viên quy luật ở bên trái để xem thông tin chi tiết.</p>
          </div>

          <!-- Content Details Document View -->
          <div v-else class="detail-scroll-area">
            
            <!-- 1. KẾT LUẬN RÚT RA -->
            <div class="review-document-card">
              <h2 class="review-rule-title">{{ form.label }}</h2>
              <p class="review-rule-citation">
                <strong>Nguồn nghiên cứu:</strong> {{ getFormattedSourceInfo(selectedCandidate) }}
              </p>
            </div>

            <!-- 2. TÓM TẮT TỪ TÀI LIỆU -->
            <div class="review-document-block prominent-block">
              <h3 class="review-block-title">Tóm tắt từ tài liệu</h3>
              <div class="review-card-body">
                <p class="prominent-evidence-text">{{ form.evidenceSummary }}</p>
              </div>
            </div>

            <!-- 3. CƠ SỞ HỌC THUẬT -->
            <div class="review-document-block">
              <h3 class="review-block-title">Cơ sở học thuật</h3>
              <div class="review-card-body">
                <p class="formatted-text-block">{{ form.scientificBasis }}</p>
              </div>
            </div>

            <!-- 3.5. TIÊU CHÍ ĐÁNH GIÁ & ĐỘ PHÙ HỢP -->
            <div class="review-document-block">
              <h3 class="review-block-title">Tiêu chí đánh giá & Độ phù hợp</h3>
              <div class="review-card-body">
                <!-- Warning for non-oracle eligible candidates -->
                <div v-if="selectedCandidate.oracleEligible === false" class="block-highlight" style="border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.05); padding: var(--space-4); margin-bottom: var(--space-4); border-radius: var(--radius-md);">
                  <p class="formatted-text-block" style="color: #ef4444; font-weight: 600; margin: 0;">
                    Tài liệu này có thể có kết luận học thuật hợp lệ, nhưng không phù hợp để dùng trực tiếp trong phân tích giấc mơ.
                  </p>
                </div>

                <div class="scores-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-2);">
                  <div class="score-card" style="background: var(--color-bg-subtle); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border); text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div class="score-label" style="font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: var(--space-2); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                      Mức chứng minh trong tài liệu
                    </div>
                    <div class="score-value" style="font-size: 2.2rem; font-weight: 800; color: #3b82f6; line-height: 1.1; margin: var(--space-1) 0;">
                      {{ selectedCandidate.evidenceCredibilityScore ?? 0 }}/100
                    </div>
                    <div class="score-desc" style="font-size: 0.76rem; color: var(--color-text-muted); line-height: 1.4; margin-top: var(--space-2);">
                      Điểm này cho biết kết luận này được chính tài liệu chứng minh rõ đến đâu.
                    </div>
                  </div>

                  <div class="score-card" style="background: var(--color-bg-subtle); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border); text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div class="score-label" style="font-size: 0.82rem; color: var(--color-text-muted); margin-bottom: var(--space-2); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
                      Độ hữu ích cho Oracle
                    </div>
                    <div class="score-value" :style="{ color: selectedCandidate.oracleEligible ? '#10b981' : '#a3a3a3' }" style="font-size: 2.2rem; font-weight: 800; line-height: 1.1; margin: var(--space-1) 0;">
                      {{ selectedCandidate.oracleUsefulnessScore ?? 0 }}/100
                    </div>
                    <div class="score-desc" style="font-size: 0.76rem; color: var(--color-text-muted); line-height: 1.4; margin-top: var(--space-2);">
                      Điểm này cho biết kết luận này hữu ích thế nào cho việc giải mã giấc mơ của người dùng.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. ĐỘ TIN CẬY HỌC THUẬT -->
            <div v-if="selectedCandidate.legitimacyLevel" class="review-document-block">
              <h3 class="review-block-title">Độ tin cậy học thuật</h3>
              <div class="review-card-body">
                <p class="formatted-text-block" style="margin-bottom: var(--space-2);">
                  {{ getLegitimacyExplanation(selectedCandidate) }}
                </p>
                <div v-if="selectedCandidate.legitimacyReason" class="assessment-row" style="margin-top: var(--space-2);">
                  <strong>Đánh giá chi tiết:</strong>
                  <p class="formatted-text-block mt-1">{{ selectedCandidate.legitimacyReason }}</p>
                </div>
              </div>
            </div>

            <!-- 5. XUNG ĐỘT HOẶC GHI CHÚ LIÊN QUAN (only if relevant) -->
            <div v-if="selectedCandidate.conflictStatus && selectedCandidate.conflictStatus !== 'none' && getConflictExplanation(selectedCandidate)" class="review-document-block">
              <h3 class="review-block-title">Xung đột hoặc ghi chú liên quan</h3>
              <div class="review-card-body block-highlight" style="border-left-color: #f59e0b; background: rgba(245, 158, 11, 0.02); padding: var(--space-4);">
                <p class="formatted-text-block">{{ getConflictExplanation(selectedCandidate) }}</p>
              </div>
            </div>

            <!-- 6. BẰNG CHỨNG HỖ TRỢ (only if clean excerpts exist) -->
            <div class="review-document-block" v-if="evidenceExcerpts && evidenceExcerpts.length > 0">
              <h3 class="review-block-title">Bằng chứng hỗ trợ</h3>
              <div class="excerpt-cards-list">
                <div
                  v-for="(exc, idx) in evidenceExcerpts"
                  :key="idx"
                  class="excerpt-card"
                >
                  <div class="excerpt-card-header" @click="toggleExcerptCollapse(idx)">
                    <div class="excerpt-card-meta">
                      <span class="excerpt-section-tag">{{ exc.sectionType || 'Paragraph' }}</span>
                      <span v-if="exc.sectionTitle" class="excerpt-title-tag" :title="exc.sectionTitle">{{ exc.sectionTitle }}</span>
                      <span v-if="exc.pageStart" class="excerpt-page-tag">
                        Trang {{ exc.pageStart }}<span v-if="exc.pageEnd && exc.pageEnd !== exc.pageStart">-{{ exc.pageEnd }}</span>
                      </span>
                    </div>
                    <span class="collapse-chevron">{{ excerptCollapsed[idx] ? 'v' : '^' }}</span>
                  </div>

                  <div v-if="!excerptCollapsed[idx]" class="excerpt-card-body">
                    <blockquote class="focused-excerpt-blockquote">
                      "{{ exc.excerpt }}"
                    </blockquote>
                    
                    <!-- Context Collapsible -->
                    <div class="context-collapsible-wrapper" v-if="getCorrespondingChunkPreview(exc.chunkId)">
                      <button
                        type="button"
                        class="context-toggle-btn"
                        @click="toggleChunkPreview(exc.chunkId)"
                      >
                        {{ showChunkPreviewMap[exc.chunkId] ? 'Ẩn ngữ cảnh rộng' : 'Xem thêm ngữ cảnh rộng' }}
                      </button>
                      <div v-show="showChunkPreviewMap[exc.chunkId]" class="context-preview-box">
                        <p class="context-preview-text">{{ getCorrespondingChunkPreview(exc.chunkId) }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 8. COLLAPSIBLE ADVANCED EDIT Accordion -->
            <div class="advanced-collapsible-section">
              <button
                type="button"
                class="advanced-toggle-btn"
                @click="showAdvancedEdit = !showAdvancedEdit"
              >
                <span>Chỉnh sửa nâng cao</span>
                <span class="toggle-chevron">{{ showAdvancedEdit ? '▲' : '▼' }}</span>
              </button>
              <div v-show="showAdvancedEdit" class="advanced-fields-panel">
                <p class="advanced-intro-text">
                  Lưu ý: Chỉ chỉnh phần này nếu bạn hiểu cách quy luật được dùng trong pipeline phân tích. Thay đổi ở đây sẽ cập nhật trực tiếp dữ liệu thô.
                </p>

                <form @submit.prevent="handleSaveCandidate">
                  <div class="form-grid">
                    
                    <!-- Form Edit Fields (Editable if pending/needs_edit) -->
                    <div class="form-group form-group--full">
                      <label class="form-label" for="edit-label">Nhãn quy luật</label>
                      <input
                        id="edit-label"
                        v-model="form.label"
                        type="text"
                        class="form-input"
                        :readonly="isReadonly"
                        required
                      />
                    </div>

                    <div class="form-group form-group--full">
                      <label class="form-label" for="edit-scientificBasis">Cơ sở khoa học (scientificBasis)</label>
                      <textarea
                        id="edit-scientificBasis"
                        v-model="form.scientificBasis"
                        rows="4"
                        class="form-textarea"
                        :readonly="isReadonly"
                        required
                      ></textarea>
                    </div>

                    <div class="form-group form-group--full">
                      <label class="form-label" for="edit-aiInstruction">Chỉ dẫn AI (aiInstruction)</label>
                      <textarea
                        id="edit-aiInstruction"
                        v-model="form.aiInstruction"
                        rows="4"
                        class="form-textarea"
                        :readonly="isReadonly"
                        required
                      ></textarea>
                    </div>

                    <div class="form-group form-group--full">
                      <label class="form-label" for="edit-limitations">Giới hạn nghiên cứu (limitations)</label>
                      <textarea
                        id="edit-limitations"
                        v-model="form.limitations"
                        rows="3"
                        class="form-textarea"
                        :readonly="isReadonly"
                        required
                      ></textarea>
                    </div>

                    <div class="form-group form-group--full">
                      <label class="form-label" for="edit-evidenceSummary">Tóm tắt bằng chứng (evidenceSummary)</label>
                      <textarea
                        id="edit-evidenceSummary"
                        v-model="form.evidenceSummary"
                        rows="3"
                        class="form-textarea"
                        :readonly="isReadonly"
                        required
                      ></textarea>
                    </div>

                    <div class="form-group form-group--full">
                      <label class="form-label" for="edit-reviewerNote">Ghi chú của kiểm duyệt viên (reviewerNote)</label>
                      <textarea
                        id="edit-reviewerNote"
                        v-model="form.reviewerNote"
                        rows="2"
                        class="form-textarea"
                        :readonly="isReadonly"
                      ></textarea>
                    </div>

                    <!-- Technical database fields -->
                    <div class="form-group form-group--full">
                      <label class="form-label" for="edit-proposedRuleId">Mã đề xuất (proposedRuleId)</label>
                      <input
                        id="edit-proposedRuleId"
                        v-model="form.proposedRuleId"
                        type="text"
                        class="form-input mono"
                        :readonly="isReadonly"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-group">Nhóm quy luật (group)</label>
                      <select
                        id="edit-group"
                        v-model="form.group"
                        class="form-input select-styled"
                        :disabled="isReadonly"
                        required
                      >
                        <option value="sleep_context">Bối cảnh giấc mơ (sleep_context)</option>
                        <option value="dream_psychology">Tâm lý học giấc mơ (dream_psychology)</option>
                        <option value="personality_knowledge">Tính cách cá nhân (personality_knowledge)</option>
                        <option value="cultural_limitation">Giới hạn văn hóa (cultural_limitation)</option>
                      </select>
                      <p class="field-help-desc">{{ getGroupDesc(form.group) }}</p>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-category">Phân loại (category)</label>
                      <input
                        id="edit-category"
                        v-model="form.category"
                        type="text"
                        class="form-input"
                        :readonly="isReadonly"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-factor">Nhân tố (factor)</label>
                      <input
                        id="edit-factor"
                        v-model="form.factor"
                        type="text"
                        class="form-input"
                        :readonly="isReadonly"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-claimStrength">Độ mạnh khẳng định (claimStrength)</label>
                      <select
                        id="edit-claimStrength"
                        v-model="form.claimStrength"
                        class="form-input select-styled"
                        :disabled="isReadonly"
                        required
                      >
                        <option value="interpretive_framework">Khung diễn giải</option>
                        <option value="possible_contributing_factor">Yếu tố có thể góp phần</option>
                        <option value="association_not_causation">Liên hệ, không phải nhân quả</option>
                        <option value="hypothesis_not_diagnosis">Giả thuyết, không phải chẩn đoán</option>
                        <option value="epistemic_boundary_rule">Quy tắc giới hạn tri thức</option>
                      </select>
                      <p class="field-help-desc">{{ getClaimStrengthDesc(form.claimStrength) }}</p>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-confidenceCap">Mức tin cậy tối đa (confidenceCap)</label>
                      <input
                        id="edit-confidenceCap"
                        v-model.number="form.confidenceCap"
                        type="number"
                        step="0.01"
                        min="0"
                        max="0.65"
                        class="form-input"
                        :readonly="isReadonly"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-evidenceCredibilityScore">Mức chứng minh trong tài liệu (evidenceCredibilityScore)</label>
                      <input
                        id="edit-evidenceCredibilityScore"
                        v-model.number="form.evidenceCredibilityScore"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        class="form-input"
                        :readonly="isReadonly"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-oracleUsefulnessScore">Độ hữu ích cho Oracle (oracleUsefulnessScore)</label>
                      <input
                        id="edit-oracleUsefulnessScore"
                        v-model.number="form.oracleUsefulnessScore"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        class="form-input"
                        :readonly="isReadonly"
                        required
                      />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="edit-paperDomain">Phạm vi nghiên cứu (paperDomain)</label>
                      <select
                        id="edit-paperDomain"
                        v-model="form.paperDomain"
                        class="form-input select-styled"
                        :disabled="isReadonly"
                        required
                      >
                        <option value="dream_sleep_psychology">Tâm lý học giấc mơ / Giấc ngủ (dream_sleep_psychology)</option>
                        <option value="computer_vision">Thị giác máy tính (computer_vision)</option>
                        <option value="medicine">Y học tổng quát (medicine)</option>
                        <option value="general_science">Khoa học chung (general_science)</option>
                        <option value="unknown">Không xác định (unknown)</option>
                      </select>
                    </div>

                    <div class="form-group" style="display: flex; align-items: center; gap: 8px; align-self: center;">
                      <input
                        id="edit-oracleEligible"
                        v-model="form.oracleEligible"
                        type="checkbox"
                        :disabled="isReadonly"
                        style="width: auto; margin: 0;"
                      />
                      <label class="form-label" for="edit-oracleEligible" style="margin: 0; cursor: pointer;">Phù hợp với Oracle (oracleEligible)</label>
                    </div>


                    <div class="form-group">
                      <label class="form-label" for="edit-evidenceRole">Vai trò bằng chứng (evidenceRole)</label>
                      <select
                        id="edit-evidenceRole"
                        v-model="form.evidenceRole"
                        class="form-input select-styled"
                        :disabled="isReadonly"
                        required
                      >
                        <option value="primary_support">Bằng chứng chính</option>
                        <option value="secondary_support">Bằng chứng phụ</option>
                        <option value="background">Bối cảnh nền</option>
                        <option value="limitation">Giới hạn áp dụng</option>
                        <option value="contradiction">Bằng chứng trái chiều</option>
                      </select>
                      <p class="field-help-desc">{{ getEvidenceRoleDesc(form.evidenceRole) }}</p>
                    </div>

                    <div class="form-group form-group--full">
                      <label class="form-label" for="edit-inputSource">Nguồn đầu vào (inputSource)</label>
                      <input
                        id="edit-inputSource"
                        v-model="form.inputSource"
                        type="text"
                        class="form-input"
                        :readonly="isReadonly"
                        required
                      />
                    </div>

                    <div class="form-group form-group--full">
                      <div class="textarea-header">
                        <label class="form-label" for="edit-inputRequired">Điều kiện cấu trúc (inputRequired JSON)</label>
                        <button
                          v-if="!isReadonly"
                          type="button"
                          class="prettify-btn"
                          @click="handlePrettifyJson"
                        >
                          Định dạng JSON
                        </button>
                      </div>
                      <textarea
                        id="edit-inputRequired"
                        v-model="inputRequiredStr"
                        rows="5"
                        class="form-textarea mono"
                        :readonly="isReadonly"
                        required
                      ></textarea>
                    </div>

                    <!-- Save changes button inside advanced only -->
                    <div class="form-group form-group--full form-save-row" v-if="!isReadonly">
                      <AppButton
                        variant="secondary"
                        type="submit"
                        :loading="isSaving"
                      >
                        Lưu cấu hình nâng cao
                      </AppButton>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <!-- Flat Action Footer for General Actions -->
            <div class="review-actions-sticky-footer" v-if="!isReadonly">
              <div class="sticky-footer-right" style="gap: var(--space-3); display: flex; width: 100%; justify-content: flex-end;">
                <AppButton
                  variant="danger-outline"
                  type="button"
                  :loading="isRejecting"
                  @click="triggerRejection"
                >
                  Từ chối
                </AppButton>
                <AppButton
                  variant="smart"
                  type="button"
                  :loading="isApproving"
                  @click="triggerApproval"
                >
                  Phê duyệt quy luật
                </AppButton>
              </div>
            </div>

            <!-- Actions for Approved status -->
            <div class="review-actions-sticky-footer" v-else-if="selectedCandidate.status === 'approved'">
              <div class="sticky-footer-right" style="width: 100%; display: flex; justify-content: flex-end;">
                <button
                  type="button"
                  class="action-link-btn text-danger-underline"
                  @click="triggerDeactivate"
                >
                  Vô hiệu hóa
                </button>
              </div>
            </div>

            <!-- Actions for Rejected status -->
            <div class="review-actions-sticky-footer" v-else-if="selectedCandidate.status === 'rejected'">
              <div class="sticky-footer-right" style="gap: var(--space-4); display: flex; align-items: center; width: 100%; justify-content: flex-end;">
                <button
                  type="button"
                  class="action-link-btn text-muted-underline"
                  :disabled="isRestoring"
                  @click="handleRestore"
                >
                  {{ isRestoring ? 'Đang khôi phục...' : 'Khôi phục về Chờ duyệt' }}
                </button>
                <button
                  type="button"
                  class="action-link-btn text-danger-underline"
                  @click="triggerDelete"
                >
                  Xóa vĩnh viễn
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>

    <!-- Confirm Approval Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showApproveModal"
          class="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận phê duyệt"
          @click.self="showApproveModal = false"
        >
          <div class="modal-container" tabindex="-1">
            <div class="modal-header">
              <h3 class="modal-header__title">Xác nhận phê duyệt ứng viên quy luật</h3>
              <button class="modal-close-btn" aria-label="Đóng" @click="showApproveModal = false">&times;</button>
            </div>
            <div class="modal-body">
              <p class="modal-description-text">
                Sau khi phê duyệt, ứng viên này sẽ trở thành quy luật đang hoạt động và có thể được dùng trong phân tích giấc mơ.
              </p>
            </div>
            <div class="modal-footer">
              <AppButton variant="secondary" size="sm" @click="showApproveModal = false">Hủy</AppButton>
              <AppButton variant="smart" size="sm" :loading="isApproving" @click="confirmApproval">Xác nhận phê duyệt</AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Reject Notes Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showRejectModal"
          class="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Từ chối ứng viên"
          @click.self="showRejectModal = false"
        >
          <div class="modal-container" tabindex="-1">
            <div class="modal-header">
              <h3 class="modal-header__title">Từ chối ứng viên quy luật</h3>
              <button class="modal-close-btn" aria-label="Đóng" @click="showRejectModal = false">&times;</button>
            </div>
            <div class="modal-body">
              <p class="modal-description-text">
                Vui lòng nhập lý do từ chối ứng viên quy luật này:
              </p>
              <textarea
                v-model="rejectReviewNote"
                rows="4"
                class="form-textarea"
                placeholder="Ví dụ: Dữ liệu chưa đủ thuyết phục, mô hình hóa sai hoặc thiếu trích xuất trọng tâm..."
              ></textarea>
            </div>
            <div class="modal-footer">
              <AppButton variant="secondary" size="sm" @click="showRejectModal = false">Hủy</AppButton>
              <AppButton variant="danger" size="sm" :loading="isRejecting" @click="confirmRejection">Xác nhận từ chối</AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Deactivate Confirm Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showDeactivateModal"
          class="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Vô hiệu hóa quy luật"
          @click.self="showDeactivateModal = false"
        >
          <div class="modal-container" tabindex="-1">
            <div class="modal-header">
              <h3 class="modal-header__title">Vô hiệu hóa quy luật</h3>
              <button class="modal-close-btn" aria-label="Đóng" @click="showDeactivateModal = false">&times;</button>
            </div>
            <div class="modal-body">
              <p class="modal-description-text">
                Vui lòng nhập lý do vô hiệu hóa quy luật này:
              </p>
              <textarea
                v-model="deactivateReason"
                rows="4"
                class="form-textarea"
                placeholder="Lý do vô hiệu hóa..."
                style="margin-bottom: var(--space-3);"
              ></textarea>
              <label class="form-checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer;">
                <input
                  type="checkbox"
                  v-model="deactivateConfirmCheckbox"
                />
                Xác nhận muốn vô hiệu hóa quy luật này
              </label>
            </div>
            <div class="modal-footer">
              <AppButton variant="secondary" size="sm" @click="showDeactivateModal = false">Hủy</AppButton>
              <AppButton variant="danger" size="sm" :loading="isDeactivating" @click="confirmDeactivate">Xác nhận vô hiệu hóa</AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirm Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showDeleteModal"
          class="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Xóa vĩnh viễn ứng viên"
          @click.self="showDeleteModal = false"
        >
          <div class="modal-container" tabindex="-1">
            <div class="modal-header">
              <h3 class="modal-header__title">Xóa vĩnh viễn ứng viên</h3>
              <button class="modal-close-btn" aria-label="Đóng" @click="showDeleteModal = false">&times;</button>
            </div>
            <div class="modal-body">
              <p class="modal-description-text" style="color: #ef4444;">
                Hành động này không thể hoàn tác. Ứng viên quy luật này sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu.
              </p>
              <label class="form-checkbox-label" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer;">
                <input
                  type="checkbox"
                  v-model="deleteConfirmCheckbox"
                />
                Tôi xác nhận muốn xóa vĩnh viễn ứng viên này
              </label>
            </div>
            <div class="modal-footer">
              <AppButton variant="secondary" size="sm" @click="showDeleteModal = false">Hủy</AppButton>
              <AppButton variant="danger" size="sm" :loading="isDeleting" @click="confirmDelete">Xác nhận xóa</AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Clear All Rejected Confirm Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showClearAllModal"
          class="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Xóa tất cả ứng viên bị từ chối"
          @click.self="showClearAllModal = false"
        >
          <div class="modal-container" tabindex="-1">
            <div class="modal-header">
              <h3 class="modal-header__title">Xóa tất cả ứng viên bị từ chối</h3>
              <button class="modal-close-btn" aria-label="Đóng" @click="showClearAllModal = false">&times;</button>
            </div>
            <div class="modal-body">
              <p class="modal-description-text" style="color: #ef4444;">
                CẢNH BÁO: Tất cả các ứng viên quy luật có trạng thái 'Từ chối' (bao gồm cả các quy luật đã vô hiệu hóa) sẽ bị xóa vĩnh viễn khỏi hệ thống!
              </p>
              <p class="modal-description-text">
                Vui lòng nhập <strong>CONFIRM</strong> bên dưới để xác nhận:
              </p>
              <input
                type="text"
                v-model="clearAllConfirmationInput"
                class="form-input"
                placeholder="Nhập CONFIRM..."
              />
            </div>
            <div class="modal-footer">
              <AppButton variant="secondary" size="sm" @click="showClearAllModal = false">Hủy</AppButton>
              <AppButton variant="danger" size="sm" :loading="isClearingAll" @click="confirmClearAll">Xác nhận xóa sạch</AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import AppButton from '@/components/common/AppButton.vue'
import {
  getRuleCandidates,
  getRuleCandidateDetail,
  updateRuleCandidate,
  approveRuleCandidate,
  rejectRuleCandidate,
  deactivateRule,
  restoreRejectedCandidate,
  deleteCandidate,
  clearAllRejectedCandidates,
  getApprovedRules
} from '@/api/ruleCandidateApi'
import { getApprovedSourceById } from '@/api/sourceApi'
import type {
  RuleCandidate,
  EvidenceChunkPreview,
  EvidenceExcerpt
} from '@/api/ruleCandidateApi'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

// Access Controls
const isUnauthorized = computed(() => {
  const allowlist = (import.meta.env.VITE_MODERATOR_USER_IDS || '').split(',')
  const myId = authStore.user?._id
  return !myId || !allowlist.map((id: string) => id.trim().toLowerCase()).includes(myId.toLowerCase())
})

// Query filters
const sourceIdFilter = ref<string | null>(null)
const sourceFilterTitle = ref<string | null>(null)

// Left Panel Tab State
const activeStatus = ref<string>('pending')
const statusTabs = [
  { status: 'approved_rules', label: 'Tất cả luật' },
  { status: 'pending', label: 'Chờ duyệt' },
  { status: 'rejected', label: 'Bị từ chối' }
]

const emptyStateMessage = computed(() => {
  if (sourceIdFilter.value) {
    return 'Chưa có ứng viên nào từ tài liệu này. Hãy trích xuất quy luật từ trang chi tiết tài liệu.'
  }
  return 'Chưa có ứng viên quy luật nào.'
})

// Lists & Selection
const candidates = ref<RuleCandidate[]>([])
const isLoadingList = ref(false)
const selectedId = ref<string | null>(null)

const groupedCandidates = computed(() => {
  const groups: Record<string, RuleCandidate[]> = {}
  for (const cand of candidates.value) {
    const sourceObj = cand.academicSourceId && typeof cand.academicSourceId === 'object' ? cand.academicSourceId : null
    const title = sourceObj?.title || cand.sourceTitle || 'Tài liệu khác'
    if (!groups[title]) {
      groups[title] = []
    }
    groups[title].push(cand)
  }
  return groups
})

// Detail & Edit Form State
const selectedCandidate = ref<RuleCandidate | null>(null)
const evidenceChunks = ref<EvidenceChunkPreview[]>([])
const evidenceExcerpts = ref<EvidenceExcerpt[]>([])
const isLoadingDetail = ref(false)
const isSaving = ref(false)

const form = ref<Partial<RuleCandidate>>({
  proposedRuleId: '',
  label: '',
  group: 'dream_psychology',
  category: '',
  factor: '',
  inputSource: '',
  scientificBasis: '',
  aiInstruction: '',
  limitations: '',
  claimStrength: 'interpretive_framework',
  confidenceCap: 0.50,
  evidenceRole: 'primary_support',
  evidenceSummary: '',
  reviewerNote: '',
  evidenceCredibilityScore: 0,
  oracleUsefulnessScore: 0,
  oracleEligible: true,
  paperDomain: 'unknown'
})
const inputRequiredStr = ref<string>('{}')

// Collapsible advanced panel
const showAdvancedEdit = ref(false)

// Chunk UI states
const chunkCollapsed = ref<boolean[]>([])
const excerptCollapsed = ref<boolean[]>([])
const showChunkPreviewMap = ref<Record<string, boolean>>({})

const isReadonly = computed(() => {
  if (!selectedCandidate.value) return true
  return selectedCandidate.value.status === 'approved' || selectedCandidate.value.status === 'rejected'
})

// Modals Trigger
const showApproveModal = ref(false)
const isApproving = ref(false)

const showRejectModal = ref(false)
const isRejecting = ref(false)
const rejectReviewNote = ref('')

// Initialize filters from route query
// Initialize filters from route query
watch(
  () => route.query.sourceId,
  async (newVal) => {
    sourceIdFilter.value = newVal ? String(newVal) : null
    if (sourceIdFilter.value) {
      try {
        const sourceData = await getApprovedSourceById(sourceIdFilter.value)
        if (sourceData && sourceData.title) {
          sourceFilterTitle.value = sourceData.title
        } else {
          sourceFilterTitle.value = null
        }
      } catch (err) {
        console.error('Failed to fetch source details:', err)
        sourceFilterTitle.value = null
      }
    } else {
      sourceFilterTitle.value = null
    }
    fetchCandidatesList()
  },
  { immediate: true }
)

function clearSourceFilter() {
  router.push({ path: route.path })
}

function changeTab(status: string) {
  showAdvancedEdit.value = false
  activeStatus.value = status
  fetchCandidatesList()
}

// Fetch left column candidate rules list
async function fetchCandidatesList() {
  if (isUnauthorized.value) return
  isLoadingList.value = true
  try {
    if (sourceIdFilter.value && !sourceFilterTitle.value) {
      try {
        const sourceData = await getApprovedSourceById(sourceIdFilter.value)
        if (sourceData && sourceData.title) {
          sourceFilterTitle.value = sourceData.title
        }
      } catch (err) {
        console.error('Failed to fetch source details on list load:', err)
      }
    }

    if (activeStatus.value === 'approved_rules') {
      const res = await getApprovedRules()
      if (res.success) {
        let mapped = res.data.map((rule: any) => ({
          _id: rule.ruleId,
          proposedRuleId: rule.ruleId,
          label: normalizeVietnameseTerms(rule.label),
          group: rule.group,
          factor: rule.factor,
          claimStrength: rule.claimStrength,
          confidenceCap: rule.confidenceCap,
          sourceTitle: rule.sourceTitle,
          sourceAuthors: rule.sourceAuthors,
          sourceYear: rule.sourceYear,
          status: 'approved',
          createdAt: rule.createdAt || new Date().toISOString()
        }))
        if (sourceFilterTitle.value) {
          mapped = mapped.filter((rule: any) =>
            rule.sourceTitle && rule.sourceTitle.toLowerCase().trim() === sourceFilterTitle.value!.toLowerCase().trim()
          )
        }
        candidates.value = mapped as any
      }
    } else {
      const params: Record<string, string> = {
        status: activeStatus.value
      }
      if (sourceIdFilter.value) {
        params.academicSourceId = sourceIdFilter.value
      }
      const res = await getRuleCandidates(params)
      if (res.success) {
        candidates.value = res.data.map((cand: any) => ({
          ...cand,
          label: normalizeVietnameseTerms(cand.label)
        }))
      }
    }
  } catch (err: any) {
    settingsStore.showToast('Không thể tải danh sách ứng viên.', 'error')
  } finally {
    isLoadingList.value = false
  }
}

// Helper maps
const groupMeta = {
  sleep_context: {
    label: 'Bối cảnh giấc mơ',
    desc: 'Ý nghĩa: Dùng cho những quy luật liên quan đến điều kiện ngủ, môi trường ngủ, tư thế, lịch ngủ, hoặc bối cảnh trước khi ngủ. (Lưu ý: Không dùng nhóm này trừ khi nguồn trực tiếp nghiên cứu các yếu tố này.)'
  },
  dream_psychology: {
    label: 'Tâm lý học giấc mơ',
    desc: 'Ý nghĩa: Dùng cho lý thuyết, cơ chế nhận thức, cảm xúc, trí nhớ, tự tổ chức, mô phỏng, hoặc xử lý thông tin trong giấc mơ.'
  },
  personality_knowledge: {
    label: 'Tính cách cá nhân',
    desc: 'Ý nghĩa: Dùng khi nguồn nghiên cứu liên hệ giấc mơ với đặc điểm tính cách hoặc khuynh hướng cá nhân.'
  },
  cultural_limitation: {
    label: 'Giới hạn văn hóa',
    desc: 'Ý nghĩa: Dùng để nhắc AI rằng diễn giải văn hóa/tâm linh chỉ là tham khảo và cần tránh áp đặt nếu thiếu dữ liệu văn hóa cá nhân.'
  }
}

const claimStrengthMeta = {
  interpretive_framework: {
    label: 'Khung diễn giải',
    desc: 'Ý nghĩa: Dùng như một lăng kính giải thích, không khẳng định chắc chắn.'
  },
  possible_contributing_factor: {
    label: 'Yếu tố có thể góp phần',
    desc: 'Ý nghĩa: Có thể liên quan, nhưng không khẳng định nguyên nhân trực tiếp.'
  },
  association_not_causation: {
    label: 'Liên hệ, không phải nhân quả',
    desc: 'Ý nghĩa: Có liên hệ trong nghiên cứu, nhưng không đủ để kết luận nguyên nhân.'
  },
  hypothesis_not_diagnosis: {
    label: 'Giả thuyết, không phải chẩn đoán',
    desc: 'Ý nghĩa: Chỉ là giả thuyết tham khảo, không dùng như chẩn đoán y khoa/tâm lý.'
  },
  epistemic_boundary_rule: {
    label: 'Quy tắc giới hạn tri thức',
    desc: 'Ý nghĩa: Nhắc AI không được diễn giải vượt quá bằng chứng.'
  }
}

const evidenceRoleMeta = {
  primary_support: {
    label: 'Bằng chứng chính',
    desc: 'Ý nghĩa: Đoạn này trực tiếp ủng hộ quy luật.'
  },
  secondary_support: {
    label: 'Bằng chứng phụ',
    desc: 'Ý nghĩa: Đoạn này bổ sung hoặc làm rõ quy luật.'
  },
  background: {
    label: 'Bối cảnh nền',
    desc: 'Ý nghĩa: Đoạn này cung cấp nền tảng, nhưng không phải bằng chứng trực tiếp.'
  },
  limitation: {
    label: 'Giới hạn áp dụng',
    desc: 'Ý nghĩa: Đoạn này nói về giới hạn hoặc phạm vi áp dụng của quy luật.'
  },
  contradiction: {
    label: 'Bằng chứng trái chiều',
    desc: 'Ý nghĩa: Đoạn này mâu thuẫn hoặc làm yếu quy luật.'
  }
}

const statusMeta = {
  pending: { label: 'Chờ duyệt', class: 'status-badge--pending' },
  needs_edit: { label: 'Cần sửa', class: 'status-badge--needs-edit' },
  approved: { label: 'Đã duyệt', class: 'status-badge--approved' },
  rejected: { label: 'Từ chối', class: 'status-badge--rejected' }
}

function getGroupDesc(groupVal?: string) {
  if (!groupVal) return '';
  return groupMeta[groupVal as keyof typeof groupMeta]?.desc || '';
}
function getClaimStrengthDesc(csVal?: string) {
  if (!csVal) return '';
  return claimStrengthMeta[csVal as keyof typeof claimStrengthMeta]?.desc || '';
}
function getEvidenceRoleDesc(erVal?: string) {
  if (!erVal) return '';
  return evidenceRoleMeta[erVal as keyof typeof evidenceRoleMeta]?.desc || '';
}
function getStatusLabel(statusVal?: string) {
  if (!statusVal) return '';
  return statusMeta[statusVal as keyof typeof statusMeta]?.label || statusVal;
}
function getStatusClass(statusVal?: string) {
  if (!statusVal) return '';
  return statusMeta[statusVal as keyof typeof statusMeta]?.class || '';
}
function getFormattedSourceInfo(cand?: RuleCandidate) {
  if (!cand) return '';
  const source = cand.academicSourceId && typeof cand.academicSourceId === 'object' ? cand.academicSourceId : null;
  const authors = source?.authors && source.authors.length > 0 
    ? source.authors.join(', ') 
    : (cand.sourceAuthors && cand.sourceAuthors.length > 0 ? cand.sourceAuthors.join(', ') : 'Unknown Authors');
  const year = source?.year ? `(${source.year})` : (cand.sourceYear ? `(${cand.sourceYear})` : '');
  const title = source?.title || cand.sourceTitle || 'Untitled Source';
  return `${authors} ${year}, "${title}"`;
}
function getCorrespondingChunkPreview(chunkId: string): string {
  const chunk = evidenceChunks.value.find(c => c.chunkId === chunkId);
  return chunk ? chunk.chunkPreview : '';
}
function toggleExcerptCollapse(idx: number) {
  excerptCollapsed.value[idx] = !excerptCollapsed.value[idx];
}
function toggleChunkPreview(chunkId: string) {
  showChunkPreviewMap.value[chunkId] = !showChunkPreviewMap.value[chunkId];
}

function getErrorMessage(err: any, defaultMsg: string): string {
  if (err.response && err.response.data) {
    const data = err.response.data;
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors[0];
    }
    return data.message || defaultMsg;
  }
  return err.message || defaultMsg;
}

// Select list item and load details
async function selectCandidate(id: string) {
  showAdvancedEdit.value = false
  selectedId.value = id
  isLoadingDetail.value = true
  try {
    const res = await getRuleCandidateDetail(id)
    if (res.success && res.data) {
      const cand = res.data.candidate

      // Normalize Vietnamese terms in cand properties before setting selectedCandidate
      cand.label = normalizeVietnameseTerms(cand.label)
      cand.scientificBasis = normalizeVietnameseTerms(cand.scientificBasis)
      cand.aiInstruction = normalizeVietnameseTerms(cand.aiInstruction)
      cand.limitations = normalizeVietnameseTerms(cand.limitations)
      cand.evidenceSummary = normalizeVietnameseTerms(cand.evidenceSummary)
      if (cand.reviewerNote) {
        cand.reviewerNote = stripMetadataLabels(normalizeVietnameseTerms(cand.reviewerNote))
      }
      if (cand.legitimacyReason) {
        cand.legitimacyReason = stripMetadataLabels(normalizeVietnameseTerms(cand.legitimacyReason))
      }
      if (cand.conflictNotes) {
        cand.conflictNotes = deduplicateSentences(stripMetadataLabels(normalizeVietnameseTerms(cand.conflictNotes)))
      }

      selectedCandidate.value = cand
      evidenceChunks.value = res.data.evidenceChunks || []
      
      // Clean excerpts: filter out raw placeholders or chunk references
      if (res.data.evidenceExcerpts && res.data.evidenceExcerpts.length > 0) {
        const cleaned = res.data.evidenceExcerpts.filter((exc: any) => {
          if (!exc || !exc.excerpt) return false
          const text = exc.excerpt.trim()
          if (!text) return false
          const lower = text.toLowerCase()
          if (
            lower.startsWith('chunk #') || 
            lower === 'paragraph' || 
            lower.startsWith('[heading:') ||
            lower.includes('chunk #') || 
            lower.includes('[heading:')
          ) {
            return false
          }
          const typeLower = (exc.sectionType || '').toLowerCase()
          const titleLower = (exc.sectionTitle || '').toLowerCase()
          if (
            typeLower.includes('chunk #') ||
            titleLower.includes('chunk #') ||
            typeLower.includes('[heading:') ||
            titleLower.includes('[heading:')
          ) {
            return false
          }
          return true
        })
        evidenceExcerpts.value = cleaned.map((exc: any) => ({
          ...exc,
          excerpt: normalizeVietnameseTerms(exc.excerpt)
        }))
      } else {
        evidenceExcerpts.value = []
      }
      
      // Initialize collapse states
      chunkCollapsed.value = new Array(evidenceChunks.value.length).fill(true) // Context chunks collapsed by default
      excerptCollapsed.value = new Array(evidenceExcerpts.value.length).fill(false) // Excerpts expanded by default
      showChunkPreviewMap.value = {}

      // Bind form variables
      form.value = {
        proposedRuleId: cand.proposedRuleId,
        label: cand.label,
        group: cand.group,
        category: cand.category,
        factor: cand.factor,
        inputSource: cand.inputSource,
        scientificBasis: cand.scientificBasis,
        aiInstruction: cand.aiInstruction,
        limitations: cand.limitations,
        claimStrength: cand.claimStrength,
        confidenceCap: cand.confidenceCap,
        evidenceRole: cand.evidenceRole,
        evidenceSummary: cand.evidenceSummary,
        reviewerNote: cand.reviewerNote || '',
        evidenceCredibilityScore: cand.evidenceCredibilityScore ?? 0,
        oracleUsefulnessScore: cand.oracleUsefulnessScore ?? 0,
        oracleEligible: cand.oracleEligible ?? true,
        paperDomain: cand.paperDomain || 'unknown'
      }
      inputRequiredStr.value = JSON.stringify(cand.inputRequired || {}, null, 2)
    }
  } catch (err: any) {
    settingsStore.showToast('Không thể tải chi tiết ứng viên.', 'error')
    selectedCandidate.value = null
  } finally {
    isLoadingDetail.value = false
  }
}

// Format JSON
function handlePrettifyJson() {
  try {
    const parsed = JSON.parse(inputRequiredStr.value)
    inputRequiredStr.value = JSON.stringify(parsed, null, 2)
  } catch (err) {
    settingsStore.showToast('JSON không hợp lệ, không thể định dạng.', 'error')
  }
}

// Save Changes Trigger (PATCH)
async function handleSaveCandidate() {
  if (!selectedCandidate.value || isReadonly.value) return

  // Validate JSON string
  let parsedInputRequired = {}
  try {
    parsedInputRequired = JSON.parse(inputRequiredStr.value)
    if (typeof parsedInputRequired !== 'object' || parsedInputRequired === null || Array.isArray(parsedInputRequired)) {
      settingsStore.showToast('Điều kiện áp dụng không phải JSON hợp lệ (phải là object).', 'error')
      return
    }
    
    // Prototype pollution detection
    const hasPrototypePollution = (obj: any): boolean => {
      for (const key in obj) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          return true
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (hasPrototypePollution(obj[key])) return true
        }
      }
      return false
    }

    if (hasPrototypePollution(parsedInputRequired)) {
      settingsStore.showToast('Phát hiện payload không hợp lệ trong inputRequired (prototype pollution).', 'error')
      return
    }

  } catch (err) {
    settingsStore.showToast('Điều kiện áp dụng không phải JSON hợp lệ.', 'error')
    return
  }

  isSaving.value = true
  try {
    const payload = {
      ...form.value,
      inputRequired: parsedInputRequired
    }
    const res = await updateRuleCandidate(selectedCandidate.value._id, payload)
    if (res.success) {
      settingsStore.showToast('Lưu thay đổi thành công.', 'success')
      await selectCandidate(selectedCandidate.value._id)
      await fetchCandidatesList()
    }
  } catch (err: any) {
    const errMsg = getErrorMessage(err, 'Chỉnh sửa thất bại.')
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isSaving.value = false
  }
}

// Approval triggers
function triggerApproval() {
  showApproveModal.value = true
}

async function confirmApproval() {
  if (!selectedCandidate.value) return
  isApproving.value = true
  try {
    const res = await approveRuleCandidate(selectedCandidate.value._id)
    if (res.success) {
      settingsStore.showToast('Đã phê duyệt quy luật.', 'success')
      showApproveModal.value = false
      await selectCandidate(selectedCandidate.value._id)
      await fetchCandidatesList()
    }
  } catch (err: any) {
    if (err.response && err.response.status === 409) {
      settingsStore.showToast('Không thể phê duyệt vì mã quy luật đã tồn tại. Hãy chỉnh mã quy luật rồi thử lại.', 'error')
    } else {
      const errMsg = getErrorMessage(err, 'Phê duyệt quy luật thất bại.')
      settingsStore.showToast(errMsg, 'error')
    }
  } finally {
    isApproving.value = false
  }
}

// Rejection triggers
function triggerRejection() {
  rejectReviewNote.value = form.value.reviewerNote || ''
  showRejectModal.value = true
}

async function confirmRejection() {
  if (!selectedCandidate.value) return
  isRejecting.value = true
  try {
    const res = await rejectRuleCandidate(selectedCandidate.value._id, rejectReviewNote.value)
    if (res.success) {
      settingsStore.showToast('Đã từ chối ứng viên.', 'success')
      showRejectModal.value = false
      await selectCandidate(selectedCandidate.value._id)
      await fetchCandidatesList()
    }
  } catch (err: any) {
    const errMsg = getErrorMessage(err, 'Từ chối ứng viên thất bại.')
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isRejecting.value = false
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// New action states & modals
const showDeactivateModal = ref(false)
const deactivateReason = ref('')
const deactivateConfirmCheckbox = ref(false)
const isDeactivating = ref(false)

const showDeleteModal = ref(false)
const deleteConfirmCheckbox = ref(false)
const isDeleting = ref(false)

const showClearAllModal = ref(false)
const clearAllConfirmationInput = ref('')
const isClearingAll = ref(false)
const isRestoring = ref(false)

function triggerDeactivate() {
  deactivateReason.value = ''
  deactivateConfirmCheckbox.value = false
  showDeactivateModal.value = true
}

async function confirmDeactivate() {
  if (!selectedCandidate.value) return
  if (!deactivateConfirmCheckbox.value) {
    settingsStore.showToast('Vui lòng tích chọn xác nhận vô hiệu hóa.', 'error')
    return
  }
  isDeactivating.value = true
  try {
    const res = await deactivateRule(
      selectedCandidate.value.proposedRuleId,
      true,
      deactivateReason.value
    )
    if (res.success) {
      settingsStore.showToast('Quy luật đã được vô hiệu hóa thành công.', 'success')
      showDeactivateModal.value = false
      await selectCandidate(selectedCandidate.value.proposedRuleId)
      await fetchCandidatesList()
    }
  } catch (err: any) {
    const errMsg = getErrorMessage(err, 'Vô hiệu hóa quy luật thất bại.')
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isDeactivating.value = false
  }
}

function triggerDelete() {
  deleteConfirmCheckbox.value = false
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!selectedCandidate.value) return
  if (!deleteConfirmCheckbox.value) {
    settingsStore.showToast('Vui lòng tích chọn xác nhận xóa.', 'error')
    return
  }
  isDeleting.value = true
  try {
    const res = await deleteCandidate(selectedCandidate.value._id, true)
    if (res.success) {
      settingsStore.showToast('Xóa ứng viên thành công.', 'success')
      showDeleteModal.value = false
      selectedCandidate.value = null
      selectedId.value = null
      await fetchCandidatesList()
    }
  } catch (err: any) {
    const errMsg = getErrorMessage(err, 'Xóa ứng viên thất bại.')
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isDeleting.value = false
  }
}

async function handleRestore() {
  if (!selectedCandidate.value) return
  isRestoring.value = true
  try {
    const res = await restoreRejectedCandidate(selectedCandidate.value._id)
    if (res.success) {
      settingsStore.showToast('Khôi phục ứng viên về trạng thái chờ duyệt thành công.', 'success')
      await selectCandidate(selectedCandidate.value._id)
      await fetchCandidatesList()
    }
  } catch (err: any) {
    const errMsg = getErrorMessage(err, 'Khôi phục ứng viên thất bại.')
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isRestoring.value = false
  }
}

function triggerClearAll() {
  clearAllConfirmationInput.value = ''
  showClearAllModal.value = true
}

async function confirmClearAll() {
  if (clearAllConfirmationInput.value !== 'CONFIRM') {
    settingsStore.showToast('Vui lòng nhập chính xác "CONFIRM".', 'error')
    return
  }
  isClearingAll.value = true
  try {
    const res = await clearAllRejectedCandidates('CONFIRM')
    if (res.success) {
      settingsStore.showToast('Đã xóa sạch toàn bộ ứng viên bị từ chối.', 'success')
      showClearAllModal.value = false
      selectedCandidate.value = null
      selectedId.value = null
      await fetchCandidatesList()
    }
  } catch (err: any) {
    const errMsg = getErrorMessage(err, 'Xóa thất bại.')
    settingsStore.showToast(errMsg, 'error')
  } finally {
    isClearingAll.value = false
  }
}

function formatLegitimacyLevel(level?: string) {
  if (!level) return 'Không xác định'
  const map: Record<string, string> = {
    weak: 'Yếu',
    moderate: 'Trung bình',
    strong: 'Mạnh',
    mixed: 'Hỗn hợp'
  }
  return map[level] || level
}

function normalizeVietnameseTerms(text?: string): string {
  if (!text) return ''
  let normalized = text
  normalized = normalized.replace(/quá trình consolization/gi, 'quá trình củng cố ký ức')
  normalized = normalized.replace(/quá trình consolidation/gi, 'quá trình củng cố ký ức')
  normalized = normalized.replace(/consolization ký ức/gi, 'củng cố ký ức')
  normalized = normalized.replace(/consolization/gi, 'củng cố ký ức')
  normalized = normalized.replace(/consolidation ký ức/gi, 'củng cố ký ức')
  normalized = normalized.replace(/ổn định hóa trí nhớ/gi, 'củng cố ký ức')
  normalized = normalized.replace(/consolidation/gi, 'củng cố ký ức')
  normalized = normalized.replace(/củng cố ký ức ký ức/gi, 'củng cố ký ức')
  normalized = normalized.replace(/củng cố ký ức\s+ký ức/gi, 'củng cố ký ức')
  return normalized
}

function stripMetadataLabels(text?: string): string {
  if (!text) return ''
  let cleaned = text
  
  // Replace patterns like "Trạng thái trùng lặp/xung đột: Bổ trợ cho quy luật hiện có"
  cleaned = cleaned.replace(/Trạng thái trùng lặp\/xung đột:\s*[^\n\.]*/gi, '')
  // Replace "Loại bằng chứng: Khung lý thuyết" or similar
  cleaned = cleaned.replace(/Loại bằng chứng:\s*[^\n\.]*/gi, '')
  // Replace "Ghi chú xung đột: ..."
  cleaned = cleaned.replace(/Ghi chú xung đột:\s*/gi, '')
  // Replace "Mức độ hợp lệ: ..."
  cleaned = cleaned.replace(/Mức độ hợp lệ:\s*/gi, '')
  // Replace "Lý do đánh giá: ..."
  cleaned = cleaned.replace(/Lý do đánh giá:\s*/gi, '')
  
  // Clean up any remaining double spaces or trailing punctuation
  cleaned = cleaned.replace(/\s+/g, ' ')
  cleaned = cleaned.trim()
  return cleaned
}

function deduplicateSentences(text?: string): string {
  if (!text) return ''
  const sentences = text.split(/(?<=\.|\n)\s+/)
  const uniqueSentences = new Set<string>()
  for (const s of sentences) {
    const trimmed = s.trim()
    if (trimmed) {
      uniqueSentences.add(trimmed)
    }
  }
  return Array.from(uniqueSentences).join(' ')
}

function getConflictExplanation(cand?: RuleCandidate): string {
  if (!cand) return ''
  const status = cand.conflictStatus
  if (!status || status === 'none') return ''
  
  let explanation = ''
  if (status === 'supports_existing_rule') {
    explanation = 'Kết luận này bổ sung cho một luật đã có. Nó không mâu thuẫn với dữ liệu hiện tại, nhưng nên được xem như phần mở rộng hoặc làm rõ thêm.'
  } else if (status === 'duplicate_or_overlap') {
    explanation = 'Kết luận này gần giống một luật hoặc ứng viên đã có. Nên kiểm tra kỹ trước khi duyệt để tránh tạo hai luật nói cùng một ý.'
  } else if (status === 'conflicts_with_existing_rule' || status === 'possible_conflict') {
    explanation = 'Kết luận này có dấu hiệu mâu thuẫn với một luật đã có. Cần so sánh bằng chứng trước khi duyệt.'
  } else {
    explanation = ''
  }

  const cleanNotes = deduplicateSentences(stripMetadataLabels(cand.conflictNotes))
  if (cleanNotes) {
    if (explanation) {
      explanation += ' Chi tiết: ' + cleanNotes
    } else {
      explanation = cleanNotes
    }
  }
  return normalizeVietnameseTerms(explanation)
}

function getLegitimacyExplanation(cand?: RuleCandidate): string {
  if (!cand) return ''
  const score = cand.legitimacyScore || 0
  const levelLabel = formatLegitimacyLevel(cand.legitimacyLevel)
  
  let baseDesc = ''
  const evidenceType = cand.evidenceType || ''
  if (evidenceType === 'theoretical_framework' || evidenceType === 'opinion_or_hypothesis') {
    baseDesc = 'Độ tin cậy ở mức trung bình vì đây là bài viết thiên về khung lý thuyết, có dẫn các nghiên cứu liên quan nhưng không phải một thử nghiệm trực tiếp.'
  } else if (evidenceType === 'empirical_study') {
    baseDesc = 'Độ tin cậy cao hơn vì kết luận được hỗ trợ bởi dữ liệu hoặc kết quả thực nghiệm trong tài liệu.'
  } else if (evidenceType === 'literature_review' || evidenceType === 'mixed') {
    baseDesc = 'Độ tin cậy ở mức trung bình đến khá vì kết luận được tổng hợp từ nhiều nghiên cứu, nhưng vẫn phụ thuộc vào cách tác giả diễn giải nguồn.'
  } else {
    baseDesc = 'Bằng chứng hỗ trợ cho kết luận này cần đối chiếu thêm với các tài liệu nghiên cứu liên quan.'
  }

  let rating = `Mức tin cậy: ${levelLabel}, ${score}/100.`
  return normalizeVietnameseTerms(`${rating} ${baseDesc}`)
}

onMounted(() => {
  fetchCandidatesList()
})
</script>

<style scoped>
.candidates-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: var(--space-4);
  margin-top: var(--space-4);
  align-items: start;
  min-height: 600px;
}

.layout-left {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  height: 800px;
}

.layout-right {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  height: 800px;
  overflow: hidden;
}

/* Scroll areas */
.candidates-list-scroll {
  flex: 1;
  overflow-y: auto;
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-right: 4px;
}

.source-group-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.source-group-header {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 20px 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border-subtle);
  padding-bottom: 6px;
}

.source-group-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.detail-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding-right: var(--space-2);
}

.detail-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-text-muted);
}

.placeholder-icon {
  font-size: 3rem;
  margin-bottom: var(--space-3);
}

/* Candidate List Card */
.candidate-list-card {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-base);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.candidate-list-card:hover {
  background: var(--color-bg-hover);
  border-color: #3f3f3f;
}

.candidate-list-card--active {
  background: var(--color-bg-active);
  border-color: var(--accent);
}

.cand-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.cand-card-title {
  font-weight: var(--font-weight-semibold);
  font-size: 0.95rem;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.cand-card-source-citation {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.cand-card-id {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.technical-row {
  margin-top: 2px;
  border-top: 1px dashed var(--color-border-subtle);
  padding-top: 2px;
}

.footer-row {
  margin-top: 2px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.cand-card-date {
  color: var(--color-text-muted);
  font-size: 0.7rem;
  text-align: right;
  margin-left: auto;
}

.cand-card-meta-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}

.group-badge {
  font-size: 0.68rem;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-subtle);
}

.status-badge {
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-medium);
  border: 1px solid transparent;
}

.status-badge--pending {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.08);
}

.status-badge--needs-edit {
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.3);
  background: rgba(59, 130, 246, 0.08);
}

.status-badge--approved {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.08);
}

.status-badge--rejected {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
}

/* HUMAN-FIRST DOCUMENT LOOK */
.review-document-card {
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.review-document-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.review-section-tag {
  font-size: 0.75rem;
  font-weight: var(--font-weight-bold);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.status-badge-lg {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-bold);
  border: 1px solid transparent;
}

.review-rule-title {
  font-size: 1.4rem;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.35;
}

.review-rule-citation {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.45;
  margin: 0;
  border-left: 2px solid var(--accent);
  padding-left: var(--space-3);
}

.review-document-block {
  margin-top: var(--space-5);
}

.review-block-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-3) 0;
}

.review-card-body {
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}

.block-highlight {
  border-left: 3px solid var(--accent);
  background: rgba(255, 255, 255, 0.01);
}

.formatted-text-block {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
  margin: 0;
  white-space: pre-wrap;
}

.prominent-block .review-card-body {
  background: rgba(16, 185, 129, 0.02);
  border-color: rgba(16, 185, 129, 0.2);
}

.prominent-evidence-text {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-primary);
  margin: 0;
  white-space: pre-wrap;
}

.warning-block .warning-box {
  background: rgba(245, 158, 11, 0.02);
  border-color: rgba(245, 158, 11, 0.2);
}

.warning-text {
  color: #f59e0b;
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-2) 0;
}

.technical-footnote {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
  padding-top: var(--space-3);
  text-align: right;
}

.mono-footnote {
  font-family: var(--font-family-mono), monospace;
  background: var(--color-bg-elevated);
  padding: 1px 4px;
  border-radius: var(--radius-sm);
}

/* Collapsible advanced edit section */
.advanced-collapsible-section {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-top: var(--space-6);
  margin-bottom: var(--space-8);
  overflow: hidden;
}

.advanced-toggle-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-base);
  border: none;
  cursor: pointer;
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  transition: background var(--transition-fast);
}

.advanced-toggle-btn:hover {
  background: var(--color-bg-hover);
}

.toggle-chevron {
  font-size: 0.75rem;
  color: var(--accent);
}

.advanced-fields-panel {
  padding: var(--space-4);
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border-subtle);
}

.advanced-intro-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-4) 0;
  line-height: 1.45;
}

/* Form inputs & controls styles */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.form-input,
.form-textarea {
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-input);
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-family: inherit;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  transition: border-color var(--transition-fast), background var(--transition-fast);
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--color-bg-surface);
}

.form-input[readonly],
.form-textarea[readonly],
.form-input[disabled],
.form-textarea[disabled] {
  background: var(--color-bg-surface);
  border-color: var(--color-border-subtle);
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

/* Select inputs styled specifically for dark theme options */
select.form-input,
select.select-styled {
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23a8a8a8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 4.5 6 7.5 9 4.5'/></svg>");
  background-repeat: no-repeat;
  background-position: right var(--space-3) center;
  padding-right: var(--space-6);
  background-color: #1e1e1e !important;
  color: #f3f5f7 !important;
}

select.form-input option,
select.select-styled option {
  background-color: #1e1e1e !important;
  color: #f3f5f7 !important;
}

.field-help-desc {
  font-size: 0.72rem;
  color: var(--accent);
  margin-top: 4px;
  line-height: 1.35;
}

.mono {
  font-family: var(--font-family-mono), monospace !important;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.form-group--full {
  grid-column: span 2;
}

.form-save-row {
  margin-top: var(--space-4);
  align-items: flex-start;
}

.textarea-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.prettify-btn {
  background: var(--color-bg-base);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.prettify-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* Approved/Rejected banners */
.approved-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  color: #10b981;
}

.approved-banner__icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.approved-banner__content {
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.approved-banner__content strong {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 2px;
}

.approved-banner__content p {
  margin: 0;
  color: var(--color-text-secondary);
}

.rejected-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  color: #ef4444;
}

.rejected-banner__icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.rejected-banner__content {
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.rejected-banner__content strong {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 2px;
}

.rejected-banner__content p {
  margin: 0;
  color: var(--color-text-secondary);
}

/* Excerpt Cards List */
.excerpt-cards-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.excerpt-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-base);
  overflow: hidden;
}

.excerpt-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  background: var(--color-bg-elevated);
  cursor: pointer;
  user-select: none;
}

.excerpt-card-header:hover {
  background: var(--color-bg-hover);
}

.excerpt-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.excerpt-section-tag {
  font-size: 0.7rem;
  text-transform: capitalize;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-subtle);
  padding: 0 6px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.excerpt-title-tag {
  font-size: 0.75rem;
  color: var(--color-text-primary);
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.excerpt-page-tag {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.collapse-chevron {
  font-size: 0.65rem;
  color: var(--color-text-muted);
}

.excerpt-card-body {
  padding: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-bg-base);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.focused-excerpt-blockquote {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--color-text-primary);
  white-space: pre-wrap;
  margin: 0;
  font-style: italic;
  border-left: 3px solid var(--accent);
  padding-left: var(--space-3);
}

/* Context collapsible inside excerpts */
.context-collapsible-wrapper {
  margin-top: 4px;
  border-top: 1px dashed var(--color-border-subtle);
  padding-top: var(--space-2);
}

.context-toggle-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.72rem;
  cursor: pointer;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.context-toggle-btn:hover {
  color: var(--accent);
}

.context-preview-box {
  background: var(--color-bg-elevated);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-subtle);
  margin-top: var(--space-2);
}

.context-preview-text {
  font-size: 0.78rem;
  line-height: var(--line-height-normal);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  margin: 0;
}

/* Filter Pill */
.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-bg-active);
  border: 1px solid var(--color-border);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  margin-bottom: var(--space-3);
  width: fit-content;
  font-size: var(--font-size-xs);
}

.filter-pill-text {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.clear-pill-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-pill-btn:hover {
  color: #ef4444;
}

.clear-all-row-bottom {
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  width: 100%;
}

/* Sticky Action Footer */
.review-actions-sticky-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  position: sticky;
  bottom: 0;
  background: var(--color-bg-elevated);
  padding-bottom: 2px;
}

.sticky-footer-right {
  display: flex;
  gap: var(--space-3);
}

.trust-level-note-pill {
  font-size: 0.78rem;
  color: var(--accent);
  font-weight: var(--font-weight-semibold);
}

/* Unauthorized section styles */
.unauthorized-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.unauthorized-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-8) var(--space-6);
  text-align: center;
  max-width: 420px;
}

.unauthorized-icon {
  font-size: 3rem;
  margin-bottom: var(--space-4);
}

.unauthorized-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
}

.unauthorized-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.4;
}

/* Modal and overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-container {
  background-color: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  width: 500px;
  max-width: 90vw;
  padding: var(--space-5);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border-subtle);
  padding-bottom: var(--space-3);
}

.modal-header__title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.modal-close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
}

.modal-close-btn:hover {
  color: var(--color-text-primary);
}

.modal-body {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.modal-description-text {
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: var(--space-3);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
  padding-top: var(--space-3);
}

/* Tab styling details */
.moderation-tabs {
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 2px;
}

.moderation-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.moderation-tab:hover {
  color: var(--color-text-primary);
}

.moderation-tab--active {
  color: var(--accent) !important;
  border-bottom-color: var(--accent) !important;
}

.moderation-loading,
.moderation-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) 0;
  text-align: center;
  color: var(--color-text-muted);
}

.moderation-empty__icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-3);
}

.moderation-empty__title {
  color: var(--color-text-primary);
  margin: 0 0 var(--space-2) 0;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
  margin-bottom: var(--space-3);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* thin elegant scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Deactivated status styling */
.status-badge--deactivated {
  color: #9ca3af;
  border-color: rgba(156, 163, 175, 0.3);
  background: rgba(156, 163, 175, 0.08);
}

.deactivated-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: rgba(156, 163, 175, 0.08);
  border: 1px solid rgba(156, 163, 175, 0.3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  color: #9ca3af;
}

.deactivated-banner__icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.deactivated-banner__content {
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.deactivated-banner__content strong {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 2px;
}

.deactivated-banner__content p {
  margin: 0;
  color: var(--color-text-secondary);
}

/* Underline text actions styling */
.action-link-btn {
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: inherit;
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  transition: color var(--transition-fast);
}

.action-link-btn:disabled {
  color: var(--color-text-muted) !important;
  cursor: not-allowed;
  text-decoration: none;
}

.text-danger-underline {
  color: #ef4444;
}
.text-danger-underline:hover:not(:disabled) {
  color: #f87171;
}

.text-primary-underline {
  color: #3b82f6;
}
.text-primary-underline:hover:not(:disabled) {
  color: #60a5fa;
}

.text-muted-underline {
  color: var(--color-text-secondary);
}
.text-muted-underline:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.assessment-row {
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.assessment-val {
  color: var(--color-text-primary);
  font-weight: 500;
  margin-left: var(--space-1);
}
</style>
