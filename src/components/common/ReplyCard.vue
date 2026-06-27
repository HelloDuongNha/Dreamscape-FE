<template>
  <article class="reply-card">

    <!-- ── My comment (top) ── -->
    <div class="reply-card__comment">
      <div
        class="reply-card__avatar"
        :style="{ background: commentAvatarBg }"
        aria-hidden="true"
      >
        {{ commentInitials }}
      </div>
      <div class="reply-card__comment-body">
        <div class="reply-card__comment-meta">
          <span class="reply-card__comment-name">{{ comment.userId.display_name }}</span>
          <span class="reply-card__comment-time">{{ commentTime }}</span>
        </div>
        <p class="reply-card__comment-text">{{ comment.content }}</p>
      </div>
    </div>

    <!-- ── Original post (nested, below) ── -->
    <div
      v-if="originalDream"
      class="reply-card__original"
      role="button"
      tabindex="0"
      aria-label="Open original post"
      @click="openOriginal"
      @keydown.enter.prevent="openOriginal"
    >
      <!-- Original post header: avatar + name -->
      <div class="reply-card__original-header">
        <div
          class="reply-card__original-avatar"
          :style="{ background: originalAvatarBg }"
          aria-hidden="true"
        >
          {{ originalInitials }}
        </div>
        <div class="reply-card__original-meta">
          <span class="reply-card__original-name">{{ originalAuthor?.display_name }}</span>
          <span class="reply-card__original-username">{{ originalAuthor?.username }}</span>
        </div>
        <!-- Like count badge -->
        <div class="reply-card__original-likes" aria-label="Likes">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          <span>{{ originalDream.likes_count }}</span>
        </div>
      </div>

      <!-- Original post body (truncated) -->
      <p class="reply-card__original-content">
        <span>{{ truncatedContent }}</span>
        <span v-if="isOriginalTruncated" class="reply-card__see-more">... xem thêm</span>
      </p>
    </div>

    <!-- Fallback if dream no longer available -->
    <div v-else class="reply-card__original reply-card__original--unavailable">
      <p class="reply-card__unavailable-text">Original post is no longer available.</p>
    </div>

  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePostStore } from '@/store/usePostStore'
import { useDreamStore } from '@/store/useDreamStore'
import { getInitials, getAvatarBg } from '@/data/mockUsers'
import { timeAgo } from '@/utils/timeAgo'
import type { ApiComment, ApiDream, ApiUser } from '@/api/types'

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps<{ comment: ApiComment }>()

const postStore  = usePostStore()
const dreamStore = useDreamStore()

// ── My comment author ─────────────────────────────────────────────────────────
const commentInitials  = computed(() => getInitials(props.comment.userId.display_name))
const commentAvatarBg  = computed(() => getAvatarBg(props.comment.userId._id))
const commentTime      = computed(() => timeAgo(props.comment.created_at))

// ── Original dream (populated dreamId from /api/comments/user/:id) ───────────

/**
 * The original dream object — either from the populated API response
 * or by looking it up in the in-memory dream store (fallback for feed dreams).
 */
const originalDream = computed<ApiDream | null>(() => {
  const d = props.comment.dreamId
  if (typeof d === 'object' && d !== null) return d as ApiDream
  // Fallback: search the global feed store
  if (typeof d === 'string') {
    return dreamStore.dreams.find(dr => dr._id === d) ?? null
  }
  return null
})

const originalAuthor = computed<ApiUser | null>(() => {
  if (!originalDream.value) return null
  const uid = originalDream.value.userId
  if (typeof uid === 'object' && uid !== null) return uid as ApiUser
  return null
})

const originalInitials = computed(() =>
  originalAuthor.value ? getInitials(originalAuthor.value.display_name) : '?'
)
const originalAvatarBg = computed(() =>
  originalAuthor.value ? getAvatarBg(originalAuthor.value._id) : '#262626'
)

// ── Content truncation ────────────────────────────────────────────────────────
const TRUNCATE_AT = 150
const isOriginalTruncated = computed(() =>
  (originalDream.value?.content.length ?? 0) > TRUNCATE_AT
)
const truncatedContent = computed(() => {
  const content = originalDream.value?.content ?? ''
  return isOriginalTruncated.value ? content.slice(0, TRUNCATE_AT) : content
})

// ── Click to open the original post in the modal ──────────────────────────────

/**
 * Open the PostDetailModal for the original dream.
 * The dream must be in dreamStore.dreams[] for usePostStore.focusedDream to work.
 * If it's not loaded (direct-to-profile navigation), we inject it from the
 * populated comment response first.
 */
function openOriginal(): void {
  if (!originalDream.value) return

  const dreamId = originalDream.value._id

  // Ensure the dream exists in the store (needed by usePostStore.focusedDream)
  const alreadyInStore = dreamStore.dreams.some(d => d._id === dreamId)
  if (!alreadyInStore) {
    // Inject the populated dream into the store so the modal can find it
    dreamStore.dreams.unshift(originalDream.value)
  }

  postStore.openPost(dreamId)
}
</script>

<style scoped>
/* ── Shell ── */
.reply-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--color-border);
}

/* ── My comment row ── */
.reply-card__comment {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.reply-card__avatar {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
}

.reply-card__comment-body {
  flex: 1;
  min-width: 0;
}

.reply-card__comment-meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin-bottom: 3px;
}

.reply-card__comment-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.reply-card__comment-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.reply-card__comment-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  word-break: break-word;
}

/* ── Nested original post box ── */
.reply-card__original {
  margin-left: calc(34px + var(--space-3)); /* align under comment text */
  background: #141414;
  border: 1px solid #262626;
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
  /* No shadow, no blur — flat spec */
}
.reply-card__original:hover {
  border-color: #3a3a3a;
  background: #1a1a1a;
}
.reply-card__original:focus-visible {
  outline: 1px solid #4a4a4a;
  outline-offset: 2px;
}

.reply-card__original-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.reply-card__original-avatar {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
}

.reply-card__original-meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  min-width: 0;
  flex: 1;
}

.reply-card__original-name {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reply-card__original-username {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.reply-card__original-likes {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.reply-card__original-content {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  word-break: break-word;
}

.reply-card__see-more {
  color: var(--color-text-muted);
  font-style: italic;
}

/* Unavailable state */
.reply-card__original--unavailable {
  cursor: default;
}
.reply-card__original--unavailable:hover {
  border-color: #262626;
  background: #141414;
}
.reply-card__unavailable-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}
</style>
