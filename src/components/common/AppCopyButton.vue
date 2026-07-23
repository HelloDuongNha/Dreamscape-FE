<template>
  <button
    type="button"
    class="app-copy-button"
    :class="{ 'app-copy-button--copied': copied, 'app-copy-button--with-label': showLabel }"
    :aria-label="copied ? copiedLabel : label"
    :title="copied ? copiedLabel : label"
    :data-tooltip="copied ? copiedLabel : label"
    @click="copy"
  >
    <span v-if="showLabel" class="app-copy-button__label">
      {{ copied ? copiedLabel : label }}
    </span>
    <svg
      v-if="copied"
      class="app-copy-button__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
    <svg
      v-else
      class="app-copy-button__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useSettingsStore } from '@/store/useSettingsStore'

const props = withDefaults(defineProps<{
  text?: string
  resolveText?: () => string | Promise<string>
  label: string
  copiedLabel: string
  successMessage: string
  errorMessage: string
  showLabel?: boolean
}>(), {
  text: '',
  resolveText: undefined,
  showLabel: false,
})

const emit = defineEmits<{
  copied: []
}>()

const settingsStore = useSettingsStore()
const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  try {
    const text = props.resolveText ? await props.resolveText() : props.text
    if (!text?.trim()) throw new Error('clipboard_empty')

    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable')
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copiedWithFallback = document.execCommand('copy')
      textarea.remove()
      if (!copiedWithFallback) throw new Error('clipboard_fallback_failed')
    }

    copied.value = true
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      copied.value = false
      resetTimer = null
    }, 10_000)
    settingsStore.showToast(props.successMessage, 'success')
    emit('copied')
  } catch {
    settingsStore.showToast(props.errorMessage, 'error')
  }
}

onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer)
})
</script>

<style scoped>
.app-copy-button {
  position: relative;
  display: inline-grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  background: transparent;
  cursor: pointer;
  transition:
    color 140ms ease,
    border-color 140ms ease,
    background 140ms ease;
}

.app-copy-button--with-label {
  display: inline-flex;
  width: auto;
  min-height: 34px;
  padding: 0 10px 0 12px;
  gap: 8px;
}

.app-copy-button:hover,
.app-copy-button:focus-visible {
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

.app-copy-button--copied {
  border-color: color-mix(in srgb, #38bdf8 55%, var(--color-border));
  color: #38bdf8;
  background: color-mix(in srgb, #38bdf8 9%, transparent);
}

.app-copy-button__label {
  max-width: 320px;
  overflow: hidden;
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-copy-button::after {
  position: absolute;
  z-index: 50;
  right: 0;
  bottom: calc(100% + 8px);
  width: max-content;
  max-width: min(280px, 80vw);
  padding: 7px 9px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-md);
  content: attr(data-tooltip);
  font-size: 11px;
  line-height: 1.35;
  opacity: 0;
  pointer-events: none;
  transform: translateY(3px);
  transition: opacity 120ms ease, transform 120ms ease;
}

.app-copy-button:hover::after,
.app-copy-button:focus-visible::after {
  opacity: 1;
  transform: translateY(0);
}
</style>
