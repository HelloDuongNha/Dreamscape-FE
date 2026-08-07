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
              <UserAvatar
                v-if="postStore.focusedUser"
                :user="postStore.focusedUser"
                size="sm"
                show-streak
                class="modal-author__avatar"
              />
              <div class="modal-author__info" translate="no">
                <span class="modal-author__name">{{ postStore.focusedUser?.display_name }}</span>
                <span class="modal-author__username">{{ formatUsername(postStore.focusedUser?.username) }}</span>
              </div>
            </RouterLink>

            <div class="modal-header__right">
              <span
                v-if="postStore.focusedDream.privacy === 'private' || postStore.focusedDream.is_public === false"
                class="modal-private-badge"
                :title="t('home.privateBadgeTitle')"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                {{ t('home.private') }}
              </span>
              <DreamMoodTag
                v-if="modalMoodLabel"
                :label="modalMoodLabel"
                :valence="analysis?.emotional_valence"
                :tone-key="analysis?.emotional_tone_key"
              />
              <AppDropdown
                v-if="isOwner"
                :options="modalMenuOptions"
                align="right"
                :label="t('home.postOptions')"
                @select="handleModalMenuSelect"
              >
                <template #trigger="{ toggle, isOpen, panelId }">
                  <button
                    type="button"
                    class="modal-menu-btn"
                    :aria-label="t('home.postOptions')"
                    aria-haspopup="menu"
                    :aria-expanded="isOpen"
                    :aria-controls="isOpen ? panelId : undefined"
                    @click.stop="toggle"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
                    </svg>
                  </button>
                </template>
              </AppDropdown>
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
              <template v-if="isContextEditing">
                <label class="modal-edit-label" for="modal-dream-context">{{ t('home.dreamContext') }}</label>
                <textarea
                  id="modal-dream-context"
                  v-model="editContextContent"
                  class="modal-context-editor"
                  maxlength="2000"
                  rows="6"
                  :aria-label="t('home.editDreamAria')"
                  translate="no"
                />

                <div
                  v-for="(addition, idx) in editContextAdditions"
                  :key="addition.clientId"
                  class="modal-dream-addition modal-dream-addition--editing"
                >
                  <div class="modal-dream-addition__header">
                    <strong>{{ editContextAdditions.length === 1 ? t('home.additionLabel') : t('home.numberedAdditionLabel', { number: idx + 1 }) }}</strong>
                  </div>
                  <textarea
                    v-model="addition.content"
                    class="modal-addition-textarea"
                    maxlength="2000"
                    rows="3"
                    :placeholder="t('home.addDreamDetailsPlaceholder')"
                    translate="no"
                  />
                  <div class="modal-addition-delete-action">
                    <AppButton
                      type="button"
                      variant="danger-outline"
                      size="sm"
                      @click="requestDraftAdditionDelete(idx)"
                    >
                      {{ t('home.deleteAddition') }}
                    </AppButton>
                  </div>
                </div>

                <AppButton
                  v-if="editContextAdditions.length < 10"
                  variant="ghost"
                  size="sm"
                  @click="addDraftAddition"
                >
                  {{ t('home.addDreamDetails') }}
                </AppButton>

                <div class="modal-context-edit-actions">
                  <span>{{ editContextContent.length }} / 2000</span>
                  <AppButton variant="ghost" size="sm" :disabled="isSavingContext" @click="cancelContextEdit">{{ t('home.cancel') }}</AppButton>
                  <AppButton
                    variant="primary"
                    size="sm"
                    :loading="isSavingContext"
                    :disabled="!canSaveContext"
                    @click="saveContextEdit"
                  >
                    {{ t('home.saveAndReanalyze') }}
                  </AppButton>
                </div>
              </template>

              <template v-else>
                <p v-if="displayedVersion?.isLegacyPartial" class="modal-version-legacy-note">
                  {{ t('home.legacyVersionPartial') }}
                </p>
                <p class="modal-content-text" translate="no">{{ displayedVersion?.content }}</p>
                <div
                  v-for="(addition, idx) in displayedVersion?.additions || []"
                  :key="`${addition.sequence}:${addition.addedAt}`"
                  class="modal-dream-addition"
                  :class="{ 'modal-dream-addition--unanalyzed': addition.analysisState === 'unanalyzed' }"
                  translate="no"
                >
                  <strong>{{ (displayedVersion?.additions?.length || 0) === 1 ? t('home.additionLabel') : t('home.numberedAdditionLabel', { number: idx + 1 }) }}</strong>
                  <p>{{ addition.content }}</p>
                  <div v-if="addition.analysisState === 'unanalyzed'" class="modal-dream-addition__warning">
                    <span>{{ t('home.additionNotAnalyzed') }}</span>
                    <AppButton
                      v-if="isOwner && isCurrentVersion"
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

                <nav
                  v-if="dreamVersions.length > 1"
                  class="modal-version-nav"
                  :aria-label="t('home.versionHistory')"
                >
                  <button type="button" :aria-label="t('home.previousVersion')" :disabled="selectedVersionIndex === 0" @click="selectedVersionIndex--">‹</button>
                  <span>{{ selectedVersionIndex + 1 }} / {{ dreamVersions.length }}</span>
                  <button type="button" :aria-label="t('home.nextVersion')" :disabled="selectedVersionIndex === dreamVersions.length - 1" @click="selectedVersionIndex++">›</button>
                </nav>
              </template>
              <span class="modal-timestamp">{{ timestamp }}</span>
            </div>

            <!-- Oracle status / results -->
            <div v-if="displayedVersion?.ai_status" class="modal-oracle-wrap">
              <div
                v-if="isCurrentVersion && postStore.focusedDream.ai_analysis_enabled === false"
                class="modal-oracle-disabled"
              >
                <span aria-hidden="true">◈</span>
                <span>{{ t('home.aiAnalysisDisabled') }}</span>
              </div>
              <div v-else-if="displayedVersion.ai_status === 'completed' && analysis" class="modal-oracle-expanded">
                <OracleAnalysisResult
                  :analysis="analysis"
                  :dream-id="postStore.focusedDream._id"
                  :can-manage-continuation="isOwner && isCurrentVersion"
                  :show-hypothesis-actions="isOwner && isCurrentVersion"
                  mode="collapsed"
                />
              </div>
              <div v-else-if="displayedVersion.ai_status === 'pending'" class="modal-oracle-pending">
                <div class="spinner-small" aria-hidden="true"></div>
                <span>{{ t('home.oracleAnalyzing') }}</span>
              </div>
              <div v-else-if="displayedVersion.ai_status === 'failed' || displayedVersion.ai_status === 'cancelled'" class="modal-oracle-failed">
                <AppIcon class="warning-icon" name="warning" :size="20" />
                <span class="error-msg-text">{{ displayedVersion.ai_status === 'cancelled' ? t('home.oracleCancelled') : t('home.oracleFailed') }}</span>
                <button
                  v-if="isOwner && isCurrentVersion"
                  type="button"
                  class="retry-btn"
                  @click.stop="retryAnalysis(postStore.focusedDream._id)"
                >
                  {{ t('home.retry') }}
                </button>
              </div>
            </div>

            <AppConfirm
              v-model="showDeleteAdditionConfirm"
              :title="t('home.deleteAdditionTitle')"
              :message="t('home.deleteAdditionDraftMessage')"
              :confirm-label="t('home.deleteAddition')"
              :danger="true"
              @confirm="confirmDraftAdditionDelete"
              @cancel="cancelDraftAdditionDelete"
            />
            <AppConfirm
              v-model="showDeletePostConfirm"
              :title="t('home.deleteDreamTitle')"
              :message="t('home.deleteDreamMessage')"
              :confirm-label="t('home.delete')"
              :danger="true"
              :loading="isDeletingPost"
              @confirm="confirmDeletePost"
              @cancel="showDeletePostConfirm = false"
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
            <AppConfirm
              v-model="showDeleteCommentConfirm"
              :title="t('home.deleteCommentTitle')"
              :message="t('home.deleteCommentMessage')"
              :confirm-label="t('home.delete')"
              :danger="true"
              :loading="isDeletingComment"
              @confirm="confirmDeleteComment"
              @cancel="cancelDeleteComment"
            />

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

              <button
                type="button"
                class="modal-like-btn"
                :aria-label="t('home.commentCountAria', { count: postStore.focusedDream.comments_count })"
                @click="focusCommentComposer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>{{ postStore.focusedDream.comments_count }}</span>
              </button>

              <!-- Edited badge -->
              <span
                v-if="isEdited"
                class="modal-edited-badge"
                :title="t('home.editedTitle')"
              >{{ t('home.edited') }}</span>

              <button
                v-if="postStore.focusedDream.is_public && postStore.focusedDream.privacy !== 'private'"
                type="button"
                class="modal-like-btn modal-share-btn"
                :aria-label="t('home.share.buttonAria')"
                @click="shareStore.open(postStore.focusedDream)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>
                </svg>
                <span>{{ t('home.share.button') }}</span>
              </button>
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
                    v-for="comment in displayedComments"
                    :key="comment._id"
                    class="modal-comment"
                    :class="{
                      'modal-comment--reply': Boolean(comment.parentCommentId),
                      'modal-comment--focused': postStore.focusedCommentId === comment._id,
                    }"
                    :data-comment-id="comment._id"
                  >
                    <span class="modal-comment__avatar-wrap">
                      <UserAvatar
                        :user="comment.userId"
                        size="sm"
                        class="modal-comment__avatar"
                      />
                      <span
                        v-if="isPostOwnerComment(comment)"
                        class="modal-comment__owner-crown"
                        :title="t('home.postOwnerComment')"
                        aria-label="post owner"
                      >
                        <AppIcon name="crown" :size="15" />
                      </span>
                    </span>
                    <div class="modal-comment__body">
                      <div class="modal-comment__meta">
                        <RouterLink
                          :to="`/profile/${comment.userId._id}`"
                          class="modal-comment__name"
                          @click="postStore.closePost()"
                        >
                          <span translate="no">{{ comment.userId.display_name }}</span>
                        </RouterLink>
                        <span
                          v-if="isPostOwnerComment(comment)"
                          class="modal-comment__admin-badge"
                        >{{ t('home.adminLabel') }}</span>
                        <span class="modal-comment__time">{{ timeAgo(comment.created_at, localeStore.currentLocale) }}</span>
                        <span
                          v-if="comment.edit_history?.length"
                          class="modal-comment__edited"
                        >{{ t('home.edited') }}</span>
                        <AppDropdown
                          v-if="canManageComment(comment)"
                          class="modal-comment__menu"
                          :options="commentMenuOptions(comment)"
                          align="right"
                          :label="t('home.commentOptions')"
                          @select="handleCommentMenuSelect(comment, $event)"
                        >
                          <template #trigger="{ toggle, isOpen, panelId }">
                            <button
                              type="button"
                              class="modal-comment__menu-btn"
                              :aria-label="t('home.commentOptions')"
                              aria-haspopup="menu"
                              :aria-expanded="isOpen"
                              :aria-controls="isOpen ? panelId : undefined"
                              @click.stop="toggle"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
                              </svg>
                            </button>
                          </template>
                        </AppDropdown>
                      </div>
                      <template v-if="editingCommentId === comment._id">
                        <textarea
                          v-model="editCommentText"
                          class="modal-comment__editor"
                          maxlength="500"
                          rows="3"
                          :aria-label="t('home.editCommentAria')"
                          :disabled="isSavingComment"
                          translate="no"
                        />
                        <div class="modal-comment__edit-actions">
                          <span>{{ editCommentText.length }} / 500</span>
                          <AppButton
                            variant="ghost"
                            size="sm"
                            :disabled="isSavingComment"
                            @click="cancelCommentEdit"
                          >{{ t('home.cancel') }}</AppButton>
                          <AppButton
                            variant="primary"
                            size="sm"
                            :loading="isSavingComment"
                            :disabled="!canSaveCommentEdit"
                            @click="saveCommentEdit(comment)"
                          >{{ t('home.save') }}</AppButton>
                        </div>
                      </template>
                      <template v-else>
                        <p class="modal-comment__text" translate="no">
                          <RouterLink
                            v-if="comment.replyToUserId"
                            :to="`/profile/${comment.replyToUserId._id}`"
                            class="modal-comment__mention"
                            @click="postStore.closePost()"
                          >{{ formatUsername(comment.replyToUserId.username) }}</RouterLink>
                          <span v-if="comment.replyToUserId"> </span>
                          {{ displayedCommentContent(comment) }}
                        </p>
                        <nav
                          v-if="comment.edit_history?.length"
                          class="modal-comment__history"
                          :aria-label="t('home.commentHistory')"
                        >
                          <button
                            type="button"
                            :aria-label="t('home.previousCommentVersion')"
                            :disabled="commentVersionIndex(comment) === 0"
                            @click="moveCommentVersion(comment, -1)"
                          >‹</button>
                          <span>
                            {{ t('home.commentVersion', {
                              current: commentVersionIndex(comment) + 1,
                              total: commentVersions(comment).length,
                            }) }}
                          </span>
                          <button
                            type="button"
                            :aria-label="t('home.nextCommentVersion')"
                            :disabled="commentVersionIndex(comment) === commentVersions(comment).length - 1"
                            @click="moveCommentVersion(comment, 1)"
                          >›</button>
                        </nav>
                        <button
                          v-if="commentsEnabled"
                          type="button"
                          class="modal-comment__reply"
                          @click="startReply(comment)"
                        >
                          {{ t('home.replyComment') }}
                        </button>
                      </template>
                    </div>
                  </li>
                </ul>
              </template>
            </div>

          </div>

          <!-- ── Comment input (fixed at bottom) ── -->
          <div v-if="commentsEnabled && authStore.isLoggedIn" class="modal-input-bar">
            <div v-if="replyingToComment" class="modal-reply-context" role="status">
              <span>
                {{ t('home.replyingTo') }}
                <strong translate="no">{{ formatUsername(replyingToComment.userId.username) }}</strong>
              </span>
              <button
                type="button"
                :aria-label="t('home.cancelReply')"
                @click="cancelReply"
              >×</button>
            </div>
            <UserAvatar
              v-if="authStore.myUser"
              :user="authStore.myUser"
              size="sm"
              class="modal-input-avatar"
            />
            <input
              id="modal-comment-input"
              ref="commentInputRef"
              v-model="commentText"
              type="text"
              class="modal-input-field"
              :placeholder="commentPlaceholder"
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
          <div v-else-if="commentsEnabled" class="modal-comments-disabled" role="status">
            <button type="button" class="modal-guest-login" @click="requestLogin">
              {{ t('home.guestLoginToInteract') }}
            </button>
          </div>
          <div v-else class="modal-comments-disabled" role="status">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
              <line x1="4" y1="4" x2="20" y2="20"/>
            </svg>
            <span>{{ t('home.commentsDisabled') }}</span>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'
import { usePostStore }  from '@/store/usePostStore'
import { useDreamStore } from '@/store/useDreamStore'
import { useAuthStore }  from '@/store/useAuthStore'
import { useOracleStore } from '@/store/useOracleStore'
import { useLocaleStore } from '@/store/useLocaleStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { usePostShareStore } from '@/store/usePostShareStore'
import apiClient         from '@/api/client'
import { timeAgo }       from '@/utils/timeAgo'
import { formatUsername } from '@/utils/username'
import { getApiErrorDataCode } from '@/utils/apiError'
import OracleAnalysisResult  from '@/components/common/OracleAnalysisResult.vue'
import DreamMoodTag from '@/components/common/DreamMoodTag.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import AppDropdown from '@/components/common/AppDropdown.vue'
import AppIcon from '@/components/common/AppIcon.vue'
import type { ApiComment, ApiDream } from '@/api/types'
import type { DropdownItem, DropdownOption } from '@/components/common/AppDropdown.vue'

const postStore  = usePostStore()
const dreamStore = useDreamStore()
const authStore  = useAuthStore()
const oracleStore = useOracleStore()
const localeStore = useLocaleStore()
const settingsStore = useSettingsStore()
const shareStore = usePostShareStore()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

const commentText  = ref('')
const isSubmitting = ref(false)
const isLiking     = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const bodyRef      = ref<HTMLElement | null>(null)
const commentInputRef = ref<HTMLInputElement | null>(null)
const replyingToComment = ref<ApiComment | null>(null)
const isRetryingAnalysis = ref(false)
const selectedVersionIndex = ref(0)
const isContextEditing = ref(false)
const editContextContent = ref('')
const editContextAdditions = ref<Array<{
  clientId: string
  sequence?: number
  content: string
}>>([])
const isSavingContext = ref(false)
const pendingDeleteDraftIndex = ref<number | null>(null)
const showDeleteAdditionConfirm = ref(false)
const showDeletePostConfirm = ref(false)
const isDeletingPost = ref(false)
const showDisableAiConfirm = ref(false)
const isUpdatingAi = ref(false)
const editingCommentId = ref<string | null>(null)
const editCommentText = ref('')
const isSavingComment = ref(false)
const pendingDeleteComment = ref<ApiComment | null>(null)
const showDeleteCommentConfirm = ref(false)
const isDeletingComment = ref(false)
const commentHistoryIndexes = ref<Record<string, number>>({})
const isUpdatingCommentsPolicy = ref(false)

type DreamVersion = NonNullable<ApiDream['versions']>[number]

const dreamVersions = computed<DreamVersion[]>(() => {
  const dream = postStore.focusedDream
  if (!dream) return []
  if (Array.isArray(dream.versions) && dream.versions.length > 0) return dream.versions
  return [{
    version: 1,
    content: dream.content,
    additions: dream.additions || [],
    ai_status: dream.ai_status,
    ai_result: dream.ai_result ?? dream.aiAnalysis ?? null,
    mood_tag: dream.mood_tag,
    analysisMetadata: dream.analysisMetadata,
    editedAt: dream.created_at,
    isCurrent: true,
    isLegacyPartial: false,
  }]
})

const displayedVersion = computed(() =>
  dreamVersions.value[selectedVersionIndex.value]
    ?? dreamVersions.value[dreamVersions.value.length - 1]
    ?? null
)
const isCurrentVersion = computed(() => displayedVersion.value?.isCurrent === true)

const normalizedDraftAdditions = computed(() =>
  editContextAdditions.value
    .filter(item => item.content.trim().length > 0)
    .map(item => ({ ...item, content: item.content.trim() }))
)

const isContextDirty = computed(() => {
  const current = dreamVersions.value[dreamVersions.value.length - 1]
  if (!current) return false
  if (editContextContent.value.trim() !== current.content.trim()) return true
  const currentAdditions = current.additions || []
  if (normalizedDraftAdditions.value.length !== currentAdditions.length) return true
  return normalizedDraftAdditions.value.some((item, index) =>
    item.content.trim() !== currentAdditions[index]?.content.trim()
  )
})

const canSaveContext = computed(() =>
  editContextContent.value.trim().length > 0
  && isContextDirty.value
  && !isSavingContext.value
)

function startContextEdit() {
  const current = dreamVersions.value[dreamVersions.value.length - 1]
  if (!current || !isOwner.value) return
  selectedVersionIndex.value = dreamVersions.value.length - 1
  editContextContent.value = current.content
  editContextAdditions.value = (current.additions || []).map((item, index) => ({
    clientId: `existing-${item.sequence}-${index}`,
    sequence: item.sequence,
    content: item.content,
  }))
  isContextEditing.value = true
}

function cancelContextEdit() {
  isContextEditing.value = false
  editContextContent.value = ''
  editContextAdditions.value = []
  cancelDraftAdditionDelete()
}

function addDraftAddition() {
  editContextAdditions.value.push({
    clientId: `new-${Date.now()}-${editContextAdditions.value.length}`,
    content: '',
  })
}

function requestDraftAdditionDelete(index: number) {
  pendingDeleteDraftIndex.value = index
  showDeleteAdditionConfirm.value = true
}

function cancelDraftAdditionDelete() {
  pendingDeleteDraftIndex.value = null
  showDeleteAdditionConfirm.value = false
}

function confirmDraftAdditionDelete() {
  const index = pendingDeleteDraftIndex.value
  if (index !== null) editContextAdditions.value.splice(index, 1)
  cancelDraftAdditionDelete()
}

async function saveContextEdit() {
  const dream = postStore.focusedDream
  if (!dream || !canSaveContext.value) return
  isSavingContext.value = true
  try {
    const updated = await dreamStore.editDream(
      dream._id,
      editContextContent.value.trim(),
      normalizedDraftAdditions.value.map(item => ({
        ...(item.sequence ? { sequence: item.sequence } : {}),
        content: item.content,
      })),
    )
    Object.assign(dream, updated)
    selectedVersionIndex.value = Math.max(0, dreamVersions.value.length - 1)
    cancelContextEdit()
  } finally {
    isSavingContext.value = false
  }
}

async function confirmDeletePost() {
  const dream = postStore.focusedDream
  if (!dream || isDeletingPost.value) return
  isDeletingPost.value = true
  try {
    await dreamStore.removeDream(dream._id)
    showDeletePostConfirm.value = false
    postStore.closePost()
  } finally {
    isDeletingPost.value = false
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
const commentsEnabled = computed(() =>
  postStore.focusedDream?.comments_enabled !== false
)
const commentPlaceholder = computed(() =>
  replyingToComment.value
    ? t('home.replyPlaceholder', { name: formatUsername(replyingToComment.value.userId.username) })
    : t('home.commentPlaceholder')
)
const displayedComments = computed<ApiComment[]>(() => {
  const comments = postStore.focusedComments
  const roots = comments.filter(comment => !comment.parentCommentId)
  const rootIds = new Set(roots.map(comment => comment._id))
  const threads = roots.map(root => [
    root,
    ...comments.filter(comment => comment.parentCommentId === root._id),
  ])
  for (const orphan of comments.filter(comment =>
    comment.parentCommentId && !rootIds.has(comment.parentCommentId))) {
    threads.push([orphan])
  }

  const target = comments.find(comment => comment._id === postStore.focusedCommentId)
  const targetRootId = target?.parentCommentId || target?._id
  if (targetRootId) {
    const targetIndex = threads.findIndex(thread =>
      thread.some(comment => comment._id === targetRootId))
    if (targetIndex > 0) threads.unshift(...threads.splice(targetIndex, 1))
  }
  return threads.flat()
})
const canSaveCommentEdit = computed(() =>
  editCommentText.value.trim().length > 0
  && editCommentText.value.trim().length <= 500
  && editCommentText.value.trim() !== postStore.focusedComments
    .find(comment => comment._id === editingCommentId.value)?.content
  && !isSavingComment.value
)

const modalMenuOptions = computed((): DropdownItem[] => {
  const dream = postStore.focusedDream
  const options: DropdownItem[] = [{
    label: t('home.editPost'),
    value: 'edit',
    disabled: postStore.focusedDream?.ai_status === 'pending',
  },
  {
    label: postStore.focusedDream?.privacy === 'private'
      ? t('home.makePublic')
      : t('home.makePrivate'),
    value: 'privacy',
  }]

  options.push({
    label: dream?.ai_analysis_enabled === false
      ? t('home.enableAiAnalysis')
      : t('home.disableAiAnalysis'),
    value: 'ai-toggle',
  })

  options.push({
    label: commentsEnabled.value
      ? t('home.disableComments')
      : t('home.enableComments'),
    value: 'comments-policy',
    disabled: isUpdatingCommentsPolicy.value,
  })

  if (dream?.ai_analysis_enabled !== false) {
    options.push({
      label: t('home.reanalyze'),
      value: 'reanalyze',
      disabled: dream?.ai_status === 'pending',
    })
  }

  options.push(
  { divider: true },
  {
    label: t('home.delete'),
    value: 'delete',
    danger: true,
  })
  return options
})

async function handleModalMenuSelect(item: DropdownOption) {
  const dream = postStore.focusedDream
  if (!dream) return
  if (item.value === 'edit') {
    startContextEdit()
    return
  }
  if (item.value === 'privacy') {
    const updated = await dreamStore.changePrivacy(
      dream._id,
      dream.privacy === 'private' ? 'public' : 'private',
    )
    Object.assign(dream, updated)
    return
  }
  if (item.value === 'ai-toggle') {
    await toggleAiAnalysis()
    return
  }
  if (item.value === 'reanalyze') {
    await retryAnalysis(dream._id)
    return
  }
  if (item.value === 'comments-policy') {
    await toggleCommentsPolicy()
    return
  }
  if (item.value === 'delete') {
    showDeletePostConfirm.value = true
  }
}

async function toggleCommentsPolicy(): Promise<void> {
  if (!isOwner.value || isUpdatingCommentsPolicy.value) return
  isUpdatingCommentsPolicy.value = true
  const nextEnabled = !commentsEnabled.value
  try {
    await postStore.setCommentsEnabled(nextEnabled)
    settingsStore.showToastKey(
      nextEnabled ? 'home.commentsEnabledSuccess' : 'home.commentsDisabledSuccess',
      undefined,
      'success',
    )
  } catch {
    settingsStore.showToastKey('home.commentPolicyError', undefined, 'error')
  } finally {
    isUpdatingCommentsPolicy.value = false
  }
}

async function toggleAiAnalysis() {
  const dream = postStore.focusedDream
  if (!dream || isUpdatingAi.value) return

  if (dream.ai_analysis_enabled === false) {
    isUpdatingAi.value = true
    try {
      const updated = await dreamStore.setAiAnalysis(dream._id, true)
      Object.assign(dream, updated)
      selectedVersionIndex.value = Math.max(0, dreamVersions.value.length - 1)
    } finally {
      isUpdatingAi.value = false
    }
    return
  }

  if (dream.ai_result ?? dream.aiAnalysis) {
    showDisableAiConfirm.value = true
    return
  }
  await disableAiAnalysis('delete')
}

async function disableAiAnalysis(resultPolicy: 'keep' | 'delete') {
  const dream = postStore.focusedDream
  if (!dream || isUpdatingAi.value) return
  isUpdatingAi.value = true
  try {
    const updated = await dreamStore.setAiAnalysis(dream._id, false, resultPolicy)
    Object.assign(dream, updated)
    selectedVersionIndex.value = Math.max(0, dreamVersions.value.length - 1)
    showDisableAiConfirm.value = false
  } finally {
    isUpdatingAi.value = false
  }
}

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
  } catch {
    settingsStore.showToast(t('home.oracleFailed'), 'error')
  } finally {
    isRetryingAnalysis.value = false
  }
}


// ── Derived from focused post ─────────────────────────────────────────────────


const timestamp = computed(() =>
  postStore.focusedDream ? timeAgo(postStore.focusedDream.created_at, localeStore.currentLocale) : ''
)
const analysis = computed(() => {
  return displayedVersion.value?.ai_result ?? null
})
const modalMoodLabel = computed(() =>
  String(analysis.value?.emotional_tone || displayedVersion.value?.mood_tag || '').trim()
)
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
  if (!authStore.isLoggedIn) {
    requestLogin()
    return
  }
  isLiking.value = true
  try {
    await dreamStore.toggleLike(postStore.focusedDream._id)
  } finally {
    isLiking.value = false
  }
}

function canManageComment(comment: ApiComment): boolean {
  return comment.userId._id === authStore.myId || isOwner.value
}

function isPostOwnerComment(comment: ApiComment): boolean {
  const postOwnerId = postStore.focusedDream?.userId
  const ownerId = typeof postOwnerId === 'object' && postOwnerId !== null
    ? postOwnerId._id
    : postOwnerId
  return Boolean(ownerId && comment.userId._id === ownerId)
}

function commentMenuOptions(comment: ApiComment): DropdownItem[] {
  const options: DropdownItem[] = []
  if (comment.userId._id === authStore.myId) {
    options.push({ label: t('home.editComment'), value: 'edit-comment' })
  }
  if (options.length) options.push({ divider: true })
  options.push({
    label: t('home.deleteComment'),
    value: 'delete-comment',
    danger: true,
  })
  return options
}

function handleCommentMenuSelect(comment: ApiComment, item: DropdownOption): void {
  if (item.value === 'edit-comment') {
    editingCommentId.value = comment._id
    editCommentText.value = comment.content
    commentHistoryIndexes.value[comment._id] = commentVersions(comment).length - 1
    return
  }
  if (item.value === 'delete-comment') {
    pendingDeleteComment.value = comment
    showDeleteCommentConfirm.value = true
  }
}

function cancelCommentEdit(): void {
  editingCommentId.value = null
  editCommentText.value = ''
}

async function saveCommentEdit(comment: ApiComment): Promise<void> {
  if (!canSaveCommentEdit.value || editingCommentId.value !== comment._id) return
  isSavingComment.value = true
  try {
    await postStore.editComment(comment._id, editCommentText.value)
    const updated = postStore.focusedComments.find(item => item._id === comment._id)
    if (updated) {
      commentHistoryIndexes.value[comment._id] = commentVersions(updated).length - 1
    }
    cancelCommentEdit()
    settingsStore.showToastKey('home.commentEditedSuccess', undefined, 'success')
  } catch {
    settingsStore.showToastKey('home.commentEditError', undefined, 'error')
  } finally {
    isSavingComment.value = false
  }
}

function cancelDeleteComment(): void {
  if (isDeletingComment.value) return
  pendingDeleteComment.value = null
  showDeleteCommentConfirm.value = false
}

async function confirmDeleteComment(): Promise<void> {
  const comment = pendingDeleteComment.value
  if (!comment || isDeletingComment.value) return
  isDeletingComment.value = true
  try {
    await postStore.deleteComment(comment._id)
    delete commentHistoryIndexes.value[comment._id]
    if (editingCommentId.value === comment._id) cancelCommentEdit()
    if (
      replyingToComment.value
      && !postStore.focusedComments.some(item => item._id === replyingToComment.value?._id)
    ) {
      cancelReply()
    }
    pendingDeleteComment.value = null
    showDeleteCommentConfirm.value = false
    settingsStore.showToastKey('home.commentDeletedSuccess', undefined, 'success')
  } catch {
    settingsStore.showToastKey('home.commentDeleteError', undefined, 'error')
  } finally {
    isDeletingComment.value = false
  }
}

function commentVersions(comment: ApiComment): string[] {
  return [
    ...(comment.edit_history || []).map(version => version.content),
    comment.content,
  ]
}

function commentVersionIndex(comment: ApiComment): number {
  const versions = commentVersions(comment)
  const selected = commentHistoryIndexes.value[comment._id]
  return typeof selected === 'number'
    ? Math.min(Math.max(0, selected), versions.length - 1)
    : versions.length - 1
}

function displayedCommentContent(comment: ApiComment): string {
  const content = commentVersions(comment)[commentVersionIndex(comment)] || comment.content
  if (!comment.replyToUserId) return content
  const username = comment.replyToUserId.username.replace(/^@+/, '')
  const escapedUsername = escapeRegExp(username)
  const mentionPrefix = new RegExp(
    `^(?:@+${escapedUsername}|\\[(?:\\*\\*)?@+${escapedUsername}(?:\\*\\*)?\\]\\([^)]*\\))\\s*`,
    'i',
  )
  return content.replace(mentionPrefix, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function moveCommentVersion(comment: ApiComment, delta: -1 | 1): void {
  commentHistoryIndexes.value[comment._id] = Math.min(
    Math.max(0, commentVersionIndex(comment) + delta),
    commentVersions(comment).length - 1,
  )
}

function startReply(comment: ApiComment): void {
  if (!authStore.isLoggedIn) {
    requestLogin()
    return
  }
  replyingToComment.value = comment
  nextTick(() => commentInputRef.value?.focus())
}

function cancelReply(): void {
  replyingToComment.value = null
}

// ── Submit comment ────────────────────────────────────────────────────────────

async function submitComment(): Promise<void> {
  if (!commentText.value.trim() || isSubmitting.value || !commentsEnabled.value) return
  isSubmitting.value = true
  try {
    const created = await postStore.addComment(
      commentText.value,
      replyingToComment.value?._id,
    )
    commentText.value = ''
    cancelReply()
    nextTick(() => {
      if (!created) return
      containerRef.value
        ?.querySelector<HTMLElement>(`[data-comment-id="${created._id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  } catch (error: unknown) {
    const code = getApiErrorDataCode(error)
    if (code === 'comments_disabled') {
      if (postStore.focusedDream) postStore.focusedDream.comments_enabled = false
      settingsStore.showToastKey('home.commentsDisabledStaleError', undefined, 'error')
    } else if (code === 'reply_not_found') {
      cancelReply()
      settingsStore.showToastKey('home.replyUnavailable', undefined, 'error')
    } else {
      settingsStore.showToastKey('home.commentCreateError', undefined, 'error')
    }
  } finally {
    isSubmitting.value = false
  }
}

function focusCommentComposer(): void {
  if (!authStore.isLoggedIn) {
    requestLogin()
    return
  }
  commentInputRef.value?.focus()
  commentInputRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function requestLogin(): void {
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`
  void router.push({ name: 'login', query: { redirect } })
}

// ── Focus trap + scroll reset ─────────────────────────────────────────────────

watch(() => postStore.focusedId, (val) => {
  if (val) {
    selectedVersionIndex.value = Math.max(0, dreamVersions.value.length - 1)
    cancelContextEdit()
    nextTick(() => {
      containerRef.value?.focus()
      if (bodyRef.value) bodyRef.value.scrollTop = 0
    })
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
    commentText.value = ''
    cancelCommentEdit()
    pendingDeleteComment.value = null
    showDeleteCommentConfirm.value = false
    commentHistoryIndexes.value = {}
    cancelContextEdit()
  }
})

watch(
  [() => postStore.focusedCommentId, () => postStore.isLoadingComments],
  ([commentId, loading]) => {
    if (!commentId || loading) return
    nextTick(() => {
      containerRef.value
        ?.querySelector<HTMLElement>(`[data-comment-id="${commentId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  },
  { immediate: true },
)

watch(
  () => postStore.editRequested && Boolean(postStore.focusedDream),
  (shouldEdit) => {
    if (!shouldEdit) return
    postStore.consumeEditRequest()
    nextTick(startContextEdit)
  },
  { immediate: true },
)

watch(
  () => dreamVersions.value.length,
  (length, previousLength) => {
    if (length > previousLength || selectedVersionIndex.value >= length) {
      selectedVersionIndex.value = Math.max(0, length - 1)
    }
  },
)

function refreshOpenDream(): void {
  if (!postStore.focusedId) return
  void postStore.refreshFocusedDream().catch(() => undefined)
}

function refreshVisibleDream(): void {
  if (document.visibilityState === 'visible') refreshOpenDream()
}

onMounted(() => {
  window.addEventListener('focus', refreshOpenDream)
  document.addEventListener('visibilitychange', refreshVisibleDream)
})
onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshOpenDream)
  document.removeEventListener('visibilitychange', refreshVisibleDream)
  document.body.style.overflow = ''
  postStore.closePost()
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

.modal-private-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}
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
.modal-menu-btn {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
.modal-menu-btn:hover { background: var(--color-bg-hover); color: var(--color-text-primary); }

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
.modal-version-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 30px;
  margin: var(--space-4) 0 var(--space-2);
  color: var(--color-text-muted);
}
.modal-version-nav button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-primary);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.modal-version-nav button:hover:not(:disabled) { background: var(--color-bg-hover); }
.modal-version-nav button:disabled { opacity: .3; cursor: default; }
.modal-version-nav span { min-width: 42px; text-align: center; font-size: var(--font-size-xs); }
.modal-version-legacy-note {
  margin: 0 0 var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(245, 158, 11, .08);
  color: #d9ad62;
  font-size: var(--font-size-xs);
  line-height: 1.5;
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
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
}
.modal-dream-addition strong {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}
.modal-dream-addition__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.modal-dream-addition--editing {
  background: var(--color-bg-surface);
  border-color: var(--color-border-input);
}
.modal-addition-delete-action {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
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
.modal-context-editor {
  width: 100%;
  min-height: 132px;
  resize: vertical;
  padding: var(--space-3);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  font: inherit;
  line-height: var(--line-height-relaxed);
}
.modal-context-editor:focus,
.modal-addition-textarea:focus {
  border-color: #666;
  outline: none;
}
.modal-edit-label {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}
.modal-context-edit-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-4);
}
.modal-context-edit-actions > span {
  margin-right: auto;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.modal-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* ── Oracle status ── */
.modal-oracle-wrap {
  border-bottom: 1px solid #262626;
}
.modal-oracle-disabled {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px var(--space-5);
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
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
.modal-share-btn { margin-left: auto; }
.modal-guest-login {
  min-height: 38px;
  padding: 0 18px;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
}

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
  position: relative;
  padding: 6px;
  border-radius: var(--radius-lg);
  transition: background-color 240ms ease, box-shadow 240ms ease;
  scroll-margin-top: var(--space-4);
}
.modal-comment--reply {
  margin-left: 38px;
}
.modal-comment--reply::before {
  content: '';
  position: absolute;
  top: -12px;
  left: -20px;
  width: 15px;
  height: 28px;
  border-left: 1px solid var(--color-border-subtle);
  border-bottom: 1px solid var(--color-border-subtle);
  border-bottom-left-radius: 10px;
}
.modal-comment--focused {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  box-shadow: inset 3px 0 0 var(--color-primary);
}
.modal-comment__avatar-wrap {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
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
.modal-comment__owner-crown {
  position: absolute;
  top: -9px;
  left: 50%;
  transform: translateX(-50%);
  color: #f5c542;
  font-size: 15px;
  line-height: 1;
  text-shadow: 0 1px 2px rgb(0 0 0 / 55%);
  pointer-events: none;
}
.modal-comment__body { flex: 1; min-width: 0; }
.modal-comment__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 3px;
  min-height: 26px;
}
.modal-comment__name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-decoration: none;
}
.modal-comment__name:hover { text-decoration: underline; }
.modal-comment__admin-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgb(245 197 66 / 18%);
  border: 1px solid rgb(245 197 66 / 42%);
  color: #e9b832;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
.modal-comment__time { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.modal-comment__edited {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-style: italic;
}
.modal-comment__menu {
  margin-left: auto;
}
.modal-comment__menu-btn {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
.modal-comment__menu-btn:hover,
.modal-comment__menu-btn:focus-visible {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  outline: none;
}
.modal-comment__text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  word-break: break-word;
  white-space: pre-wrap;
}
.modal-comment__mention {
  color: #7db7ff;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}
.modal-comment__mention:hover {
  text-decoration: underline;
}
.modal-comment__reply {
  margin-top: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}
.modal-comment__reply:hover,
.modal-comment__reply:focus-visible {
  color: var(--color-text-primary);
  outline: none;
  text-decoration: underline;
}
.modal-comment__editor {
  width: 100%;
  min-height: 74px;
  resize: vertical;
  padding: var(--space-3);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  font: inherit;
  line-height: var(--line-height-relaxed);
}
.modal-comment__editor:focus {
  border-color: #666;
  outline: none;
}
.modal-comment__edit-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.modal-comment__edit-actions > span {
  margin-right: auto;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.modal-comment__history {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 28px;
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.modal-comment__history button {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.modal-comment__history button:hover:not(:disabled) {
  background: var(--color-bg-hover);
}
.modal-comment__history button:disabled {
  cursor: default;
  opacity: .3;
}

/* ── Comment input bar (fixed bottom) ── */
.modal-input-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid #262626;
  background: #181818;
  flex-shrink: 0;
}
.modal-reply-context {
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  padding: 0 4px 6px 42px;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.modal-reply-context strong {
  color: #7db7ff;
  font-weight: var(--font-weight-semibold);
}
.modal-reply-context button {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.modal-reply-context button:hover,
.modal-reply-context button:focus-visible {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  outline: none;
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
.modal-comments-disabled {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 60px;
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid #262626;
  background: #181818;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .modal-overlay {
    padding: 0;
  }
  .modal-container {
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    padding-top: var(--safe-area-top);
    padding-bottom: var(--safe-area-bottom);
  }
  .modal-header,
  .modal-content-block,
  .modal-comments-section,
  .modal-input-bar {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
  .modal-comment__meta {
    flex-wrap: wrap;
  }
  .modal-comment__menu {
    margin-left: auto;
  }

  .modal-header {
    min-height: 58px;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .modal-content-block,
  .modal-comments-section {
    padding-top: 14px;
    padding-bottom: 14px;
  }

  .modal-input-bar {
    gap: 8px;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .modal-close-btn,
  .modal-menu-btn {
    width: 40px;
    height: 40px;
  }
}

/* ── Transition ── */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.18s ease; }
.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container          { transition: transform 0.18s ease, opacity 0.18s ease; }
.modal-fade-enter-from { opacity: 0; }
.modal-fade-leave-to   { opacity: 0; }
.modal-fade-enter-from .modal-container { transform: translateY(12px); opacity: 0; }
.modal-fade-leave-to   .modal-container { transform: translateY(12px); opacity: 0; }
</style>
