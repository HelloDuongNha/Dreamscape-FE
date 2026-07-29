<template>
  <div class="profile-view">

    <!-- ── 404 state ── -->
    <div v-if="!isLoading && !targetUser" class="profile-404">
      <span class="profile-404__icon" aria-hidden="true">◈</span>
      <p class="profile-404__text">{{ t('profile.notFoundDesc') }}</p>
      <AppButton variant="secondary" size="sm" @click="router.push('/')">{{ t('profile.backToHomeBtn') }}</AppButton>
    </div>

    <!-- ── Loading Skeleton ── -->
    <template v-else-if="isLoading && !targetUser">
      <div class="profile-skeleton-header">
        <AppSkeleton type="avatar" style="width: 80px; height: 80px; margin-bottom: var(--space-4);" />
        <AppSkeleton type="text" style="width: 150px; height: 24px;" />
        <AppSkeleton type="text" style="width: 100px;" />
        <AppSkeleton type="text" style="width: 250px; margin-top: var(--space-4);" />
      </div>
      <div class="profile-skeleton-tabs">
        <AppSkeleton type="text" style="width: 100%; height: 40px; margin-bottom: var(--space-6);" />
      </div>
      <div class="profile-skeleton-feed">
        <AppSkeleton v-for="i in 3" :key="i" type="card" />
      </div>
    </template>

    <template v-else>
      <!-- ── Profile Header ── -->
      <ProfileHeader
        :user="displayUser"
        :is-me="isMe"
        :dream-count="userDreams.length"
        :approved-source-count="contributionStats?.approvedSourceCount || 0"
        :pending-follow-count="displayUser.followRequestCount || 0"
        @updated="handleProfileUpdate"
        @open-followers="openFollowersModal"
      />

      <!-- ── Tab Bar ── -->
      <ProfileTabs :active-tab="activeTab" @change="activeTab = $event" />

      <!-- ── Tab Content — padding-top creates breathing room below the tab bar ── -->
      <div class="profile-content" role="tabpanel">

        <!-- Private Account Visibility Block -->
        <template v-if="!canViewContent">
          <div class="profile-private-lock">
            <AppIcon class="profile-private-lock__icon" name="lock" :size="32" />
            <p class="profile-private-lock__title">{{ t('profile.privateTitle') }}</p>
            <p class="profile-private-lock__sub">{{ t('profile.privateDesc') }}</p>
          </div>
        </template>

        <template v-else>
          <!-- Posts tab -->
          <template v-if="activeTab === 'posts'">
            <div v-if="userDreams.length === 0" class="profile-empty">
              <span aria-hidden="true">◈</span>
              <p>{{ t('profile.noPosts') }}</p>
            </div>

            <div v-else class="profile-feed">
              <!-- ── Unified DreamCard: identical to Home Feed ── -->
              <DreamCard
                v-for="dream in userDreams"
                :key="dream._id"
                :dream="dream"
                :user="getDreamAuthor(dream)"
                @delete="handleProfileDelete"
              />

              <!-- Infinite scroll sentinel -->
              <div ref="sentinel" class="profile-sentinel" aria-hidden="true" />

              <!-- Load-more skeletons -->
              <template v-if="isLoadingMore">
                <AppSkeleton v-for="i in 2" :key="`pmore-${i}`" type="card" />
              </template>

              <!-- End of archive -->
              <div v-if="!hasMore && userDreams.length > 0" class="profile-end">
                {{ t('profile.allDreamsLoaded') }}
              </div>
            </div>
          </template>

          <!-- Replies tab — custom ReplyCard component (Threads/Instagram style) -->
          <template v-else-if="activeTab === 'replies'">
            <!-- Loading state for replies -->
            <div v-if="isLoadingReplies" class="profile-placeholder">
              <span class="profile-placeholder__icon" aria-hidden="true">◈</span>
              <p class="profile-placeholder__sub">{{ t('profile.loadingReplies') }}</p>
            </div>
            <!-- Empty state -->
            <div v-else-if="myComments.length === 0" class="profile-placeholder">
              <span class="profile-placeholder__icon" aria-hidden="true">◈</span>
              <p class="profile-placeholder__title">{{ t('profile.repliesTab') }}</p>
              <p class="profile-placeholder__sub">
                <i18n-t keypath="profile.repliesEmptyDesc" scope="global">
                  <template #name>
                    <span translate="no">{{ displayUser.display_name }}</span>
                  </template>
                </i18n-t>
              </p>
            </div>
            <!-- Reply cards -->
            <div v-else class="profile-feed">
              <ReplyCard
                v-for="comment in myComments"
                :key="comment._id"
                :comment="comment"
              />
            </div>
          </template>

          <!-- Likes tab — shows dreams the current user has liked -->
          <template v-else-if="activeTab === 'likes'">
            <div v-if="!isMe" class="profile-placeholder">
              <span class="profile-placeholder__icon" aria-hidden="true">◈</span>
              <p class="profile-placeholder__title">{{ t('profile.likesTab') }}</p>
              <p class="profile-placeholder__sub">{{ t('profile.likesOnlyMe') }}</p>
            </div>

            <template v-else>
              <div v-if="likedDreams.length === 0" class="profile-placeholder">
                <span class="profile-placeholder__icon" aria-hidden="true">◈</span>
                <p class="profile-placeholder__title">{{ t('profile.noLikes') }}</p>
                <p class="profile-placeholder__sub">{{ t('profile.likesEmptyDesc') }}</p>
              </div>

              <div v-else class="profile-feed">
                <DreamCard
                  v-for="dream in likedDreams"
                  :key="dream._id"
              :dream="dream"
                  :user="getDreamAuthor(dream)"
                />
              </div>
            </template>
          </template>
        </template>

      <!-- Followers/Following Modal -->
      <FollowersModal
        v-if="isFollowersModalOpen"
        :initial-tab="followersModalTab"
        :followers-list="displayUser.followersList"
        :following-list="displayUser.followingList"
        :pending-requests="displayUser.followRequests"
        :show-pending-tab="isMe"
        :reviewing-request-id="reviewingRequestId"
        :follower-count="displayUser.followers ? displayUser.followers.length : (displayUser.follower_count || 0)"
        :following-count="displayUser.following ? displayUser.following.length : 0"
        @review-request="reviewFollowRequest"
        @close="isFollowersModalOpen = false"
      />

      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter }  from 'vue-router'
import { useI18n }              from 'vue-i18n'
import ProfileHeader            from './ProfileHeader.vue'
import ProfileTabs              from './ProfileTabs.vue'
import type { TabId }           from './ProfileTabs.vue'
import FollowersModal           from './FollowersModal.vue'
import AppButton                from '@/components/common/AppButton.vue'
import AppSkeleton              from '@/components/common/AppSkeleton.vue'
import AppIcon                  from '@/components/common/AppIcon.vue'
import DreamCard                from '@/features/home/DreamCard.vue'
import ReplyCard                from '@/components/common/ReplyCard.vue'
import { useAuthStore }         from '@/store/useAuthStore'
import { useDreamStore }        from '@/store/useDreamStore'
import { useSettingsStore }     from '@/store/useSettingsStore'
import type { ApiDream, ApiUser } from '@/api/types'
import type { ApiComment }      from '@/api/types'
import apiClient                from '@/api/client'

const { t } = useI18n()
const route      = useRoute()
const router     = useRouter()
const authStore  = useAuthStore()
const dreamStore = useDreamStore()
const settingsStore = useSettingsStore()

// ── State ─────────────────────────────────────────────────────────────────────
const isLoading  = ref(true)
const targetUser = ref<ApiUser | null>(null)
const userDreams = ref<ApiDream[]>([])
const nextCursor = ref<string | null>(null)
const hasMore    = ref(true)
const isLoadingMore = ref(false)
const sentinel   = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// ── Replies tab state ─────────────────────────────────────────────────────────
const myComments      = ref<ApiComment[]>([])
const isLoadingReplies = ref(false)

const isFollowersModalOpen = ref(false)
const followersModalTab = ref<'followers' | 'following' | 'pending'>('followers')
const reviewingRequestId = ref<string | null>(null)

// Contribution profile & achievements system states (Correction 8)
interface ContributionStats {
  approvedSourceCount: number
}

const contributionStats = ref<ContributionStats | null>(null)

const openFollowersModal = (tab: 'followers' | 'following' | 'pending') => {
  followersModalTab.value = tab
  isFollowersModalOpen.value = true
}

// ── Resolve which userId to fetch ─────────────────────────────────────────────
const targetUserId = computed<string>(() => {
  const paramId = route.params.id as string | undefined
  if (!paramId) return authStore.myId              // /profile → own profile
  return paramId                                    // /profile/:id
})

const isMe = computed(() => targetUserId.value === authStore.myId)

const canViewContent = computed(() => {
  if (isMe.value) return true
  if (!targetUser.value) return false
  if (targetUser.value.canViewPrivateContent !== undefined) {
    return targetUser.value.canViewPrivateContent
  }
  const isFollowing = targetUser.value.followers?.includes(authStore.myId) || false
  return !targetUser.value.isPrivateAccount || isFollowing
})

// ── Build a display User from targetUser, authStore or fallback ────────
const displayUser = computed<ApiUser>(() => {
  if (targetUser.value) return targetUser.value

  if (isMe.value && authStore.myUser) {
    return {
      _id:            authStore.myUser._id,
      username:       authStore.myUser.username,
      display_name:   authStore.myUser.display_name,
      avatar:         authStore.myUser.avatar ?? '',
      bio:            authStore.myUser.bio ?? '',
      follower_count: authStore.myUser.followers ? authStore.myUser.followers.length : (authStore.myUser.follower_count ?? 0),
      followers:      authStore.myUser.followers ?? [],
      following:      authStore.myUser.following ?? [],
      followRequests: [],
      followRequestCount: authStore.myUser.followRequestCount ?? 0,
      followStatus: 'none',
      statsVisible: true,
      canViewPrivateContent: true,
      isPrivateAccount: authStore.myUser.isPrivateAccount ?? false,
      dmPrivacy:      authStore.myUser.dmPrivacy ?? 'everyone',
      followersPrivacy: authStore.myUser.followersPrivacy ?? 'everyone',
      followingPrivacy: authStore.myUser.followingPrivacy ?? 'everyone',
      followersList:  authStore.myUser.followersList ?? [],
      followingList:  authStore.myUser.followingList ?? [],
      createdAt:      authStore.myUser.createdAt,
    }
  }

  // Final fallback
  return {
    _id:            targetUserId.value,
    username:       '@unknown',
    display_name:   'User',
    avatar:         '',
    bio:            '',
    follower_count: 0,
    followers:      [],
    following:      [],
    followRequests: [],
    followRequestCount: 0,
    followStatus: 'none',
    statsVisible: true,
    canViewPrivateContent: true,
    isPrivateAccount: false,
    dmPrivacy:      'everyone',
    followersPrivacy: 'everyone',
    followingPrivacy: 'everyone',
    followersList:  [],
    followingList:  [],
  }
})

/**
 * LIKES tab — dreams that myUser has liked, derived from the global dream store.
 * Only populated when isMe (privacy: only own profile sees liked posts).
 * Uses dreamStore.getLikedDreams(myId) to avoid a separate fetch.
 */
const likedDreams = computed(() => {
  if (!isMe.value) return []
  return dreamStore.getLikedDreams(authStore.myId)
})

/**
 * Build a User-shaped object for DreamCard from an ApiDream's populated userId.
 * Falls back to a stub if userId is a raw string (unlikely after populate).
 */
function getDreamAuthor(dream: ApiDream): ApiUser {
  if (typeof dream.userId === 'object' && dream.userId !== null) {
    const u = dream.userId as ApiUser
    return {
      _id:            u._id,
      username:       u.username,
      display_name:   u.display_name,
      avatar:         u.avatar ?? '',
      bio:            u.bio ?? '',
      follower_count: u.followers ? u.followers.length : (u.follower_count ?? 0),
      followers:      u.followers ?? [],
      following:      u.following ?? [],
      isPrivateAccount: u.isPrivateAccount ?? false,
      dmPrivacy:      u.dmPrivacy ?? 'everyone',
    }
  }
  // userId is a raw string — build a stub so DreamCard renders
  return {
    _id:            dream.userId as string,
    username:       '@unknown',
    display_name:   'User',
    avatar:         '',
    bio:            '',
    follower_count: 0,
    followers:      [],
    following:      [],
    isPrivateAccount: false,
    dmPrivacy:      'everyone',
  }
}

// ── Fetch Dreams ──────────────────────────────────────────────────────────────
async function fetchDreams(cursor: string | null = null) {
  const params: Record<string, string | number> = { limit: 10 }
  if (cursor) params.nextCursor = cursor
  const { data } = await apiClient.get(`/dreams/user/${targetUserId.value}`, { params })
  return data as { data: ApiDream[]; nextCursor: string | null }
}

async function loadProfile() {
  isLoading.value = true
  try {
    // 1. Fetch user details first
    try {
      const { data } = await apiClient.get(`/users/${targetUserId.value}`)
      if (data.success) {
        targetUser.value = data.user
        contributionStats.value = data.contributionStats || null
      }
    } catch (err) {
      targetUser.value = null
      contributionStats.value = null
    }

    // 2. Fetch dreams feed if allowed
    if (targetUser.value && canViewContent.value) {
      const result     = await fetchDreams(null)
      userDreams.value = result.data
      nextCursor.value = result.nextCursor
      hasMore.value    = result.nextCursor !== null
    } else {
      userDreams.value = []
      nextCursor.value = null
      hasMore.value    = false
    }
  } finally {
    isLoading.value = false
  }
}

async function loadMoreDreams() {
  if (isLoadingMore.value || !hasMore.value || !nextCursor.value || !canViewContent.value) return
  isLoadingMore.value = true
  try {
    const result = await fetchDreams(nextCursor.value)
    userDreams.value.push(...result.data)
    nextCursor.value = result.nextCursor
    hasMore.value    = result.nextCursor !== null
  } finally {
    isLoadingMore.value = false
  }
}

// ── Infinite Scroll ───────────────────────────────────────────────────────────
function setupObserver() {
  if (!sentinel.value) return
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && hasMore.value && !isLoadingMore.value && canViewContent.value) {
        loadMoreDreams()
      }
    },
    { threshold: 0.1 }
  )
  observer.observe(sentinel.value)
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref<TabId>('posts')

/**
 * Lazy-load the global feed when the Likes tab is first activated on own profile.
 */
watch(activeTab, async (tab) => {
  if (tab === 'likes' && isMe.value && dreamStore.dreams.length === 0) {
    await dreamStore.loadFeed()
  }
  // Fetch current user's comment history on first visit to the Replies tab
  if (tab === 'replies' && isMe.value && myComments.value.length === 0) {
    isLoadingReplies.value = true
    try {
      const { data } = await apiClient.get<{ success: boolean; data: ApiComment[] }>(
        `/comments/user/${authStore.myId}`
      )
      myComments.value = data.data
    } catch {
      myComments.value = []
    } finally {
      isLoadingReplies.value = false
    }
  }
})

// ── Edit support & Follow update handler ──────────────────────────────────────────
function handleProfileUpdate(updatedUser: Partial<ApiUser>) {
  if (isMe.value) {
    if (authStore.myUser) {
      authStore.updateCurrentUser({ ...authStore.myUser, ...updatedUser })
    }
  } else if (targetUser.value) {
    targetUser.value = { ...targetUser.value, ...updatedUser }
  }
  // Re-fetch everything to sync state (including visibility transitions)
  loadProfile()
}

async function reviewFollowRequest(payload: {
  requesterId: string
  action: 'approve' | 'reject'
}) {
  if (reviewingRequestId.value) return
  reviewingRequestId.value = payload.requesterId
  try {
    const { data } = await apiClient.patch(
      `/users/follow-requests/${payload.requesterId}`,
      { action: payload.action },
    )
    if (!data.success) return
    targetUser.value = data.user
    if (authStore.myUser) {
      authStore.updateCurrentUser({ ...authStore.myUser, ...data.user })
    }
    settingsStore.showToastKey(
      payload.action === 'approve'
        ? 'toasts.followRequestApproved'
        : 'toasts.followRequestRejected',
      undefined,
      'success',
    )
  } catch {
    settingsStore.showToastKey('errors.followRequestReviewFailed', undefined, 'error')
  } finally {
    reviewingRequestId.value = null
  }
}

// ── Profile delete handler ───────────────────────────────────────────────────
/**
 * When DreamCard emits 'delete' inside the Profile feed, splice the card
 * from the local userDreams ref so it disappears immediately.
 * (useDreamStore.removeDream already removed it from the global feed.)
 */
function handleProfileDelete(dreamId: string) {
  userDreams.value = userDreams.value.filter(d => d._id !== dreamId)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadProfile()
  setupObserver()
})

onUnmounted(() => { observer?.disconnect() })

watch(sentinel, (el) => { if (el && !observer) setupObserver() })
watch(() => route.params.id, async () => {
  activeTab.value  = 'posts'
  userDreams.value = []
  nextCursor.value = null
  hasMore.value    = true
  targetUser.value = null
  contributionStats.value = null
  await loadProfile()
})
</script>

<style scoped>
.profile-view {
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-bottom: var(--space-16);
}

.profile-skeleton-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) 0;
}
.profile-skeleton-tabs {
  padding: 0 var(--space-5);
}
.profile-skeleton-feed {
  padding: var(--space-4) 0;
}

/* ── 404 ── */
.profile-404 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-20) 0;
  color: var(--color-text-muted);
  text-align: center;
}
.profile-404__icon { font-size: 2rem; display: block; }
.profile-404__text { font-size: var(--font-size-base); }

/* ── Content area ── */
.profile-content {
  display: flex;
  flex-direction: column;
  padding-top: 16px; /* breathing room below the tab bar */
}

/* ── Feed ── */
.profile-feed { display: flex; flex-direction: column; gap: var(--space-4); }

/* ── Private Profile Lock ── */
.profile-private-lock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-16) var(--space-6);
  text-align: center;
}
.profile-private-lock__icon { font-size: 2rem; display: block; }
.profile-private-lock__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
.profile-private-lock__sub {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
  max-width: 320px;
}

/* ── Empty + Placeholder states ── */
.profile-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-16) 0;
  color: var(--color-text-muted);
  text-align: center;
  font-size: var(--font-size-base);
}

.profile-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-16) var(--space-6);
  text-align: center;
}
.profile-placeholder__icon { font-size: 1.75rem; color: var(--color-text-muted); display: block; }
.profile-placeholder__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
.profile-placeholder__sub {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: var(--line-height-relaxed);
  max-width: 320px;
}

/* Invisible IntersectionObserver target */
.profile-sentinel {
  height: 1px;
  width: 100%;
  pointer-events: none;
}

/* End-of-feed label */
.profile-end {
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  padding: var(--space-4) 0 var(--space-2);
}
</style>
