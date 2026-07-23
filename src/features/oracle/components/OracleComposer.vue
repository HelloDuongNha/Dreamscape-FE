<template>
  <div class="oracle-composer">
    <div class="oracle-composer__box">
      <textarea
        ref="textarea"
        id="oracle-composer-input"
        v-model="inputContent"
        class="oracle-composer__textarea"
        :placeholder="t('oracle.composerPlaceholder')"
        :aria-label="t('oracle.composerPlaceholder')"
        rows="1"
        :disabled="isSending"
        @keydown.enter.exact.prevent="submit"
      />

      <div class="oracle-composer__actions">
        <div class="oracle-composer__left-actions">
          <button
            type="button"
            class="oracle-composer__attach-btn"
            disabled
            :aria-label="`${t('oracle.attachDream')} (${t('oracle.backendUnavailable')})`"
            :title="`${t('oracle.attachDream')} — ${t('oracle.backendUnavailable')}`"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.5-8.5" />
            </svg>
          </button>

          <span class="oracle-composer__automatic">{{ t('oracle.automaticMode') }}</span>
        </div>

        <div class="oracle-composer__right-actions">
          <div
            v-if="contextUsage"
            class="oracle-composer__context"
            :title="t('oracle.contextUsageHelp', { used: contextUsage.usedTokens, max: contextUsage.maxTokens })"
          >
            <span class="oracle-composer__context-label">{{ t('oracle.contextLabel') }}</span>
            <span class="oracle-composer__context-ring">
              <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="15.5" />
                <circle
                  class="oracle-composer__context-progress"
                  cx="18"
                  cy="18"
                  r="15.5"
                  :style="{ strokeDashoffset: String(97.4 - (97.4 * contextUsage.percent) / 100) }"
                />
              </svg>
              <span>{{ contextUsage.percent }}%</span>
            </span>
            <span class="oracle-composer__context-popover" role="tooltip">
              <strong>{{ t('oracle.contextDetails') }}</strong>
              <span>{{ t('oracle.contextModel') }}: {{ contextUsage.modelName || t('oracle.contextEstimating') }}</span>
              <span>{{ t('oracle.contextProvider') }}: {{ contextUsage.provider || t('oracle.contextEstimating') }}</span>
              <span>{{ t('oracle.contextMessages') }}: {{ contextMessageCount }}</span>
              <span>{{ t('oracle.contextUsed') }}: {{ contextUsage.usedTokens.toLocaleString() }} token</span>
              <span>{{ t('oracle.contextRemaining') }}: {{ Math.max(0, contextUsage.maxTokens - contextUsage.usedTokens).toLocaleString() }} token</span>
              <span>{{ t('oracle.contextCapacity') }}: {{ contextUsage.maxTokens.toLocaleString() }} token</span>
            </span>
          </div>
          <div class="oracle-composer__delivery-option">
            <button
              type="button"
              :class="['oracle-composer__delivery-toggle', { 'oracle-composer__delivery-toggle--active': waitForComplete }]"
              role="switch"
              :aria-checked="waitForComplete"
              :aria-label="t('oracle.waitForComplete')"
              @click="$emit('update:waitForComplete', !waitForComplete)"
            >
              <span class="oracle-composer__delivery-track"><i /></span>
              <span>{{ waitForComplete ? t('oracle.showWhenReady') : t('oracle.showProgressively') }}</span>
            </button>
            <button
              type="button"
              class="oracle-composer__delivery-help"
              :aria-label="t('oracle.waitForCompleteHelp')"
              @click="showDeliveryHelp = !showDeliveryHelp"
              @blur="showDeliveryHelp = false"
            >?</button>
            <div v-show="showDeliveryHelp" class="oracle-composer__delivery-popover" role="tooltip">
              <strong>{{ t('oracle.waitForCompleteHelp') }}</strong>
              <span>- {{ t('oracle.waitForCompleteOnHelp') }}</span>
              <span>- {{ t('oracle.waitForCompleteOffHelp') }}</span>
            </div>
          </div>

          <AppButton
            variant="smart"
            size="sm"
            :disabled="!inputContent.trim() && !isSending"
            class="oracle-composer__send-btn"
            :aria-label="isSending ? t('oracle.stop') : t('oracle.send')"
            :title="isSending ? t('oracle.stop') : t('oracle.send')"
            @click="isSending ? $emit('cancel') : submit()"
          >
            <svg v-if="!isSending" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 19V5m-6 6 6-6 6 6" />
            </svg>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/common/AppButton.vue'

const props = withDefaults(
  defineProps<{
    isSending?: boolean
    waitForComplete?: boolean
    contextUsage?: {
      usedTokens: number
      maxTokens: number
      percent: number
      provider?: string
      modelName?: string
    }
    contextMessageCount?: number
  }>(),
  {
    isSending: false,
    waitForComplete: false,
    contextUsage: undefined,
    contextMessageCount: 0,
  }
)

const emit = defineEmits<{
  (e: 'send', content: string): void
  (e: 'cancel'): void
  (e: 'update:waitForComplete', value: boolean): void
}>()

const { t } = useI18n()
const inputContent = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)
const showDeliveryHelp = ref(false)

function submit() {
  const content = inputContent.value.trim()
  if (!content || props.isSending) return
  emit('send', content)
  inputContent.value = ''
}

function focus() {
  textarea.value?.focus()
}

function setContent(content: string) {
  inputContent.value = content
  requestAnimationFrame(() => {
    textarea.value?.focus()
    textarea.value?.setSelectionRange(content.length, content.length)
  })
}

function clear() {
  inputContent.value = ''
}

defineExpose({ focus, setContent, clear })
</script>

<style scoped>
.oracle-composer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

/* Notice banner for creative mode */
.oracle-composer__notice {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-md, 6px);
  color: #f59e0b;
  font-size: var(--font-size-xs, 12px);
}

/* Main Box */
.oracle-composer__box {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-input);
  border-radius: 22px;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.16);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.oracle-composer__box:focus-within {
  border-color: var(--color-border-hover);
  box-shadow: 0 12px 38px rgba(0, 0, 0, 0.22);
}

.oracle-composer__textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text-primary, #ffffff);
  font-family: var(--font-family-base);
  font-size: var(--font-size-sm, 14px);
  resize: none;
  min-height: 52px;
  max-height: 180px;
  line-height: 1.55;
  padding: var(--space-2);
}
.oracle-composer__textarea::placeholder {
  color: var(--color-text-muted, #737373);
}

/* Actions Bar */
.oracle-composer__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.oracle-composer__left-actions {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.oracle-composer__attach-btn {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  cursor: not-allowed;
  opacity: 0.72;
}

.oracle-composer__automatic {
  color: var(--color-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.oracle-composer__send-btn {
  width: 34px;
  min-width: 34px;
  padding: 0;
  border-radius: var(--radius-full);
}

.oracle-composer__right-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.oracle-composer__delivery-option {
  position: relative;
  display: inline-flex;
  width: 126px;
  flex: 0 0 126px;
  align-items: center;
  gap: 0.35rem;
}

.oracle-composer__send-btn :deep(.app-btn__label) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.oracle-composer__delivery-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  white-space: nowrap;
}

.oracle-composer__delivery-track {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: var(--color-bg-active);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

.oracle-composer__delivery-track i {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-text-muted);
  transition: transform 160ms ease, background 160ms ease;
}

.oracle-composer__delivery-toggle--active {
  color: var(--color-text-primary);
}

.oracle-composer__delivery-toggle--active .oracle-composer__delivery-track {
  background: var(--color-primary, #617dff);
}

.oracle-composer__delivery-toggle--active .oracle-composer__delivery-track i {
  transform: translateX(12px);
  background: #fff;
}

.oracle-composer__delivery-help {
  display: grid;
  width: 18px;
  height: 18px;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: help;
  font: inherit;
  font-size: 10px;
}

.oracle-composer__delivery-help:hover + .oracle-composer__delivery-popover,
.oracle-composer__delivery-help:focus + .oracle-composer__delivery-popover {
  display: grid !important;
}

.oracle-composer__context {
  position: relative;
  display: inline-flex;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-muted);
  font-size: 8px;
  font-weight: 700;
}

.oracle-composer__context-popover {
  position: absolute;
  z-index: 22;
  right: 0;
  bottom: calc(100% + 10px);
  display: none;
  width: 260px;
  gap: 0.35rem;
  padding: 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-elevated);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 450;
  line-height: 1.4;
}

.oracle-composer__context:hover .oracle-composer__context-popover,
.oracle-composer__context:focus-within .oracle-composer__context-popover {
  display: grid;
}

.oracle-composer__context-popover strong {
  color: var(--color-text-primary);
}

.oracle-composer__context-label {
  font-size: 10px;
  font-weight: 500;
}

.oracle-composer__context-ring {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
}

.oracle-composer__context-ring svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: var(--color-border);
  stroke-width: 2.4;
  transform: rotate(-90deg);
}

.oracle-composer__context-ring .oracle-composer__context-progress {
  stroke: var(--color-primary, #617dff);
  stroke-dasharray: 97.4;
  stroke-dashoffset: 97.4;
  stroke-linecap: round;
  transition: stroke-dashoffset 220ms ease;
}

.oracle-composer__delivery-popover {
  position: absolute;
  z-index: 20;
  right: 0;
  bottom: calc(100% + 10px);
  width: min(310px, calc(100vw - 40px));
  gap: 0.45rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-elevated);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.45;
}

.oracle-composer__delivery-popover strong {
  color: var(--color-text-primary);
}

@media (max-width: 640px) {
  .oracle-composer__actions {
    align-items: flex-end;
  }

  .oracle-composer__modes {
    max-width: calc(100vw - 150px);
  }
}
</style>
