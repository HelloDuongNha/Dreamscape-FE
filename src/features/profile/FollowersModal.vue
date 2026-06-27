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
            Followers
          </button>
          <button
            role="tab"
            :aria-selected="activeTab === 'following'"
            class="followers-modal__tab"
            :class="{ 'followers-modal__tab--active': activeTab === 'following' }"
            @click="activeTab = 'following'"
          >
            Following
          </button>
        </div>
        <button
          class="followers-modal__close-btn"
          aria-label="Close modal"
          @click="emit('close')"
        >
          ✕
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
                >
                  {{ getInitials(u.display_name) }}
                </div>
              </div>
              <div class="user-info">
                <span class="user-display-name">{{ u.display_name }}</span>
                <span class="user-username">{{ u.username }}</span>
              </div>
            </router-link>
          </div>
          <div v-else-if="followerCount > 0" class="empty-state">
            This list is private.
          </div>
          <div v-else class="empty-state">
            No followers yet.
          </div>
        </template>

        <template v-else>
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
                >
                  {{ getInitials(u.display_name) }}
                </div>
              </div>
              <div class="user-info">
                <span class="user-display-name">{{ u.display_name }}</span>
                <span class="user-username">{{ u.username }}</span>
              </div>
            </router-link>
          </div>
          <div v-else-if="followingCount > 0" class="empty-state">
            This list is private.
          </div>
          <div v-else class="empty-state">
            Not following anyone yet.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getInitials, getAvatarBg } from '@/data/mockUsers'
import type { User } from '@/data/mockUsers'

const props = withDefaults(
  defineProps<{
    initialTab: 'followers' | 'following'
    followersList?: User[]
    followingList?: User[]
    followerCount: number
    followingCount: number
  }>(),
  {
    followersList: () => [],
    followingList: () => [],
  }
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

const activeTab = ref<'followers' | 'following'>(props.initialTab)
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
