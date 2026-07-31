<template>
  <span
    ref="rootRef"
    class="dream-mood-wrap"
    tabindex="0"
    :aria-label="t('home.moodScale.openHelp')"
    :aria-expanded="legendOpen"
    @click.stop="legendOpen = !legendOpen"
    @keydown.enter.prevent="legendOpen = !legendOpen"
    @keydown.space.prevent="legendOpen = !legendOpen"
  >
    <span class="dream-mood" :style="dreamMoodCssVariables(level)">
    <span class="dream-mood__label">{{ displayLabel }}</span>
    </span>
    <div v-if="legendOpen" class="dream-mood__legend" role="dialog" @click.stop>
      <div class="dream-mood__legend-title">{{ t('home.moodScale.title') }}</div>
      <div
        v-for="item in moodLevels"
        :key="item.value"
        class="dream-mood__legend-row"
      >
        <span
          class="dream-mood__legend-swatch"
          :style="dreamMoodCssVariables(item.value)"
          aria-hidden="true"
        />
        <span class="dream-mood__legend-copy">
          <strong>{{ t(`home.moodScale.label.${item.value}`) }}</strong>
          <span>{{ t(`home.moodScale.help.${item.value}`) }}</span>
        </span>
      </div>
    </div>
  </span>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DREAM_MOOD_LEVELS,
  dreamMoodCssVariables,
  resolveDreamMoodLevel,
  type LegacyDreamTone,
} from '@/utils/dreamMood'

const props = withDefaults(defineProps<{
  label?: string
  valence?: number
  toneKey?: LegacyDreamTone
}>(), {
  label: '',
  toneKey: 'neutral',
})

const { t } = useI18n({ useScope: 'global' })
const legendOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const moodLevels = DREAM_MOOD_LEVELS.map(value => ({ value })).reverse()

function closeLegendOnOutsideClick(event: PointerEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) legendOpen.value = false
}

onMounted(() => document.addEventListener('pointerdown', closeLegendOnOutsideClick))
onUnmounted(() => document.removeEventListener('pointerdown', closeLegendOnOutsideClick))

const level = computed(() => resolveDreamMoodLevel(props.valence, props.toneKey))

// Mood labels are presentation values; always derive them from the normalized level and active locale.
const displayLabel = computed(() => {
  return t(`home.moodScale.label.${level.value}`)
})

</script>

<style scoped>
.dream-mood-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: help;
  outline: none;
}
.dream-mood {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 220px;
  padding: 3px 8px;
  border: 1px solid var(--dream-mood-border);
  background: var(--dream-mood-bg);
  color: var(--dream-mood-fg);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}
.dream-mood__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dream-mood-wrap:focus-visible .dream-mood { outline: 2px solid currentColor; outline-offset: 2px; }
.dream-mood__legend {
  position: absolute;
  z-index: 40;
  right: 0;
  top: calc(100% + 8px);
  display: grid;
  width: min(340px, calc(100vw - 32px));
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-relaxed);
}
.dream-mood__legend-title {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}
.dream-mood__legend-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.dream-mood__legend-swatch {
  width: 11px;
  height: 11px;
  flex: 0 0 11px;
  margin-top: 4px;
  border: 1px solid var(--dream-mood-border);
  background: var(--dream-mood-bg);
  border-radius: 50%;
  padding: 0;
}
.dream-mood__legend-copy {
  display: grid;
  gap: 1px;
}
.dream-mood__legend-copy strong {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}
</style>
