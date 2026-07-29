<template>
  <div class="mood-filter" role="group" :aria-label="t('home.searchMoodFilter')">
    <span class="mood-filter__label">{{ t('home.searchMoodFilter') }}</span>
    <div class="mood-filter__swatches">
      <button
        v-for="level in DREAM_MOOD_LEVELS"
        :key="level"
        type="button"
        class="mood-filter__swatch"
        :class="{ 'mood-filter__swatch--selected': modelValue === level }"
        :style="dreamMoodCssVariables(level)"
        :aria-label="t(`home.moodScale.label.${level}`)"
        :aria-pressed="modelValue === level"
        :title="t(`home.moodScale.label.${level}`)"
        @click="$emit('update:modelValue', modelValue === level ? null : level)"
      >
        <svg
          v-if="modelValue === level"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
    <span v-if="modelValue" class="mood-filter__selection">
      {{ t(`home.moodScale.label.${modelValue}`) }}
    </span>
    <button
      v-if="modelValue"
      type="button"
      class="mood-filter__clear"
      @click="$emit('update:modelValue', null)"
    >
      {{ t('home.clearMoodFilter') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  DREAM_MOOD_LEVELS,
  dreamMoodCssVariables,
  type DreamMoodLevel,
} from '@/utils/dreamMood'

defineProps<{ modelValue: DreamMoodLevel | null }>()
defineEmits<{ 'update:modelValue': [value: DreamMoodLevel | null] }>()
const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
.mood-filter {
  display: flex;
  width: 100%;
  min-height: 38px;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: 0 0 var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.mood-filter__label {
  flex-shrink: 0;
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}
.mood-filter__swatches {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mood-filter__swatch {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--dream-mood-border);
  border-radius: 50%;
  background: var(--dream-mood-bg);
  color: var(--dream-mood-fg);
  cursor: pointer;
  transition: transform var(--transition-fast), outline-color var(--transition-fast);
}
.mood-filter__swatch:hover { transform: scale(1.08); }
.mood-filter__swatch:focus-visible {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 2px;
}
.mood-filter__swatch--selected {
  outline: 2px solid var(--dream-mood-fg);
  outline-offset: 2px;
}
.mood-filter__selection {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mood-filter__clear {
  min-height: 28px;
  flex-shrink: 0;
  padding: 2px 6px;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.mood-filter__clear:hover { color: var(--color-text-primary); }

@media (max-width: 600px) {
  .mood-filter {
    flex-wrap: wrap;
    gap: 8px;
  }
  .mood-filter__label {
    width: 100%;
    text-align: right;
  }
  .mood-filter__swatches { gap: 10px; }
  .mood-filter__swatch {
    width: 32px;
    height: 32px;
  }
}
</style>
