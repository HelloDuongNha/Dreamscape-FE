<template>
  <div :class="['app-skeleton', `app-skeleton--${type}`]" aria-hidden="true"></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'card' | 'list' | 'text' | 'avatar'
}>(), {
  type: 'text'
})
</script>

<style scoped>
.app-skeleton {
  background: #262626;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}

/* Card Skeleton: Used for posts */
.app-skeleton--card {
  width: 100%;
  height: 180px;
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-4);
}

/* List Skeleton: Used for sidebar/conversations */
.app-skeleton--list {
  width: 100%;
  height: 70px;
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
}

/* Text Skeleton: Generic text block */
.app-skeleton--text {
  width: 100%;
  height: 20px;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

/* Avatar Skeleton: Circular profile pic */
.app-skeleton--avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
