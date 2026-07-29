<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="modelValue"
        class="app-confirm-overlay"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="messageId"
        @click.self="handleCancel"
        @keydown="handleDialogKeydown"
      >
        <div ref="dialogRef" class="app-confirm" tabindex="-1">
          <button
            type="button"
            class="app-confirm__close-btn"
            :aria-label="t('common.confirm.close')"
            :disabled="loading"
            @click="handleCancel"
          >
            ×
          </button>
          <h2 :id="titleId" class="app-confirm__title">{{ title }}</h2>
          <p :id="messageId" class="app-confirm__message">{{ message }}</p>
          <div class="app-confirm__actions">
            <button
              v-if="secondaryLabel"
              type="button"
              :id="`${uid}-secondary`"
              class="app-confirm__btn app-confirm__btn--secondary"
              :disabled="loading"
              @click="emit('secondary')"
            >
              {{ secondaryLabel }}
            </button>
            <button
              type="button"
              :id="`${uid}-cancel`"
              class="app-confirm__btn app-confirm__btn--cancel"
              :disabled="loading"
              @click="handleCancel"
            >
              {{ resolvedCancelLabel }}
            </button>
            <button
              type="button"
              :id="`${uid}-confirm`"
              class="app-confirm__btn"
              :class="danger ? 'app-confirm__btn--danger' : 'app-confirm__btn--confirm'"
              :disabled="loading"
              @click="handleConfirm"
            >
              {{ loading ? t('common.confirm.loading') : resolvedConfirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  secondaryLabel?: string
  danger?: boolean
  loading?: boolean
}>(), {
  confirmLabel: '',
  cancelLabel:  '',
  secondaryLabel: '',
  danger:       false,
  loading:      false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel:  []
  secondary: []
}>()

const { t } = useI18n()
const uid      = `app-confirm-${Math.random().toString(36).slice(2, 7)}`
const titleId  = computed(() => `${uid}-title`)
const messageId = computed(() => `${uid}-msg`)
const resolvedConfirmLabel = computed(() => props.confirmLabel || t('common.confirm.confirm'))
const resolvedCancelLabel = computed(() => props.cancelLabel || t('common.confirm.cancel'))
const dialogRef = ref<HTMLElement | null>(null)
let previouslyFocusedElement: HTMLElement | null = null

function handleConfirm() {
  if (props.loading) return
  emit('confirm')
}

function handleCancel() {
  if (props.loading) return
  emit('cancel')
  emit('update:modelValue', false)
}

function enabledControls(): HTMLElement[] {
  if (!dialogRef.value) return []
  return Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    handleCancel()
    return
  }

  if (event.key !== 'Tab') return
  const controls = enabledControls()
  if (controls.length === 0) {
    event.preventDefault()
    dialogRef.value?.focus()
    return
  }

  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

watch(
  () => props.modelValue,
  async (isOpen, wasOpen) => {
    if (isOpen) {
      previouslyFocusedElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      await nextTick()
      const cancelButton = dialogRef.value?.querySelector<HTMLElement>('.app-confirm__btn--cancel:not(:disabled)')
      const initialFocusTarget = cancelButton ?? dialogRef.value
      initialFocusTarget?.focus()
      return
    }

    if (wasOpen) {
      await nextTick()
      previouslyFocusedElement?.focus()
      previouslyFocusedElement = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (props.modelValue) previouslyFocusedElement?.focus()
})
</script>

<style scoped>
/* ── Overlay ── */
/* rgba(0,0,0,0.8) — no blur, as per PROJECT_SPEC flat design rules */
.app-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

/* ── Modal panel ── */
/* Strictly flat: #181818 bg, 1px solid #262626 border, NO shadow */
.app-confirm {
  position: relative;
  width: min(400px, calc(100vw - 2rem));
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  box-shadow: none;
}

.app-confirm:focus {
  outline: none;
}

.app-confirm__close-btn {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  background: transparent;
  border: none;
  color: var(--color-text-muted, #737373);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm, 4px);
  transition: color var(--transition-fast), background var(--transition-fast);
}
.app-confirm__close-btn:hover:not(:disabled) {
  color: var(--color-text-primary, #ffffff);
  background: rgba(255, 255, 255, 0.05);
}
.app-confirm__close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.app-confirm__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}

.app-confirm__message {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

/* ── Action row ── */
.app-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.app-confirm__btn {
  height: 36px;
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-family: var(--font-family-base);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.app-confirm__btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Cancel — muted flat */
.app-confirm__btn--cancel {
  background: #222222;
  color: var(--color-text-secondary);
  border-color: #333333;
}
.app-confirm__btn--secondary {
  margin-right: auto;
  background: transparent;
  color: var(--color-text-primary);
  border-color: #3a3a3a;
}
.app-confirm__btn--secondary:hover:not(:disabled) { background: #242424; }
.app-confirm__btn--cancel:hover:not(:disabled) {
  background: #2a2a2a;
  color: var(--color-text-primary);
}

/* Confirm — solid white (default action) */
.app-confirm__btn--confirm {
  background: #ffffff;
  color: #101010;
  border-color: #ffffff;
}
.app-confirm__btn--confirm:hover:not(:disabled) {
  background: #e0e0e0;
}

/* Danger confirm — solid red */
.app-confirm__btn--danger {
  background: #ed4956;
  color: #ffffff;
  border-color: #ed4956;
}
.app-confirm__btn--danger:hover:not(:disabled) {
  background: #c73b47;
}

/* ── Transition ── */
.confirm-fade-enter-active,
.confirm-fade-leave-active { transition: opacity 0.15s ease; }
.confirm-fade-enter-from,
.confirm-fade-leave-to     { opacity: 0; }
</style>
