<template>
  <div class="feedback-choice-group" role="group" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :class="[
        'feedback-choice',
        `feedback-choice--${option.value}`,
        { 'feedback-choice--active': modelValue === option.value },
      ]"
      :aria-pressed="modelValue === option.value"
      :disabled="disabled"
      @click="$emit('update:modelValue', modelValue === option.value ? null : option.value)"
    >
      <span aria-hidden="true">{{ option.icon }}</span>
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type FeedbackChoice = 'yes' | 'no' | 'unsure'

const props = withDefaults(defineProps<{
  modelValue?: FeedbackChoice | null
  yesLabel?: string
  noLabel?: string
  unsureLabel?: string
  ariaLabel?: string
  disabled?: boolean
}>(), {
  modelValue: null,
  yesLabel: 'Có',
  noLabel: 'Không',
  unsureLabel: 'Chưa biết',
  ariaLabel: 'Chọn câu trả lời',
  disabled: false,
})

defineEmits<{
  (event: 'update:modelValue', value: FeedbackChoice | null): void
}>()

const options = computed(() => [
  { value: 'yes' as const, icon: '✓', label: props.yesLabel },
  { value: 'no' as const, icon: '×', label: props.noLabel },
  { value: 'unsure' as const, icon: '?', label: props.unsureLabel },
])
</script>

<style scoped>
.feedback-choice-group{display:flex;flex-wrap:wrap;gap:8px}
.feedback-choice{display:inline-flex;align-items:center;min-height:34px;padding:0 12px;border:1px solid var(--color-border);border-radius:999px;background:var(--color-bg-surface);color:var(--color-text-secondary);font:inherit;font-size:11px;font-weight:650;cursor:pointer;transition:background .16s ease,border-color .16s ease,color .16s ease,transform .12s ease}
.feedback-choice>span{display:inline-grid;place-items:center;width:17px;height:17px;margin-right:5px;border-radius:50%;background:var(--color-bg-elevated);font-size:10px}
.feedback-choice:hover:not(:disabled){border-color:var(--color-border-input);background:var(--color-bg-hover);color:var(--color-text-primary)}
.feedback-choice:active:not(:disabled){transform:scale(.97)}
.feedback-choice:disabled{cursor:not-allowed;opacity:.5}
.feedback-choice--yes.feedback-choice--active{border-color:rgb(52 211 153 / 55%);background:rgb(16 185 129 / 14%);color:#6ee7b7}
.feedback-choice--no.feedback-choice--active{border-color:rgb(248 113 113 / 55%);background:rgb(239 68 68 / 12%);color:#fca5a5}
.feedback-choice--unsure.feedback-choice--active{border-color:rgb(148 163 184 / 50%);background:rgb(148 163 184 / 12%);color:#cbd5e1}
</style>
