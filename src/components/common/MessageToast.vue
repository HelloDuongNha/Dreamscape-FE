<template>
  <div
    class="message-toast"
    :class="{ 'message-toast--stacked': index > 0 }"
    :style="cardStyle"
    role="button"
    tabindex="0"
    @click="$emit('click')"
    @keydown.enter="$emit('click')"
  >
    <div class="message-toast__avatar-col">
      <div v-if="message.senderAvatar" class="message-toast__avatar">
        <img :src="message.senderAvatar" alt="" class="message-toast__avatar-img" />
      </div>
      <div v-else class="message-toast__avatar-placeholder" :style="{ background: avatarBg }">
        {{ initials }}
      </div>
    </div>
    
    <div class="message-toast__content-col">
      <div class="message-toast__header">
        <span class="message-toast__name">{{ message.senderName }}</span>
        <span class="message-toast__username">{{ message.senderUsername }}</span>
      </div>
      <p class="message-toast__body">{{ message.content }}</p>
    </div>

    <!-- Only show close button on the top-most card of the stack -->
    <button
      v-if="index === 0"
      class="message-toast__close"
      aria-label="Dismiss notification"
      @click.stop="$emit('dismiss')"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getInitials, getAvatarBg } from '@/utils/avatar'

interface MessageToastProps {
  message: {
    id:             string
    senderId:       string
    senderName:     string
    senderAvatar:   string
    senderUsername: string
    content:        string
    timestamp:      string
  }
  index: number // 0 is top-most (latest), 1 is middle, 2 is bottom
  total: number
}

const props = defineProps<MessageToastProps>()

defineEmits<{
  (e: 'click'): void
  (e: 'dismiss'): void
}>()

const initials = computed(() => getInitials(props.message.senderName))
const avatarBg = computed(() => getAvatarBg(props.message.senderId))

const cardStyle = computed(() => {
  const idx = props.index
  // Latest message (idx === 0) has transform: none, scale: 1, opacity: 1, z-index: 10
  // Index 1 (second latest) has transform: translateY(8px) scale(0.96), opacity: 0.7, z-index: 9
  // Index 2 (third latest) has transform: translateY(16px) scale(0.92), opacity: 0.4, z-index: 8
  const translateY = idx * 8
  const scale = 1 - idx * 0.04
  const opacity = 1 - idx * 0.4
  const zIndex = 10 - idx

  return {
    transform: `translateY(${translateY}px) scale(${scale})`,
    opacity: opacity,
    zIndex: zIndex,
  }
})
</script>

<style scoped>
.message-toast {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 72px; /* Fixed height for consistent stacking */
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              background-color var(--transition-fast),
              border-color var(--transition-fast);
  box-sizing: border-box;
}

/* Hover effect on top card */
.message-toast:not(.message-toast--stacked):hover {
  border-color: #3e3e3e;
  background: var(--color-bg-hover);
}

.message-toast--stacked {
  pointer-events: none; /* user only interacts with the top card */
}

/* Avatar styling */
.message-toast__avatar-col {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.message-toast__avatar {
  width: var(--space-9);
  height: var(--space-9);
  border-radius: var(--radius-full);
  overflow: hidden;
  border: 1px solid #262626;
}
.message-toast__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.message-toast__avatar-placeholder {
  width: var(--space-9);
  height: var(--space-9);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: #fff;
  border: 1px solid #262626;
}

/* Content styling */
.message-toast__content-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.message-toast__header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: var(--font-size-xs);
}
.message-toast__name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}
.message-toast__username {
  color: var(--color-text-muted);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}
.message-toast__body {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: var(--line-height-normal);
}

/* Close button styling */
.message-toast__close {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity var(--transition-fast), color var(--transition-fast), background-color var(--transition-fast);
  border-radius: var(--radius-sm);
}
.message-toast__close:hover {
  opacity: 1;
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}
</style>
