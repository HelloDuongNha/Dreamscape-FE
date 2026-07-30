<template>
  <Teleport to="body">
    <div
      class="mobile-pull-refresh"
      :class="{
        'is-visible': status === 'refreshing' || pullDistance >= PULL_ACTIVATION_DISTANCE_PX,
        'is-armed': status === 'armed',
        'is-refreshing': status === 'refreshing',
        'is-resetting': status === 'resetting',
      }"
      :style="indicatorStyle"
      role="status"
      aria-live="polite"
      :aria-label="statusLabel"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path class="mobile-pull-refresh__track" d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path class="mobile-pull-refresh__arrow" d="M13.9 6.1l3.76.24-.21-3.76" />
      </svg>
      <span class="sr-only">{{ statusLabel }}</span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

type PullStatus = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'resetting'

const PULL_ACTIVATION_DISTANCE_PX = 10
const PULL_THRESHOLD_PX = 76
const MAX_PULL_DISTANCE_PX = 112
const RESET_DURATION_MS = 220
const RELOAD_DELAY_MS = 180
const WHEEL_RELEASE_DELAY_MS = 90

const { t } = useI18n()
const status = ref<PullStatus>('idle')
const pullDistance = ref(0)

let activeTouchId: number | null = null
let isMouseDragging = false
let isWheelPulling = false
let suppressNextClick = false
let startX = 0
let startY = 0
let scrollSurface: HTMLElement | null = null
let resetTimer: ReturnType<typeof setTimeout> | null = null
let reloadTimer: ReturnType<typeof setTimeout> | null = null
let wheelReleaseTimer: ReturnType<typeof setTimeout> | null = null

const pullProgress = computed(() =>
  Math.min(pullDistance.value / PULL_THRESHOLD_PX, 1)
)

const indicatorStyle = computed(() => ({
  '--pull-opacity': pullDistance.value >= PULL_ACTIVATION_DISTANCE_PX
    ? String(Math.min((pullDistance.value - PULL_ACTIVATION_DISTANCE_PX) / 18, 1))
    : '0',
  '--pull-offset': `${Math.min(12, -24 + pullDistance.value * 0.55)}px`,
  '--pull-rotation': `${pullProgress.value * 300}deg`,
  '--pull-scale': String(0.78 + pullProgress.value * 0.22),
}))

const statusLabel = computed(() => {
  if (status.value === 'refreshing') return t('common.pullToRefresh.refreshing')
  if (status.value === 'armed') return t('common.pullToRefresh.release')
  return t('common.pullToRefresh.pull')
})

onMounted(() => {
  window.addEventListener('touchstart', handleTouchStart, { passive: true })
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd, { passive: true })
  window.addEventListener('touchcancel', handleTouchCancel, { passive: true })
  window.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('click', handleClickCapture, true)
})

onUnmounted(() => {
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
  window.removeEventListener('touchcancel', handleTouchCancel)
  window.removeEventListener('mousedown', handleMouseDown)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('wheel', handleWheel)
  window.removeEventListener('click', handleClickCapture, true)
  document.body.classList.remove('is-pulling-to-refresh')
  clearTimers()
})

function handleTouchStart(event: TouchEvent): void {
  if (event.touches.length !== 1) return

  const touch = event.touches[0]
  if (!beginPull(touch.clientX, touch.clientY, event.target)) return
  activeTouchId = touch.identifier
}

function handleTouchMove(event: TouchEvent): void {
  if (activeTouchId === null || status.value === 'refreshing') return

  const touch = findTouch(event.touches, activeTouchId)
  if (!touch) {
    resetPull()
    return
  }

  updatePull(touch.clientX, touch.clientY, event)
}

function handleTouchEnd(event: TouchEvent): void {
  if (activeTouchId === null || findTouch(event.touches, activeTouchId)) return

  releasePull()
}

function handleTouchCancel(): void {
  clearGesture()
  resetPull()
}

function handleMouseDown(event: MouseEvent): void {
  if (event.button !== 0) return
  isMouseDragging = beginPull(event.clientX, event.clientY, event.target)
}

function handleMouseMove(event: MouseEvent): void {
  if (!isMouseDragging) return
  if (event.buttons !== 1) {
    handleMouseUp()
    return
  }
  updatePull(event.clientX, event.clientY, event)
}

function handleMouseUp(): void {
  if (!isMouseDragging) return
  if (pullDistance.value > 4) {
    suppressNextClick = true
    window.setTimeout(() => {
      suppressNextClick = false
    }, 0)
  }
  releasePull()
}

function handleClickCapture(event: MouseEvent): void {
  if (!suppressNextClick) return
  event.preventDefault()
  event.stopPropagation()
}

function handleWheel(event: WheelEvent): void {
  if (event.ctrlKey || event.metaKey || status.value === 'refreshing') return

  if (event.deltaY >= 0) {
    if (isWheelPulling) resetPull()
    return
  }

  if (!isWheelPulling) {
    const started = beginPull(event.clientX, event.clientY, event.target)
    if (!started) return
    isWheelPulling = true
  }

  if (!isSurfaceAtTop(scrollSurface)) {
    resetPull()
    return
  }

  pullDistance.value = Math.min(
    MAX_PULL_DISTANCE_PX,
    pullDistance.value + wheelPullIncrement(event.deltaY),
  )
  if (pullDistance.value < PULL_ACTIVATION_DISTANCE_PX) {
    scheduleWheelRelease()
    return
  }

  if (event.cancelable) event.preventDefault()
  document.body.classList.add('is-pulling-to-refresh')
  status.value = pullDistance.value >= PULL_THRESHOLD_PX ? 'armed' : 'pulling'
  scheduleWheelRelease()
}

function beginPull(clientX: number, clientY: number, target: EventTarget | null): boolean {
  if (status.value === 'refreshing') return false
  if (!(target instanceof Element)) return false
  if (target.closest([
    '[role="dialog"]',
    'button',
    'a',
    'input',
    'textarea',
    'select',
    'label',
    '[contenteditable="true"]',
    '[data-no-pull-refresh]',
    '.mobile-more',
  ].join(', '))) {
    return false
  }

  const surface = findScrollSurface(target)
  if (!isSurfaceAtTop(surface)) return false

  startX = clientX
  startY = clientY
  scrollSurface = surface
  clearResetTimer()
  return true
}

function updatePull(clientX: number, clientY: number, event: TouchEvent | MouseEvent): void {
  if (!isSurfaceAtTop(scrollSurface)) {
    resetPull()
    return
  }

  const deltaX = clientX - startX
  const deltaY = clientY - startY

  if (deltaY <= 0) {
    if (status.value !== 'idle') resetPull()
    return
  }

  if (Math.abs(deltaX) > deltaY) return
  const nextDistance = applyPullResistance(deltaY)
  if (nextDistance < PULL_ACTIVATION_DISTANCE_PX) return

  if (event.cancelable) event.preventDefault()
  document.body.classList.add('is-pulling-to-refresh')
  pullDistance.value = nextDistance
  status.value = pullDistance.value >= PULL_THRESHOLD_PX ? 'armed' : 'pulling'
}

function releasePull(): void {
  const shouldRefresh = status.value === 'armed'
  clearGesture()

  if (!shouldRefresh) {
    resetPull()
    return
  }

  status.value = 'refreshing'
  pullDistance.value = PULL_THRESHOLD_PX
  reloadTimer = setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
}

function findScrollSurface(target: EventTarget | null): HTMLElement | null {
  let element = target instanceof Element ? target : null

  while (element && element !== document.body) {
    const style = window.getComputedStyle(element)
    const scrollsVertically = /(auto|scroll)/.test(style.overflowY)
    if (scrollsVertically && element.scrollHeight > element.clientHeight + 1) {
      return element as HTMLElement
    }
    element = element.parentElement
  }

  return document.scrollingElement as HTMLElement | null
}

function isSurfaceAtTop(surface: HTMLElement | null): boolean {
  if (!surface) return window.scrollY <= 0
  if (surface === document.scrollingElement) return window.scrollY <= 0
  return surface.scrollTop <= 0
}

function findTouch(touches: TouchList, identifier: number): Touch | null {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index)
    if (touch?.identifier === identifier) return touch
  }
  return null
}

function applyPullResistance(rawDistance: number): number {
  return Math.min(MAX_PULL_DISTANCE_PX, rawDistance * 0.68)
}

function wheelPullIncrement(deltaY: number): number {
  return Math.min(30, Math.max(0.5, Math.abs(deltaY) * 0.28))
}

function scheduleWheelRelease(): void {
  clearWheelReleaseTimer()
  wheelReleaseTimer = setTimeout(() => {
    releasePull()
  }, WHEEL_RELEASE_DELAY_MS)
}

function resetPull(): void {
  clearGesture()
  if (status.value === 'idle') return

  status.value = 'resetting'
  pullDistance.value = 0
  clearResetTimer()
  resetTimer = setTimeout(() => {
    status.value = 'idle'
  }, RESET_DURATION_MS)
}

function clearGesture(): void {
  activeTouchId = null
  isMouseDragging = false
  isWheelPulling = false
  scrollSurface = null
  clearWheelReleaseTimer()
  document.body.classList.remove('is-pulling-to-refresh')
}

function clearResetTimer(): void {
  if (!resetTimer) return
  clearTimeout(resetTimer)
  resetTimer = null
}

function clearTimers(): void {
  clearResetTimer()
  clearWheelReleaseTimer()
  if (!reloadTimer) return
  clearTimeout(reloadTimer)
  reloadTimer = null
}

function clearWheelReleaseTimer(): void {
  if (!wheelReleaseTimer) return
  clearTimeout(wheelReleaseTimer)
  wheelReleaseTimer = null
}
</script>

<style scoped>
.mobile-pull-refresh {
  position: fixed;
  top: calc(var(--safe-area-top) + 12px);
  left: 50%;
  z-index: calc(var(--z-modal) + 1);
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, white);
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-bg-elevated) 94%, transparent);
  box-shadow: 0 5px 18px rgb(0 0 0 / 32%);
  color: var(--color-text-secondary);
  opacity: var(--pull-opacity);
  pointer-events: none;
  transform: translate(-50%, var(--pull-offset)) scale(var(--pull-scale));
  transition:
    opacity 70ms linear,
    color var(--transition-fast),
    border-color var(--transition-fast);
  will-change: transform, opacity;
}

.mobile-pull-refresh svg {
  width: 20px;
  height: 20px;
  overflow: visible;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  transform: rotate(var(--pull-rotation));
  will-change: transform;
}

.mobile-pull-refresh.is-armed {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 48%, var(--color-border));
}

.mobile-pull-refresh.is-refreshing {
  --pull-opacity: 1;
  --pull-offset: 10px;
  --pull-scale: 1;
}

.mobile-pull-refresh.is-refreshing svg {
  animation: mobile-pull-refresh-spin 720ms linear infinite;
}

.mobile-pull-refresh.is-resetting {
  transition:
    transform 220ms cubic-bezier(.22, .72, .3, 1),
    opacity 180ms ease-out;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:global(body.is-pulling-to-refresh) {
  cursor: grabbing;
  user-select: none;
}

@media (prefers-reduced-motion: reduce) {
  .mobile-pull-refresh,
  .mobile-pull-refresh svg {
    transition-duration: 1ms;
    animation-duration: 1.4s;
  }
}

@keyframes mobile-pull-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
