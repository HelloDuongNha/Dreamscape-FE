<template>
  <div class="home-view">

    <!-- ══════════════════════════════════════════
         ① POST COMPOSER
    ═══════════════════════════════════════════ -->
    <DreamComposer
      v-if="!isSearchMode"
      v-model:text="composerText"
      v-model:public="isPublic"
      v-model:ai-analysis="aiAnalysisEnabled"
      :user="currentUser"
      :posting="isPosting"
      @submit="handlePost"
    />

    <!-- Divider -->
    <div class="home-divider" role="separator" />

    <!-- ══════════════════════════════════════════
         ② SEARCH RESULT LABEL
    ═══════════════════════════════════════════ -->
    <div v-if="isSearchMode" class="search-results-label" aria-live="polite">
      <span class="search-results-label__count">
        {{ t('home.resultsCount', searchTab === 'users' ? userSearchResults.length : displayedItems.length) }}
      </span>
      <span v-if="dreamStore.searchQuery.trim()" class="search-results-label__query">
        {{ t('home.resultsFor') }} <span translate="no">“{{ dreamStore.searchQuery }}”</span>
      </span>
      <span v-if="dreamStore.searchMood" class="search-results-label__query">
        · {{ t(`home.moodScale.label.${dreamStore.searchMood}`) }}
      </span>
    </div>

    <div v-if="isSearchMode" class="search-tabs" role="tablist" :aria-label="t('home.searchTabsAria')">
      <button
        type="button"
        class="search-tabs__tab"
        :class="{ 'search-tabs__tab--active': searchTab === 'posts' }"
        role="tab"
        :aria-selected="searchTab === 'posts'"
        @click="searchTab = 'posts'"
      >{{ t('home.searchPostsTab') }}</button>
      <button
        type="button"
        class="search-tabs__tab"
        :class="{ 'search-tabs__tab--active': searchTab === 'users' }"
        role="tab"
        :aria-selected="searchTab === 'users'"
        @click="searchTab = 'users'"
      >{{ t('home.searchUsersTab') }}</button>
    </div>

    <DreamMoodFilter v-if="!isSearchMode || searchTab === 'posts'" v-model="dreamStore.searchMood" />

    <section
      v-if="isSearchMode && searchTab === 'users'"
      class="user-search-results"
      :aria-label="t('home.searchUsersTab')"
    >
      <template v-if="isSearchingUsers">
        <AppSkeleton v-for="i in 3" :key="`user-${i}`" type="list" />
      </template>
      <div v-else-if="userSearchError" class="feed-empty" role="alert">
        <AppIcon class="feed-empty__icon" name="warning" :size="24" />
        <p class="feed-empty__text">{{ t('home.searchError') }}</p>
      </div>
      <div v-else-if="userSearchResults.length === 0" class="feed-empty">
        <span class="feed-empty__icon" aria-hidden="true">◌</span>
        <p class="feed-empty__text">{{ t('home.noUserSearchResults') }}</p>
      </div>
      <div v-else class="user-search-results__list">
        <RouterLink
          v-for="user in userSearchResults"
          :key="user._id"
          :to="`/profile/${user._id}`"
          class="user-search-row"
        >
          <UserAvatar :user="user" size="md" />
          <span class="user-search-row__info">
            <strong>{{ user.display_name }}</strong>
            <span>{{ formatUsername(user.username) }}</span>
            <small v-if="user.bio">{{ user.bio }}</small>
          </span>
          <span class="user-search-row__arrow" aria-hidden="true">›</span>
        </RouterLink>
      </div>
    </section>

    <!-- ══════════════════════════════════════════
         ③ DREAM FEED
    ═══════════════════════════════════════════ -->
    <section v-else class="dream-feed" :aria-label="t('home.feedAria')">
      <!-- Initial loading skeletons -->
      <template v-if="isInitialLoading">
        <AppSkeleton v-for="i in 3" :key="i" type="card" />
      </template>

      <template v-else>
        <div v-if="isSearchMode && dreamStore.searchError" class="feed-empty" role="alert">
        <AppIcon class="feed-empty__icon" name="warning" :size="24" />
          <p class="feed-empty__text">{{ t('home.searchError') }}</p>
          <AppButton size="sm" variant="secondary" @click="dreamStore.searchDreams()">
            {{ t('home.retrySearch') }}
          </AppButton>
        </div>

        <!-- Empty state -->
        <div v-else-if="displayedItems.length === 0" class="feed-empty">
          <span class="feed-empty__icon" aria-hidden="true">◈</span>
          <p class="feed-empty__text">
            {{ isSearchMode ? t('home.noSearchResults') : t('home.noDreams') }}
          </p>
        </div>

        <!-- Dream cards -->
        <DreamCard
          v-for="item in displayedItems"
          :key="item.dream._id"
          :dream="item.dream"
          :user="item.user"
          :content-highlights="item.dreamRanges"
          :matched-comments="item.matchedComments"
          :matched-comment-count="item.matchedCommentCount"
          class="feed-card"
        />

        <!-- Infinite scroll sentinel -->
        <div ref="sentinel" class="feed-sentinel" aria-hidden="true" />

        <!-- Load more skeletons -->
        <template v-if="isLoadingMoreResults">
          <AppSkeleton v-for="i in 2" :key="`more-${i}`" type="card" />
        </template>

        <!-- End of feed -->
        <div v-if="!hasMoreResults && displayedItems.length > 0" class="feed-end">
          <span>{{ isSearchMode ? t('home.searchEnd') : t('home.feedEnd') }}</span>
        </div>
      </template>
    </section>

  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppButton       from '@/components/common/AppButton.vue'
import AppSkeleton     from '@/components/common/AppSkeleton.vue'
import AppIcon         from '@/components/common/AppIcon.vue'
import DreamMoodFilter from '@/components/common/DreamMoodFilter.vue'
import UserAvatar     from '@/components/common/UserAvatar.vue'
import DreamCard       from './DreamCard.vue'
import DreamComposer   from './DreamComposer.vue'
import { useDreamStore } from '@/store/useDreamStore'
import { useAuthStore }  from '@/store/useAuthStore'
import { usePostStore }  from '@/store/usePostStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import apiClient          from '@/api/client'
import { formatUsername } from '@/utils/username'
import type { ApiDream, ApiUser, DreamSearchItem } from '@/api/types'

const dreamStore = useDreamStore()
const authStore  = useAuthStore()
const postStore  = usePostStore()
const settingsStore = useSettingsStore()
const route      = useRoute()
const router     = useRouter()
const { t }      = useI18n({ useScope: 'global' })


// ── Composer ──────────────────────────────────────────────────────────────────
const composerText = ref('')
const isPublic     = ref(true)
const aiAnalysisEnabled = ref(true)
const isPosting    = ref(false)
const searchTab = ref<'posts' | 'users'>('posts')
const userSearchResults = ref<ApiUser[]>([])
const isSearchingUsers = ref(false)
const userSearchError = ref(false)
let userSearchRequest = 0

watch(
  () => authStore.myUser?.defaultPrivacy,
  (newPrivacy) => {
    isPublic.value = newPrivacy !== 'private'
  },
  { immediate: true }
)

const currentUser     = computed(() => authStore.myUser)

async function handlePost(): Promise<void> {
  if (!composerText.value.trim() || isPosting.value) return
  isPosting.value = true
  try {
    await dreamStore.addDream(composerText.value, isPublic.value, '', aiAnalysisEnabled.value)
    composerText.value = ''
    isPublic.value     = authStore.myUser?.defaultPrivacy !== 'private'
    aiAnalysisEnabled.value = true
  } catch {
    settingsStore.showToast(t('home.postFailed'), 'error')
  }
  finally { isPosting.value = false }
}

// ── Search (read from store — written by header input in MainLayout) ──────────

/**
 * Normalize each dream into { dream, user } shape for DreamCard.
 * The API returns userId as a populated object (ApiUser) or a raw string id.
 */
function resolveUser(dream: ApiDream): ApiUser {
  if (typeof dream.userId === 'object' && dream.userId !== null) {
    return dream.userId as ApiUser
  }
  // Fallback: anonymous placeholder
  return {
    _id:            String(dream.userId),
    username:       '@unknown',
    display_name:   t('home.unknownUser'),
    avatar:         '',
    bio:            '',
    follower_count: 0,
  }
}

type PresentedDreamSearchItem = DreamSearchItem & { user: ApiUser }

const isSearchMode = computed(() =>
  Boolean(dreamStore.searchQuery.trim() || dreamStore.searchMood)
)
const feedItems = computed<PresentedDreamSearchItem[]>(() =>
  dreamStore.dreams.map(dream => ({
    dream,
    user: resolveUser(dream),
    dreamRanges: [],
    matchedComments: [],
    matchedCommentCount: 0,
  }))
)
const displayedItems = computed<PresentedDreamSearchItem[]>(() =>
  isSearchMode.value
    ? dreamStore.searchResults.map(item => ({ ...item, user: resolveUser(item.dream) }))
    : feedItems.value
)
const isInitialLoading = computed(() =>
  isSearchMode.value ? dreamStore.isSearching && !dreamStore.searchResults.length : dreamStore.isLoading
)
const isLoadingMoreResults = computed(() =>
  isSearchMode.value ? dreamStore.isSearchLoadingMore : dreamStore.isLoadingMore
)
const hasMoreResults = computed(() =>
  isSearchMode.value ? Boolean(dreamStore.searchNextCursor) : dreamStore.hasMore
)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [() => dreamStore.searchQuery, () => dreamStore.searchMood, searchTab],
  () => {
    dreamStore.prepareSearchCriteriaChange()
    if (searchTimer) clearTimeout(searchTimer)
    if (searchTab.value === 'users') {
      void searchUsers()
      return
    }
    searchTimer = setTimeout(() => {
      void dreamStore.searchDreams()
    }, 300)
  },
)

async function searchUsers(): Promise<void> {
  const query = dreamStore.searchQuery.trim()
  const requestId = ++userSearchRequest
  if (!query) {
    userSearchResults.value = []
    userSearchError.value = false
    isSearchingUsers.value = false
    return
  }
  isSearchingUsers.value = true
  userSearchError.value = false
  try {
    const { data } = await apiClient.post<{ success: boolean; data: ApiUser[] }>(
      '/conversations/search',
      { username: query },
    )
    if (requestId === userSearchRequest) {
      userSearchResults.value = data.data ?? []
    }
  } catch {
    if (requestId === userSearchRequest) userSearchError.value = true
  } finally {
    if (requestId === userSearchRequest) isSearchingUsers.value = false
  }
}

// ── Infinite Scroll via IntersectionObserver ──────────────────────────────────
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function setupObserver() {
  if (!sentinel.value) return
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      if (isSearchMode.value) {
        if (dreamStore.searchNextCursor && !dreamStore.isSearchLoadingMore) {
          void dreamStore.loadMoreSearchResults()
        }
        return
      }
      if (dreamStore.hasMore && !dreamStore.isLoadingMore) void dreamStore.loadMore()
    },
    { threshold: 0.1 }
  )
  observer.observe(sentinel.value)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await dreamStore.loadFeed()
  if (isSearchMode.value) await dreamStore.searchDreams()
  // Set up observer after feed loads so sentinel is rendered
  setupObserver()
})

onUnmounted(() => {
  observer?.disconnect()
  if (searchTimer) clearTimeout(searchTimer)
})

// Re-attach observer if it wasn't set up on initial load (rare edge case)
watch(sentinel, (el) => {
  if (el && !observer) setupObserver()
})

watch(
  () => route.query.openPostId,
  (newPostId) => {
    if (newPostId && typeof newPostId === 'string' && newPostId !== '[object Object]') {
      postStore.openPost(newPostId)
    }
  },
  { immediate: true, deep: true }
)

watch(
  () => postStore.focusedId,
  (newId, oldId) => {
    if (oldId && !newId && route.query.openPostId) {
      router.replace({ path: '/', query: {} })
    }
  }
)
</script>

<style scoped>
/* ── Page shell ── */
.home-view {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
}

/* ══════════════════════════════════════════
   DIVIDER
═══════════════════════════════════════════ */
.home-divider {
  height: 1px;
  background: var(--color-border);
  margin: var(--space-1) 0 var(--space-4);
}

/* ══════════════════════════════════════════
   SEARCH RESULTS LABEL
═══════════════════════════════════════════ */
.search-results-label {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: 0 0 var(--space-3);
}
.search-results-label__count {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}
.search-results-label__query {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.search-tabs {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
}
.search-tabs__tab {
  position: relative;
  padding: var(--space-2) var(--space-4);
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: color var(--transition-fast);
}
.search-tabs__tab::after {
  content: '';
  position: absolute;
  right: var(--space-3);
  bottom: -1px;
  left: var(--space-3);
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: transparent;
  transition: background var(--transition-fast);
}
.search-tabs__tab:hover,
.search-tabs__tab--active { color: var(--color-text-primary); }
.search-tabs__tab--active::after { background: var(--color-primary); }
.user-search-results {
  padding-bottom: var(--space-16);
}
.user-search-results__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.user-search-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  color: inherit;
  text-decoration: none;
  transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
}
.user-search-row:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border);
  transform: translateY(-1px);
}
.user-search-row__info {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.user-search-row__info strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-search-row__info span {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}
.user-search-row__info small {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-search-row__arrow {
  color: var(--color-text-muted);
  font-size: 1.35rem;
}

/* ══════════════════════════════════════════
   DREAM FEED
═══════════════════════════════════════════ */
.dream-feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: var(--space-16);
}

/* Invisible sentinel element for IntersectionObserver */
.feed-sentinel {
  height: 1px;
  width: 100%;
  pointer-events: none;
}

/* End-of-feed message */
.feed-end {
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  padding: var(--space-4) 0 var(--space-2);
}

/* Empty state */
.feed-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-16) 0;
  text-align: center;
}
.feed-empty__icon {
  font-size: 2rem;
  color: var(--color-text-muted);
  display: block;
}
.feed-empty__text {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
}

/* Responsive */
@media (max-width: 600px) {
  .home-view { max-width: 100%; }
}
</style>
