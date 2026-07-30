<template>
  <div class="messages-view">
    <!-- Skeleton — shown while the global conversation list is still loading -->
    <template v-if="chatStore.isLoadingConvs">
      <div class="skeleton-conversations">
        <AppSkeleton v-for="i in 5" :key="i" type="list" />
      </div>
      <div class="skeleton-chat">
        <AppSkeleton type="card" style="height: 100%; margin: 0;" />
      </div>
    </template>

    <template v-else>
      <ConversationList
        :class="{ 'messages-view__pane--hidden-mobile': chatStore.activeConversationId }"
        :conversations="chatStore.conversationsWithPartner"
        :active-id="chatStore.activeConversationId"
        @select="handleConversationSelect"
        @open-user="handleUserSelect"
      />
      <ChatWindow
        :class="{ 'messages-view__pane--hidden-mobile': !chatStore.activeConversationId }"
        @back="handleConversationClose"
        @deleted="handleConversationClose"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * MessagesView.vue
 *
 * loadConversations() has been moved to App.vue onMounted (global init).
 * This view NO LONGER calls it — doing so would be a duplicate fetch and
 * could reset unread_count values that were already incremented by socket
 * events while the user was on another route.
 *
 * This view only:
 *  1. Shows the skeleton while isLoadingConvs is true (driven by the global fetch).
 *  2. Handles the ?userId=<id> deep-link query param to auto-open a chat.
 *  3. Watches for query param changes while already on this route.
 */
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConversationList   from './ConversationList.vue'
import ChatWindow         from './ChatWindow.vue'
import AppSkeleton        from '@/components/common/AppSkeleton.vue'
import { useChatStore }   from '@/store/useChatStore'

const route     = useRoute()
const router    = useRouter()
const chatStore = useChatStore()

// Opens the selected conversation, then makes it reload-safe through the URL.
async function handleConversationSelect(conversationId: string): Promise<void> {
  await chatStore.openConversation(conversationId)
  await replaceConversationQuery(conversationId)
}

// Resolves a profile deep link to a concrete conversation before canonicalizing the URL.
async function handleUserSelect(userId: string): Promise<void> {
  await chatStore.openConversationWithUser(userId)
  if (chatStore.activeConversationId) {
    await replaceConversationQuery(chatStore.activeConversationId)
  }
}

// Restores a conversation after pull-to-refresh, a hard reload, or browser history navigation.
watch(
  () => route.query.conversationId,
  async (conversationId) => {
    if (typeof conversationId === 'string' && conversationId) {
      if (chatStore.activeConversationId === conversationId) return
      try {
        await chatStore.openConversation(conversationId)
      } catch {
        chatStore.clearActiveConversation()
        await replaceConversationQuery(null)
      }
      return
    }

    if (!route.query.userId && chatStore.activeConversationId) {
      chatStore.clearActiveConversation()
    }
  },
  { immediate: true },
)

// Resolves ?userId=<id> links from Profile into the canonical conversation URL.
watch(
  () => route.query.userId,
  async (userId) => {
    if (userId && typeof userId === 'string') {
      await handleUserSelect(userId)
    }
  },
  { immediate: true },
)

// Returns to the conversation list and removes stale reload state from the URL.
async function handleConversationClose(): Promise<void> {
  chatStore.clearActiveConversation()
  await replaceConversationQuery(null)
}

// Keeps one canonical query shape so conversationId and userId cannot conflict.
async function replaceConversationQuery(conversationId: string | null): Promise<void> {
  const currentConversationId = typeof route.query.conversationId === 'string'
    ? route.query.conversationId
    : null
  if (currentConversationId === conversationId && !route.query.userId) return

  const query = { ...route.query }
  delete query.userId
  if (conversationId) query.conversationId = conversationId
  else delete query.conversationId

  await router.replace({ name: 'messages', query })
}
</script>

<style scoped>
.messages-view {
  display: flex;
  width: 100%;
  height: calc(100dvh - var(--header-height));
  background: var(--color-bg-base);
  overflow: hidden;
}

.skeleton-conversations {
  width: 280px;
  border-right: 1px solid var(--color-border);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.skeleton-chat {
  flex: 1;
  padding: var(--space-6);
}

@media (max-width: 640px) {
  .messages-view {
    height: 100%;
  }

  .messages-view > :deep(.conv-list),
  .messages-view > :deep(.chat-window),
  .messages-view > :deep(.chat-empty) {
    width: 100%;
    height: 100%;
    flex: 1 1 100%;
  }

  .messages-view > :deep(.messages-view__pane--hidden-mobile) {
    display: none;
  }

  .skeleton-conversations {
    width: 100%;
    border-right: none;
  }
  .skeleton-chat { display: none; }
}
</style>
