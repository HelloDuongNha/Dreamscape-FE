<template>
  <div class="mood-filter" role="group" :aria-label="t('home.searchMoodFilter')">
    <span class="mood-filter__label">{{ t('home.searchMoodFilter') }}</span>
    <div class="mood-filter__swatches">
      <div
        v-for="level in DREAM_MOOD_LEVELS"
        :key="level"
        class="mood-filter__option"
      >
        <button
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
        <span v-if="modelValue === level" class="mood-filter__selection">
          {{ t(`home.moodScale.label.${level}`) }}
        </span>
      </div>
    </div>
    <button
      type="button"
      class="mood-filter__clear"
      :class="{ 'mood-filter__clear--hidden': !modelValue }"
      :disabled="!modelValue"
      :aria-hidden="!modelValue"
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
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 68px;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 4px;
  padding: 0 0 var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.mood-filter__label {
  width: 100%;
  flex-shrink: 0;
  padding-top: 0;
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
  text-align: right;
}
.mood-filter__swatches {
  display: flex;
  align-self: flex-end;
  align-items: flex-start;
  gap: 8px;
}
.mood-filter__option {
  position: relative;
  flex: 0 0 28px;
  width: 28px;
  height: 48px;
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
  position: absolute;
  z-index: 1;
  top: 34px;
  left: 50%;
  max-width: 110px;
  overflow: hidden;
  transform: translateX(-50%);
  color: var(--color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mood-filter__clear {
  position: absolute;
  top: 19px;
  right: calc(-52px - var(--space-3));
  min-width: 52px;
  min-height: 28px;
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
.mood-filter__clear--hidden {
  visibility: hidden;
  pointer-events: none;
}

@media (max-width: 600px) {
  .mood-filter {
    flex-wrap: nowrap;
    gap: 8px;
  }
  .mood-filter__label {
    width: 100%;
    padding-top: 0;
    text-align: right;
  }
  .mood-filter__swatches { gap: 10px; }
  .mood-filter__option {
    flex-basis: 32px;
    width: 32px;
    height: 52px;
  }
  .mood-filter__swatch {
    width: 32px;
    height: 32px;
  }
  .mood-filter__selection { top: 38px; }
  .mood-filter__clear {
    top: 22px;
  }
}
</style>
