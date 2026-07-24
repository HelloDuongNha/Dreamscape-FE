<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="postStore.focusedDream"
        id="post-detail-modal"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('home.dreamByAria', { name: postStore.focusedUser?.display_name || t('home.unknownUser') })"
        @keydown.esc="postStore.closePost()"
      >
        <div class="modal-container" tabindex="-1" ref="containerRef">

          <!-- ── Modal header: author + mood + close ── -->
          <div class="modal-header">
            <!-- Route by _id so ProfileView gets a valid MongoDB ObjectId -->
            <RouterLink
              :to="`/profile/${postStore.focusedUser?._id}`"
              class="modal-author"
              @click="postStore.closePost()"
            >
              <div class="modal-author__avatar" :style="{ background: avatarBg }" translate="no">
                {{ initials }}
              </div>
              <div class="modal-author__info" translate="no">
                <span class="modal-author__name">{{ postStore.focusedUser?.display_name }}</span>
                <span class="modal-author__username">@{{ postStore.focusedUser?.username }}</span>
              </div>
            </RouterLink>

            <div class="modal-header__right">
              <span v-if="modalMoodLabel" class="modal-mood" :class="`modal-mood--${moodClass}`">
                {{ modalMoodLabel }}
              </span>
              <button
                id="modal-close-btn"
                class="modal-close-btn"
                :aria-label="t('home.closeModal')"
                @click="postStore.closePost()"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- ── Unified Scrollable body: Post content + AI + Likes + Comments ── -->
          <div class="modal-body-scrollable" ref="bodyRef">

            <!-- Full dream content (un-truncated) -->
            <div class="modal-content-block">
              <p class="modal-content-text" translate="no">{{ postStore.focusedDream.content }}</p>
              <div
                v-for="(addition, idx) in postStore.focusedDream.additions || []"
                :key="`${addition.sequence}:${addition.addedAt}`"
                class="modal-dream-addition"
                :class="{ 'modal-dream-addition--unanalyzed': addition.analysisState === 'unanalyzed' }"
                translate="no"
              >
                <strong>{{ (postStore.focusedDream.additions?.length || 0) === 1 ? t('home.additionLabel') : t('home.numberedAdditionLabel', { number: idx + 1 }) }}</strong>
                <p>{{ addition.content }}</p>
                <div v-if="addition.analysisState === 'unanalyzed'" class="modal-dream-addition__warning">
                  <span>{{ t('home.additionNotAnalyzed') }}</span>
                  <AppButton
                    v-if="isOwner"
                    type="button"
                    variant="danger-outline"
                    size="sm"
                    :loading="isRetryingAnalysis"
                    @click.stop="retryAnalysis(postStore.focusedDream._id)"
                  >
                    {{ t('home.retryAdditionAnalysis') }}
                  </AppButton>
                </div>
              </div>
              <div v-if="isOwner" class="modal-addition-controls">
                <AppButton v-if="!showAdditionForm" variant="ghost" size="sm" @click="showAdditionForm = true">
                  {{ t('home.addDreamDetails') }}
                </AppButton>
                <template v-else>
                  <textarea
                    v-model="additionText"
                    class="modal-addition-textarea"
                    maxlength="2000"
                    rows="4"
                    :placeholder="t('home.addDreamDetailsPlaceholder')"
                    :aria-label="t('home.addDreamDetails')"
                    translate="no"
                  />
                  <div class="modal-addition-actions">
                    <span>{{ additionText.length }} / 2000</span>
                    <AppButton variant="ghost" size="sm" :disabled="isAddingDetail" @click="cancelAddition">{{ t('home.cancel') }}</AppButton>
                    <AppButton variant="primary" size="sm" :loading="isAddingDetail" :disabled="!additionText.trim()" @click="submitAddition">{{ t('home.addAndReanalyze') }}</AppButton>
                  </div>
                  <small>{{ t('home.addDreamDetailsNote') }}</small>
                </template>
              </div>
              <span class="modal-timestamp">{{ timestamp }}</span>
            </div>

            <!-- Oracle status / results -->
            <div v-if="postStore.focusedDream && postStore.focusedDream.ai_status" class="modal-oracle-wrap">
              <div v-if="postStore.focusedDream.ai_status === 'completed' && analysis" class="modal-oracle-expanded">
                <OracleAnalysisResult
                  :analysis="analysis"
                  :dream-id="postStore.focusedDream._id"
                  :show-hypothesis-actions="true"
                  mode="collapsed"
                />
              </div>
              <div v-else-if="postStore.focusedDream.ai_status === 'pending'" class="modal-oracle-pending">
                <div class="spinner-small" aria-hidden="true"></div>
                <span>{{ t('home.oracleAnalyzing') }}</span>
              </div>
              <div v-else-if="postStore.focusedDream.ai_status === 'failed' || postStore.focusedDream.ai_status === 'cancelled'" class="modal-oracle-failed">
                <span class="warning-icon" aria-hidden="true">⚠️</span>
                <span class="error-msg-text">{{ postStore.focusedDream.ai_status === 'cancelled' ? t('home.oracleCancelled') : t('home.oracleFailed') }}</span>
                <button
                  v-if="isOwner"
                  type="button"
                  class="retry-btn"
                  @click.stop="retryAnalysis(postStore.focusedDream._id)"
                >
                  {{ t('home.retry') }}
                </button>
              </div>
            </div>

            <!-- ── Like interaction row ── -->
            <div class="modal-interactions">
              <button
                id="modal-like-btn"
                class="modal-like-btn"
                :class="{ 'modal-like-btn--liked': isLiked }"
                :aria-label="isLiked ? t('home.unlikeDream') : t('home.likeDream')"
                :disabled="isLiking"
                @click="handleLike"
              >
                <!-- Filled heart when liked, outline when not -->
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  :fill="isLiked ? '#EF4444' : 'none'"
                  :stroke="isLiked ? '#EF4444' : 'currentColor'"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>{{ postStore.focusedDream.likes_count }}</span>
              </button>

              <!-- Edited badge -->
              <span
                v-if="isEdited"
                class="modal-edited-badge"
                :title="t('home.editedTitle')"
              >{{ t('home.edited') }}</span>
            </div>

            <!-- ── Comments section ── -->
            <div class="modal-comments-section">
              <h3 class="modal-comments-title">
                {{ t('home.comments') }}
                <span class="modal-comments-count">{{ postStore.focusedComments.length }}</span>
              </h3>

              <!-- Loading state -->
              <div v-if="postStore.isLoadingComments" class="modal-comments-loading">
                <span>{{ t('home.loadingComments') }}</span>
              </div>

              <!-- Comment list -->
              <template v-else>
                <!-- Empty state -->
                <div v-if="postStore.focusedComments.length === 0" class="modal-comments-empty">
                  {{ t('home.noComments') }}
                </div>

                <!-- Comment items -->
                <ul v-else class="modal-comments-list" :aria-label="t('home.commentsAria')">
                  <li
                    v-for="comment in postStore.focusedComments"
                    :key="comment._id"
                    class="modal-comment"
                  >
                    <div
                      class="modal-comment__avatar"
                      :style="{ background: getAvatarBg(comment.userId._id) }"
                      aria-hidden="true"
                      translate="no"
                    >
                      {{ getInitials(comment.userId.display_name) }}
                    </div>
                    <div class="modal-comment__body">
                      <div class="modal-comment__meta">
                        <RouterLink
                          :to="`/profile/${comment.userId._id}`"
                          class="modal-comment__name"
                          @click="postStore.closePost()"
                        >
                          <span translate="no">{{ comment.userId.display_name }}</span>
                        </RouterLink>
                        <span class="modal-comment__time">{{ timeAgo(comment.created_at, localeStore.currentLocale) }}</span>
                      </div>
                      <p class="modal-comment__text" translate="no">{{ comment.content }}</p>
                    </div>
                  </li>
                </ul>
              </template>
            </div>

          </div>

          <!-- ── Comment input (fixed at bottom) ── -->
          <div class="modal-input-bar">
            <div
              class="modal-input-avatar"
              :style="{ background: currentAvatarBg }"
              aria-hidden="true"
              translate="no"
            >
              {{ currentInitials }}
            </div>
            <input
              id="modal-comment-input"
              v-model="commentText"
              type="text"
              class="modal-input-field"
              :placeholder="t('home.commentPlaceholder')"
              maxlength="500"
              autocomplete="off"
              :disabled="isSubmitting"
              translate="no"
              @keydown.enter.prevent="submitComment"
            />
            <button
              id="modal-comment-submit"
              class="modal-input-submit"
              :disabled="!commentText.trim() || isSubmitting"
              :aria-label="t('home.postCommentAria')"
              @click="submitComment"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink }    from 'vue-router'
import { usePostStore }  from '@/store/usePostStore'
import { useDreamStore } from '@/store/useDreamStore'
import { useAuthStore }  from '@/store/useAuthStore'
import { useOracleStore } from '@/store/useOracleStore'
import { useLocaleStore } from '@/store/useLocaleStore'
import apiClient         from '@/api/client'
import { getInitials, getAvatarBg } from '@/data/mockUsers'
import { timeAgo }       from '@/utils/timeAgo'
import OracleAnalysisResult  from '@/components/common/OracleAnalysisResult.vue'
import AppButton from '@/components/common/AppButton.vue'

const postStore  = usePostStore()
const dreamStore = useDreamStore()
const authStore  = useAuthStore()
const oracleStore = useOracleStore()
const localeStore = useLocaleStore()
const { t } = useI18n({ useScope: 'global' })

const commentText  = ref('')
const isSubmitting = ref(false)
const isLiking     = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const bodyRef      = ref<HTMLElement | null>(null)
const showAdditionForm = ref(false)
const additionText = ref('')
const isAddingDetail = ref(false)
const isRetryingAnalysis = ref(false)

function cancelAddition() {
  showAdditionForm.value = false
  additionText.value = ''
}

async function submitAddition() {
  const dream = postStore.focusedDream
  if (!dream || !additionText.value.trim() || isAddingDetail.value) return
  isAddingDetail.value = true
  try {
    const updated = await dreamStore.appendDreamAddition(dream._id, additionText.value.trim())
    Object.assign(dream, updated)
    cancelAddition()
  } finally {
    isAddingDetail.value = false
  }
}

// ── Derived from focused post ─────────────────────────────────────────────────

const isOwner = computed(() => {
  if (!postStore.focusedDream) return false
  const userId = typeof postStore.focusedDream.userId === 'object' && postStore.focusedDream.userId !== null
    ? (postStore.focusedDream.userId as { _id: string })._id
    : postStore.focusedDream.userId
  return userId === authStore.myId
})

async function retryAnalysis(dreamId: string) {
  if (isRetryingAnalysis.value) return
  isRetryingAnalysis.value = true
  try {
    const { data } = await apiClient.post(`/dreams/${dreamId}/analyze`)
    if (data.success) {
      const currentUser = postStore.focusedDream?.userId
      if (postStore.focusedDream) {
        Object.assign(postStore.focusedDream, data.data, { userId: currentUser })
      }
      
      const idx = dreamStore.dreams.findIndex(d => d._id === dreamId)
      if (idx !== -1) {
        const storedUser = dreamStore.dreams[idx].userId
        dreamStore.dreams[idx] = { ...data.data, userId: storedUser }
      }
      
      oracleStore.startTracking(postStore.focusedDream || data.data)
    }
  } catch (err) {
    console.error('Failed to retry analysis:', err)
  } finally {
    isRetryingAnalysis.value = false
  }
}


// ── Derived from focused post ─────────────────────────────────────────────────


const initials  = computed(() => getInitials(postStore.focusedUser?.display_name ?? ''))
const avatarBg  = computed(() => getAvatarBg(postStore.focusedUser?._id ?? ''))
const timestamp = computed(() =>
  postStore.focusedDream ? timeAgo(postStore.focusedDream.created_at, localeStore.currentLocale) : ''
)
const analysis = computed(() => {
  const d = postStore.focusedDream
  if (!d) return null
  return d.ai_result ?? d.aiAnalysis ?? null
})
type EmotionToneKey = 'urgent_conflicted' | 'anxious' | 'fearful' | 'sad' | 'calm' | 'mixed' | 'neutral'
const emotionLabelKeys: Record<EmotionToneKey, string> = {
  urgent_conflicted: 'home.mood.urgentConflicted',
  anxious: 'home.mood.anxious',
  fearful: 'home.mood.fearful',
  sad: 'home.mood.sad',
  calm: 'home.mood.calm',
  mixed: 'home.mood.mixed',
  neutral: 'home.mood.neutral',
}

const emotionToneKey = computed<EmotionToneKey>(() => {
  const explicit = analysis.value?.emotional_tone_key
  if (explicit && explicit in emotionLabelKeys) return explicit
  const legacy = `${analysis.value?.emotional_tone || postStore.focusedDream?.mood_tag || ''}`.toLocaleLowerCase('vi')
  if (/gấp|bối rối/.test(legacy)) return 'urgent_conflicted'
  if (/lo âu|lo lắng|anx/.test(legacy)) return 'anxious'
  if (/sợ|fear|hoảng/.test(legacy)) return 'fearful'
  if (/buồn|tiếc|sad|regret/.test(legacy)) return 'sad'
  if (/bình yên|calm|thư thái/.test(legacy)) return 'calm'
  if (/đan xen|mixed/.test(legacy)) return 'mixed'
  return 'neutral'
})
const modalMoodLabel = computed(() => t(emotionLabelKeys[emotionToneKey.value]))
const moodClass = computed(() => emotionToneKey.value.replace(/_/g, '-'))
const isEdited = computed(() =>
  (postStore.focusedDream?.edit_history?.length ?? 0) > 0
)

// ── Like state ────────────────────────────────────────────────────────────────

const isLiked = computed(() => {
  const likes = postStore.focusedDream?.likes
  return Array.isArray(likes) && likes.includes(authStore.myId)
})

async function handleLike(): Promise<void> {
  if (!postStore.focusedDream || isLiking.value) return
  isLiking.value = true
  try {
    await dreamStore.toggleLike(postStore.focusedDream._id)
  } finally {
    isLiking.value = false
  }
}

// ── Current user for the comment bar ─────────────────────────────────────────

const currentInitials = computed(() =>
  getInitials(authStore.myUser?.display_name ?? '?')
)
const currentAvatarBg = computed(() =>
  getAvatarBg(authStore.myId)
)

// ── Submit comment ────────────────────────────────────────────────────────────

async function submitComment(): Promise<void> {
  if (!commentText.value.trim() || isSubmitting.value) return
  isSubmitting.value = true
  try {
    await postStore.addComment(commentText.value)
    commentText.value = ''
    // Scroll to bottom of comment list
    nextTick(() => {
      if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
    })
  } finally {
    isSubmitting.value = false
  }
}

// ── Focus trap + scroll reset ─────────────────────────────────────────────────

watch(() => postStore.focusedId, (val) => {
  if (val) {
    nextTick(() => {
      containerRef.value?.focus()
      if (bodyRef.value) bodyRef.value.scrollTop = 0
    })
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
    commentText.value = ''
  }
})
</script>

<style scoped>
/* ── Overlay ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  z-index: var(--z-modal, 300);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

/* ── Container ── */
.modal-container {
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-xl);
  width: 760px;
  max-width: calc(100vw - 32px);
  height: 80vh;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  outline: none;
  overflow: hidden;
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid #262626;
  flex-shrink: 0;
}

.modal-author {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
  min-width: 0;
}
.modal-author__avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
}
.modal-author__info  { display: flex; flex-direction: column; min-width: 0; }
.modal-author__name  { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); white-space: nowrap; }
.modal-author__username { font-size: var(--font-size-xs); color: var(--color-text-muted); }

.modal-header__right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

/* Mood tag */
.modal-mood {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  white-space: nowrap;
  background: #262626;
  color: var(--color-text-secondary);
}
.modal-mood--lucid       { background: #112136; color: #5b9cf6; border-color: #1e3a5f; }
.modal-mood--nightmare   { background: #2d1010; color: #ed4956; border-color: #3d1515; }
.modal-mood--calm        { background: #0e2a1c; color: #4ade80; border-color: #1a3d2e; }
.modal-mood--prophetic   { background: #1e1230; color: #a78bfa; border-color: #2d1f4a; }
.modal-mood--euphoric    { background: #2a1e08; color: #f59e0b; border-color: #3d2d10; }
.modal-mood--urgent-conflicted { background: #2a1e08; color: #f5c36a; border-color: #4a3514; }
.modal-mood--anxious,
.modal-mood--fearful { background: #2d1010; color: #f19a9f; border-color: #4b2024; }
.modal-mood--sad { background: #24182f; color: #c9a7e8; border-color: #3b2850; }
.modal-mood--mixed { background: #171e30; color: #aab9e8; border-color: #293654; }
.modal-mood--neutral { background: #242424; color: #b8b8b8; border-color: #343434; }

.modal-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.modal-close-btn:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }

/* ── Unified scrollable body ── */
.modal-body-scrollable {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #2a2a2a transparent;
}
.modal-body-scrollable::-webkit-scrollbar        { width: 4px; }
.modal-body-scrollable::-webkit-scrollbar-track  { background: transparent; }
.modal-body-scrollable::-webkit-scrollbar-thumb  { background: #2a2a2a; border-radius: 4px; }

/* ── Full dream content ── */
.modal-content-block {
  padding: var(--space-5);
  border-bottom: 1px solid #262626;
}
.modal-content-text {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: var(--space-2);
}
.modal-dream-addition {
  margin: var(--space-4) 0;
  padding: var(--space-4);
  border-left: 2px solid rgba(129, 140, 248, .6);
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  background: rgba(99, 102, 241, .07);
}
.modal-dream-addition strong {
  display: block;
  margin-bottom: var(--space-2);
  color: #a5b4fc;
  font-size: var(--font-size-xs);
}
.modal-dream-addition p {
  margin: 0;
  white-space: pre-wrap;
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
}
.modal-dream-addition--unanalyzed {
  border: 1px solid rgba(237, 73, 86, .7);
  border-left-width: 3px;
  border-radius: var(--radius-lg);
  background: rgba(237, 73, 86, .07);
}
.modal-dream-addition--unanalyzed strong {
  color: #ff8a95;
}
.modal-dream-addition__warning {
  display: grid;
  justify-items: end;
  gap: var(--space-3);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid rgba(237, 73, 86, .24);
}
.modal-dream-addition__warning > span {
  width: 100%;
  color: #ff9aa3;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-relaxed);
}
.modal-addition-controls {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  margin: var(--space-3) 0;
}
.modal-addition-textarea {
  width: 100%;
  resize: vertical;
  padding: var(--space-3);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  font: inherit;
  line-height: 1.6;
}
.modal-addition-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  width: 100%;
}
.modal-addition-actions > span,
.modal-addition-controls > small {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.modal-addition-actions > span { margin-right: auto; }
.modal-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* ── Oracle status ── */
.modal-oracle-wrap {
  border-bottom: 1px solid #262626;
}
.modal-oracle-expanded {
  padding: var(--space-5);
  background: #141414;
}
.modal-oracle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: #141414;
}
.modal-oracle__icon { font-size: var(--font-size-sm); color: var(--color-text-muted); flex-shrink: 0; }
.modal-oracle__text {
  display: flex;
  align-items: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
}
.status-label {
  margin-right: var(--space-2);
}

.modal-oracle-pending {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #141414;
  font-size: 12px;
  color: var(--color-text-muted);
}

.modal-oracle-failed {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #2d1010;
  border-top: 1px solid #3d1515;
  border-bottom: 1px solid #3d1515;
  font-size: 12px;
  color: #ed4956;
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ── Like interaction row ── */
.modal-interactions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid #262626;
}

.modal-like-btn {
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
  font-family: var(--font-family-base);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.modal-like-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}
.modal-like-btn--liked {
  color: #EF4444;
}
.modal-like-btn--liked:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.08);
  color: #EF4444;
}
.modal-like-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-edited-badge {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  border: 1px solid #333;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-style: italic;
}

/* ── Comments section ── */
.modal-comments-section {
  padding: var(--space-4) var(--space-5) var(--space-6);
  border-top: 1px solid #262626;
}

.modal-comments-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.modal-comments-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: #262626;
  border-radius: var(--radius-full);
  padding: 1px 7px;
}

.modal-comments-loading {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-6) 0;
  font-style: italic;
}

.modal-comments-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.modal-comments-empty {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-10) var(--space-6);
  font-style: italic;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

/* Single comment */
.modal-comment {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}
.modal-comment__avatar {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
}
.modal-comment__body { flex: 1; min-width: 0; }
.modal-comment__meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin-bottom: 3px;
}
.modal-comment__name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-decoration: none;
}
.modal-comment__name:hover { text-decoration: underline; }
.modal-comment__time { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.modal-comment__text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  word-break: break-word;
}

/* ── Comment input bar (fixed bottom) ── */
.modal-input-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid #262626;
  background: #181818;
  flex-shrink: 0;
}
.modal-input-avatar {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
}
.modal-input-field {
  flex: 1;
  height: 36px;
  background: #242424;
  border: 1px solid #2e2e2e;
  border-radius: var(--radius-lg);
  padding: 0 var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  transition: border-color var(--transition-fast);
  min-width: 0;
}
.modal-input-field::placeholder { color: var(--color-text-muted); }
.modal-input-field:focus         { border-color: #3a3a3a; outline: none; }
.modal-input-field:disabled      { opacity: 0.5; }

.modal-input-submit {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--transition-fast);
}
.modal-input-submit:not(:disabled)       { color: var(--color-text-primary); }
.modal-input-submit:disabled             { opacity: 0.3; cursor: not-allowed; }
.modal-input-submit:not(:disabled):hover { color: #fff; }

/* ── Transition ── */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.18s ease; }
.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container          { transition: transform 0.18s ease, opacity 0.18s ease; }
.modal-fade-enter-from { opacity: 0; }
.modal-fade-leave-to   { opacity: 0; }
.modal-fade-enter-from .modal-container { transform: translateY(12px); opacity: 0; }
.modal-fade-leave-to   .modal-container { transform: translateY(12px); opacity: 0; }
</style>
