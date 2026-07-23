<template>
  <div
    ref="root"
    :class="[
      'pinned-task-toast',
      `pinned-task-toast--${kind}`,
      {
        'pinned-task-toast--collapsed': collapsed,
        'pinned-task-toast--dragging': dragging,
        'pinned-task-toast--terminal': terminal,
      },
    ]"
    @pointerdown="startDrag"
    @pointermove="moveDrag"
    @pointerup="finishDrag"
    @pointercancel="cancelDrag"
  >
    <div class="pinned-task-toast__panel">
      <button
        type="button"
        class="pinned-task-toast__view-tab"
        :aria-label="t('common.pinnedTaskView')"
        :title="t('common.pinnedTaskView')"
        @pointerdown.stop
        @click.stop="$emit('open')"
      >
        <span>{{ t('common.pinnedTaskView') }}</span>
      </button>

      <div class="pinned-task-toast__surface">
        <div class="pinned-task-toast__header">
          <span class="pinned-task-toast__dot" aria-hidden="true" />
          <span class="pinned-task-toast__title">{{ title }}</span>
        </div>
        <p class="pinned-task-toast__body" :class="{ 'pinned-task-toast__body--pre': preserveLines }">
          {{ message }}
        </p>
        <p v-if="hint" class="pinned-task-toast__hint">{{ hint }}</p>
        <div v-if="progress !== undefined" class="pinned-task-toast__progress-row">
          <div
            class="pinned-task-toast__progress-track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.round(boundedProgress)"
          >
            <div class="pinned-task-toast__progress-fill" :style="{ width: `${boundedProgress}%` }" />
          </div>
          <span class="pinned-task-toast__progress-value">{{ Math.round(boundedProgress) }}%</span>
        </div>
        <div v-if="terminal" class="pinned-task-toast__terminal-timer" aria-hidden="true" />
        <div v-if="terminal" class="pinned-task-toast__terminal-timer-left" aria-hidden="true" />
      </div>

      <button
        type="button"
        class="pinned-task-toast__edge-handle pinned-task-toast__edge-handle--collapse"
        :aria-label="t('common.pinnedTaskCollapse')"
        :title="t('common.pinnedTaskCollapse')"
        @pointerdown.stop="startDrag($event, true)"
        @click.stop="handleHandleClick"
      >
        <span aria-hidden="true">&gt;</span>
      </button>

      <button
        type="button"
        class="pinned-task-toast__edge-handle pinned-task-toast__edge-handle--expand"
        :aria-label="t('common.pinnedTaskExpand')"
        :title="t('common.pinnedTaskExpand')"
        @pointerdown.stop="startDrag($event, true)"
        @click.stop="handleHandleClick"
      >
        <span aria-hidden="true">&lt;</span>
      </button>

    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  title: string
  message: string
  kind: 'oracle-chat' | 'dream-analysis' | 'rule-analysis' | 'source-import' | 'queue'
  progress?: number
  terminal?: boolean
  preserveLines?: boolean
  hint?: string
}>(), {
  terminal: false,
  preserveLines: false,
  hint: '',
})

defineEmits<{ (event: 'open'): void }>()

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)
const collapsed = ref(false)
const dragging = ref(false)
let dragStartX = 0
let dragStartOffset = 0
let dragMaxOffset = 0
let dragPointerId: number | null = null
let dragStartedOnHandle = false
let ignoreNextHandleClick = false
let dragFrame: number | null = null
let pendingDragOffset = 0
const boundedProgress = computed(() => Math.max(0, Math.min(100, Number(props.progress) || 0)))
function concealedOffset(width: number): number {
  // Leave only the 1px accent edge beside the fixed expand handle. The panel
  // must not remain underneath the handle when fully collapsed.
  return Math.max(1, width - 1)
}

function applyDragVisual(offset: number) {
  if (!root.value) return
  const reveal = Math.max(0, Math.min(1, 1 - (offset / Math.max(1, dragMaxOffset))))
  root.value.style.setProperty('--drag-offset', `${offset}px`)
  root.value.style.setProperty('--reveal-progress', String(reveal))
  root.value.style.setProperty('--conceal-progress', String(1 - reveal))
  root.value.style.setProperty('--view-tab-shift', `${Math.round((1 - reveal) * 54)}px`)
  root.value.style.setProperty('--expand-handle-shift', `${Math.round(reveal * 34)}px`)
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  if (root.value) {
    dragMaxOffset = concealedOffset(root.value.getBoundingClientRect().width)
    applyDragVisual(collapsed.value ? dragMaxOffset : 0)
  }
}

function handleHandleClick() {
  if (ignoreNextHandleClick) return
  toggleCollapsed()
}

function startDrag(event: PointerEvent, allowButton = false) {
  if (event.button !== 0 || !root.value) return
  if (!allowButton && (event.target as HTMLElement | null)?.closest('button')) return
  dragging.value = true
  dragStartedOnHandle = allowButton
  dragPointerId = event.pointerId
  dragStartX = event.clientX
  const width = root.value.getBoundingClientRect().width
  dragMaxOffset = concealedOffset(width)
  dragStartOffset = collapsed.value ? dragMaxOffset : 0
  pendingDragOffset = dragStartOffset
  applyDragVisual(dragStartOffset)
  root.value.setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== dragPointerId || !root.value) return
  const delta = event.clientX - dragStartX
  pendingDragOffset = Math.max(0, Math.min(dragMaxOffset, dragStartOffset + delta))
  if (dragFrame !== null) return
  dragFrame = window.requestAnimationFrame(() => {
    applyDragVisual(pendingDragOffset)
    dragFrame = null
  })
}

function finishDrag(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== dragPointerId || !root.value) return
  const delta = event.clientX - dragStartX
  const moved = Math.abs(delta) > 6
  if (dragFrame !== null) {
    window.cancelAnimationFrame(dragFrame)
    dragFrame = null
  }
  const maxOffset = dragMaxOffset
  pendingDragOffset = Math.max(0, Math.min(maxOffset, dragStartOffset + delta))
  applyDragVisual(pendingDragOffset)
  if (dragStartedOnHandle && !moved) {
    collapsed.value = !collapsed.value
  } else if (moved) {
    collapsed.value = pendingDragOffset >= maxOffset * 0.5
  }
  ignoreNextHandleClick = dragStartedOnHandle
  window.setTimeout(() => { ignoreNextHandleClick = false }, 0)
  dragging.value = false
  dragPointerId = null
  dragStartedOnHandle = false
  window.requestAnimationFrame(() => {
    applyDragVisual(collapsed.value ? maxOffset : 0)
  })
  if (root.value.hasPointerCapture(event.pointerId)) root.value.releasePointerCapture(event.pointerId)
}

function cancelDrag(event: PointerEvent) {
  if (event.pointerId !== dragPointerId) return
  if (dragFrame !== null) {
    window.cancelAnimationFrame(dragFrame)
    dragFrame = null
  }
  dragging.value = false
  dragPointerId = null
  dragStartedOnHandle = false
  window.requestAnimationFrame(() => {
    applyDragVisual(collapsed.value ? dragMaxOffset : 0)
  })
}

watch(
  () => props.terminal,
  (terminal, previous) => {
    if (terminal && !previous) {
      collapsed.value = false
      applyDragVisual(0)
    }
  },
)
</script>

<style scoped>
.pinned-task-toast {
  --task-accent: #8b5cf6;
  --handle-edge: color-mix(in srgb, var(--task-accent) 48%, #343434);
  --reveal-progress: 1;
  --conceal-progress: 0;
  --expand-handle-shift: 34px;
  --view-tab-shift: 0px;
  position: relative;
  width: 100%;
  margin-bottom: 12px;
  pointer-events: none;
  touch-action: none;
  user-select: none;
}

.pinned-task-toast--collapsed {
  --reveal-progress: 0;
  --conceal-progress: 1;
}

.pinned-task-toast--oracle-chat { --task-accent: #a78bfa; }
.pinned-task-toast--dream-analysis { --task-accent: #38bdf8; }
.pinned-task-toast--rule-analysis { --task-accent: #f59e0b; }
.pinned-task-toast--source-import { --task-accent: #34d399; }
.pinned-task-toast--queue { --task-accent: #94a3b8; }

.pinned-task-toast__panel {
  position: relative;
  width: 100%;
  transform: translate3d(0, 0, 0);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.pinned-task-toast--collapsed .pinned-task-toast__panel {
  transform: translate3d(calc(100% - 1px), 0, 0);
}

.pinned-task-toast--dragging .pinned-task-toast__panel {
  transform: translate3d(var(--drag-offset), 0, 0);
  transition: none;
  will-change: transform;
}

.pinned-task-toast__surface {
  position: relative;
  z-index: 2;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  padding:
    calc(var(--space-3) + 5px)
    var(--space-3)
    calc(var(--space-3) + 3px)
    var(--space-4);
  border: 1px solid color-mix(in srgb, var(--task-accent) 26%, #262626);
  border-left: 3px solid var(--task-accent);
  border-radius: var(--radius-md);
  background: #181818;
  cursor: grab;
  pointer-events: auto;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.pinned-task-toast__surface:hover {
  border-color: color-mix(in srgb, var(--task-accent) 48%, #343434);
}

.pinned-task-toast--dragging .pinned-task-toast__surface {
  cursor: grabbing;
}

.pinned-task-toast__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding-right: 42px;
}

.pinned-task-toast__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--task-accent);
}

.pinned-task-toast__title {
  min-width: 0;
  overflow: hidden;
  color: var(--task-accent);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.045em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.pinned-task-toast__edge-handle {
  position: absolute;
  z-index: 6;
  top: 8px;
  right: -1px;
  width: 36px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid var(--handle-edge);
  border-right: 0;
  border-radius: 9px 0 0 9px;
  color: var(--task-accent);
  background: #181818;
  cursor: ew-resize;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  touch-action: none;
  overflow: hidden;
  pointer-events: auto;
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.pinned-task-toast__edge-handle span {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
}

.pinned-task-toast__edge-handle--collapse {
  opacity: var(--reveal-progress);
}

.pinned-task-toast__edge-handle--expand {
  z-index: 1;
  right: auto;
  left: -34px;
  pointer-events: none;
  transform: translate3d(var(--expand-handle-shift), 0, 0);
}

.pinned-task-toast--collapsed .pinned-task-toast__edge-handle--expand {
  pointer-events: auto;
}

.pinned-task-toast--collapsed .pinned-task-toast__edge-handle--collapse {
  pointer-events: none;
}

.pinned-task-toast__view-tab {
  position: absolute;
  z-index: 1;
  top: 64px;
  left: -54px;
  width: 58px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--task-accent) 52%, #343434);
  border-left: 1px solid color-mix(in srgb, var(--task-accent) 52%, #343434);
  padding: 0 10px 0 13px;
  color: var(--task-accent);
  background: color-mix(in srgb, var(--task-accent) 16%, #181818);
  clip-path: polygon(16% 0, 100% 0, 100% 100%, 16% 100%, 0 50%);
  cursor: pointer;
  pointer-events: auto;
  transform: translate3d(var(--view-tab-shift), 0, 0);
  transition:
    color 120ms ease,
    background-color 120ms ease,
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.pinned-task-toast__view-tab span {
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.pinned-task-toast__view-tab:hover,
.pinned-task-toast__view-tab:focus-visible {
  color: #fff;
  background: color-mix(in srgb, var(--task-accent) 24%, #181818);
}

.pinned-task-toast--dragging .pinned-task-toast__edge-handle--expand,
.pinned-task-toast--dragging .pinned-task-toast__edge-handle--collapse,
.pinned-task-toast--dragging .pinned-task-toast__view-tab {
  transition: none;
  will-change: transform;
}

.pinned-task-toast__body,
.pinned-task-toast__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.pinned-task-toast__body--pre {
  white-space: pre-line;
}

.pinned-task-toast__hint {
  color: var(--color-text-secondary);
  font-size: 10px;
}

.pinned-task-toast__progress-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.pinned-task-toast__progress-track {
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: #292929;
}

.pinned-task-toast__progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--task-accent);
  transition: width 300ms ease;
}

.pinned-task-toast__progress-value {
  min-width: 30px;
  color: var(--task-accent);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.pinned-task-toast__terminal-timer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--task-accent);
  transform-origin: left;
  animation: pinned-task-terminal-bottom 2.1s linear forwards;
}

.pinned-task-toast__terminal-timer-left {
  position: absolute;
  z-index: 4;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: var(--task-accent);
  transform-origin: top;
  animation: pinned-task-terminal-left 0.9s linear 2.1s forwards;
}

.pinned-task-toast--terminal .pinned-task-toast__surface {
  border-left-color: color-mix(in srgb, var(--task-accent) 26%, #262626);
}

@keyframes pinned-task-terminal-bottom {
  to { transform: scaleX(0); }
}

@keyframes pinned-task-terminal-left {
  to { transform: scaleY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .pinned-task-toast {
    transition-duration: 1ms;
  }
}
</style>
