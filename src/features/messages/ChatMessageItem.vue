<template>
  <article
    :id="`chat-message-${message._id}`"
    class="chat-message"
    :class="[
      mine ? 'chat-message--me' : 'chat-message--other',
      { 'chat-message--swiping': isSwiping },
    ]"
    :style="swipeStyle"
    @pointerdown.capture="startSwipe"
    @pointermove.capture="moveSwipe"
    @pointerup.capture="finishSwipe"
    @pointercancel.capture="cancelSwipe"
    @click.capture="guardClickAfterSwipe"
  >
    <span
      class="chat-message__reply-indicator"
      :class="mine
        ? 'chat-message__reply-indicator--mine'
        : 'chat-message__reply-indicator--other'"
      :style="{
        opacity: swipeProgress,
        transform: `translateY(-50%) scale(${0.75 + swipeProgress * 0.25})`,
      }"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24">
        <path d="m9 7-5 5 5 5"/>
        <path d="M4 12h9a7 7 0 0 1 7 7"/>
      </svg>
    </span>
    <div class="chat-message__row">
      <UserAvatar
        v-if="!mine && partner"
        :user="partner"
        size="sm"
        class="chat-message__avatar"
      />
      <MessageActionsMenu
        v-if="mine"
        :mine="true"
        :unsent="Boolean(message.unsentAt)"
        @reply="$emit('reply')"
        @forward="$emit('forward')"
        @delete="$emit('delete')"
        @unsend="$emit('unsend')"
      />
      <div class="chat-message__stack">
        <div v-if="message.forwarded" class="chat-message__forwarded">
          {{ t('messages.forwarded') }}
        </div>
        <button
          v-if="message.replyTo"
          type="button"
          class="chat-message__reply"
          :class="{ 'chat-message__reply--me': mine }"
          @click="$emit('jump-to', message.replyTo._id)"
        >
          <strong>{{ replyAuthorLabel(message.replyTo.senderId) }}</strong>
          <span>{{ replyPreviewText(message.replyTo) }}</span>
        </button>
        <div
          v-if="message.unsentAt"
          class="chat-message__bubble chat-message__bubble--unsent"
          :class="mine ? 'chat-message__bubble--me' : 'chat-message__bubble--other'"
        >
          {{ t('messages.messageUnsent') }}
        </div>
        <SharedPostMessageCard
          v-else-if="message.messageType === 'shared_post' && message.sharedPostId"
          :post-id="message.sharedPostId"
        />
        <div
          v-else
          class="chat-message__bubble"
          :class="[
            mine ? 'chat-message__bubble--me' : 'chat-message__bubble--other',
            {
              'chat-message__bubble--optimistic': message.deliveryState === 'sending',
              'chat-message__bubble--failed': message.deliveryState === 'failed',
            },
          ]"
        >
          {{ message.content_unavailable ? t('messages.contentUnavailable') : message.content }}
        </div>
      </div>
      <MessageActionsMenu
        v-if="!mine"
        :mine="false"
        :unsent="Boolean(message.unsentAt)"
        @reply="$emit('reply')"
        @forward="$emit('forward')"
        @delete="$emit('delete')"
      />
    </div>
    <div class="chat-message__meta" :class="{ 'chat-message__meta--other': !mine }">
      <span class="chat-message__time">{{ timeAgo(message.timestamp) }}</span>
      <span v-if="mine && lastSent" class="chat-message__status">
          <template v-if="message.deliveryState === 'sending'">{{ t('messages.sending') }}</template>
          <button
            v-else-if="message.deliveryState === 'failed'"
            type="button"
            @click="$emit('retry')"
          >
            {{ t('messages.retrySend') }}
          </button>
          <template v-else>{{ statusLabel }}</template>
      </span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ApiMessage, ApiUser } from '@/api/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { timeAgo } from '@/utils/timeAgo'
import MessageActionsMenu from './MessageActionsMenu.vue'
import SharedPostMessageCard from './SharedPostMessageCard.vue'

const props = defineProps<{
  message: ApiMessage
  mine: boolean
  lastSent: boolean
  currentUserId: string
  partner: ApiUser | null
}>()
const emit = defineEmits<{
  reply: []
  forward: []
  delete: []
  unsend: []
  retry: []
  'jump-to': [messageId: string]
}>()
const { t } = useI18n()
const SWIPE_TRIGGER_PX = 48
const SWIPE_MAX_PX = 72
const swipeOffset = ref(0)
const isSwiping = ref(false)
let suppressClickUntil = 0
let swipePointer: {
  id: number
  startX: number
  startY: number
  element: HTMLElement
} | null = null

const swipeStyle = computed(() => ({
  '--message-swipe-x': `${swipeOffset.value}px`,
}))
const swipeProgress = computed(() => (
  Math.min(1, Math.abs(swipeOffset.value) / SWIPE_TRIGGER_PX)
))

const statusLabel = computed(() => {
  if (props.message.status === 'delivered') return t('messages.delivered')
  if (props.message.status === 'seen') return t('messages.seen')
  return t('messages.sent')
})

function replyAuthorLabel(senderId: ApiMessage['senderId']): string {
  const id = typeof senderId === 'object' ? senderId._id : senderId
  if (id === props.currentUserId) return t('messages.you')
  return props.partner?.display_name || t('messages.otherPerson')
}

function replyPreviewText(message: NonNullable<ApiMessage['replyTo']>): string {
  if (message.unsentAt) return t('messages.messageUnsent')
  if (message.messageType === 'shared_post') return t('messages.sharedPostPreview')
  if (message.content_unavailable) return t('messages.contentUnavailable')
  return message.content
}

function startSwipe(event: PointerEvent): void {
  if (
    props.message.unsentAt
    || event.button !== 0
    || (event.target as HTMLElement | null)?.closest('.message-actions')
  ) return

  swipePointer = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    element: event.currentTarget as HTMLElement,
  }
}

function moveSwipe(event: PointerEvent): void {
  if (!swipePointer || event.pointerId !== swipePointer.id) return
  const deltaX = event.clientX - swipePointer.startX
  const deltaY = event.clientY - swipePointer.startY
  const directionMatches = props.mine ? deltaX < 0 : deltaX > 0

  if (!isSwiping.value) {
    if (Math.abs(deltaY) > 9 && Math.abs(deltaY) >= Math.abs(deltaX)) {
      swipePointer = null
      return
    }
    if (
      !directionMatches
      || Math.abs(deltaX) < 7
      || Math.abs(deltaX) <= Math.abs(deltaY)
    ) return
    isSwiping.value = true
    swipePointer.element.setPointerCapture(event.pointerId)
  }

  event.preventDefault()
  const directionalDistance = props.mine
    ? Math.min(0, deltaX)
    : Math.max(0, deltaX)
  swipeOffset.value = Math.sign(directionalDistance)
    * Math.min(SWIPE_MAX_PX, Math.abs(directionalDistance) * .82)
}

function finishSwipe(event: PointerEvent): void {
  if (!swipePointer || event.pointerId !== swipePointer.id) return
  const shouldReply = isSwiping.value
    && Math.abs(swipeOffset.value) >= SWIPE_TRIGGER_PX
  if (isSwiping.value) {
    suppressClickUntil = Date.now() + 500
  }
  releaseSwipePointer(event.pointerId)
  resetSwipe()
  if (shouldReply) emit('reply')
}

function cancelSwipe(event: PointerEvent): void {
  if (!swipePointer || event.pointerId !== swipePointer.id) return
  releaseSwipePointer(event.pointerId)
  resetSwipe()
}

function releaseSwipePointer(pointerId: number): void {
  if (swipePointer?.element.hasPointerCapture(pointerId)) {
    swipePointer.element.releasePointerCapture(pointerId)
  }
  swipePointer = null
}

function resetSwipe(): void {
  swipeOffset.value = 0
  isSwiping.value = false
}

function guardClickAfterSwipe(event: MouseEvent): void {
  if (Date.now() >= suppressClickUntil) return
  event.preventDefault()
  event.stopPropagation()
  suppressClickUntil = 0
}
</script>

<style scoped>
.chat-message {
  --message-swipe-x: 0px;
  position: relative;
  max-width: 72%;
  display: flex;
  flex-direction: column;
  gap: 3px;
  touch-action: pan-y;
}
.chat-message--me { align-self: flex-end; align-items: flex-end; }
.chat-message--other { align-self: flex-start; align-items: flex-start; }
.chat-message--highlighted { animation: message-highlight 1.5s ease; }
@keyframes message-highlight {
  0%, 100% { filter: none; }
  25%, 70% { filter: drop-shadow(0 0 8px rgba(255, 255, 255, .28)); }
}
.chat-message__row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}
.chat-message__stack {
  transform: translate3d(var(--message-swipe-x), 0, 0);
  transition: transform 170ms cubic-bezier(.2, .8, .2, 1);
  will-change: transform;
}
.chat-message--swiping {
  user-select: none;
}
.chat-message--swiping .chat-message__stack {
  transition: none;
}
.chat-message__reply-indicator {
  position: absolute;
  top: 50%;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  pointer-events: none;
  transition: opacity 90ms linear;
}
.chat-message__reply-indicator--mine { right: 4px; }
.chat-message__reply-indicator--other {
  left: calc(30px + var(--space-2) + 4px);
}
.chat-message__reply-indicator svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.chat-message__meta {
  display: flex;
  align-items: center;
  gap: 7px;
}
.chat-message__meta--other {
  padding-left: calc(30px + var(--space-2));
}
.chat-message__row:hover :deep(.message-actions__trigger),
.chat-message__row:focus-within :deep(.message-actions__trigger) { opacity: 1; }
.chat-message__avatar { flex-shrink: 0; }
.chat-message__stack {
  min-width: 0;
  display: grid;
  justify-items: start;
  gap: 4px;
}
.chat-message--me .chat-message__stack { justify-items: end; }
.chat-message__forwarded {
  padding-inline: 5px;
  color: var(--color-text-muted);
  font-size: 10px;
  font-style: italic;
}
.chat-message__reply {
  width: 100%;
  max-width: 310px;
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  overflow: hidden;
  border: 0;
  border-left: 3px solid #8b8b8b;
  border-radius: 8px;
  background: #202020;
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
}
.chat-message__reply--me {
  border-left-color: #555;
  background: #e9e9e9;
  color: #101010;
}
.chat-message__reply strong { font-size: 11px; }
.chat-message__reply span {
  overflow: hidden;
  font-size: 12px;
  opacity: .72;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-message__bubble {
  max-width: 100%;
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
  word-break: break-word;
}
.chat-message__bubble--me {
  border-radius: 18px 18px 4px 18px;
  background: #fff;
  color: #101010;
}
.chat-message__bubble--other {
  border-radius: 18px 18px 18px 4px;
  background: #262626;
  color: var(--color-text-primary);
}
.chat-message__bubble--optimistic { opacity: .75; }
.chat-message__bubble--failed {
  opacity: .72;
  outline: 1px solid rgba(239, 68, 68, .65);
}
.chat-message__bubble--unsent { font-style: italic; opacity: .68; }
.chat-message__time,
.chat-message__status {
  padding: 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.chat-message__status { font-size: 10px; letter-spacing: .01em; opacity: .8; }
.chat-message__status button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #f87171;
  font: inherit;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}
@media (max-width: 640px) {
  .chat-message { max-width: 88%; }
  .chat-message__bubble { padding: 8px 12px; font-size: 15px; }
}
</style>
