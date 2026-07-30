<template>
  <div
    ref="rootRef"
    class="message-actions"
    :class="mine ? 'message-actions--mine' : 'message-actions--other'"
  >
    <button
      ref="triggerRef"
      type="button"
      class="message-actions__trigger"
      :aria-label="t('messages.messageOptions')"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1.8"/>
        <circle cx="12" cy="12" r="1.8"/>
        <circle cx="19" cy="12" r="1.8"/>
      </svg>
    </button>
    <Teleport to="body">
      <Transition name="message-menu">
        <div
          v-if="open"
          ref="panelRef"
          class="message-actions__panel"
          :class="`message-actions__panel--${placement}`"
          :style="panelStyle"
          role="menu"
        >
          <button v-if="!unsent" type="button" role="menuitem" @click="choose('reply')">
            {{ t('messages.reply') }}
          </button>
          <button v-if="!unsent" type="button" role="menuitem" @click="choose('forward')">
            {{ t('messages.forward') }}
          </button>
          <button
            type="button"
            class="message-actions__danger"
            role="menuitem"
            @click="choose('delete')"
          >
            {{ t('messages.deleteForMe') }}
          </button>
          <button
            v-if="mine && !unsent"
            type="button"
            class="message-actions__danger"
            role="menuitem"
            @click="choose('unsend')"
          >
            {{ t('messages.unsendForEveryone') }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ mine: boolean; unsent?: boolean }>()
const emit = defineEmits<{
  reply: []
  forward: []
  delete: []
  unsend: []
}>()
const { t } = useI18n()
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const open = ref(false)
const panelTop = ref(0)
const panelLeft = ref(0)
const placement = ref<'top' | 'bottom'>('top')
let positionFrame: number | null = null

const panelStyle = computed(() => ({
  top: `${panelTop.value}px`,
  left: `${panelLeft.value}px`,
}))

async function toggle(): Promise<void> {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  updatePosition()
}

function updatePosition(): void {
  if (!open.value || !triggerRef.value || !panelRef.value) return
  const trigger = triggerRef.value.getBoundingClientRect()
  const panel = panelRef.value.getBoundingClientRect()
  const viewportPadding = 8
  const gap = 6
  if (trigger.bottom < 0 || trigger.top > window.innerHeight) {
    open.value = false
    return
  }
  const roomBelow = window.innerHeight - trigger.bottom
  const openBelow = roomBelow >= panel.height + gap + viewportPadding
    || trigger.top < panel.height + gap + viewportPadding

  placement.value = openBelow ? 'bottom' : 'top'
  const preferredTop = openBelow
    ? trigger.bottom + gap
    : trigger.top - panel.height - gap
  panelTop.value = Math.min(
    Math.max(viewportPadding, preferredTop),
    window.innerHeight - panel.height - viewportPadding,
  )

  const preferredLeft = props.mine
    ? trigger.right - panel.width
    : trigger.left
  panelLeft.value = Math.min(
    Math.max(viewportPadding, preferredLeft),
    window.innerWidth - panel.width - viewportPadding,
  )
}

function schedulePositionUpdate(): void {
  if (!open.value || positionFrame !== null) return
  positionFrame = window.requestAnimationFrame(() => {
    positionFrame = null
    updatePosition()
  })
}

function choose(action: 'reply' | 'forward' | 'delete' | 'unsend'): void {
  open.value = false
  if (action === 'reply') emit('reply')
  else if (action === 'forward') emit('forward')
  else if (action === 'delete') emit('delete')
  else emit('unsend')
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target as Node
  if (
    !rootRef.value?.contains(target)
    && !panelRef.value?.contains(target)
  ) open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('resize', schedulePositionUpdate)
  window.addEventListener('scroll', schedulePositionUpdate, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('resize', schedulePositionUpdate)
  window.removeEventListener('scroll', schedulePositionUpdate, true)
  if (positionFrame !== null) window.cancelAnimationFrame(positionFrame)
})
</script>

<style scoped>
.message-actions { position: relative; flex: 0 0 auto; }
.message-actions__trigger {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: .64;
  transition: opacity 130ms ease, background 130ms ease, color 130ms ease;
}
.message-actions__trigger svg { width: 18px; height: 18px; fill: currentColor; }
.message-actions__trigger:hover,
.message-actions__trigger:focus-visible,
.message-actions__trigger[aria-expanded='true'] {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  opacity: 1;
}
.message-actions__panel {
  position: fixed;
  z-index: 1200;
  display: grid;
  width: max-content;
  max-width: calc(100vw - 16px);
  padding: 5px;
  border: 1px solid var(--color-border);
  border-radius: 11px;
  background: var(--color-bg-elevated);
  box-shadow: 0 12px 32px rgba(0, 0, 0, .34);
}
.message-actions__panel button {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.message-actions__panel button:hover,
.message-actions__panel button:focus-visible { background: var(--color-bg-surface); outline: none; }
.message-actions__panel .message-actions__danger { color: #ed4956; }
.message-menu-enter-active,
.message-menu-leave-active { transition: opacity 120ms ease, transform 120ms ease; }
.message-menu-enter-from,
.message-menu-leave-to { opacity: 0; transform: scale(.98); }
@media (hover: none) {
  .message-actions__trigger { opacity: .82; }
}
</style>
