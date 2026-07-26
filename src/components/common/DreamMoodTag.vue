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
    <span class="dream-mood" :class="`dream-mood--${level}`">
    <span class="dream-mood__label" translate="no">{{ displayLabel }}</span>
    </span>
    <div v-if="legendOpen" class="dream-mood__legend" role="dialog" @click.stop>
      <div class="dream-mood__legend-title">{{ t('home.moodScale.title') }}</div>
      <div
        v-for="item in moodLevels"
        :key="item.value"
        class="dream-mood__legend-row"
      >
        <span class="dream-mood__legend-swatch" :class="`dream-mood--${item.value}`" aria-hidden="true" />
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

type LegacyTone =
  | 'urgent_conflicted'
  | 'anxious'
  | 'fearful'
  | 'sad'
  | 'calm'
  | 'mixed'
  | 'neutral'

const props = withDefaults(defineProps<{
  label?: string
  valence?: number
  toneKey?: LegacyTone
}>(), {
  label: '',
  toneKey: 'neutral',
})

const { t } = useI18n({ useScope: 'global' })
const legendOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const moodLevels = [
  { value: 'very-positive' },
  { value: 'positive' },
  { value: 'mixed' },
  { value: 'negative' },
  { value: 'very-negative' },
] as const

function closeLegendOnOutsideClick(event: PointerEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) legendOpen.value = false
}

onMounted(() => document.addEventListener('pointerdown', closeLegendOnOutsideClick))
onUnmounted(() => document.removeEventListener('pointerdown', closeLegendOnOutsideClick))

const legacyValence: Record<LegacyTone, -2 | -1 | 0 | 1 | 2> = {
  fearful: -2,
  sad: -2,
  anxious: -1,
  urgent_conflicted: -1,
  mixed: 0,
  neutral: 0,
  calm: 1,
}

const normalizedValence = computed<-2 | -1 | 0 | 1 | 2>(() => {
  const valence = props.valence
  if (valence !== undefined && Number.isInteger(valence) && valence >= -2 && valence <= 2) {
    return valence as -2 | -1 | 0 | 1 | 2
  }
  return legacyValence[props.toneKey]
})

const level = computed(() => ({
  [-2]: 'very-negative',
  [-1]: 'negative',
  [0]: 'mixed',
  [1]: 'positive',
  [2]: 'very-positive',
}[normalizedValence.value]))

const genericLabels = new Set([
  '',
  'unclear',
  'unknown',
  'neutral',
  'chưa xác định rõ',
  'không rõ',
])

const displayLabel = computed(() => {
  const label = props.label.trim()
  return genericLabels.has(label.toLocaleLowerCase('vi'))
    ? t(`home.moodScale.label.${level.value}`)
    : label
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
  border: 1px solid;
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
  border: 1px solid currentColor;
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
.dream-mood--very-negative {
  border-color: #6f292f;
  background: #2d1014;
  color: #f28b93;
}
.dream-mood--negative {
  border-color: #67412b;
  background: #2b1b12;
  color: #e9a16e;
}
.dream-mood--mixed {
  border-color: #5a5127;
  background: #27230f;
  color: #d8c268;
}
.dream-mood--positive {
  border-color: #315f55;
  background: #10271f;
  color: #71c8af;
}
.dream-mood--very-positive {
  border-color: #236a45;
  background: #0d2b1b;
  color: #62d692;
}
</style>
