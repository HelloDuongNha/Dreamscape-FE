<template>
  <div class="profile-tabs" role="tablist" :aria-label="'Profile sections'">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :id="`profile-tab-${tab.id}`"
      class="profile-tabs__tab"
      :class="{ 'profile-tabs__tab--active': activeTab === tab.id }"
      role="tab"
      :aria-selected="activeTab === tab.id"
      :tabindex="activeTab === tab.id ? 0 : -1"
      @click="$emit('change', tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
export type TabId = 'posts' | 'replies' | 'likes'

defineProps<{ activeTab: TabId }>()
defineEmits<{ change: [id: TabId] }>()

const tabs: { id: TabId; label: string }[] = [
  { id: 'posts',   label: 'Posts'   },
  { id: 'replies', label: 'Replies' },
  { id: 'likes',   label: 'Likes'   },
]
</script>

<style scoped>
.profile-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.profile-tabs__tab {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;  /* reserve space — no visible border by default */
  margin-bottom: -1px;                    /* sit on top of the parent border */
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-base);
  cursor: pointer;
  text-align: center;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.profile-tabs__tab:hover {
  color: var(--color-text-secondary);
}

/* Active: crisp white bottom border + white text — Threads style */
.profile-tabs__tab--active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-text-primary); /* 2px solid white */
  font-weight: var(--font-weight-semibold);
}
</style>
