
<template>
  <article class="dream-card" @click="openModal">
    <!-- ── Header: avatar · name · time · 3-dot menu ── -->
    <header class="dream-card__header">
      <!-- Avatar link: .stop prevents bubbling to any parent click handlers -->
      <div
        class="dream-card__avatar-link"
        :aria-label="`View ${user.display_name}'s profile`"
        role="link"
        style="cursor: pointer"
      >
        <div class="dream-card__avatar" :style="{ background: avatarBg }" @click.stop="navigateToProfile">
          {{ initials }}
        </div>
      </div>

      <div class="dream-card__meta">
        <div class="dream-card__name-row">
          <span class="dream-card__name" role="link" style="cursor: pointer" @click.stop="navigateToProfile">{{ user.display_name }}</span>
          <span class="dream-card__username" role="link" style="cursor: pointer" @click.stop="navigateToProfile">{{ user.username }}</span>
        </div>
        <span class="dream-card__time">{{ timestamp }}</span>
      </div>

      <div class="dream-card__badges">
        <span v-if="!dream.is_public" class="dream-card__private-badge" title="Private">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Private
        </span>
        <!-- "Edited" badge — visible when edit_history has at least one entry -->
        <span v-if="isEdited" class="dream-card__edited-badge" title="This post has been edited">
          Edited
        </span>
        <span class="dream-card__mood" :class="`dream-card__mood--${moodClass}`">
          {{ dream.mood_tag }}
        </span>
      </div>

      <!-- ── 3-dot owner menu ── -->
      <AppDropdown
        v-if="isOwner"
        :options="menuOptions"
        align="right"
        label="Post options"
        @select="handleMenuSelect"
      >
        <template #trigger="{ toggle }">
          <button
            :id="`post-menu-btn-${dream._id}`"
            class="dream-card__menu-btn"
            aria-label="Post options"
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

    <!-- ── Body: content OR inline editor ── -->
    <div class="dream-card__body">
      <!-- Inline edit mode -->
      <template v-if="editMode">
        <textarea
          :id="`edit-textarea-${dream._id}`"
          v-model="editContent"
          class="dream-card__edit-textarea"
          maxlength="2000"
          rows="4"
          :aria-label="`Edit dream content for ${dream._id}`"
        />
        <div class="dream-card__edit-actions">
          <span class="dream-card__edit-count">{{ editContent.length }} / 2000</span>
          <button
            :id="`edit-cancel-${dream._id}`"
            class="dream-card__edit-btn dream-card__edit-btn--cancel"
            :disabled="isSaving"
            @click="cancelEdit"
          >Cancel</button>
          <button
            :id="`edit-save-${dream._id}`"
            class="dream-card__edit-btn dream-card__edit-btn--save"
            :disabled="isSaving || !editContent.trim()"
            @click="saveEdit"
          >{{ isSaving ? 'Saving…' : 'Save' }}</button>
        </div>
      </template>

      <!-- Normal read mode -->
      <template v-else>
        <p class="dream-card__content" @click="openModal">
          <span>{{ displayContent }}</span>
          <button
            v-if="isTruncated"
            class="dream-card__see-more"
            :aria-label="`Read full dream by ${user.display_name}`"
            @click.stop="openModal"
          >...Xem thêm</button>
        </p>
      </template>
    </div>


    <!-- ── Oracle status ── -->
    <div v-if="!editMode && dream.ai_status" class="dream-card__oracle-wrap">
      <OracleAnalysisResult
        v-if="dream.ai_status === 'completed' && analysis"
        :analysis="analysis"
        compact
        @view-details="openModal"
      />
      <div v-else-if="dream.ai_status === 'pending'" class="dream-card__status-pending">
        <div class="spinner-small" aria-hidden="true"></div>
        <span>Oracle đang phân tích...</span>
      </div>
      <div v-else-if="dream.ai_status === 'failed'" class="dream-card__status-failed">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <span class="error-msg-text">Oracle chưa thể phân tích bài này</span>
        <button
          v-if="isOwner"
          type="button"
          class="retry-btn"
          @click.stop="retryAnalysis(dream._id)"
        >
          Thử lại
        </button>
      </div>
    </div>

    <!-- ── Footer: interactions ── -->
    <footer v-if="!editMode" class="dream-card__footer">
      <!-- Like button: filled #EF4444 heart when liked, outline when not -->
      <button
        :id="`like-btn-${dream._id}`"
        class="dream-card__action"
        :class="{ 'dream-card__action--liked': isLiked }"
        :aria-label="isLiked ? `Unlike — ${dream.likes_count} likes` : `Like — ${dream.likes_count} likes`"
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
        :aria-label="`Comment — ${dream.comments_count} comments`"
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
      title="Delete dream?"
      message="This action is permanent. Your dream and its Oracle analysis will be removed."
      confirm-label="Delete"
      :danger="true"
      :loading="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </article>
</template>

<script setup lang="ts">
import { ref, computed }     from 'vue'
import { useRouter } from 'vue-router'
import { timeAgo }           from '@/utils/timeAgo'
import { getInitials, getAvatarBg } from '@/data/mockUsers'
import { usePostStore }      from '@/store/usePostStore'
import { useDreamStore }     from '@/store/useDreamStore'
import { useAuthStore }      from '@/store/useAuthStore'
import { useOracleStore }    from '@/store/useOracleStore'
import apiClient             from '@/api/client'
import AppDropdown           from '@/components/common/AppDropdown.vue'
import AppConfirm            from '@/components/common/AppConfirm.vue'
import OracleAnalysisResult  from '@/components/common/OracleAnalysisResult.vue'
import type { DropdownOption } from '@/components/common/AppDropdown.vue'
import type { ApiDream }     from '@/api/types'
import type { User }         from '@/data/mockUsers'

const oracleStore = useOracleStore()

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

const props = defineProps<{ dream: ApiDream; user: User }>()
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
const timestamp = computed(() => timeAgo(props.dream.created_at))

const isOwner = computed(() => {
  const userId = typeof props.dream.userId === 'object'
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

const TRUNCATE_AT    = 200
const isTruncated    = computed(() => props.dream.content.length > TRUNCATE_AT)
const displayContent = computed(() =>
  isTruncated.value ? props.dream.content.slice(0, TRUNCATE_AT) : props.dream.content
)

function openModal() {
  if (editMode.value) return
  postStore.openPost(props.dream._id)
}

const moodClass = computed(() => props.dream.mood_tag.toLowerCase().replace(/\s+/g, '-'))

const analysis = computed(() => props.dream.ai_result ?? props.dream.aiAnalysis ?? null)

// ── 3-dot menu ───────────────────────────────────────────────────────────────

const menuOptions = computed((): DropdownOption[] => [
  {
    label: 'Edit Post',
    value: 'edit',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  },
  {
    label: props.dream.privacy === 'private' ? 'Make Public' : 'Make Private',
    value: 'privacy',
    icon:  props.dream.privacy === 'private'
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  },
  { divider: true } as any,
  {
    label:  'Delete',
    value:  'delete',
    danger: true,
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  },
])

async function handleMenuSelect(item: DropdownOption) {
  switch (item.value) {
    case 'edit':
      startEdit()
      break
    case 'privacy':
      await dreamStore.changePrivacy(
        props.dream._id,
        props.dream.privacy === 'private' ? 'public' : 'private'
      )
      break
    case 'delete':
      showDeleteConfirm.value = true
      break
  }
}

// ── Inline edit ───────────────────────────────────────────────────────────────

const editMode    = ref(false)
const editContent = ref('')
const isSaving    = ref(false)

function startEdit() {
  editContent.value = props.dream.content
  editMode.value    = true
}
function cancelEdit() {
  editMode.value    = false
  editContent.value = ''
}
async function saveEdit() {
  if (!editContent.value.trim() || isSaving.value) return
  isSaving.value = true
  try {
    await dreamStore.editDream(props.dream._id, editContent.value)
    editMode.value = false
  } finally {
    isSaving.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

const showDeleteConfirm = ref(false)
const isDeleting        = ref(false)

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

/* Mood tag */
.dream-card__mood {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  white-space: nowrap;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
}
.dream-card__mood--lucid         { background: #112136; color: #5b9cf6; border-color: #1e3a5f; }
.dream-card__mood--nightmare     { background: #2d1010; color: #ed4956; border-color: #3d1515; }
.dream-card__mood--calm          { background: #0e2a1c; color: #4ade80; border-color: #1a3d2e; }
.dream-card__mood--prophetic     { background: #1e1230; color: #a78bfa; border-color: #2d1f4a; }
.dream-card__mood--euphoric      { background: #2a1e08; color: #f59e0b; border-color: #3d2d10; }
.dream-card__mood--uncategorized { background: var(--color-bg-elevated); color: var(--color-text-muted); border-color: var(--color-border); }

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

/* ── Inline edit ── */
.dream-card__edit-textarea {
  width: 100%;
  min-height: 100px;
  background: var(--color-bg-elevated);
  border: 1px solid #3a3a3a;
  border-radius: var(--radius-md);
  padding: var(--space-3);
  font-size: var(--font-size-base);
  font-family: var(--font-family-base);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  resize: vertical;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}
.dream-card__edit-textarea:focus { border-color: #555; outline: none; }

.dream-card__edit-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  justify-content: flex-end;
}
.dream-card__edit-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-right: auto;
}

.dream-card__edit-btn {
  height: 30px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  font-family: var(--font-family-base);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background var(--transition-fast);
}
.dream-card__edit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.dream-card__edit-btn--cancel {
  background: #222;
  color: var(--color-text-secondary);
  border-color: #333;
}
.dream-card__edit-btn--cancel:hover:not(:disabled) { background: #2a2a2a; }

.dream-card__edit-btn--save {
  background: #ffffff;
  color: #101010;
}
.dream-card__edit-btn--save:hover:not(:disabled) { background: #e0e0e0; }

/* ── Oracle status ── */
.dream-card__oracle-wrap {
  margin: 0 var(--space-5) var(--space-3);
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
