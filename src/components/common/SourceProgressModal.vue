<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="sourceProgressStore.isDialogVisible && sourceProgressStore.contributionId"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="modalTitle"
        @click.self="sourceProgressStore.minimizeDialog()"
        @keydown.esc="sourceProgressStore.minimizeDialog()"
      >
        <div class="modal-container" tabindex="-1">
          <!-- Modal header -->
          <div class="modal-header">
            <div class="modal-title-area">
              <span class="modal-title-text">{{ modalTitle }}</span>
            </div>

            <div class="modal-header__right">
              <button
                class="modal-close-btn"
                aria-label="Minimize dialog"
                @click="sourceProgressStore.minimizeDialog()"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="modal-body-content">
            <div class="modal-source-info">
              <h3 class="source-title-heading">{{ sourceProgressStore.sourceTitle }}</h3>
              <p class="source-subtitle">{{ modalSubtitle }}</p>
            </div>

            <ol v-if="sourceProgressStore.pipelineKind === 'pdf'" class="docling-stage-list" :aria-label="t('common.sourceProgress.doclingStagesLabel')">
              <li v-for="stage in doclingStages" :key="stage.label" :class="[`is-${stage.state}`]">
                <span aria-hidden="true">{{ stage.state === 'done' ? '✓' : stage.state === 'active' ? '●' : '○' }}</span>
                <div><strong>{{ stage.label }}</strong><small>{{ stage.detail }}</small></div>
              </li>
            </ol>

            <!-- Pending Loading Content -->
            <PipelineProgressPanel
              :progress="sourceProgressStore.progress"
              :step-text="sourceProgressStore.stepText"
              :detail-text="sourceProgressStore.stageDetail"
              :elapsed-seconds="sourceProgressStore.elapsedSeconds"
              :estimated-remaining-seconds="sourceProgressStore.estimatedRemainingSeconds"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSourceProgressStore } from '@/store/useSourceProgressStore'
import PipelineProgressPanel from './PipelineProgressPanel.vue'

const sourceProgressStore = useSourceProgressStore()
const { t } = useI18n()

const modalTitle = computed(() => {
  if (sourceProgressStore.pipelineKind === 'structured') return 'Nhập lại bản đọc'
  if (sourceProgressStore.pipelineKind === 'pdf') return 'Tạo bản đọc từ PDF'
  return 'Đóng góp tài liệu'
})

const modalSubtitle = computed(() => {
  if (sourceProgressStore.pipelineKind === 'structured') {
    return 'Hệ thống đang lấy lại nội dung có cấu trúc từ DOI, JATS/XML hoặc HTML.'
  }
  if (sourceProgressStore.pipelineKind === 'pdf') {
    return 'Hệ thống đang phân tích PDF bằng Docling và dựng Bản đọc thông minh.'
  }
  return 'Hệ thống đang tiền xử lý nguồn, tải PDF và xây dựng Bản đọc thông minh tự động...'
})

const doclingStages = computed(() => {
  const progress = sourceProgressStore.progress
  const stages = [
    { threshold: 20, label: t('common.sourceProgress.receivePdf'), detail: t('common.sourceProgress.receivePdfDetail') },
    { threshold: 40, label: t('common.sourceProgress.inspectOcr'), detail: t('common.sourceProgress.inspectOcrDetail') },
    { threshold: 68, label: t('common.sourceProgress.parseDocling'), detail: t('common.sourceProgress.parseDoclingDetail') },
    { threshold: 85, label: t('common.sourceProgress.cleanOcr'), detail: t('common.sourceProgress.cleanOcrDetail') },
    { threshold: 100, label: t('common.sourceProgress.buildReader'), detail: t('common.sourceProgress.buildReaderDetail') },
  ]
  return stages.map((stage, index) => ({
    ...stage,
    state: progress >= stage.threshold ? 'done' : progress >= (stages[index - 1]?.threshold || 0) ? 'active' : 'pending',
  }))
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  z-index: var(--z-modal, 300);
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
  flex-shrink: 0;
}

.modal-title-text {
  font-size: var(--font-size-md);
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

.modal-body-content {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modal-source-info {
  border-bottom: 1px solid #262626;
  padding-bottom: var(--space-4);
}

.source-title-heading {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-1) 0;
  line-height: 1.4;
}

.source-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
}

.docling-stage-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.docling-stage-list li { display: grid; grid-template-columns: 18px 1fr; gap: 9px; padding: 8px 10px; border: 1px solid #292929; border-radius: var(--radius-md); color: var(--color-text-muted); }
.docling-stage-list li > span { padding-top: 1px; font-size: 11px; text-align: center; }
.docling-stage-list strong { display: block; color: inherit; font-size: var(--font-size-xs); }
.docling-stage-list small { display: block; margin-top: 2px; color: var(--color-text-muted); font-size: 10px; line-height: 1.4; }
.docling-stage-list .is-active { border-color: rgba(59,130,246,.42); color: #93c5fd; background: rgba(59,130,246,.06); }
.docling-stage-list .is-done { color: #6ee7b7; }

.pending-analysis-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) 0;
}

.loading-spinner-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #262626;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.progress-details {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.progress-text {
  font-weight: var(--font-weight-medium);
}

.progress-percent {
  font-family: var(--font-family-mono, monospace);
  color: #3b82f6;
}

.progress-bar-bg {
  width: 100%;
  height: 6px;
  background: #262626;
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.18s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
