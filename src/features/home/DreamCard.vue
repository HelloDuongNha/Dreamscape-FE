
<template>
  <article class="dream-card" @click="openModal">
    <!-- ── Header: avatar · name · time · 3-dot menu ── -->
    <header class="dream-card__header">
      <!-- Avatar link: .stop prevents bubbling to any parent click handlers -->
      <div
        class="dream-card__avatar-link"
        :aria-label="t('home.viewProfileAria', { name: user.display_name })"
        role="link"
        style="cursor: pointer"
      >
        <div class="dream-card__avatar" :style="{ background: avatarBg }" translate="no" @click.stop="navigateToProfile">
          {{ initials }}
        </div>
      </div>

      <div class="dream-card__meta">
        <div class="dream-card__name-row">
          <span class="dream-card__name" role="link" style="cursor: pointer" translate="no" @click.stop="navigateToProfile">{{ user.display_name }}</span>
          <span class="dream-card__username" role="link" style="cursor: pointer" translate="no" @click.stop="navigateToProfile">{{ user.username }}</span>
        </div>
        <span class="dream-card__time">{{ timestamp }}</span>
      </div>

      <div class="dream-card__badges">
        <span v-if="!dream.is_public" class="dream-card__private-badge" :title="t('home.privateBadgeTitle')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          {{ t('home.private') }}
        </span>
        <!-- "Edited" badge — visible when edit_history has at least one entry -->
        <span v-if="isEdited" class="dream-card__edited-badge" :title="t('home.editedTitle')">
          {{ t('home.edited') }}
        </span>
        <span v-if="dream.additions?.length" class="dream-card__edited-badge">
          {{ t('home.additionsCount', { count: dream.additions.length }) }}
        </span>
        <DreamMoodTag
          v-if="moodLabel"
          :label="moodLabel"
          :valence="analysis?.emotional_valence"
          :tone-key="analysis?.emotional_tone_key"
        />
      </div>

      <!-- ── 3-dot owner menu ── -->
      <AppDropdown
        v-if="isOwner"
        :options="menuOptions"
        align="right"
        :label="t('home.postOptions')"
        @select="handleMenuSelect"
      >
        <template #trigger="{ toggle }">
          <button
            :id="`post-menu-btn-${dream._id}`"
            class="dream-card__menu-btn"
            :aria-label="t('home.postOptions')"
            aria-haspopup="true"
            @click.stop="toggle"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.8"/>
              <circle cx="12" cy="12" r="1.8"/>
              <circle cx="12" cy="19" r="1.8"/>
            </svg>
          </button>
        </template>
      </AppDropdown>
    </header>

    <!-- ── Body ── -->
    <div class="dream-card__body">
      <p class="dream-card__content" @click="openModal">
        <span v-if="dreamExcerpt.clippedBefore" aria-hidden="true">…</span>
        <template v-for="(segment, index) in dreamExcerpt.segments" :key="index">
          <mark v-if="segment.highlighted" class="dream-card__highlight" translate="no">
            {{ segment.text }}
          </mark>
          <span v-else translate="no">{{ segment.text }}</span>
        </template>
        <button
          v-if="dreamExcerpt.clippedAfter"
          class="dream-card__see-more"
          :aria-label="t('home.readFullDreamAria', { name: user.display_name })"
          @click.stop="openModal"
        >…{{ t('home.seeMore') }}</button>
      </p>
    </div>

    <div
      v-if="presentedCommentMatches.length"
      class="dream-card__search-comments"
      :aria-label="t('home.matchedComments')"
    >
      <div class="dream-card__search-comments-label">
        {{ t('home.matchedComments') }}
      </div>
      <article
        v-for="comment in presentedCommentMatches"
        :key="comment._id"
        class="dream-card__search-comment"
      >
        <span class="dream-card__search-comment-author" translate="no">
          {{ comment.user?.display_name || t('home.unknownUser') }}
        </span>
        <p>
          <span v-if="comment.excerpt.clippedBefore" aria-hidden="true">…</span>
          <template v-for="(segment, index) in comment.excerpt.segments" :key="index">
            <mark v-if="segment.highlighted" class="dream-card__highlight" translate="no">
              {{ segment.text }}
            </mark>
            <span v-else translate="no">{{ segment.text }}</span>
          </template>
          <span v-if="comment.excerpt.clippedAfter" aria-hidden="true">…</span>
        </p>
      </article>
      <span
        v-if="matchedCommentCount > presentedCommentMatches.length"
        class="dream-card__search-comments-more"
      >
        {{ t('home.moreMatchedComments', { count: matchedCommentCount - presentedCommentMatches.length }) }}
      </span>
    </div>


    <!-- ── Oracle status ── -->
    <div v-if="dream.ai_status" class="dream-card__oracle-wrap">
      <div v-if="dream.ai_analysis_enabled === false" class="dream-card__ai-disabled">
        <span aria-hidden="true">◈</span>
        <span>{{ t('home.aiAnalysisDisabled') }}</span>
      </div>
      <OracleAnalysisResult
        v-else-if="dream.ai_status === 'completed' && analysis"
        :analysis="analysis"
        compact
        @view-details="openModal"
      />
      <div v-else-if="dream.ai_status === 'pending'" class="dream-card__status-pending">
        <div class="spinner-small" aria-hidden="true"></div>
        <span>{{ t('home.oracleAnalyzing') }}</span>
      </div>
      <div v-else-if="dream.ai_status === 'failed' || dream.ai_status === 'cancelled'" class="dream-card__status-failed">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <span class="error-msg-text">{{ dream.ai_status === 'cancelled' ? t('home.oracleCancelled') : t('home.oracleFailed') }}</span>
        <button
          v-if="isOwner"
          type="button"
          class="retry-btn"
          @click.stop="retryAnalysis(dream._id)"
        >
          {{ t('home.retry') }}
        </button>
      </div>
    </div>

    <!-- ── Footer: interactions ── -->
    <footer class="dream-card__footer">
      <!-- Like button: filled #EF4444 heart when liked, outline when not -->
      <button
        :id="`like-btn-${dream._id}`"
        class="dream-card__action"
        :class="{ 'dream-card__action--liked': isLiked }"
        :aria-label="isLiked ? t('home.unlikeCountAria', { count: dream.likes_count }) : t('home.likeCountAria', { count: dream.likes_count })"
        :disabled="isLiking"
        @click.stop="handleLike"
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24"
          :fill="isLiked ? '#EF4444' : 'none'"
          :stroke="isLiked ? '#EF4444' : 'currentColor'"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span>{{ dream.likes_count }}</span>
      </button>

      <button
        :id="`comment-btn-${dream._id}`"
        class="dream-card__action"
        :aria-label="t('home.commentCountAria', { count: dream.comments_count })"
        @click.stop="openModal"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>{{ dream.comments_count }}</span>
      </button>
    </footer>

    <!-- ── Delete confirmation modal ── -->
    <AppConfirm
      v-model="showDeleteConfirm"
      :title="t('home.deleteDreamTitle')"
      :message="t('home.deleteDreamMessage')"
      :confirm-label="t('home.delete')"
      :danger="true"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />
    <AppConfirm
      v-model="showDisableAiConfirm"
      :title="t('home.disableAiTitle')"
      :message="t('home.disableAiMessage')"
      :secondary-label="t('home.keepAiResult')"
      :confirm-label="t('home.deleteAiResult')"
      :danger="true"
      :loading="isUpdatingAi"
      @secondary="disableAiAnalysis('keep')"
      @confirm="disableAiAnalysis('delete')"
      @cancel="showDisableAiConfirm = false"
    />
  </article>
</template>

<script setup lang="ts">
import { ref, computed }     from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { timeAgo }           from '@/utils/timeAgo'
import { getInitials, getAvatarBg } from '@/data/mockUsers'
import { usePostStore }      from '@/store/usePostStore'
import { useDreamStore }     from '@/store/useDreamStore'
import { useAuthStore }      from '@/store/useAuthStore'
import { useOracleStore }    from '@/store/useOracleStore'
import { useLocaleStore }    from '@/store/useLocaleStore'
import apiClient             from '@/api/client'
import AppDropdown           from '@/components/common/AppDropdown.vue'
import AppConfirm            from '@/components/common/AppConfirm.vue'
import OracleAnalysisResult  from '@/components/common/OracleAnalysisResult.vue'
import DreamMoodTag          from '@/components/common/DreamMoodTag.vue'
import type { DropdownOption } from '@/components/common/AppDropdown.vue'
import type {
  ApiDream,
  DreamSearchCommentMatch,
  SearchTextRange,
} from '@/api/types'
import type { User }         from '@/data/mockUsers'
import { createHighlightedExcerpt } from '@/utils/highlightText'

const oracleStore = useOracleStore()
const localeStore = useLocaleStore()
const { t } = useI18n({ useScope: 'global' })

async function retryAnalysis(dreamId: string) {
  try {
    const { data } = await apiClient.post(`/dreams/${dreamId}/analyze`)
    if (data.success) {
      props.dream.ai_status = 'pending'
      
      const idx = dreamStore.dreams.findIndex(d => d._id === dreamId)
      if (idx !== -1) {
        dreamStore.dreams[idx].ai_status = 'pending'
      }
      
      oracleStore.startTracking(data.data)
    }
  } catch (err) {
    console.error('Failed to retry analysis:', err)
  }
}

const router = useRouter()

function navigateToProfile() {
  router.push('/profile/' + props.user._id)
}

// ── Props & Emits ─────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  dream: ApiDream
  user: User
  contentHighlights?: SearchTextRange[]
  matchedComments?: DreamSearchCommentMatch[]
  matchedCommentCount?: number
}>(), {
  contentHighlights: () => [],
  matchedComments: () => [],
  matchedCommentCount: 0,
})
const emit  = defineEmits<{
  delete: [dreamId: string]
}>()

// ── Stores ────────────────────────────────────────────────────────────────────

const postStore  = usePostStore()
const dreamStore = useDreamStore()
const authStore  = useAuthStore()

// ── Computed ─────────────────────────────────────────────────────────────────

const initials  = computed(() => getInitials(props.user.display_name))
const avatarBg  = computed(() => getAvatarBg(props.user._id))
const timestamp = computed(() => timeAgo(props.dream.created_at, localeStore.currentLocale))

const isOwner = computed(() => {
  const userId = typeof props.dream.userId === 'object' && props.dream.userId !== null
    ? (props.dream.userId as { _id: string })._id
    : props.dream.userId
  return userId === authStore.myId
})

const isEdited = computed(() =>
  Array.isArray(props.dream.edit_history) && props.dream.edit_history.length > 0
)


// ── Like state ────────────────────────────────────────────────────────────────

/** True when the authenticated user's ID is in the dream's likes array */
const isLiked = computed(() =>
  Array.isArray(props.dream.likes) && props.dream.likes.includes(authStore.myId)
)

const isLiking = ref(false)

async function handleLike(): Promise<void> {
  if (isLiking.value) return
  isLiking.value = true
  try {
    await dreamStore.toggleLike(props.dream._id)
  } finally {
    isLiking.value = false
  }
}

// ── Content truncation ────────────────────────────────────────────────────────

const dreamExcerpt = computed(() =>
  createHighlightedExcerpt(props.dream.content, props.contentHighlights, 240)
)
const presentedCommentMatches = computed(() =>
  props.matchedComments.map(comment => ({
    ...comment,
    excerpt: createHighlightedExcerpt(comment.content, comment.ranges, 240),
  }))
)

function openModal() {
  postStore.openPost(props.dream._id)
}

const analysis = computed(() => props.dream.ai_result ?? props.dream.aiAnalysis ?? null)
const moodLabel = computed(() =>
  String(analysis.value?.emotional_tone || props.dream.mood_tag || '').trim()
)

// ── 3-dot menu ───────────────────────────────────────────────────────────────

const menuOptions = computed((): DropdownOption[] => {
  const options: DropdownOption[] = [{
    label: t('home.editPost'),
    value: 'edit',
    disabled: props.dream.ai_status === 'pending',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  },
  {
    label: props.dream.privacy === 'private' ? t('home.makePublic') : t('home.makePrivate'),
    value: 'privacy',
    icon:  props.dream.privacy === 'private'
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  }]

  options.push({
    label: props.dream.ai_analysis_enabled === false
      ? t('home.enableAiAnalysis')
      : t('home.disableAiAnalysis'),
    value: 'ai-toggle',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v3"/><path d="M18.4 5.6l-2.1 2.1"/><path d="M21 12h-3"/><path d="M5 12H2"/><path d="M7.7 7.7 5.6 5.6"/><circle cx="12" cy="12" r="4"/><path d="M8 21h8"/></svg>`,
  })

  if (props.dream.ai_analysis_enabled !== false) {
    options.push({
      label: t('home.reanalyze'),
      value: 'reanalyze',
      disabled: props.dream.ai_status === 'pending',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>`,
    })
  }

  options.push(
    { divider: true } as any,
  {
    label:  t('home.delete'),
    value:  'delete',
    danger: true,
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  })
  return options
})

async function handleMenuSelect(item: DropdownOption) {
  switch (item.value) {
    case 'edit':
      await postStore.openPost(props.dream._id, { edit: true })
      break
    case 'privacy':
      await dreamStore.changePrivacy(
        props.dream._id,
        props.dream.privacy === 'private' ? 'public' : 'private'
      )
      break
    case 'ai-toggle':
      await toggleAiAnalysis()
      break
    case 'reanalyze':
      await retryAnalysis(props.dream._id)
      break
    case 'delete':
      showDeleteConfirm.value = true
      break
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

const showDeleteConfirm = ref(false)
const isDeleting        = ref(false)
const showDisableAiConfirm = ref(false)
const isUpdatingAi = ref(false)

async function toggleAiAnalysis() {
  if (isUpdatingAi.value) return
  if (props.dream.ai_analysis_enabled === false) {
    isUpdatingAi.value = true
    try {
      await dreamStore.setAiAnalysis(props.dream._id, true)
    } finally {
      isUpdatingAi.value = false
    }
    return
  }

  if (analysis.value) {
    showDisableAiConfirm.value = true
    return
  }
  await disableAiAnalysis('delete')
}

async function disableAiAnalysis(resultPolicy: 'keep' | 'delete') {
  if (isUpdatingAi.value) return
  isUpdatingAi.value = true
  try {
    await dreamStore.setAiAnalysis(props.dream._id, false, resultPolicy)
    showDisableAiConfirm.value = false
  } finally {
    isUpdatingAi.value = false
  }
}

async function confirmDelete() {
  if (isDeleting.value) return
  isDeleting.value = true
  try {
    await dreamStore.removeDream(props.dream._id)
    showDeleteConfirm.value = false
    emit('delete', props.dream._id)
  } finally {
    isDeleting.value = false
  }
}
</script>

<style scoped>
/* ── Shell ── */
.dream-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: visible;
  position: relative;
  cursor: pointer;
}


/* ── Header ── */
.dream-card__header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5) 0;
  position: relative;
}

.dream-card__avatar-link {
  display: inline-flex;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  text-decoration: none;
}

.dream-card__avatar {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: #ffffff;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.dream-card__meta {
  flex: 1;
  min-width: 0;
}
.dream-card__name-link  { text-decoration: none; }
.dream-card__name-row   { display: flex; align-items: baseline; gap: var(--space-2); flex-wrap: wrap; }
.dream-card__name       { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); white-space: nowrap; }
.dream-card__username   { font-size: var(--font-size-sm); color: var(--color-text-muted); white-space: nowrap; }
.dream-card__time       { display: block; font-size: var(--font-size-xs); color: var(--color-text-muted); margin-top: 2px; }

/* Badges */
.dream-card__badges {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.dream-card__private-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  padding: 2px 7px;
  border-radius: var(--radius-full);
}

/* "Edited" badge — flat, muted, no glow */
.dream-card__edited-badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid #333;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-style: italic;
}

/* 3-dot button */
.dream-card__menu-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.dream-card__menu-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}


/* ── Body ── */
.dream-card__body {
  padding: var(--space-3) var(--space-5);
}

.dream-card__content {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  cursor: pointer;
}

.dream-card__see-more {
  display: inline;
  background: none;
  border: none;
  padding: 0;
  margin-left: 2px;
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: var(--font-family-base);
  line-height: inherit;
  transition: color var(--transition-fast);
}
.dream-card__see-more:hover { color: var(--color-text-secondary); }
.dream-card__highlight {
  border-radius: 2px;
  background: #5a5127;
  color: var(--color-text-primary);
  box-decoration-break: clone;
  padding: 0 1px;
}
.dream-card__search-comments {
  display: grid;
  gap: 8px;
  margin: 0 var(--space-5) var(--space-3);
  padding: 10px 12px;
  border-left: 2px solid #3a3a3a;
  background: #151515;
}
.dream-card__search-comments-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}
.dream-card__search-comment {
  display: grid;
  gap: 2px;
}
.dream-card__search-comment-author {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}
.dream-card__search-comment p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
}
.dream-card__search-comments-more {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* ── Oracle status ── */
.dream-card__oracle-wrap {
  margin: 0 var(--space-5) var(--space-3);
}
.dream-card__ai-disabled {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.dream-card__status-pending {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #141414;
  border: 1px solid #262626;
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--color-text-muted);
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid #262626;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.dream-card__status-failed {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #2d1010;
  border: 1px solid #3d1515;
  border-radius: var(--radius-md);
  font-size: 12px;
  color: #ed4956;
  width: 100%;
  box-sizing: border-box;
}

.retry-btn {
  background: #3d1515;
  border: 1px solid #ed4956;
  border-radius: 4px;
  color: #ed4956;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  margin-left: auto;
  transition: background 0.15s, color 0.15s;
}

.retry-btn:hover {
  background: #ed4956;
  color: #fff;
}

/* ── Footer ── */
.dream-card__footer {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4) var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
}

.dream-card__action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.dream-card__action:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}
.dream-card__action:disabled { opacity: 0.5; cursor: not-allowed; }
.dream-card__action span { font-size: var(--font-size-sm); line-height: 1; }

/* Liked state — solid red, no blur/gradient */
.dream-card__action--liked       { color: #EF4444; }
.dream-card__action--liked:hover { background: rgba(239, 68, 68, 0.08); color: #EF4444; }
</style>
