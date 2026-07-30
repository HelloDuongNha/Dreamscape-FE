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
      <header
        id="app-header"
        class="main-layout__header"
        :class="{ 'main-layout__header--with-search': route.path === '/' }"
        role="banner"
      >
        <div class="main-layout__header-inner">

          <!-- Left: burger (mobile) + page title -->
          <div class="main-layout__header-left">
            <button
              id="mobile-menu-btn"
              class="main-layout__burger"
              :aria-expanded="!sidebarCollapsed"
              :aria-label="t('common.toggleNav')"
              @click="sidebarCollapsed = !sidebarCollapsed"
            >
              <span /><span /><span />
            </button>

            <slot name="header-title">
              <button
                class="main-layout__page-title-btn"
                :aria-label="route.path === '/' ? t('common.scrollToTop') : t('common.goHome')"
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
              <label for="header-search-input" class="sr-only">{{ t('common.searchLabel') }}</label>
              <div class="header-search__bar">
                <svg class="header-search__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  id="header-search-input"
                  v-model="dreamStore.searchQuery"
                  type="search"
                  :placeholder="t('common.searchPlaceholder')"
                  autocomplete="off"
                  spellcheck="false"
                  class="header-search__input"
                />
                <button
                  v-if="dreamStore.searchQuery"
                  id="header-search-clear"
                  class="header-search__clear"
                  :aria-label="t('common.clearSearch')"
                  @click="dreamStore.searchQuery = ''"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <slot name="header-actions">
              <button
                id="locale-switch-btn"
                class="locale-switch"
                :aria-label="localeStore.currentLocale === 'vi' ? t('common.switchToEnglish') : t('common.switchToVietnamese')"
                :title="localeStore.currentLocale === 'vi' ? t('common.switchToEnglish') : t('common.switchToVietnamese')"
                @click="localeStore.toggleLocale()"
              >
                <span class="locale-switch__track" aria-hidden="true">
                  <span :class="{ 'is-active': localeStore.currentLocale === 'en' }">En</span>
                  <span :class="{ 'is-active': localeStore.currentLocale === 'vi' }">Vi</span>
                </span>
              </button>

              <!-- Notification wrapper with dropdown -->
              <div class="notifications-wrapper">
                <button
                  id="notif-btn"
                  class="main-layout__icon-btn"
                  :aria-label="t('notifications.buttonLabel')"
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
                    <h3>{{ t('notifications.title') }}</h3>
                    <button
                      v-if="notificationStore.unreadCount > 0"
                      class="notifications-dropdown__mark-all"
                      :disabled="notificationActionId === 'mark-all'"
                      @click="handleMarkAllNotificationsRead"
                    >
                      {{ t('notifications.markAllRead') }}
                    </button>
                  </div>
                  <div class="notifications-dropdown__body">
                    <div v-if="notificationStore.isLoading" class="notifications-dropdown__loading">
                      {{ t('notifications.loading') }}
                    </div>
                    <div v-else-if="notificationStore.hasLoadError" class="notifications-dropdown__empty">
                      <span>{{ t('notifications.loadError') }}</span>
                      <button type="button" @click="notificationStore.fetchNotifications">
                        {{ t('notifications.retry') }}
                      </button>
                    </div>
                    <div v-else-if="notificationStore.notifications.length === 0" class="notifications-dropdown__empty">
                      {{ t('notifications.empty') }}
                    </div>
                    <div v-else class="notifications-dropdown__list">
                      <div
                        v-for="notif in notificationStore.notifications"
                        :key="notif._id"
                        :class="[
                          'notifications-dropdown__item',
                          {
                            'notifications-dropdown__item--unread': !notif.isRead,
                            'notifications-dropdown__item--viewable': hasNotificationTarget(notif),
                            'notifications-dropdown__item--busy': notificationActionId === notif._id,
                          },
                        ]"
                        :role="hasNotificationTarget(notif) ? 'button' : undefined"
                        :tabindex="hasNotificationTarget(notif) ? 0 : undefined"
                        @click="handleNotificationClick(notif)"
                        @keydown.enter.prevent="handleNotificationClick(notif)"
                        @keydown.space.prevent="handleNotificationClick(notif)"
                      >
                        <div
                          class="notifications-dropdown__avatar"
                          :style="{ background: getAvatarBg(notif.senderId?._id ?? '') }"
                        >
                          {{ getInitials(notif.senderId?.display_name ?? t('notifications.anonymous')) }}
                        </div>
                        <div class="notifications-dropdown__content">
                          <p class="notifications-dropdown__text">
                            <span v-if="notif.type === 'dream_analysis'" class="notifications-dropdown__name">{{ t('notifications.oracleAnalyzed') }}</span>
                            <template v-else>
                              <span class="notifications-dropdown__name">{{ notif.senderId?.display_name ?? t('notifications.anonymous') }}</span>
                            </template>
                            <span v-if="notif.type === 'like'"> {{ t('notifications.liked') }}</span>
                            <span v-else-if="notif.type === 'comment'"> {{ t('notifications.commented') }}</span>
                            <span v-else-if="notif.type === 'comment_reply'"> {{ t('notifications.replied') }}</span>
                            <span v-else-if="notif.type === 'follow'"> {{ t('notifications.followed') }}</span>
                          </p>
                          <span class="notifications-dropdown__time">{{ timeAgo(notif.timestamp, localeStore.currentLocale) }}</span>
                        </div>
                        <span v-if="!notif.isRead" class="notifications-dropdown__unread-badge" aria-hidden="true" />
                        <AppDropdown
                          class="notifications-dropdown__menu"
                          :options="notificationMenuOptions(notif)"
                          align="right"
                          :label="t('notifications.options')"
                          @select="handleNotificationMenuSelect(notif, $event)"
                        >
                          <template #trigger="{ toggle, isOpen, panelId }">
                            <button
                              type="button"
                              class="notifications-dropdown__menu-btn"
                              :aria-label="t('notifications.options')"
                              aria-haspopup="menu"
                              :aria-expanded="isOpen"
                              :aria-controls="isOpen ? panelId : undefined"
                              :disabled="notificationActionId === notif._id"
                              @click.stop="toggle"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
                              </svg>
                            </button>
                          </template>
                        </AppDropdown>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Avatar -->
              <button
                id="avatar-btn"
                class="main-layout__avatar"
                :aria-label="t('common.goToProfile')"
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
    <MobilePullToRefresh />
    <MobileNavigation />
    <PostDetailModal />
    <SharePostModal />
    <OraclePendingModal />
    <ExtractionPendingModal />
    <SourceProgressModal />
    <AppConfirm
      v-model="showDeleteNotificationConfirm"
      :title="t('notifications.deleteTitle')"
      :message="t('notifications.deleteMessage')"
      :confirm-label="t('notifications.delete')"
      :cancel-label="t('notifications.cancel')"
      :loading="isDeletingNotification"
      danger
      @confirm="confirmDeleteNotification"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import MobilePullToRefresh from './MobilePullToRefresh.vue'
import MobileNavigation from './MobileNavigation.vue'
import PostDetailModal from '@/features/home/PostDetailModal.vue'
import SharePostModal from '@/features/home/SharePostModal.vue'
import OraclePendingModal from '@/components/common/OraclePendingModal.vue'
import ExtractionPendingModal from '@/components/common/ExtractionPendingModal.vue'
import SourceProgressModal from '@/components/common/SourceProgressModal.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import AppDropdown from '@/components/common/AppDropdown.vue'
import { useDreamStore } from '@/store/useDreamStore'
import { useNotificationStore } from '@/store/useNotificationStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useOracleStore } from '@/store/useOracleStore'
import { useLocaleStore } from '@/store/useLocaleStore'
import { usePostStore } from '@/store/usePostStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { ApiNotification, ApiNotificationTarget } from '@/api/types'
import { getInitials, getAvatarBg } from '@/utils/avatar'
import { timeAgo } from '@/utils/timeAgo'
import apiClient from '@/api/client'

const { t } = useI18n()
const sidebarCollapsed = ref(false)
const route = useRoute()
const router = useRouter()
const dreamStore = useDreamStore()
const notificationStore = useNotificationStore()
const authStore = useAuthStore()
const oracleStore = useOracleStore()
const postStore = usePostStore()
const localeStore = useLocaleStore()
const settingsStore = useSettingsStore()

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
const notificationActionId = ref<string | null>(null)
const notificationToDelete = ref<ApiNotification | null>(null)
const showDeleteNotificationConfirm = ref(false)
const isDeletingNotification = ref(false)

function toggleNotifications() {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    notificationStore.fetchNotifications()
  }
}

async function handleNotificationClick(notif: ApiNotification) {
  if (!hasNotificationTarget(notif) || notificationActionId.value) return
  await openNotificationTarget(notif)
}

function hasNotificationTarget(notif: ApiNotification): boolean {
  return notif.type === 'follow'
    ? Boolean(notif.senderId?._id)
    : Boolean(notif.postId)
}

function notificationMenuOptions(notif: ApiNotification) {
  return [
    ...(hasNotificationTarget(notif)
      ? [{ label: t('notifications.view'), value: 'view' }]
      : []),
    ...(hasNotificationTarget(notif) ? [{ divider: true as const }] : []),
    { label: t('notifications.delete'), value: 'delete', danger: true },
  ]
}

async function handleNotificationMenuSelect(
  notif: ApiNotification,
  option: { value?: string },
) {
  if (option.value === 'view') {
    await openNotificationTarget(notif)
    return
  }
  if (option.value === 'delete') {
    notificationToDelete.value = notif
    showDeleteNotificationConfirm.value = true
  }
}

async function openNotificationTarget(notif: ApiNotification) {
  if (notificationActionId.value) return
  notificationActionId.value = notif._id
  try {
    const target = await notificationStore.openNotification(notif._id)
    showNotifications.value = false
    await presentNotificationTarget(target)
  } catch (error: any) {
    if (error?.response?.data?.code === 'notification_target_unavailable') {
      if (notif.type === 'dream_analysis' && notif.postId) {
        oracleStore.stopTracking(notif.postId)
      }
      settingsStore.showToastKey('notifications.targetUnavailable', undefined, 'error')
    } else {
      settingsStore.showToastKey('notifications.openError', undefined, 'error')
    }
  } finally {
    notificationActionId.value = null
  }
}

async function presentNotificationTarget(target: ApiNotificationTarget) {
  if (target.kind === 'dream_analysis') {
    oracleStore.openCompletedDialog(target.dream)
    return
  }
  if (target.kind === 'profile') {
    await router.push(`/profile/${target.userId}`)
    return
  }
  if (route.path !== '/') await router.push('/')
  await postStore.openPost(target.dream._id, {
    ...(target.commentId ? { commentId: target.commentId } : {}),
  })
}

async function handleMarkAllNotificationsRead() {
  if (notificationActionId.value) return
  notificationActionId.value = 'mark-all'
  const succeeded = await notificationStore.markAllRead()
  settingsStore.showToastKey(
    succeeded ? 'notifications.markAllSuccess' : 'notifications.markAllError',
    undefined,
    succeeded ? 'success' : 'error',
  )
  notificationActionId.value = null
}

async function confirmDeleteNotification() {
  const notification = notificationToDelete.value
  if (!notification || isDeletingNotification.value) return
  isDeletingNotification.value = true
  notificationActionId.value = notification._id
  try {
    await notificationStore.deleteNotification(notification._id)
    showDeleteNotificationConfirm.value = false
    notificationToDelete.value = null
    settingsStore.showToastKey('notifications.deleteSuccess', undefined, 'success')
  } catch {
    settingsStore.showToastKey('notifications.deleteError', undefined, 'error')
  } finally {
    isDeletingNotification.value = false
    notificationActionId.value = null
  }
}

async function sendHeartbeat() {
  try {
    const { data } = await apiClient.post<any>('/users/me/heartbeat')
    if (data.success && authStore.user) {
      authStore.updateCurrentUser({
        ...authStore.user,
        timeOnlineToday: data.timeOnlineToday,
        role: data.role,
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
const FULL_BLEED_ROUTES = ['/messages', '/oracle', '/moderation/rule-candidates']

const isFullBleed = computed(() => {
  return FULL_BLEED_ROUTES.includes(route.path) || 
         route.path.startsWith('/library/sources/') ||
         (route.path.startsWith('/moderation/sources/') && route.path.endsWith('/preview'))
})


// Route-name → translation key map (covers all routes rendered inside MainLayout)
const PAGE_TITLE_KEYS: Record<string, string> = {
  home:                         'navigation.pageHome',
  oracle:                       'navigation.pageOracle',
  messages:                     'navigation.pageMessages',
  profile:                      'navigation.pageProfile',
  'profile-user':               'navigation.pageProfile',
  settings:                     'navigation.pageSettings',
  achievements:                 'navigation.pageAchievements',
  library:                      'navigation.pageLibrary',
  'library-source-detail':      'navigation.pageLibrarySourceDetail',
  'moderation-sources':         'navigation.pageModerationSources',
  'moderation-source-preview':  'navigation.pageModerationSourcePreview',
  'moderation-rule-candidates': 'navigation.pageModerationRuleCandidates',
}

const pageTitle = computed(() =>
  t(PAGE_TITLE_KEYS[route.name as string] ?? 'navigation.pageFallback')
)

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
  min-width: 0;
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

/* ── Locale switch label ────────────────────────────────────────── */
.locale-switch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 3px 6px 3px 5px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.locale-switch:hover {
  border-color: var(--color-text-muted);
  background: var(--color-bg-hover);
}
.locale-switch__track {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}
.locale-switch__track span {
  min-width: 25px;
  padding: 5px 4px;
  border-radius: 999px;
  text-align: center;
  color: var(--color-text-muted);
}
.locale-switch__track span.is-active {
  background: var(--color-primary);
  color: var(--color-bg-base);
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

@media (max-width: 767px) {
  .main-layout {
    overscroll-behavior-y: contain;
  }

  .main-layout__body,
  .main-layout--collapsed .main-layout__body {
    margin-left: 0;
    padding-right: var(--safe-area-right);
    padding-left: var(--safe-area-left);
  }

  .main-layout__burger {
    display: none;
  }

  .main-layout__content {
    padding-bottom: var(--mobile-nav-height);
  }

  .main-layout__content-inner {
    max-width: 100%;
    padding: var(--mobile-page-padding);
  }

  .main-layout__content-inner--full {
    padding: 0;
  }

  .main-layout__header-inner {
    padding-right: var(--mobile-page-padding);
    padding-left: var(--mobile-page-padding);
  }

  .main-layout__header-right {
    gap: 4px;
  }

  .main-layout__page-title {
    font-size: var(--font-size-md);
  }

  .main-layout__icon-btn,
  .main-layout__avatar {
    width: 36px;
    height: 36px;
  }

  .main-layout__avatar {
    display: none;
  }

  .locale-switch {
    height: 28px;
    padding: 2px 4px;
  }

  .locale-switch__track span {
    min-width: 23px;
    padding: 4px 3px;
  }
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
  .main-layout__header--with-search {
    height: calc(var(--header-height) + 52px);
  }
  .main-layout__header--with-search .main-layout__header-inner {
    height: var(--header-height);
  }
  .header-search {
    position: absolute;
    right: var(--space-3);
    bottom: 8px;
    left: var(--space-3);
    display: flex;
    margin: 0;
  }
  .header-search__bar,
  .header-search__bar:focus-within {
    width: 100%;
  }
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

.notifications-dropdown__mark-all:disabled {
  opacity: 0.55;
  cursor: wait;
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

.notifications-dropdown__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.notifications-dropdown__empty button {
  background: transparent;
  border: 0;
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
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
  cursor: default;
  transition: background var(--transition-fast);
  align-items: flex-start;
}

.notifications-dropdown__item:last-child {
  border-bottom: none;
}

.notifications-dropdown__item--viewable {
  cursor: pointer;
}

.notifications-dropdown__item--viewable:hover {
  background: var(--color-bg-hover);
}

.notifications-dropdown__item--busy {
  opacity: 0.65;
  cursor: wait;
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

.notifications-dropdown__menu {
  flex-shrink: 0;
}

.notifications-dropdown__menu-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.notifications-dropdown__menu-btn:hover:not(:disabled),
.notifications-dropdown__menu-btn:focus-visible {
  background: #262626;
  color: var(--color-text-primary);
}

.notifications-dropdown__menu-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.notifications-dropdown__item:nth-last-child(-n + 2) :deep(.app-dropdown__panel) {
  top: auto;
  bottom: calc(100% + 6px);
}

@media (max-width: 600px) {
  .notifications-dropdown {
    position: fixed;
    top: 56px;
    right: var(--space-2);
    left: var(--space-2);
    width: auto;
    max-height: min(520px, calc(100dvh - 72px));
  }

  .main-layout__header--with-search .notifications-dropdown {
    top: calc(var(--header-height) + 48px);
  }

  .notifications-dropdown__item {
    padding: var(--space-3) var(--space-2);
  }
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
