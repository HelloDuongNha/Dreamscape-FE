<template>
  <!-- Empty state when no conversation selected -->
  <div v-if="!chatStore.activeConversationId" class="chat-empty">
    <span class="chat-empty__icon" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </span>
    <p class="chat-empty__text">Select a conversation to start chatting</p>
  </div>

  <!-- Active chat window -->
  <div v-else class="chat-window" @click="closeMenu">

    <!-- ── Header ── -->
    <header class="chat-header">
      <div
        class="chat-header__avatar"
        :style="{ background: partnerAvatarBg }"
        aria-hidden="true"
      >
        {{ partnerInitials }}
      </div>
      <div class="chat-header__info">
        <span class="chat-header__name">{{ chatStore.activePartner?.display_name ?? '…' }}</span>
        <span class="chat-header__handle">{{ chatStore.activePartner?.username ?? '' }}</span>
      </div>

      <!-- Loading indicator for messages -->
      <div v-if="chatStore.isLoadingMsgs" class="chat-header__loading" aria-label="Loading messages">
        <span class="chat-header__dot" />
        <span class="chat-header__dot" />
        <span class="chat-header__dot" />
      </div>

      <!-- ── 3-dot Action Menu ── -->
      <div class="chat-menu" @click.stop>
        <button
          id="chat-menu-btn"
          class="chat-menu__trigger"
          :aria-expanded="menuOpen"
          aria-haspopup="true"
          aria-label="Conversation options"
          @click.stop="toggleMenu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.8"/>
            <circle cx="12" cy="12" r="1.8"/>
            <circle cx="12" cy="19" r="1.8"/>
          </svg>
        </button>

        <!-- Dropdown panel -->
        <Transition name="menu-fade">
          <div v-if="menuOpen" id="chat-menu-panel" class="chat-menu__panel" role="menu">

            <!-- Mute toggle -->
            <button
              id="chat-menu-mute"
              class="chat-menu__item"
              role="menuitem"
              @click="handleToggleMute"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <template v-if="chatStore.isActiveMuted">
                  <!-- Bell with slash = muted, clicking unmutes -->
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </template>
                <template v-else>
                  <!-- Bell = not muted, clicking mutes -->
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </template>
              </svg>
              <span>{{ chatStore.isActiveMuted ? 'Unmute notifications' : 'Mute notifications' }}</span>
              <span v-if="chatStore.isActiveMuted" class="chat-menu__badge">Muted</span>
            </button>

            <div class="chat-menu__divider" role="separator" />

            <!-- Delete conversation -->
            <button
              id="chat-menu-delete"
              class="chat-menu__item chat-menu__item--danger"
              role="menuitem"
              :disabled="isDeleting"
              @click="handleDelete"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              <span>{{ isDeleting ? 'Deleting…' : 'Delete conversation' }}</span>
            </button>
          </div>
        </Transition>
      </div>
    </header>

    <!-- ── Message list ── -->
    <div
      ref="messageListRef"
      class="chat-messages"
      role="log"
      aria-label="Message history"
      aria-live="polite"
    >
      <!-- Empty conversation -->
      <div v-if="!chatStore.isLoadingMsgs && !chatStore.activeMessages.length" class="chat-messages__empty">
        <p>No messages yet. Say hello!</p>
      </div>

      <div
        v-for="msg in chatStore.activeMessages"
        :key="msg._id"
        class="chat-bubble-wrap"
        :class="isMe(msg) ? 'chat-bubble-wrap--me' : 'chat-bubble-wrap--other'"
      >
        <!-- ── OTHER: inner row (avatar + bubble bottom-aligned) + time below ── -->
        <template v-if="!isMe(msg)">
          <div class="chat-bubble-row">
            <div
              class="chat-bubble-wrap__avatar"
              :style="{ background: partnerAvatarBg }"
              :aria-label="chatStore.activePartner?.display_name"
            >
              {{ partnerInitials }}
            </div>
            <div class="chat-bubble chat-bubble--other">{{ msg.content }}</div>
          </div>
          <span class="chat-bubble__time chat-bubble__time--other">{{ timeAgo(msg.timestamp) }}</span>
        </template>

        <!-- ── ME: bubble + time + status ── -->
        <template v-else>
          <div class="chat-bubble-col">
            <div
              class="chat-bubble chat-bubble--me"
              :class="{ 'chat-bubble--optimistic': msg._id.startsWith('temp-') }"
            >
              {{ msg.content }}
            </div>
            <span class="chat-bubble__time">{{ timeAgo(msg.timestamp) }}</span>
            <!-- Status indicator — only on the last sent message -->
            <span
              v-if="isLastSentMsg(msg)"
              class="chat-bubble__status"
              :aria-label="`Message ${msg.status ?? 'sent'}`"
            >
              {{ statusLabel(msg.status) }}
            </span>
          </div>
        </template>
      </div>
    </div>

    <!-- ── Input area ── -->
    <div class="chat-input-area">
      <label :for="inputId" class="sr-only">Type a message</label>
      <input
        :id="inputId"
        v-model="newMessage"
        type="text"
        class="chat-input"
        placeholder="Message..."
        autocomplete="off"
        maxlength="2000"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
        @keydown.enter="handleComposerEnter"
      />
      <button
        :id="`send-btn-${chatStore.activeConversationId}`"
        class="chat-send-btn"
        :disabled="!newMessage.trim()"
        aria-label="Send message"
        @click="handleSend"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useChatStore }            from '@/store/useChatStore'
import { getInitials, getAvatarBg } from '@/data/mockUsers'
import { timeAgo }                 from '@/utils/timeAgo'
import type { ApiMessage }         from '@/api/types'

const chatStore     = useChatStore()
const newMessage    = ref('')
const messageListRef = ref<HTMLElement | null>(null)
const inputId       = `chat-input-${Math.random().toString(36).slice(2, 6)}`
const menuOpen      = ref(false)
const isDeleting    = ref(false)
const isComposing   = ref(false)

// ── Partner visuals ─────────────────────────────────────────────────────────
const partnerInitials = computed(() =>
  chatStore.activePartner ? getInitials(chatStore.activePartner.display_name) : '?'
)
const partnerAvatarBg = computed(() =>
  chatStore.activePartner ? getAvatarBg(chatStore.activePartner._id) : '#262626'
)

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

// ── Status label text ─────────────────────────────────────────────────────────
function statusLabel(status?: 'sent' | 'delivered' | 'seen'): string {
  switch (status) {
    case 'delivered': return 'Delivered'
    case 'seen':      return 'Seen'
    default:          return 'Sent'
  }
}

// ── Send ────────────────────────────────────────────────────────────────────
function handleSend() {
  const content = newMessage.value.trim()
  if (!content) return
  chatStore.sendMessage(content)
  newMessage.value = ''
  scrollToBottom()
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

// ── 3-dot menu ───────────────────────────────────────────────────────────────
function toggleMenu() {
  menuOpen.value = !menuOpen.value
}
function closeMenu() {
  menuOpen.value = false
}

async function handleDelete() {
  if (!chatStore.activeConversationId || isDeleting.value) return
  isDeleting.value = true
  menuOpen.value   = false
  try {
    await chatStore.deleteConversation(chatStore.activeConversationId)
  } finally {
    isDeleting.value = false
  }
}

function handleToggleMute() {
  if (!chatStore.activeConversationId) return
  chatStore.toggleMute(chatStore.activeConversationId)
  menuOpen.value = false
}

// Close menu when active conversation changes
watch(() => chatStore.activeConversationId, () => { menuOpen.value = false })
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
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
}
.chat-header__info   { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.chat-header__name   { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.chat-header__handle { font-size: var(--font-size-xs); color: var(--color-text-muted); }

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

/* ── 3-dot menu ── */
.chat-menu {
  position: relative;
  flex-shrink: 0;
}
.chat-menu__trigger {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.chat-menu__trigger:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* Dropdown panel — flat dark, no blur, no shadow */
.chat-menu__panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 210px;
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-lg);
  overflow: hidden;
  z-index: 200;
}

.chat-menu__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.chat-menu__item:hover {
  background: #222222;
  color: var(--color-text-primary);
}
.chat-menu__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-menu__item--danger { color: #ed4956; }
.chat-menu__item--danger:hover { background: #1a1010; color: #ff6b75; }

.chat-menu__badge {
  margin-left: auto;
  font-size: 10px;
  background: #2a2a2a;
  color: var(--color-text-muted);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  border: 1px solid #333;
}

.chat-menu__divider {
  height: 1px;
  background: #262626;
  margin: 2px 0;
}

/* Menu transition */
.menu-fade-enter-active,
.menu-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.menu-fade-enter-from,
.menu-fade-leave-to     { opacity: 0; transform: translateY(-4px); }

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

/* ── Bubble outer wrap (one per message) ── */
.chat-bubble-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 72%;
}
.chat-bubble-wrap--me    { align-self: flex-end; align-items: flex-end; }
.chat-bubble-wrap--other { align-self: flex-start; align-items: flex-start; }

/* Inner row: avatar + bubble, bottom-edges aligned */
.chat-bubble-row {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: var(--space-2);
}

.chat-bubble-wrap__avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
}

/* Me column (bubble + time right-aligned) */
.chat-bubble-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

/* ── Bubble ── */
.chat-bubble {
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
  word-break: break-word;
  max-width: 100%;
}

/* Me — solid white, dark text */
.chat-bubble--me {
  background: #ffffff;
  color: #101010;
  border-radius: 18px 18px 4px 18px;
}

/* Optimistic (temp- prefix, not yet confirmed by server) */
.chat-bubble--optimistic {
  opacity: 0.75;
}

/* Other — solid dark gray */
.chat-bubble--other {
  background: #262626;
  color: var(--color-text-primary);
  border-radius: 18px 18px 18px 4px;
}

.chat-bubble__time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  padding: 0 var(--space-1);
}
/* Indent "other" timestamp past the avatar width */
.chat-bubble__time--other {
  padding-left: calc(28px + var(--space-2) + var(--space-1));
}

/* ── Delivery status label ── */
.chat-bubble__status {
  font-size: 10px;
  color: var(--color-text-muted);
  padding: 0 var(--space-1);
  letter-spacing: 0.01em;
  opacity: 0.8;
}

/* ── Input area ── */
.chat-input-area {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
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
</style>
