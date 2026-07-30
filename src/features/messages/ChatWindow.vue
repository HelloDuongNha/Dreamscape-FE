<template>
  <!-- Empty state when no conversation selected -->
  <div v-if="!chatStore.activeConversationId" class="chat-empty">
    <span class="chat-empty__icon" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </span>
    <p class="chat-empty__text">{{ t('messages.selectConversation') }}</p>
  </div>

  <!-- Active chat window -->
  <div v-else class="chat-window">

    <!-- ── Header ── -->
    <header class="chat-header">
      <button
        type="button"
        class="chat-header__back"
        :aria-label="t('messages.backToConversations')"
        @click="$emit('back')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
      <span
        v-if="chatStore.activePartner"
        class="chat-header__avatar"
      >
        <UserAvatar :user="chatStore.activePartner" size="md" show-streak />
        <span
          v-if="partnerIsOnline"
          class="chat-header__online-indicator"
          :aria-label="t('messages.activeNow')"
        />
      </span>
      <div class="chat-header__info">
        <span class="chat-header__name">{{ chatStore.activePartner?.display_name ?? '…' }}</span>
        <span class="chat-header__presence">{{ partnerPresenceLabel }}</span>
      </div>

      <!-- Loading indicator for messages -->
      <div v-if="chatStore.isLoadingMsgs" class="chat-header__loading" :aria-label="t('messages.loadingMessages')">
        <span class="chat-header__dot" />
        <span class="chat-header__dot" />
        <span class="chat-header__dot" />
      </div>

      <ConversationActionsMenu
        :key="chatStore.activeConversationId || 'empty'"
        :muted="chatStore.isActiveMuted"
        :deleting="isDeleting"
        variant="header"
        @toggle-mute="handleToggleMute"
        @delete="handleDelete"
      />
    </header>

    <!-- ── Message list ── -->
    <div
      ref="messageListRef"
      class="chat-messages"
      role="log"
      :aria-label="t('messages.messageHistory')"
      aria-live="polite"
    >
      <!-- Empty conversation -->
      <div v-if="!chatStore.isLoadingMsgs && !chatStore.activeMessages.length" class="chat-messages__empty">
        <p>{{ t('messages.sayHello') }}</p>
      </div>

      <ChatMessageItem
        v-for="msg in chatStore.activeMessages"
        :key="msg._id"
        :message="msg"
        :mine="isMe(msg)"
        :last-sent="isLastSentMsg(msg)"
        :current-user-id="chatStore.currentUserId"
        :partner="chatStore.activePartner"
        @reply="startReply(msg)"
        @forward="forwardingMessage = msg"
        @delete="requestMessageMutation('delete', msg)"
        @unsend="requestMessageMutation('unsend', msg)"
        @retry="chatStore.retryMessage(msg)"
        @jump-to="scrollToMessage"
      />
    </div>

    <!-- ── Input area ── -->
    <div class="chat-composer">
      <div v-if="replyingTo" class="chat-composer__reply">
        <span>
          <strong>{{ t('messages.replyingTo', { name: replyAuthorLabel(replyingTo.senderId) }) }}</strong>
          <small>{{ replyPreviewText(replyingTo) }}</small>
        </span>
        <button type="button" :aria-label="t('messages.cancelReply')" @click="replyingTo = null">×</button>
      </div>
      <div class="chat-input-area">
        <label :for="inputId" class="sr-only">{{ t('messages.typeMessage') }}</label>
        <input
          :id="inputId"
          ref="messageInputRef"
          v-model="newMessage"
          type="text"
          class="chat-input"
          :placeholder="t('messages.messagePlaceholder')"
          autocomplete="off"
          maxlength="2000"
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
          @keydown.enter="handleComposerEnter"
        />
        <button
          :id="`send-btn-${chatStore.activeConversationId}`"
          class="chat-send-btn"
          :disabled="!newMessage.trim() || isSending || chatStore.socketState !== 'connected'"
          :aria-label="t('messages.sendMessage')"
          @click="handleSend"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>

    <ForwardMessageModal :message="forwardingMessage" @close="forwardingMessage = null" />
    <AppConfirm
      v-model="showMessageConfirm"
      :title="messageConfirmTitle"
      :message="messageConfirmBody"
      :confirm-label="messageConfirmLabel"
      :loading="isMutatingMessage"
      danger
      @confirm="confirmMessageMutation"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore }            from '@/store/useChatStore'
import { timeAgo }                 from '@/utils/timeAgo'
import { useLocaleStore }          from '@/store/useLocaleStore'
import type { ApiMessage }         from '@/api/types'
import UserAvatar                  from '@/components/common/UserAvatar.vue'
import ConversationActionsMenu     from './ConversationActionsMenu.vue'
import ChatMessageItem             from './ChatMessageItem.vue'
import ForwardMessageModal         from './ForwardMessageModal.vue'
import AppConfirm                  from '@/components/common/AppConfirm.vue'
import { useSettingsStore }        from '@/store/useSettingsStore'

const emit = defineEmits<{ back: []; deleted: [] }>()

const chatStore     = useChatStore()
const localeStore   = useLocaleStore()
const { t } = useI18n()
const newMessage    = ref('')
const messageInputRef = ref<HTMLInputElement | null>(null)
const messageListRef = ref<HTMLElement | null>(null)
const inputId       = `chat-input-${Math.random().toString(36).slice(2, 6)}`
const isDeleting    = ref(false)
const isComposing   = ref(false)
const isSending     = ref(false)
const replyingTo = ref<ApiMessage | null>(null)
const forwardingMessage = ref<ApiMessage | null>(null)
const pendingMessageMutation = ref<{ action: 'delete' | 'unsend'; message: ApiMessage } | null>(null)
const showMessageConfirm = ref(false)
const isMutatingMessage = ref(false)
const settingsStore = useSettingsStore()
const presenceClock = ref(Date.now())
let presenceTimer: ReturnType<typeof setInterval> | null = null

// ── Partner visuals ─────────────────────────────────────────────────────────
const partnerIsOnline = computed(() => {
  const partner = chatStore.activePartner
  return Boolean(partner && chatStore.isUserOnline(partner._id, partner.lastHeartbeatAt))
})
const partnerPresenceLabel = computed(() => {
  presenceClock.value
  const partner = chatStore.activePartner
  if (!partner) return ''
  if (partnerIsOnline.value) return t('messages.activeNow')

  const lastActiveAt = chatStore.getUserLastActiveAt(partner._id, partner.lastHeartbeatAt)
  return lastActiveAt
    ? t('messages.activeAgo', { time: timeAgo(lastActiveAt, localeStore.currentLocale) })
    : `@${partner.username}`
})

onMounted(() => {
  presenceTimer = setInterval(() => {
    presenceClock.value = Date.now()
  }, 30_000)
})

onUnmounted(() => {
  if (presenceTimer) clearInterval(presenceTimer)
})

// ── isMe: determines bubble style ───────────────────────────────────────────
function isMe(msg: ApiMessage): boolean {
  const senderId = typeof msg.senderId === 'object'
    ? (msg.senderId as { _id: string })._id
    : msg.senderId
  return senderId === chatStore.currentUserId
}

// ── Last sent message (for status indicator) ─────────────────────────────────
function isLastSentMsg(msg: ApiMessage): boolean {
  const myMsgs = chatStore.activeMessages.filter(m => isMe(m))
  if (!myMsgs.length) return false
  return myMsgs[myMsgs.length - 1]._id === msg._id
}

// ── Send ────────────────────────────────────────────────────────────────────
async function handleSend() {
  const content = newMessage.value.trim()
  if (!content || isSending.value) return
  isSending.value = true
  const sent = await chatStore.sendMessageToConversation(chatStore.activeConversationId!, {
    content,
    replyToMessageId: replyingTo.value?._id,
  })
  if (sent && newMessage.value.trim() === content) {
    newMessage.value = ''
    replyingTo.value = null
  }
  isSending.value = false
  scrollToBottom()
}

function startReply(message: ApiMessage): void {
  if (message.unsentAt) return
  replyingTo.value = message
  void nextTick(() => messageInputRef.value?.focus())
}

function replyAuthorLabel(senderId: ApiMessage['senderId']): string {
  const id = typeof senderId === 'object' ? senderId._id : senderId
  if (id === chatStore.currentUserId) return t('messages.you')
  return chatStore.activePartner?.display_name || t('messages.otherPerson')
}

function replyPreviewText(message: NonNullable<ApiMessage['replyTo']> | ApiMessage): string {
  if (message.unsentAt) return t('messages.messageUnsent')
  if (message.messageType === 'shared_post') return t('messages.sharedPostPreview')
  if (message.content_unavailable) return t('messages.contentUnavailable')
  return message.content
}

function scrollToMessage(messageId: string): void {
  const target = document.getElementById(`chat-message-${messageId}`)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target.classList.add('chat-message--highlighted')
  window.setTimeout(() => target.classList.remove('chat-message--highlighted'), 1_500)
}

function requestMessageMutation(action: 'delete' | 'unsend', message: ApiMessage): void {
  pendingMessageMutation.value = { action, message }
  showMessageConfirm.value = true
}

const messageConfirmTitle = computed(() =>
  pendingMessageMutation.value?.action === 'unsend'
    ? t('messages.unsendTitle')
    : t('messages.deleteMessageTitle'),
)
const messageConfirmBody = computed(() =>
  pendingMessageMutation.value?.action === 'unsend'
    ? t('messages.unsendConfirm')
    : t('messages.deleteMessageConfirm'),
)
const messageConfirmLabel = computed(() =>
  pendingMessageMutation.value?.action === 'unsend'
    ? t('messages.unsendForEveryone')
    : t('messages.deleteForMe'),
)

async function confirmMessageMutation(): Promise<void> {
  const pending = pendingMessageMutation.value
  if (!pending || isMutatingMessage.value) return
  isMutatingMessage.value = true
  try {
    if (pending.action === 'unsend') {
      await chatStore.unsendMessage(pending.message._id)
      settingsStore.showToastKey('messages.unsendSuccess')
    } else {
      await chatStore.deleteMessageForMe(pending.message._id)
      settingsStore.showToastKey('messages.deleteMessageSuccess')
    }
    showMessageConfirm.value = false
    pendingMessageMutation.value = null
  } catch {
    settingsStore.showToastKey('messages.messageActionFailed', undefined, 'error')
  } finally {
    isMutatingMessage.value = false
  }
}

function handleComposerEnter(event: KeyboardEvent) {
  if (event.isComposing || isComposing.value || event.keyCode === 229) return
  event.preventDefault()
  handleSend()
}

// ── Scroll ──────────────────────────────────────────────────────────────────
function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

// Auto-scroll when messages change or conversation switches
watch(
  () => [chatStore.activeMessages.length, chatStore.activeConversationId],
  () => scrollToBottom(),
  { flush: 'post' }
)

watch(() => chatStore.activeConversationId, () => {
  replyingTo.value = null
  forwardingMessage.value = null
  showMessageConfirm.value = false
  pendingMessageMutation.value = null
})

async function handleDelete() {
  if (!chatStore.activeConversationId || isDeleting.value) return
  isDeleting.value = true
  try {
    await chatStore.deleteConversation(chatStore.activeConversationId)
    emit('deleted')
  } finally {
    isDeleting.value = false
  }
}

function handleToggleMute() {
  if (!chatStore.activeConversationId) return
  chatStore.toggleMute(chatStore.activeConversationId)
}
</script>

<style scoped>
/* ── Empty state ── */
.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  color: var(--color-text-muted);
}
.chat-empty__icon { display: block; opacity: 0.4; }
.chat-empty__text { font-size: var(--font-size-base); }

/* ── Chat window shell ── */
.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* ── Header ── */
.chat-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  position: relative;
}
.chat-header__avatar {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}
.chat-header__online-indicator {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 11px;
  height: 11px;
  border: 2px solid var(--color-bg-surface);
  border-radius: var(--radius-full);
  background: #22c55e;
  box-sizing: border-box;
}
.chat-header__info   { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.chat-header__name   { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.chat-header__presence { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.chat-header__back {
  display: none;
}

/* Loading dots in header */
.chat-header__loading {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.chat-header__dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
  animation: dot-bounce 1.2s ease-in-out infinite;
}
.chat-header__dot:nth-child(2) { animation-delay: 0.2s; }
.chat-header__dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-bounce {
  0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
  40%            { opacity: 1;   transform: translateY(-3px); }
}

/* ── Message list ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: var(--color-bg-base);
}

.chat-messages__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* ── Input area ── */
.chat-composer {
  flex-shrink: 0;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
}
.chat-composer__reply {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 16px 0;
}
.chat-composer__reply > span {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 2px;
  padding-left: 10px;
  border-left: 3px solid #777;
}
.chat-composer__reply strong { font-size: 12px; }
.chat-composer__reply small {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-composer__reply button {
  width: 28px; height: 28px; border: 0; border-radius: 50%;
  background: transparent; color: var(--color-text-muted); font-size: 20px; cursor: pointer;
}
.chat-composer__reply button:hover { background: var(--color-bg-elevated); color: var(--color-text-primary); }
.chat-input-area {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-surface);
}

.chat-input {
  flex: 1;
  height: 40px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-full);
  padding: 0 var(--space-4);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  transition: border-color var(--transition-fast);
}
.chat-input::placeholder { color: var(--color-text-muted); }
.chat-input:focus { border-color: #4a4a4a; outline: none; }

.chat-send-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: #ffffff;
  color: #101010;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition-fast);
}
.chat-send-btn:hover:not(:disabled) { background: #e0e0e0; }
.chat-send-btn:disabled {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .chat-header {
    min-height: 58px;
    gap: 9px;
    padding: 9px 10px;
  }

  .chat-header__back {
    display: grid;
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-primary);
  }

  .chat-header__back:active {
    background: var(--color-bg-hover);
  }

  .chat-messages {
    gap: 10px;
    padding: 14px 12px;
  }

  .chat-input-area {
    padding: 9px 10px;
  }

  .chat-input {
    min-width: 0;
    font-size: 16px;
  }
}
</style>
