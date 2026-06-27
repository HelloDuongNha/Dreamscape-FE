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
        :conversations="chatStore.conversationsWithPartner"
        :active-id="chatStore.activeConversationId"
        @select="chatStore.openConversation"
        @open-user="chatStore.openConversationWithUser"
      />
      <ChatWindow />
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
import { useRoute }       from 'vue-router'
import ConversationList   from './ConversationList.vue'
import ChatWindow         from './ChatWindow.vue'
import AppSkeleton        from '@/components/common/AppSkeleton.vue'
import { useChatStore }   from '@/store/useChatStore'

const route     = useRoute()
const chatStore = useChatStore()

// Support: ?userId=<id> query param (from Profile → Message button)
// Opens or creates a conversation with that user automatically.
// We do this inside a watch on the route query so it also fires when the
// param changes while the user is already on this route (different profile click).
watch(
  () => route.query.userId,
  async (userId) => {
    if (userId && typeof userId === 'string') {
      await chatStore.openConversationWithUser(userId)
    }
  },
  { immediate: true }   // runs once on mount (handles initial load with ?userId)
)
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
  .messages-view { flex-direction: column; }
  .skeleton-conversations { width: 100%; border-right: none; }
  .skeleton-chat { display: none; }
}
</style>
