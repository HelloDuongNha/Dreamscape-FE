<template>
  <div
    :class="[
      'main-layout',
      { 
        'main-layout--collapsed': sidebarCollapsed,
        'main-layout--full-bleed': isFullBleed
      }
    ]"
    role="application"
  >
    <!-- ── Sidebar ─────────────────────────────────────────── -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      @toggle="sidebarCollapsed = !sidebarCollapsed"
    />

    <!-- ── Right-side body ────────────────────────────────── -->
    <div class="main-layout__body">

      <!-- Sticky top header -->
      <header id="app-header" class="main-layout__header" role="banner">
        <div class="main-layout__header-inner">

          <!-- Left: burger (mobile) + page title -->
          <div class="main-layout__header-left">
            <button
              id="mobile-menu-btn"
              class="main-layout__burger"
              :aria-expanded="!sidebarCollapsed"
              aria-label="Toggle navigation"
              @click="sidebarCollapsed = !sidebarCollapsed"
            >
              <span /><span /><span />
            </button>

            <slot name="header-title">
              <button
                class="main-layout__page-title-btn"
                :aria-label="route.path === '/' ? 'Scroll to top and refresh feed' : 'Go to Home'"
                @click="handleHomeClick"
              >
                <span class="main-layout__page-title">{{ pageTitle }}</span>
              </button>
            </slot>
          </div>

          <!-- Right: header search (Home only) + actions slot -->
          <div class="main-layout__header-right">

            <!-- ── Compact search bar — only visible on the Home feed ── -->
            <div v-if="route.path === '/'" class="header-search">
              <label for="header-search-input" class="sr-only">Search dreams</label>
              <div class="header-search__bar">
                <svg class="header-search__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  id="header-search-input"
                  v-model="dreamStore.searchQuery"
                  type="search"
                  placeholder="Search dreams..."
                  autocomplete="off"
                  spellcheck="false"
                  class="header-search__input"
                />
                <button
                  v-if="dreamStore.searchQuery"
                  id="header-search-clear"
                  class="header-search__clear"
                  aria-label="Clear search"
                  @click="dreamStore.searchQuery = ''"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <slot name="header-actions">
              <!-- Notification wrapper with dropdown -->
              <div class="notifications-wrapper">
                <button
                  id="notif-btn"
                  class="main-layout__icon-btn"
                  aria-label="Notifications"
                  @click.stop="toggleNotifications"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  <span v-if="notificationStore.unreadCount > 0" class="main-layout__notif-dot" aria-hidden="true" />
                </button>

                <!-- Dropdown -->
                <div
                  v-if="showNotifications"
                  class="notifications-dropdown"
                  @click.stop
                >
                  <div class="notifications-dropdown__header">
                    <h3>Notifications</h3>
                    <button
                      v-if="notificationStore.unreadCount > 0"
                      class="notifications-dropdown__mark-all"
                      @click="notificationStore.markAllRead"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div class="notifications-dropdown__body">
                    <div v-if="notificationStore.isLoading" class="notifications-dropdown__loading">
                      Loading...
                    </div>
                    <div v-else-if="notificationStore.notifications.length === 0" class="notifications-dropdown__empty">
                      No notifications yet
                    </div>
                    <div v-else class="notifications-dropdown__list">
                      <div
                        v-for="notif in notificationStore.notifications"
                        :key="notif._id"
                        :class="['notifications-dropdown__item', { 'notifications-dropdown__item--unread': !notif.isRead }]"
                        @click="handleNotificationClick(notif)"
                      >
                        <div
                          class="notifications-dropdown__avatar"
                          :style="{ background: getAvatarBg(notif.senderId?._id ?? '') }"
                        >
                          {{ getInitials(notif.senderId?.display_name ?? 'Anonymous') }}
                        </div>
                        <div class="notifications-dropdown__content">
                          <p class="notifications-dropdown__text">
                            <span v-if="notif.type === 'dream_analysis'" class="notifications-dropdown__name">Oracle đã phân tích xong giấc mơ</span>
                            <template v-else>
                              <span class="notifications-dropdown__name">{{ notif.senderId?.display_name }}</span>
                            </template>
                            <span v-if="notif.type === 'like'"> liked your dream</span>
                            <span v-else-if="notif.type === 'comment'"> commented on your dream</span>
                            <span v-else-if="notif.type === 'follow'"> followed you</span>
                          </p>
                          <span class="notifications-dropdown__time">{{ timeAgo(notif.timestamp) }}</span>
                        </div>
                        <span v-if="!notif.isRead" class="notifications-dropdown__unread-badge" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Avatar -->
              <button
                id="avatar-btn"
                class="main-layout__avatar"
                aria-label="Go to my profile"
                aria-haspopup="false"
                @click="handleAvatarClick"
                :style="{ background: avatarBg }"
              >
                <img
                  v-if="authStore.user?.avatar"
                  :src="authStore.user.avatar"
                  :alt="authStore.user.display_name"
                  class="main-layout__avatar-img"
                />
                <span v-else class="main-layout__avatar-initials" aria-hidden="true">
                  {{ headerInitials }}
                </span>
              </button>
            </slot>
          </div>

        </div>
      </header>

      <!-- Page content -->
      <RouterView v-slot="{ Component, route }">
        <Transition name="fade" mode="out-in">
          <main
            :key="route.path"
            id="main-content"
            :class="[
              'main-layout__content',
              { 'main-layout__content--full': isFullBleed }
            ]"
            role="main"
          >
            <div :class="['main-layout__content-inner', { 'main-layout__content-inner--full': isFullBleed }]">
              <component :is="Component" />
            </div>
          </main>
        </Transition>
      </RouterView>

    </div><!-- /main-layout__body -->
    <PostDetailModal />
    <OraclePendingModal />
    <ExtractionPendingModal />
    <SourceProgressModal />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import PostDetailModal from '@/features/home/PostDetailModal.vue'
import OraclePendingModal from '@/components/common/OraclePendingModal.vue'
import ExtractionPendingModal from '@/components/common/ExtractionPendingModal.vue'
import SourceProgressModal from '@/components/common/SourceProgressModal.vue'
import { useDreamStore } from '@/store/useDreamStore'
import { useNotificationStore } from '@/store/useNotificationStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useOracleStore } from '@/store/useOracleStore'
import type { ApiDream, ApiNotification } from '@/api/types'
import { getInitials, getAvatarBg } from '@/data/mockUsers'
import { timeAgo } from '@/utils/timeAgo'
import apiClient from '@/api/client'

const sidebarCollapsed = ref(false)
const route = useRoute()
const router = useRouter()
const dreamStore = useDreamStore()
const notificationStore = useNotificationStore()
const authStore = useAuthStore()
const oracleStore = useOracleStore()

const avatarBg = computed(() => {
  return authStore.user?._id ? getAvatarBg(authStore.user._id) : '#262626'
})

const headerInitials = computed(() => {
  const name = authStore.user?.display_name || authStore.user?.username || ''
  return getInitials(name)
})

// ── Global Heartbeat Session screen-time tracker ─────────────────────────────
let heartbeatInterval: any = null








const showNotifications = ref(false)

function toggleNotifications() {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    notificationStore.fetchNotifications()
  }
}

async function handleNotificationClick(notif: ApiNotification) {
  showNotifications.value = false
  if (notif.type === 'dream_analysis') {
    const targetPostId = notif.postId && typeof notif.postId === 'object' ? notif.postId._id : notif.postId
    if (targetPostId) {
      try {
        const { data } = await apiClient.get<{ success: boolean; data: ApiDream }>(`/dreams/${targetPostId}`)
        if (data.success && data.data.ai_status === 'completed') {
          oracleStore.openCompletedDialog(data.data)
        }
      } catch (error) {
        console.error('Failed to open completed Oracle analysis:', error)
      }
    }
  } else if (notif.type === 'follow') {
    const userId = notif.senderId?._id || notif.senderId
    if (userId) {
      router.push(`/profile/${userId}`)
    }
  } else {
    const targetPostId = notif.postId && typeof notif.postId === 'object' ? notif.postId._id : notif.postId
    if (targetPostId) {
      router.push({ path: '/', query: { openPostId: String(targetPostId) } })
    }
  }
  await notificationStore.markAllRead()
}

async function sendHeartbeat() {
  try {
    const { data } = await apiClient.post<any>('/users/me/heartbeat')
    if (data.success && authStore.user) {
      authStore.updateCurrentUser({
        ...authStore.user,
        timeOnlineToday: data.timeOnlineToday
      })
    }
  } catch (err) {
    console.error('Failed to send heartbeat ping:', err)
  }
}

function handleOutsideClick() {
  showNotifications.value = false
}

/** Avatar → navigate to own profile */
function handleAvatarClick() {
  const id = authStore.myId
  if (id) router.push(`/profile/${id}`)
}

/** Page title click — Home: scroll-to-top + silent reload; else navigate to / */
function handleHomeClick() {
  if (route.path === '/') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    dreamStore.loadFeed()
  } else {
    router.push('/')
  }
}

onMounted(() => {
  notificationStore.fetchNotifications()
  window.addEventListener('click', handleOutsideClick)
  if (authStore.isLoggedIn) {
    sendHeartbeat()
  }
  heartbeatInterval = setInterval(() => {
    if (authStore.isLoggedIn) {
      sendHeartbeat()
    }
  }, 60000)
})

onUnmounted(() => {
  window.removeEventListener('click', handleOutsideClick)
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }
})

/** Routes that need edge-to-edge layout (no max-width, no padding) */
const FULL_BLEED_ROUTES = ['/messages']

const isFullBleed = computed(() => {
  return FULL_BLEED_ROUTES.includes(route.path) || 
         route.path.startsWith('/library/sources/') ||
         (route.path.startsWith('/moderation/sources/') && route.path.endsWith('/preview'))
})


const pageTitle = computed(() => {
  if (route.path.startsWith('/library/sources/')) {
    return 'Chi tiết tài liệu'
  }
  if (route.path.startsWith('/moderation/sources/') && route.path.endsWith('/preview')) {
    return 'Xem trước tài liệu'
  }
  const map: Record<string, string> = {
    '/':          'Home',
    '/oracle':    'Oracle',
    '/messages':  'Messages',
    '/profile':   'Profile',
    '/achievements': 'Achievements',
    '/library':   'Thư viện',
    '/moderation/sources': 'Duyệt nguồn',
  }
  return map[route.path] ?? 'DreamScape'
})

defineProps<{ title?: string }>()
</script>

<style scoped>
/* ── Outer shell ───────────────────────────────────────────────── */
.main-layout {
  display: flex;
  min-height: 100dvh;
  background: var(--color-bg-base);
}

/* ── Body (everything right of the sidebar) ────────────────────── */
.main-layout__body {
  margin-left: var(--sidebar-width);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  /* Only margin-left transitions — no layout-thrashing properties */
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.main-layout--collapsed .main-layout__body {
  margin-left: var(--sidebar-collapsed);
}

/* ── Header ────────────────────────────────────────────────────── */
.main-layout__header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  height: var(--header-height);
  background: var(--color-bg-base);     /* solid — no blur */
  border-bottom: 1px solid var(--color-border);
}

.main-layout__header-inner {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  width: 100%;
}

/* ── Header left ───────────────────────────────────────────────── */
.main-layout__header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.main-layout__page-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: var(--letter-spacing-tight);
}

/* Strip button chrome from the page-title wrapper */
.main-layout__page-title-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
}

/* ── Header right ──────────────────────────────────────────────── */
.main-layout__header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* ── Icon buttons ──────────────────────────────────────────────── */
.main-layout__icon-btn {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-icon-default);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.main-layout__icon-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-icon-active);
}

/* Notification dot — solid red, no glow */
.main-layout__notif-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-danger);
  border: 1.5px solid var(--color-bg-base);
}

/* ── Avatar ────────────────────────────────────────────────────── */
.main-layout__avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
  flex-shrink: 0;
}
.main-layout__avatar:hover {
  background: var(--color-bg-hover);
  border-color: #3a3a3a;
}
.main-layout__avatar-initials {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: 1;
}

/* Avatar photo — fills button square */
.main-layout__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-full);
  display: block;
}

/* ── Mobile burger ─────────────────────────────────────────────── */
.main-layout__burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  flex-shrink: 0;
}
.main-layout__burger span {
  display: block;
  width: 100%;
  height: 1.5px;
  background: var(--color-text-secondary);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
}
.main-layout__burger:hover span { background: var(--color-text-primary); }

/* ── Content area ──────────────────────────────────────────────── */
.main-layout__content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Wide-screen fluid column — uses 92vw up to 1440px */
.main-layout__content-inner {
  max-width: min(1440px, 92vw);
  margin: 0 auto;
  padding: var(--space-6);
  width: 100%;
}

/* Full-bleed override — used by /messages and other edge-to-edge views */
.main-layout__content--full {
  overflow: hidden;   /* let child panes handle their own scroll */
  height: 100%;
  min-height: 0;
}
.main-layout__content-inner--full {
  max-width: none;
  margin: 0;
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ── Page transition (opacity only — no layout shift) ──────────── */
.page-fade-enter-active { transition: opacity var(--transition-base); }
.page-fade-leave-active { transition: opacity var(--transition-fast); }
.page-fade-enter-from,
.page-fade-leave-to     { opacity: 0; }

/* ── Responsive ────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .main-layout__burger        { display: flex; }
  .main-layout__content-inner { padding: var(--space-4); }
  .main-layout__header-inner  { padding: 0 var(--space-4); }
}

@media (max-width: 600px) {
  .main-layout__content-inner { padding: var(--space-3); }
}
/* ── Header search bar (Home route only) ───────────────────────── */
.header-search {
  display: flex;
  align-items: center;
  margin-right: var(--space-2);
}

.header-search__bar {
  position: relative;
  display: flex;
  align-items: center;
  background: #1a1a1a;
  border: 1px solid #2e2e2e;
  border-radius: var(--radius-full);
  height: 34px;
  width: 220px;
  padding: 0 var(--space-3);
  gap: var(--space-2);
  transition: border-color var(--transition-fast), width var(--transition-base);
}
.header-search__bar:focus-within {
  border-color: #3a3a3a;
  width: 280px;
}

.header-search__icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.header-search__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  min-width: 0;
}
.header-search__input::placeholder { color: var(--color-text-muted); }
/* Remove default browser search-cancel button */
.header-search__input::-webkit-search-cancel-button { display: none; }

.header-search__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  background: #333;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.header-search__clear:hover { background: #444; color: var(--color-text-primary); }

/* Screen reader only helper */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .header-search__bar { width: 160px; }
  .header-search__bar:focus-within { width: 200px; }
}
@media (max-width: 600px) {
  .header-search { display: none; }
}

/* ── Notifications Dropdown ─────────────────────────────────── */
.notifications-wrapper {
  position: relative;
  display: inline-block;
}

.notifications-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 320px;
  max-height: 360px;
  background: #181818;
  border: 1px solid #262626;
  border-radius: 4px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.notifications-dropdown__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  border-bottom: 1px solid #262626;
}

.notifications-dropdown__header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.notifications-dropdown__mark-all {
  background: transparent;
  border: none;
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  padding: 0;
  transition: color var(--transition-fast);
}

.notifications-dropdown__mark-all:hover {
  color: var(--color-primary-hover, #60a5fa);
}

.notifications-dropdown__body {
  overflow-y: auto;
  flex: 1;
}

.notifications-dropdown__loading,
.notifications-dropdown__empty {
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.notifications-dropdown__list {
  display: flex;
  flex-direction: column;
}

.notifications-dropdown__item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid #202020;
  cursor: pointer;
  transition: background var(--transition-fast);
  align-items: flex-start;
}

.notifications-dropdown__item:last-child {
  border-bottom: none;
}

.notifications-dropdown__item:hover {
  background: var(--color-bg-hover);
}

.notifications-dropdown__item--unread {
  background: #202020;
}

.notifications-dropdown__avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: bold;
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.notifications-dropdown__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notifications-dropdown__text {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.4;
  word-wrap: break-word;
}

.notifications-dropdown__name {
  color: var(--color-text-primary);
  font-weight: 500;
}

.notifications-dropdown__time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.notifications-dropdown__unread-badge {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-danger);
  margin-top: 6px;
  flex-shrink: 0;
}

/* Full bleed locks and overrides */
.main-layout--full-bleed {
  height: 100vh !important;
  height: 100dvh !important;
  overflow: hidden !important;
}

.main-layout--full-bleed .main-layout__body {
  height: 100vh !important;
  height: 100dvh !important;
  min-height: 0 !important;
  overflow: hidden !important;
}
</style>
