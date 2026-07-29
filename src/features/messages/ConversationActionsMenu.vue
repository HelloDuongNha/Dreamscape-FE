<template>
  <div
    ref="rootRef"
    class="conversation-actions"
    :class="`conversation-actions--${variant}`"
    @click.stop
  >
    <button
      ref="triggerRef"
      type="button"
      class="conversation-actions__trigger"
      :aria-label="t('messages.conversationOptions')"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="toggle"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.75" />
        <circle cx="12" cy="12" r="1.75" />
        <circle cx="19" cy="12" r="1.75" />
      </svg>
    </button>

    <Teleport to="body">
      <Transition name="conversation-menu">
        <div
          v-if="open"
          ref="panelRef"
          class="conversation-actions__panel"
          :style="panelStyle"
          role="menu"
          @click.stop
        >
          <button
            type="button"
            class="conversation-actions__item"
            role="menuitem"
            @click="selectMute"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              <line v-if="muted" x1="2" y1="2" x2="22" y2="22" />
            </svg>
            <span>{{ muted ? t('messages.unmuteNotifications') : t('messages.muteNotifications') }}</span>
          </button>

          <div class="conversation-actions__divider" role="separator" />

          <button
            type="button"
            class="conversation-actions__item conversation-actions__item--danger"
            role="menuitem"
            :disabled="deleting"
            @click="selectDelete"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            <span>{{ deleting ? t('messages.deletingConversation') : t('messages.deleteConversation') }}</span>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

withDefaults(defineProps<{
  muted: boolean
  deleting?: boolean
  variant?: 'list' | 'header'
}>(), {
  deleting: false,
  variant: 'list',
})

const emit = defineEmits<{
  toggleMute: []
  delete: []
}>()

const { t } = useI18n()
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const open = ref(false)
const panelStyle = ref<Record<string, string>>({})

function toggle(): void {
  open.value = !open.value
  if (open.value) void nextTick(positionPanel)
}

function close(): void {
  open.value = false
}

function selectMute(): void {
  emit('toggleMute')
  close()
}

function selectDelete(): void {
  emit('delete')
  close()
}

function positionPanel(): void {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const width = 216
  const gap = 6
  const estimatedHeight = 101
  const viewportPadding = 8
  const left = Math.min(
    window.innerWidth - width - viewportPadding,
    Math.max(viewportPadding, rect.right - width),
  )
  const opensUpward = rect.bottom + gap + estimatedHeight > window.innerHeight - viewportPadding
  const top = opensUpward
    ? Math.max(viewportPadding, rect.top - estimatedHeight - gap)
    : rect.bottom + gap
  panelStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${width}px`,
  }
}

function handlePointerDown(event: PointerEvent): void {
  if (!open.value) return
  const target = event.target as Node
  if (rootRef.value?.contains(target) || panelRef.value?.contains(target)) return
  close()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open.value) return
  close()
  triggerRef.value?.focus()
}

function handleViewportChange(): void {
  if (open.value) positionPanel()
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<style scoped>
.conversation-actions {
  display: inline-flex;
  flex: 0 0 auto;
}

.conversation-actions__trigger {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    opacity var(--transition-fast);
}

.conversation-actions--header .conversation-actions__trigger {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-lg);
}

.conversation-actions__trigger:hover,
.conversation-actions__trigger:focus-visible,
.conversation-actions__trigger[aria-expanded='true'] {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  outline: none;
}

.conversation-actions__panel {
  position: fixed;
  z-index: 1200;
  overflow: hidden;
  padding: 5px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-elevated);
  box-shadow: 0 10px 32px rgb(0 0 0 / 32%);
}

.conversation-actions__item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 40px;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-align: left;
  cursor: pointer;
}

.conversation-actions__item:hover,
.conversation-actions__item:focus-visible {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  outline: none;
}

.conversation-actions__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.conversation-actions__item--danger {
  color: #ef6a75;
}

.conversation-actions__item--danger:hover,
.conversation-actions__item--danger:focus-visible {
  background: rgb(239 73 86 / 10%);
  color: #ff7883;
}

.conversation-actions__divider {
  height: 1px;
  margin: 4px 5px;
  background: var(--color-border);
}

.conversation-menu-enter-active,
.conversation-menu-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.conversation-menu-enter-from,
.conversation-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
