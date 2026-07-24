<template>
  <Teleport to="body">
    <Transition name="long-task-fade">
      <div
        v-if="modelValue"
        class="long-task-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel || title"
        @click.self="$emit('minimize')"
        @keydown.esc="$emit('minimize')"
      >
        <section class="long-task-modal" tabindex="-1">
          <header class="long-task-modal__header">
            <h2>{{ title }}</h2>
            <button
              type="button"
              class="long-task-modal__close"
              :aria-label="minimizeLabel"
              @click="$emit('minimize')"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>

          <div class="long-task-modal__body">
            <div class="long-task-modal__intro">
              <h3>{{ subject }}</h3>
              <p>{{ subtitle }}</p>
            </div>

            <PipelineProgressPanel
              :progress="progress"
              :step-text="stepText"
              :detail-text="detailText"
              :elapsed-seconds="elapsedSeconds"
              :processed-label="processedLabel"
              :estimated-remaining-seconds="estimatedRemainingSeconds"
              :remaining-text="remainingText"
              :timing-delta-seconds="timingDeltaSeconds"
              :completed="completed"
            />

            <ol class="long-task-stages" :aria-label="stepsAriaLabel">
              <li
                v-for="(stage, index) in stages"
                :key="stage.key"
                :class="{
                  'is-done': stage.state === 'done' || index < currentStageIndex,
                  'is-active': stage.state === 'active' || index === currentStageIndex,
                  'is-failed': stage.state === 'failed',
                }"
              >
                <span class="long-task-stages__marker" aria-hidden="true">
                  {{ stage.state === 'done' || index < currentStageIndex ? '✓' : index + 1 }}
                </span>
                <div>
                  <strong>{{ stage.label }}</strong>
                  <p>
                    {{ stage.state === 'active' || index === currentStageIndex
                      ? (stage.activeDetail || stage.detail)
                      : (stage.result || stage.detail) }}
                    <span
                      v-if="!completed && (stage.state === 'active' || index === currentStageIndex)"
                      class="long-task-dots"
                      aria-hidden="true"
                    ><i></i><i></i><i></i></span>
                  </p>
                </div>
              </li>
            </ol>

            <slot />
          </div>

          <footer v-if="cancelable || $slots.actions" class="long-task-modal__footer">
            <slot name="actions" />
            <AppButton
              v-if="cancelable"
              type="button"
              variant="danger-outline"
              size="sm"
              :disabled="cancelLoading"
              @click="showCancelConfirm = true"
            >
              {{ cancelLabel }}
            </AppButton>
          </footer>
        </section>

        <AppConfirm
          v-model="showCancelConfirm"
          :title="cancelConfirmTitle"
          :message="cancelConfirmMessage"
          :confirm-label="cancelConfirmLabel"
          :cancel-label="keepRunningLabel"
          :loading="cancelLoading"
          danger
          @confirm="confirmCancellation"
          @cancel="showCancelConfirm = false"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AppButton from './AppButton.vue'
import AppConfirm from './AppConfirm.vue'
import PipelineProgressPanel from './PipelineProgressPanel.vue'

export interface LongRunningTaskStage {
  key: string
  label: string
  detail: string
  activeDetail?: string
  result?: string
  state?: 'pending' | 'active' | 'done' | 'failed'
}

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  subject: string
  subtitle: string
  ariaLabel?: string
  minimizeLabel: string
  stepsAriaLabel: string
  stages: LongRunningTaskStage[]
  currentStageIndex: number
  progress: number
  stepText: string
  detailText?: string
  elapsedSeconds?: number
  processedLabel?: string
  estimatedRemainingSeconds?: number | null
  remainingText?: string
  timingDeltaSeconds?: number | null
  completed?: boolean
  cancelable?: boolean
  cancelLoading?: boolean
  cancelLabel: string
  cancelConfirmTitle: string
  cancelConfirmMessage: string
  cancelConfirmLabel: string
  keepRunningLabel: string
}>(), {
  ariaLabel: '',
  detailText: '',
  elapsedSeconds: 0,
  processedLabel: '',
  estimatedRemainingSeconds: null,
  remainingText: '',
  timingDeltaSeconds: null,
  completed: false,
  cancelable: false,
  cancelLoading: false,
})

const emit = defineEmits<{
  minimize: []
  cancel: []
}>()

const showCancelConfirm = ref(false)

function confirmCancellation() {
  showCancelConfirm.value = false
  emit('cancel')
}

watch(
  () => [props.modelValue, props.cancelable] as const,
  ([visible, cancelable]) => {
    if (!visible || !cancelable) showCancelConfirm.value = false
  },
  { immediate: true },
)
</script>

<style scoped>
.long-task-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 300);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, .82);
}
.long-task-modal {
  width: 560px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow: auto;
  border: 1px solid #262626;
  border-radius: var(--radius-xl);
  outline: none;
  background: #181818;
}
.long-task-modal__header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 62px;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid #262626;
  background: #181818;
}
.long-task-modal__header h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}
.long-task-modal__close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
}
.long-task-modal__close:hover { color: var(--color-text-primary); background: var(--color-bg-hover); }
.long-task-modal__body { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); }
.long-task-modal__intro { padding-bottom: var(--space-4); border-bottom: 1px solid #262626; }
.long-task-modal__intro h3 {
  margin: 0 0 6px;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  line-height: 1.4;
}
.long-task-modal__intro p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.long-task-stages { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.long-task-stages li {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 10px;
  align-items: start;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  opacity: .68;
}
.long-task-stages__marker {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid #343434;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
}
.long-task-stages strong { display: block; font-size: 12px; font-weight: 650; }
.long-task-stages p { margin: 3px 0 0; font-size: 11px; line-height: 1.45; }
.long-task-stages .is-done { color: #91bca7; opacity: 1; }
.long-task-stages .is-done .long-task-stages__marker { border-color: #39785c; color: #6ee7b7; }
.long-task-stages .is-active {
  color: var(--color-text-primary);
  background: rgba(103, 111, 180, .09);
  opacity: 1;
}
.long-task-stages .is-active .long-task-stages__marker {
  border-color: #6671b8;
  color: #c3c8f0;
  box-shadow: 0 0 0 3px rgba(102, 113, 184, .09);
  animation: long-task-marker 1.6s ease-in-out infinite;
}
.long-task-stages .is-failed { color: #fca5a5; opacity: 1; }
.long-task-dots { display: inline-flex; gap: 3px; margin-left: 5px; vertical-align: 2px; }
.long-task-dots i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #929bd1;
  animation: long-task-dot 1.15s ease-in-out infinite;
}
.long-task-dots i:nth-child(2) { animation-delay: .16s; }
.long-task-dots i:nth-child(3) { animation-delay: .32s; }
.long-task-modal__footer {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5) var(--space-4);
  border-top: 1px solid #262626;
  background: #181818;
}
@keyframes long-task-dot {
  0%, 70%, 100% { opacity: .25; transform: translateY(0); }
  35% { opacity: 1; transform: translateY(-2px); }
}
@keyframes long-task-marker {
  0%, 100% { box-shadow: 0 0 0 3px rgba(102, 113, 184, .09); }
  50% { box-shadow: 0 0 0 6px rgba(102, 113, 184, .04); }
}
.long-task-fade-enter-active, .long-task-fade-leave-active { transition: opacity .18s ease; }
.long-task-fade-enter-from, .long-task-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .long-task-stages .is-active .long-task-stages__marker, .long-task-dots i { animation: none; }
}
</style>
