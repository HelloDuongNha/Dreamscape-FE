<template>
  <nav
    :class="['sidebar', { 'sidebar--collapsed': collapsed }]"
    role="navigation"
    :aria-label="t('navigation.mainNav')"
  >
    <!-- Logo mark -->
    <div class="sidebar__logo">
        <div class="sidebar__logo-icon-container">
          <div class="sidebar__logo-icon" aria-label="DreamScape">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
              d="M22.7 4.8a11.8 11.8 0 1 0 4.5 16.6A10.2 10.2 0 1 1 22.7 4.8Z"
              fill="currentColor"
            />
            <path
              d="m24.8 6.2.9 2.4 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.4Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
      <span class="sidebar__logo-text" :class="{ 'sidebar__logo-text--collapsed': collapsed }">DreamScape</span>
    </div>

    <!-- Nav items -->
    <ul class="sidebar__nav" role="list">
      <li v-for="item in navItems" :key="item.to" role="none">
        <RouterLink
          :to="item.to"
          :id="`sidebar-nav-${item.id}`"
          :class="['sidebar__nav-item', { 'sidebar__nav-item--active': isActive(item.to) }]"
          :aria-label="collapsed ? item.label : undefined"
          :title="collapsed ? item.label : undefined"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          role="menuitem"
        >
          <!-- Icon Container -->
          <div class="sidebar__nav-icon-container">
            <span class="sidebar__nav-icon" aria-hidden="true">
              <NavigationIcon :name="item.icon" />
            </span>
          </div>

          <!-- Label -->
          <span class="sidebar__nav-label" :class="{ 'sidebar__nav-label--collapsed': collapsed }">{{ item.label }}</span>

          <!-- Badge -->
          <span
            v-if="item.badge"
            class="sidebar__badge"
            :class="{ 'sidebar__badge--collapsed': collapsed }"
            :aria-label="t('navigation.unreadCount', { count: item.badge })"
          >
            {{ item.badge > 9 ? '9+' : item.badge }}
          </span>
        </RouterLink>
      </li>
    </ul>

    <!-- Bottom: profile + collapse -->
    <div class="sidebar__bottom">
      <div class="sidebar__divider" aria-hidden="true" />

      <RouterLink
        to="/profile"
        id="sidebar-nav-profile"
        :class="['sidebar__nav-item', { 'sidebar__nav-item--active': isActive('/profile') }]"
        :title="collapsed ? t('navigation.profile') : undefined"
        :aria-label="collapsed ? t('navigation.profile') : undefined"
        :aria-current="isActive('/profile') ? 'page' : undefined"
      >
        <div class="sidebar__nav-icon-container">
          <span class="sidebar__nav-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
        </div>
        <span class="sidebar__nav-label" :class="{ 'sidebar__nav-label--collapsed': collapsed }">{{ t('navigation.profile') }}</span>
      </RouterLink>

      <!-- Settings -->
      <RouterLink
        to="/settings/account"
        id="sidebar-nav-settings"
        :class="['sidebar__nav-item', { 'sidebar__nav-item--active': isSettingsActive }]"
        :title="collapsed ? t('navigation.settings') : undefined"
        :aria-label="collapsed ? t('navigation.settings') : undefined"
        :aria-current="isSettingsActive ? 'page' : undefined"
      >
        <div class="sidebar__nav-icon-container">
          <span class="sidebar__nav-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
        </div>
        <span class="sidebar__nav-label" :class="{ 'sidebar__nav-label--collapsed': collapsed }">{{ t('navigation.settings') }}</span>
      </RouterLink>

      <!-- Logout -->
      <button
        id="sidebar-logout-btn"
        class="sidebar__collapse-btn sidebar__logout-btn"
        :title="collapsed ? t('navigation.logout') : undefined"
        :aria-label="collapsed ? t('navigation.logout') : undefined"
        @click="handleLogout"
      >
        <div class="sidebar__nav-icon-container">
          <span class="sidebar__nav-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </span>
        </div>
        <span class="sidebar__collapse-label" :class="{ 'sidebar__collapse-label--collapsed': collapsed }">{{ t('navigation.logout') }}</span>
      </button>

      <!-- Collapse toggle -->
      <button
        id="sidebar-collapse-btn"
        class="sidebar__collapse-btn"
        :aria-label="collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')"
        :title="collapsed ? t('navigation.expandSidebar') : t('navigation.collapseSidebar')"
        @click="$emit('toggle')"
      >
        <div class="sidebar__nav-icon-container">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :class="{ 'icon--flipped': collapsed }"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
        <span class="sidebar__collapse-label" :class="{ 'sidebar__collapse-label--collapsed': collapsed }">{{ t('navigation.collapseLabel') }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/useAuthStore'
import { useChatStore } from '@/store/useChatStore'
import { isAdminUser } from '@/utils/adminAccess'
import NavigationIcon from './navigation/NavigationIcon.vue'
import { buildNavigationModel } from './navigation/navigation.config'

withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })
defineEmits<{ toggle: [] }>()

const { t }     = useI18n()
const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()
const isActive  = (path: string) => route.path === path || (path !== '/' && route.path.startsWith(`${path}/`))
const isSettingsActive = computed(() => route.path.startsWith('/settings'))

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

const navItems = computed(() =>
  buildNavigationModel({
    isAdmin: isAdminUser(authStore.user),
    unreadMessages: chatStore.totalUnread,
  }).desktopPrimary.map((item) => ({
    ...item,
    label: t(item.labelKey),
  }))
)
</script>

<style scoped>
/* ── Shell ─────────────────────────────────────────────────────── */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: 100dvh;
  width: var(--sidebar-width);
  background: var(--color-bg-sidebar);   /* solid #0a0a0a */
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: var(--space-4) 10px;
  z-index: var(--z-sidebar);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-sizing: border-box;
}
.sidebar--collapsed {
  width: var(--sidebar-collapsed);
}

@media (max-width: 767px) {
  .sidebar {
    display: none;
  }
}

/* ── Logo ──────────────────────────────────────────────────────── */
.sidebar__logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 40px;
  margin-bottom: var(--space-6);
  overflow: hidden;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 100%;
  transition: gap 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar__logo-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}
.sidebar__logo-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary);
}
.sidebar__logo-text {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  white-space: nowrap;
  letter-spacing: var(--letter-spacing-tight);
  opacity: 1;
  max-width: 150px;
  transition: opacity 0.2s ease, max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar__logo-text--collapsed {
  opacity: 0 !important;
  max-width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* ── Nav list ──────────────────────────────────────────────────── */
.sidebar__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow-y: auto;
  overflow-x: hidden;
}

/* ── Nav item ──────────────────────────────────────────────────── */
.sidebar__nav-item,
.sidebar__collapse-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 40px;
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--color-text-secondary);   /* muted gray by default */
  box-sizing: border-box;
  width: 100%;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  overflow: hidden;
  transition: background var(--transition-fast), color var(--transition-fast), gap 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar__nav-item:hover,
.sidebar__collapse-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);     /* white on hover */
}
.sidebar__nav-item--active {
  background: var(--color-bg-active);
  color: var(--color-text-primary);     /* solid white — no glow */
  font-weight: var(--font-weight-semibold);
}

/* Icon Containers (Permanently fixed 40px width to secure vertical axis) */
.sidebar__nav-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}
.sidebar__nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

/* Labels with smooth opacity and max-width collapsing */
.sidebar__nav-label,
.sidebar__collapse-label {
  flex: 1;
  opacity: 1;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-align: left;
  transition: opacity 0.2s ease, max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar__nav-label--collapsed,
.sidebar__collapse-label--collapsed {
  opacity: 0 !important;
  max-width: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  flex: none !important;
}

/* Badge — solid, flat, transitions along with text collapse */
.sidebar__badge {
  background: var(--color-danger);
  color: #ffffff;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  padding: 1px 5px;
  border-radius: var(--radius-full);
  min-width: 16px;
  text-align: center;
  flex-shrink: 0;
  line-height: 1.6;
  opacity: 1;
  max-width: 40px;
  margin-right: var(--space-3);
  transition: opacity 0.2s ease, max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar__badge--collapsed {
  opacity: 0 !important;
  max-width: 0 !important;
  margin-right: 0 !important;
  padding: 0 !important;
}

/* Collapsed alignment modifiers to reset gap and alignment */
.sidebar--collapsed .sidebar__logo,
.sidebar--collapsed .sidebar__nav-item,
.sidebar--collapsed .sidebar__collapse-btn {
  gap: 0;
}

/* ── Bottom section ────────────────────────────────────────────── */
.sidebar__bottom {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex-shrink: 0;
  padding-top: var(--space-2);
}
.sidebar__divider {
  height: 1px;
  background: var(--color-border);
  margin-bottom: var(--space-2);
  width: 100%;
}

/* Flip the chevron when collapsed */
.icon--flipped { transform: rotate(180deg); }

/* Logout button — slight danger tint on hover */
.sidebar__logout-btn:hover {
  color: #ed4956;
}
</style>
