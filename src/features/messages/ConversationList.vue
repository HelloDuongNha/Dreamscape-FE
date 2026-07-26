<template>
  <aside class="conv-list">
    <!-- Header -->
    <div class="conv-list__header">
      <h2 class="conv-list__title">Messages</h2>
    </div>

    <!-- @username Search -->
    <div class="conv-list__search-wrap">
      <label :for="searchId" class="sr-only">Search by @username</label>
      <div class="conv-list__search">
        <svg class="conv-list__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          :id="searchId"
          v-model="searchQuery"
          type="search"
          placeholder="Search @username..."
          autocomplete="off"
          spellcheck="false"
          class="conv-list__search-input"
        />
        <button
          v-if="searchQuery"
          class="conv-list__search-clear"
          aria-label="Clear search"
          @click="clearSearch"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <template v-if="searchQuery">
      <div class="conv-list__search-tabs" role="tablist" aria-label="Message search">
        <button
          class="conv-list__search-tab"
          :class="{ 'conv-list__search-tab--active': activeSearchTab === 'conversations' }"
          role="tab"
          :aria-selected="activeSearchTab === 'conversations'"
          @click="activeSearchTab = 'conversations'"
        >
          Conversations
          <span>{{ searchResults.conversations.length }}</span>
        </button>
        <button
          class="conv-list__search-tab"
          :class="{ 'conv-list__search-tab--active': activeSearchTab === 'messages' }"
          role="tab"
          :aria-selected="activeSearchTab === 'messages'"
          @click="activeSearchTab = 'messages'"
        >
          Messages
          <span>{{ searchResults.messages.length }}</span>
        </button>
      </div>

      <div v-if="isSearching" class="conv-list__searching">
        <span class="conv-list__searching-dot" />
        <span class="conv-list__searching-dot" />
        <span class="conv-list__searching-dot" />
      </div>

      <ul
        v-else-if="activeSearchTab === 'conversations' && searchResults.conversations.length"
        class="conv-list__search-results"
        role="listbox"
        aria-label="Conversation search results"
      >
        <li
          v-for="item in searchResults.conversations"
          :key="item.user._id"
          class="conv-list__user-result"
          role="option"
          :aria-selected="false"
          @click="openConversationResult(item)"
        >
          <div class="conv-list__avatar" :style="{ background: getAvatarBg(item.user._id) }">
            {{ getInitials(item.user.display_name) }}
          </div>
          <div class="conv-list__user-info">
            <span class="conv-list__user-name">{{ item.user.display_name }}</span>
            <span class="conv-list__user-handle">{{ item.user.username }}</span>
            <span class="conv-list__search-snippet">
              {{ item.last_message || 'Following · Start a conversation' }}
            </span>
          </div>
        </li>
      </ul>

      <ul
        v-else-if="activeSearchTab === 'messages' && searchResults.messages.length"
        class="conv-list__search-results"
        role="listbox"
        aria-label="Message search results"
      >
        <li
          v-for="item in searchResults.messages"
          :key="item.message._id"
          class="conv-list__message-result"
          role="option"
          :aria-selected="false"
          @click="openMessageResult(item.conversationId)"
        >
          <div class="conv-list__message-result-top">
            <span>{{ item.partner.display_name }}</span>
            <time>{{ timeAgo(item.message.timestamp) }}</time>
          </div>
          <p>
            <strong>{{ messageSenderLabel(item) }}:</strong>
            {{ item.message.content }}
          </p>
        </li>
      </ul>

      <p v-else-if="!isSearching" class="conv-list__no-results">
        No {{ activeSearchTab }} found for "{{ searchQuery }}"
      </p>
    </template>

    <!-- Conversation list (shown when not searching) -->
    <ul v-if="!searchQuery" class="conv-list__items" role="list">
      <li
        v-for="item in conversations"
        :key="item.conversation._id"
        :id="`conv-item-${item.conversation._id}`"
        class="conv-list__item"
        :class="{
          'conv-list__item--active':  activeId === item.conversation._id,
          'conv-list__item--unread':  item.conversation.unread_count > 0,
        }"
        role="button"
        :aria-pressed="activeId === item.conversation._id"
        :tabindex="0"
        @click="$emit('select', item.conversation._id)"
        @keydown.enter="$emit('select', item.conversation._id)"
      >
        <div class="conv-list__avatar" :style="{ background: getAvatarBg(item.partner._id) }">
          {{ getInitials(item.partner.display_name) }}
        </div>
        <div class="conv-list__item-body">
          <div class="conv-list__item-top">
            <span class="conv-list__item-name">{{ item.partner.display_name }}</span>
            <!-- Unread badge — shown when count > 0 -->
            <span
              v-if="item.conversation.unread_count > 0"
              class="conv-list__unread-badge"
              :aria-label="`${item.conversation.unread_count} unread messages`"
            >
              {{ item.conversation.unread_count > 9 ? '9+' : item.conversation.unread_count }}
            </span>
            <span v-else class="conv-list__item-time">{{ timeAgo(item.conversation.updated_at) }}</span>
          </div>
          <p
            class="conv-list__item-snippet"
            :class="{ 'conv-list__item-snippet--unread': item.conversation.unread_count > 0 }"
          >{{ item.conversation.last_message || 'No messages yet' }}</p>
        </div>
      </li>
    </ul>

    <!-- Empty state -->
    <div v-if="!searchQuery && !conversations.length" class="conv-list__empty">
      <span aria-hidden="true">◈</span>
      <p>No conversations yet.<br>Search for someone to start chatting.</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getInitials, getAvatarBg } from '@/data/mockUsers'
import { timeAgo }                  from '@/utils/timeAgo'
import { useChatStore }             from '@/store/useChatStore'
import type {
  MessagingConversationSearchResult,
  MessagingMessageSearchResult,
  MessagingSearchResponse,
} from '@/api/types'
import type { ConversationWithPartner } from '@/store/useChatStore'

const props = defineProps<{
  conversations: ConversationWithPartner[]
  activeId:      string | null
}>()

const emit = defineEmits<{
  select:   [convId: string]
  openUser: [userId: string]
}>()

const chatStore   = useChatStore()
const searchId    = `conv-search-${Math.random().toString(36).slice(2, 6)}`
const searchQuery = ref('')
const isSearching = ref(false)
const activeSearchTab = ref<'conversations' | 'messages'>('conversations')
const searchResults = ref<MessagingSearchResponse>({ conversations: [], messages: [] })

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let searchRequestId = 0

async function onSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  const query = searchQuery.value.trim()
  const requestId = ++searchRequestId
  if (!query) {
    searchResults.value = { conversations: [], messages: [] }
    isSearching.value = false
    return
  }
  isSearching.value = true
  debounceTimer = setTimeout(async () => {
    try {
      const results = await chatStore.searchMessaging(query)
      if (requestId === searchRequestId && query === searchQuery.value.trim()) {
        searchResults.value = results
      }
    } finally {
      if (requestId === searchRequestId) {
        isSearching.value = false
      }
    }
  }, 250)
}

watch(searchQuery, () => {
  void onSearch()
})

function clearSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  searchRequestId += 1
  searchQuery.value = ''
  searchResults.value = { conversations: [], messages: [] }
  isSearching.value = false
  activeSearchTab.value = 'conversations'
}

function openConversationResult(item: MessagingConversationSearchResult) {
  clearSearch()
  if (item.conversationId) {
    emit('select', item.conversationId)
  } else {
    emit('openUser', item.user._id)
  }
}

function openMessageResult(conversationId: string) {
  clearSearch()
  emit('select', conversationId)
}

function messageSenderLabel(item: MessagingMessageSearchResult): string {
  const senderId = typeof item.message.senderId === 'object'
    ? item.message.senderId._id
    : item.message.senderId
  return senderId === chatStore.currentUserId ? 'You' : item.partner.display_name
}
</script>

<style scoped>
.conv-list {
  width: 280px;
  flex-shrink: 0;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.conv-list__header {
  padding: var(--space-4) var(--space-4) 0;
  flex-shrink: 0;
}
.conv-list__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: var(--letter-spacing-tight);
}

/* Search */
.conv-list__search-wrap {
  padding: var(--space-3) var(--space-3) var(--space-2);
  flex-shrink: 0;
}
.conv-list__search {
  position: relative;
  display: flex;
  align-items: center;
}
.conv-list__search-icon {
  position: absolute;
  left: var(--space-3);
  color: var(--color-text-muted);
  pointer-events: none;
}
.conv-list__search-input {
  width: 100%;
  height: 36px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  padding: 0 var(--space-8) 0 calc(var(--space-3) + 14px + var(--space-2));
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  transition: border-color var(--transition-fast);
}
.conv-list__search-input::placeholder { color: var(--color-text-muted); }
.conv-list__search-input:focus { border-color: #4a4a4a; outline: none; }
.conv-list__search-input::-webkit-search-cancel-button { display: none; }
.conv-list__search-clear {
  position: absolute;
  right: var(--space-2);
  width: 20px; height: 20px;
  border-radius: var(--radius-full);
  display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-active);
  color: var(--color-text-muted);
  border: none; cursor: pointer;
  transition: background var(--transition-fast);
}
.conv-list__search-clear:hover { background: #333; }

.conv-list__search-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-1);
  padding: 0 var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--color-border);
}
.conv-list__search-tab {
  min-width: 0;
  border: 0;
  border-radius: var(--radius-md);
  padding: 7px var(--space-2);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}
.conv-list__search-tab:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}
.conv-list__search-tab--active {
  color: var(--color-text-primary);
  background: var(--color-bg-active);
}
.conv-list__search-tab span {
  margin-left: 3px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

/* Searching dots animation */
.conv-list__searching {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-3) 0;
}
.conv-list__searching-dot {
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
  animation: conv-dot-pulse 1.2s ease-in-out infinite;
}
.conv-list__searching-dot:nth-child(2) { animation-delay: 0.2s; }
.conv-list__searching-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes conv-dot-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40%            { opacity: 1;   transform: scale(1); }
}

/* Search results (user list) */
.conv-list__search-results {
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid var(--color-border);
}
.conv-list__user-result {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.conv-list__user-result:hover { background: var(--color-bg-hover); }
.conv-list__user-info { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 1px; }
.conv-list__user-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
.conv-list__user-handle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.conv-list__search-snippet {
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-list__message-result {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: pointer;
}
.conv-list__message-result:hover { background: var(--color-bg-hover); }
.conv-list__message-result-top {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}
.conv-list__message-result-top time {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-weight: var(--font-weight-normal);
}
.conv-list__message-result p {
  display: -webkit-box;
  margin-top: 3px;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.conv-list__message-result strong {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.conv-list__no-results {
  padding: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
}

/* Conversation items */
.conv-list__items {
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid var(--color-border);
}
.conv-list__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: background var(--transition-fast);
  border-bottom: 1px solid var(--color-border-subtle);
}
.conv-list__item:hover         { background: var(--color-bg-hover); }
.conv-list__item--active       { background: var(--color-bg-active); }
.conv-list__item:focus-visible { outline: 2px solid var(--color-border-focus); outline-offset: -2px; }

/* Shared avatar */
.conv-list__avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
}

.conv-list__item-body   { flex: 1; min-width: 0; }
.conv-list__item-top    { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.conv-list__item-name   {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}
.conv-list__item-time   { font-size: var(--font-size-xs); color: var(--color-text-muted); white-space: nowrap; flex-shrink: 0; }
.conv-list__item-snippet {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
  max-width: 180px;
}
/* Highlight snippet text when there are unread messages */
.conv-list__item-snippet--unread {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

/* ── Flat unread badge ── */
/* Strictly: no shadow, no gradient, no blur — solid flat pill */
.conv-list__unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #3B82F6;       /* solid flat blue */
  color: #ffffff;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  flex-shrink: 0;
  letter-spacing: 0;
  /* zero shadow, zero gradient, zero blur */
  box-shadow: none;
}

/* Empty state */
.conv-list__empty {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.conv-list__empty span {
  font-size: 1.5rem;
  opacity: 0.4;
}
</style>
