<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="extractionStore.isDialogVisible && extractionStore.sourceId"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('rules.extraction.dialogAria')"
        @click.self="extractionStore.minimizeDialog()"
        @keydown.esc="extractionStore.minimizeDialog()"
      >
        <div class="modal-container" tabindex="-1">
          <!-- Modal header -->
          <div class="modal-header">
            <div class="modal-title-area">
              <span class="modal-title-text">{{ t('rules.extraction.title') }}</span>
            </div>

            <div class="modal-header__right">
              <button
                class="modal-close-btn"
                :aria-label="t('rules.extraction.minimize')"
                @click="extractionStore.minimizeDialog()"
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
              <h3 class="source-title-heading">{{ extractionStore.sourceTitle }}</h3>
              <p class="source-subtitle">{{ t('rules.extraction.subtitle') }}</p>
            </div>

            <!-- Pending Loading Content -->
            <PipelineProgressPanel
              :progress="extractionStore.progress"
              :step-text="localizedStepText"
              :detail-text="localizedStageDetail"
              :elapsed-seconds="extractionStore.elapsedSeconds"
              :processed-label="extractionStore.processedLabel"
              :estimated-remaining-seconds="extractionStore.estimatedRemainingSeconds"
            />

            <ol class="extraction-stage-list" :aria-label="t('rules.extraction.stepsAria')">
              <li
                v-for="(item, index) in stages"
                :key="item.key"
                :class="{
                  'extraction-stage-list__item--done': index < currentStageIndex,
                  'extraction-stage-list__item--active': index === currentStageIndex,
                }"
              >
                <span class="extraction-stage-list__marker" aria-hidden="true">{{ index < currentStageIndex ? '✓' : index + 1 }}</span>
                <div>
                  <strong>{{ item.label }}</strong>
                  <p>{{ index === currentStageIndex ? localizedStageDetail : item.detail }}</p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useExtractionStore } from '@/store/useExtractionStore'
import PipelineProgressPanel from './PipelineProgressPanel.vue'

const extractionStore = useExtractionStore()
const { t } = useI18n({ useScope: 'global' })

const stages = computed(() => [
  { key: 'initializing', label: t('rules.extraction.steps.prepare'), detail: t('rules.extraction.stepDetails.prepare') },
  { key: 'extracting_candidates', label: t('rules.extraction.steps.extract'), detail: t('rules.extraction.stepDetails.extract') },
  { key: 'saving_candidates', label: t('rules.extraction.steps.save'), detail: t('rules.extraction.stepDetails.save') },
])

const stageOrder = ['initializing', 'extracting_candidates', 'saving_candidates', 'completed'] as const
const currentStageIndex = computed(() => {
  const index = stageOrder.indexOf(extractionStore.currentStage)
  return extractionStore.currentStage === 'completed' ? stages.value.length : Math.max(0, index)
})

const localizedStepText = computed(() => {
  if (extractionStore.currentStage === 'extracting_candidates') {
    return t('rules.extraction.extracting', {
      processed: extractionStore.processedBatches,
      total: extractionStore.totalBatches,
    })
  }
  if (extractionStore.currentStage === 'saving_candidates') return t('rules.extraction.saving')
  if (extractionStore.currentStage === 'completed') return t('rules.extraction.completed')
  return t('rules.extraction.preparing')
})

const localizedStageDetail = computed(() => {
  if (extractionStore.currentStage === 'extracting_candidates') {
    return t('rules.extraction.candidateCounts', {
      raw: extractionStore.rawCandidateCount,
      verified: extractionStore.verifiedCandidateCount,
    })
  }
  if (extractionStore.currentStage === 'saving_candidates') return t('rules.extraction.stepDetails.save')
  if (extractionStore.currentStage === 'completed') return t('rules.extraction.stepDetails.completed')
  return t('rules.extraction.stepDetails.prepare')
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

.extraction-stage-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.extraction-stage-list li { display: grid; grid-template-columns: 28px 1fr; gap: 10px; opacity: .58; }
.extraction-stage-list__marker { display: grid; place-items: center; width: 26px; height: 26px; border: 1px solid #3a3a3a; border-radius: 50%; color: var(--color-text-muted); font-size: 12px; font-weight: 700; }
.extraction-stage-list strong { display: block; color: var(--color-text-secondary); font-size: var(--font-size-sm); }
.extraction-stage-list p { margin: 3px 0 0; color: var(--color-text-muted); font-size: var(--font-size-xs); line-height: 1.45; }
.extraction-stage-list__item--done, .extraction-stage-list__item--active { opacity: 1 !important; }
.extraction-stage-list__item--done .extraction-stage-list__marker { border-color: #16a34a; color: #4ade80; }
.extraction-stage-list__item--active .extraction-stage-list__marker { border-color: #3b82f6; color: #60a5fa; box-shadow: 0 0 0 4px rgba(59,130,246,.12); }
.extraction-stage-list__item--active strong { color: var(--color-text-primary); }

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
