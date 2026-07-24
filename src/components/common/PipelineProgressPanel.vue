<template>
  <div class="pipeline-progress">
    <div class="pipeline-progress__status">
      <span class="pipeline-progress__pulse" aria-hidden="true"></span>
      <div>
        <strong>{{ stepText }}</strong>
        <p v-if="detailText">{{ detailText }}</p>
      </div>
      <span class="pipeline-progress__percent">{{ Math.round(progress) }}%</span>
    </div>

    <div class="pipeline-progress__track" role="progressbar" :aria-valuenow="Math.round(progress)" aria-valuemin="0" aria-valuemax="100">
      <div class="pipeline-progress__fill" :style="{ width: `${Math.max(0, Math.min(100, progress))}%` }"></div>
    </div>

    <div class="pipeline-progress__meta">
      <span>{{ t('common.progress.elapsed', { duration: elapsedLabel }) }}</span>
      <span v-if="processedLabel">{{ processedLabel }}</span>
      <span>{{ remainingLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })

const props = defineProps<{
  progress: number
  stepText: string
  detailText?: string
  elapsedSeconds?: number
  processedLabel?: string
  estimatedRemainingSeconds?: number | null
  remainingText?: string
  timingDeltaSeconds?: number | null
  completed?: boolean
}>()

function durationLabel(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds < 60) return t('common.progress.seconds', { count: seconds })
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  if (minutes < 60) return remain
    ? t('common.progress.minutesSeconds', { minutes, seconds: remain })
    : t('common.progress.minutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  return t('common.progress.hoursMinutes', { hours, minutes: minutes % 60 })
}

const elapsedLabel = computed(() => durationLabel(props.elapsedSeconds || 0))
const remainingLabel = computed(() => {
  if (props.remainingText) return props.remainingText
  if (props.completed && typeof props.timingDeltaSeconds === 'number') {
    if (Math.abs(props.timingDeltaSeconds) <= 2) return t('common.progress.finishedOnTime')
    return props.timingDeltaSeconds < 0
      ? t('common.progress.finishedEarly', { duration: durationLabel(Math.abs(props.timingDeltaSeconds)) })
      : t('common.progress.finishedLate', { duration: durationLabel(props.timingDeltaSeconds) })
  }
  const estimate = props.estimatedRemainingSeconds
  if (typeof estimate !== 'number') {
    return t('common.progress.measuring')
  }
  if (estimate < 0) return t('common.progress.overdue', { duration: durationLabel(Math.abs(estimate)) })
  return t('common.progress.remaining', { duration: durationLabel(estimate) })
})
</script>

<style scoped>
.pipeline-progress {
  width: 100%;
  padding: var(--space-4);
  border: 1px solid #2b2b2b;
  border-radius: var(--radius-lg);
  background: #141414;
}
.pipeline-progress__status { display: grid; grid-template-columns: 12px 1fr auto; gap: 12px; align-items: start; }
.pipeline-progress__status strong { display: block; color: var(--color-text-primary); font-size: var(--font-size-sm); line-height: 1.4; }
.pipeline-progress__status p { margin: 4px 0 0; color: var(--color-text-muted); font-size: var(--font-size-xs); line-height: 1.5; }
.pipeline-progress__pulse { width: 10px; height: 10px; margin-top: 5px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 0 0 rgba(59,130,246,.5); animation: pulse 1.8s infinite; }
.pipeline-progress__percent { color: #60a5fa; font-family: var(--font-family-mono, monospace); font-size: var(--font-size-sm); font-weight: 700; }
.pipeline-progress__track { height: 8px; margin-top: 16px; overflow: hidden; border-radius: 999px; background: #292929; }
.pipeline-progress__fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #2563eb, #60a5fa); transition: width .7s cubic-bezier(.22,1,.36,1); }
.pipeline-progress__meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 16px; margin-top: 10px; color: var(--color-text-muted); font-size: 11px; }
@keyframes pulse { 70% { box-shadow: 0 0 0 8px rgba(59,130,246,0); } 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); } }
@media (prefers-reduced-motion: reduce) { .pipeline-progress__pulse { animation: none; } .pipeline-progress__fill { transition: none; } }
</style>
