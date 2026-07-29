<template>
  <div class="followers-modal-overlay" @click.self="emit('close')">
    <div class="followers-modal">
      <!-- Modal Header -->
      <div class="followers-modal__header">
        <div class="followers-modal__tabs" role="tablist">
          <button
            role="tab"
            :aria-selected="activeTab === 'followers'"
            class="followers-modal__tab"
            :class="{ 'followers-modal__tab--active': activeTab === 'followers' }"
            @click="activeTab = 'followers'"
          >
            {{ t('profile.followersLabel') }}
          </button>
          <button
            role="tab"
            :aria-selected="activeTab === 'following'"
            class="followers-modal__tab"
            :class="{ 'followers-modal__tab--active': activeTab === 'following' }"
            @click="activeTab = 'following'"
          >
            {{ t('profile.followingLabel') }}
          </button>
          <button
            v-if="showPendingTab"
            role="tab"
            :aria-selected="activeTab === 'pending'"
            class="followers-modal__tab"
            :class="{ 'followers-modal__tab--active': activeTab === 'pending' }"
            @click="activeTab = 'pending'"
          >
            {{ t('profile.pendingRequestsLabel') }}
            <span v-if="pendingRequests.length" class="followers-modal__pending-count">
              {{ pendingRequests.length }}
            </span>
          </button>
        </div>
        <button
          class="followers-modal__close-btn"
          :aria-label="t('profile.closeModal')"
          @click="emit('close')"
        >
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <!-- Modal Content -->
      <div class="followers-modal__content">
        <template v-if="activeTab === 'followers'">
          <div v-if="followersList.length > 0" class="user-list">
            <router-link
              v-for="u in followersList"
              :key="u._id"
              :to="`/profile/${u._id}`"
              class="user-item"
              @click="emit('close')"
            >
              <div class="user-avatar-wrap">
                <img
                  v-if="u.avatar"
                  :src="u.avatar"
                  :alt="u.display_name"
                  class="user-avatar"
                />
                <div
                  v-else
                  class="user-avatar-placeholder"
                  :style="{ backgroundColor: getAvatarBg(u._id) }"
                  translate="no"
                >
                  {{ getInitials(u.display_name) }}
                </div>
              </div>
              <div class="user-info" translate="no">
                <span class="user-display-name">{{ u.display_name }}</span>
                <span class="user-username">{{ u.username }}</span>
              </div>
            </router-link>
          </div>
          <div v-else-if="followerCount > 0" class="empty-state">
            {{ t('profile.listPrivate') }}
          </div>
          <div v-else class="empty-state">
            {{ t('profile.noFollowers') }}
          </div>
        </template>

        <template v-else-if="activeTab === 'following'">
          <div v-if="followingList.length > 0" class="user-list">
            <router-link
              v-for="u in followingList"
              :key="u._id"
              :to="`/profile/${u._id}`"
              class="user-item"
              @click="emit('close')"
            >
              <div class="user-avatar-wrap">
                <img
                  v-if="u.avatar"
                  :src="u.avatar"
                  :alt="u.display_name"
                  class="user-avatar"
                />
                <div
                  v-else
                  class="user-avatar-placeholder"
                  :style="{ backgroundColor: getAvatarBg(u._id) }"
                  translate="no"
                >
                  {{ getInitials(u.display_name) }}
                </div>
              </div>
              <div class="user-info" translate="no">
                <span class="user-display-name">{{ u.display_name }}</span>
                <span class="user-username">{{ u.username }}</span>
              </div>
            </router-link>
          </div>
          <div v-else-if="followingCount > 0" class="empty-state">
            {{ t('profile.listPrivate') }}
          </div>
          <div v-else class="empty-state">
            {{ t('profile.noFollowing') }}
          </div>
        </template>

        <template v-else>
          <div v-if="pendingRequests.length > 0" class="user-list">
            <div v-for="u in pendingRequests" :key="u._id" class="user-item">
              <router-link
                :to="`/profile/${u._id}`"
                class="user-item__identity"
                @click="emit('close')"
              >
                <div class="user-avatar-wrap">
                  <img
                    v-if="u.avatar"
                    :src="u.avatar"
                    :alt="u.display_name"
                    class="user-avatar"
                  />
                  <div
                    v-else
                    class="user-avatar-placeholder"
                    :style="{ backgroundColor: getAvatarBg(u._id) }"
                    translate="no"
                  >
                    {{ getInitials(u.display_name) }}
                  </div>
                </div>
                <div class="user-info" translate="no">
                  <span class="user-display-name">{{ u.display_name }}</span>
                  <span class="user-username">{{ u.username }}</span>
                </div>
              </router-link>
              <div class="follow-request-actions">
                <button
                  class="follow-request-btn"
                  :disabled="Boolean(reviewingRequestId)"
                  @click="emit('review-request', { requesterId: u._id, action: 'reject' })"
                >
                  {{ t('profile.rejectRequest') }}
                </button>
                <button
                  class="follow-request-btn follow-request-btn--approve"
                  :disabled="Boolean(reviewingRequestId)"
                  @click="emit('review-request', { requesterId: u._id, action: 'approve' })"
                >
                  {{ t('profile.approveRequest') }}
                </button>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            {{ t('profile.noPendingRequests') }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ApiUser } from '@/api/types'
import AppIcon from '@/components/common/AppIcon.vue'
import { getInitials, getAvatarBg } from '@/utils/avatar'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    initialTab: 'followers' | 'following' | 'pending'
    followersList?: ApiUser[]
    followingList?: ApiUser[]
    pendingRequests?: ApiUser[]
    showPendingTab?: boolean
    reviewingRequestId?: string | null
    followerCount: number
    followingCount: number
  }>(),
  {
    followersList: () => [],
    followingList: () => [],
    pendingRequests: () => [],
    showPendingTab: false,
    reviewingRequestId: null,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'review-request', payload: { requesterId: string; action: 'approve' | 'reject' }): void
}>()

const activeTab = ref<'followers' | 'following' | 'pending'>(props.initialTab)
</script>

<style scoped>
.followers-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.followers-modal {
  width: 440px;
  height: 520px;
  background-color: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-lg, 8px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.followers-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #262626;
  padding: 0 var(--space-4);
  position: relative;
}

.followers-modal__tabs {
  display: flex;
  gap: var(--space-4);
}

.followers-modal__tab {
  background: none;
  border: none;
  color: var(--color-text-muted, #737373);
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-semibold, 600);
  padding: var(--space-4) 0;
  cursor: pointer;
  position: relative;
  outline: none;
  transition: color var(--transition-fast, 0.2s);
}

.followers-modal__tab:hover {
  color: var(--color-text-primary, #fff);
}

.followers-modal__tab--active {
  color: var(--color-text-primary, #fff);
}

.followers-modal__tab--active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--color-text-primary, #fff);
}

.followers-modal__pending-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-bg-base);
  font-size: 10px;
}

.followers-modal__close-btn {
  background: none;
  border: none;
  color: var(--color-text-muted, #737373);
  font-size: var(--font-size-lg, 18px);
  cursor: pointer;
  padding: var(--space-2);
  outline: none;
  transition: color var(--transition-fast, 0.2s);
  display: flex;
  align-items: center;
  justify-content: center;
}

.followers-modal__close-btn:hover {
  color: var(--color-text-primary, #fff);
}

.followers-modal__content {
  flex: 1;
  min-height: 0;       /* required for overflow-y inside flex child */
  overflow-y: auto;
  padding: var(--space-4) 0;
}

.user-list {
  display: flex;
  flex-direction: column;
}

.user-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  text-decoration: none;
  transition: background var(--transition-fast, 0.2s);
}

.user-item:hover {
  background-color: var(--color-bg-hover, #202020);
}

.user-item__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
  text-decoration: none;
}

.follow-request-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.follow-request-btn {
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.follow-request-btn--approve {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-bg-base);
}

.follow-request-btn:hover:not(:disabled) {
  border-color: var(--color-text-muted);
  color: var(--color-text-primary);
}

.follow-request-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.user-avatar-wrap {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: var(--font-size-xs, 12px);
  font-weight: var(--font-weight-bold, 700);
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-display-name {
  font-size: var(--font-size-sm, 14px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary, #fff);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.user-username {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-muted, #737373);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.empty-state {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--color-text-muted, #737373);
  font-size: var(--font-size-sm, 14px);
}
</style>
