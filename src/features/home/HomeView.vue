<template>
  <div class="home-view">

    <!-- ══════════════════════════════════════════
         ① POST COMPOSER
    ═══════════════════════════════════════════ -->
    <div v-if="!dreamStore.searchQuery" class="composer">
      <!-- Left: current user avatar -->
      <div
        class="composer__avatar"
        :style="{ background: currentAvatarBg }"
        aria-hidden="true"
      >
        {{ currentInitials }}
      </div>

      <!-- Right: input area -->
      <div class="composer__body">
        <textarea
          id="composer-textarea"
          v-model="composerText"
          class="composer__textarea"
          placeholder="What did you dream about last night?"
          rows="3"
          :aria-label="'Write a new dream post'"
        />


        <!-- Composer footer: visibility toggle + post button -->
        <div class="composer__footer">
          <button
            id="visibility-toggle-btn"
            class="composer__visibility"
            :class="{ 'composer__visibility--private': !isPublic }"
            :aria-pressed="isPublic"
            :aria-label="isPublic ? 'Visibility: Public. Click to make private.' : 'Visibility: Private. Click to make public.'"
            @click="isPublic = !isPublic"
          >
            <!-- Globe (public) -->
            <svg v-if="isPublic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <!-- Lock (private) -->
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {{ isPublic ? 'Public' : 'Private' }}
          </button>

          <AppButton
            id="post-dream-btn"
            size="sm"
            variant="primary"
            :disabled="composerText.trim().length === 0 || isPosting"
            @click="handlePost"
          >
            {{ isPosting ? 'Posting…' : 'Post' }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="home-divider" role="separator" />

    <!-- ══════════════════════════════════════════
         ② SEARCH RESULT LABEL
    ═══════════════════════════════════════════ -->
    <div v-if="dreamStore.searchQuery" class="search-results-label">
      <span class="search-results-label__count">
        {{ filteredDreams.length }} result{{ filteredDreams.length !== 1 ? 's' : '' }}
      </span>
      <span class="search-results-label__query">for "{{ dreamStore.searchQuery }}"</span>
    </div>

    <!-- ══════════════════════════════════════════
         ③ DREAM FEED
    ═══════════════════════════════════════════ -->
    <section class="dream-feed" aria-label="Dream feed">
      <!-- Initial loading skeletons -->
      <template v-if="dreamStore.isLoading">
        <AppSkeleton v-for="i in 3" :key="i" type="card" />
      </template>

      <template v-else>
        <!-- Empty state -->
        <div v-if="filteredDreams.length === 0" class="feed-empty">
          <span class="feed-empty__icon" aria-hidden="true">◈</span>
          <p class="feed-empty__text">
            {{ dreamStore.searchQuery ? 'No dreams match your search.' : 'No dreams yet. Post your first one.' }}
          </p>
        </div>

        <!-- Dream cards -->
        <DreamCard
          v-for="item in filteredDreams"
          :key="item.dream._id"
          :dream="item.dream as any"
          :user="item.user as any"
          class="feed-card"
        />

        <!-- Infinite scroll sentinel -->
        <div ref="sentinel" class="feed-sentinel" aria-hidden="true" />

        <!-- Load more skeletons -->
        <template v-if="dreamStore.isLoadingMore">
          <AppSkeleton v-for="i in 2" :key="`more-${i}`" type="card" />
        </template>

        <!-- End of feed -->
        <div v-if="!dreamStore.hasMore && filteredDreams.length > 0" class="feed-end">
          <span>You've reached the end of the feed.</span>
        </div>
      </template>
    </section>

  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton       from '@/components/common/AppButton.vue'
import AppSkeleton     from '@/components/common/AppSkeleton.vue'
import DreamCard       from './DreamCard.vue'
import { useDreamStore } from '@/store/useDreamStore'
import { useAuthStore }  from '@/store/useAuthStore'
import { usePostStore }  from '@/store/usePostStore'
import type { ApiDream, ApiUser } from '@/api/types'
import { getInitials, getAvatarBg } from '@/data/mockUsers'

const dreamStore = useDreamStore()
const authStore  = useAuthStore()
const postStore  = usePostStore()
const route      = useRoute()
const router     = useRouter()


// ── Composer ──────────────────────────────────────────────────────────────────
const composerText = ref('')
const isPublic     = ref(true)
const isPosting    = ref(false)

watch(
  () => authStore.myUser?.defaultPrivacy,
  (newPrivacy) => {
    isPublic.value = newPrivacy !== 'private'
  },
  { immediate: true }
)

const currentUser     = computed(() => authStore.myUser)
const currentInitials = computed(() =>
  currentUser.value ? getInitials(currentUser.value.display_name) : '?'
)
const currentAvatarBg = computed(() =>
  currentUser.value ? getAvatarBg(currentUser.value._id) : '#262626'
)

async function handlePost(): Promise<void> {
  if (!composerText.value.trim() || isPosting.value) return
  isPosting.value = true
  try {
    await dreamStore.addDream(composerText.value, isPublic.value, '')
    composerText.value = ''
    isPublic.value     = authStore.myUser?.defaultPrivacy !== 'private'
  } catch { /* silently ignore for now */ }
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
    display_name:   'Unknown User',
    avatar:         '',
    bio:            '',
    follower_count: 0,
  }
}

const dreamsWithUsers = computed(() =>
  dreamStore.dreams.map(dream => ({ dream, user: resolveUser(dream) }))
)

const filteredDreams = computed(() => {
  const q = dreamStore.searchQuery.trim().toLowerCase()
  if (!q) return dreamsWithUsers.value
  return dreamsWithUsers.value.filter(({ dream, user }) =>
    dream.content.toLowerCase().includes(q) ||
    user.display_name.toLowerCase().includes(q) ||
    user.username.toLowerCase().includes(q) ||
    dream.mood_tag.toLowerCase().includes(q)
  )
})

// ── Infinite Scroll via IntersectionObserver ──────────────────────────────────
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function setupObserver() {
  if (!sentinel.value) return
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && dreamStore.hasMore && !dreamStore.isLoadingMore) {
        dreamStore.loadMore()
      }
    },
    { threshold: 0.1 }
  )
  observer.observe(sentinel.value)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await dreamStore.loadFeed()
  // Set up observer after feed loads so sentinel is rendered
  setupObserver()
})

onUnmounted(() => {
  observer?.disconnect()
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
   COMPOSER
═══════════════════════════════════════════ */
.composer {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) 0 var(--space-3);
}

.composer__avatar {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
  margin-top: 2px;
}

.composer__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.composer__textarea {
  width: 100%;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  resize: none;
  transition: border-color var(--transition-fast);
  font-family: var(--font-family-base);
}
.composer__textarea::placeholder { color: var(--color-text-muted); }
.composer__textarea:focus {
  border-color: #4a4a4a;
  outline: none;
}
.composer__footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.composer__visibility {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}
.composer__visibility:hover {
  background: var(--color-bg-hover);
  border-color: #3a3a3a;
  color: var(--color-text-primary);
}
.composer__visibility--private {
  border-color: #3a3a3a;
  color: var(--color-text-secondary);
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
