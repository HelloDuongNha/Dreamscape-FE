import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { useAuthStore } from '@/store/useAuthStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0, behavior: 'smooth' }),
  routes: [
    // ── Auth routes (no sidebar layout) ──────────────────────────────────────
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: { titleKey: 'navigation.titleLogin', public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/features/auth/RegisterView.vue'),
      meta: { titleKey: 'navigation.titleRegister', public: true },
    },
    {
      path: '/verify-otp',
      name: 'verify-otp',
      component: () => import('@/features/auth/OtpVerifyView.vue'),
      meta: { titleKey: 'navigation.titleVerifyOtp', public: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/features/auth/ForgotPasswordView.vue'),
      meta: { titleKey: 'navigation.titleForgotPassword', public: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/features/auth/ResetPasswordView.vue'),
      meta: { titleKey: 'navigation.titleResetPassword', public: true },
    },
    {
      path: '/post/:id',
      name: 'shared-post',
      component: () => import('@/features/home/PublicSharedPostView.vue'),
      meta: {
        titleKey: 'navigation.titleSharedPost',
      },
    },

    // ── App routes (with sidebar via MainLayout) ──────────────────────────────
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/features/home/HomeView.vue'),
          meta: { titleKey: 'navigation.titleHome' },
        },
        {
          path: 'oracle',
          name: 'oracle',
          component: () => import('@/features/oracle/OracleView.vue'),
          meta: { titleKey: 'navigation.titleOracle' },
        },
        {
          path: 'messages',
          name: 'messages',
          component: () => import('@/features/messages/MessagesView.vue'),
          meta: { titleKey: 'navigation.titleMessages' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/features/profile/ProfileView.vue'),
          meta: { titleKey: 'navigation.titleProfile' },
        },
        {
          path: 'profile/:id',
          name: 'profile-user',
          component: () => import('@/features/profile/ProfileView.vue'),
          meta: { titleKey: 'navigation.titleProfile' },
        },
        {
          path: 'settings',
          redirect: '/settings/account',
        },
        {
          path: 'settings/:section',
          name: 'settings',
          component: () => import('@/features/settings/SettingsView.vue'),
          meta: { titleKey: 'navigation.titleSettings' },
        },
        {
          path: 'achievements',
          name: 'achievements',
          component: () => import('@/features/achievements/AchievementsView.vue'),
          meta: { titleKey: 'navigation.titleSettings' },
        },
        {
          path: 'library',
          name: 'library',
          component: () => import('@/features/library/LibraryView.vue'),
          meta: { titleKey: 'navigation.titleLibrary' },
        },
        {
          path: 'library/sources/:id',
          name: 'library-source-detail',
          component: () => import('@/features/library/LibrarySourceDetailView.vue'),
          meta: { titleKey: 'navigation.titleLibrarySourceDetail' },
        },
        {
          path: 'moderation/sources',
          name: 'moderation-sources',
          component: () => import('@/features/moderation/ModerationSourcesView.vue'),
          meta: { titleKey: 'navigation.titleModerationSources', adminOnly: true },
        },
        {
          path: 'moderation/sources/:id/preview',
          name: 'moderation-source-preview',
          component: () => import('@/features/moderation/ModerationSourcePreviewView.vue'),
          meta: { titleKey: 'navigation.titleModerationSourcePreview', adminOnly: true },
        },
        {
          path: 'moderation/rule-candidates',
          name: 'moderation-rule-candidates',
          component: () => import('@/features/moderation/RuleCandidatesView.vue'),
          meta: { titleKey: 'navigation.titleModerationRuleCandidates', adminOnly: true },
        },
        {
          path: 'moderation/evidence-needed',
          name: 'moderation-evidence-needed',
          component: () => import('@/features/moderation/EvidenceNeededView.vue'),
          meta: { titleKey: 'navigation.titleModerationEvidenceNeeded', adminOnly: true },
        },
        {
          path: 'moderation/knowledge-evidence',
          redirect: '/moderation/rule-candidates',
        },
      ],
    },

    // Catch-all → redirect to home
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// ── Auth Navigation Guard ─────────────────────────────────────────────────────
// Routes without meta.public require a valid token.
// Redirect unauthenticated users to /login; redirect logged-in users away from auth pages.
router.beforeEach((to) => {
  const auth = useAuthStore()

  // Already logged in → don't allow re-visiting login/register (but allow verify-otp for email update)
  if (
    to.meta.public &&
    !to.meta.allowAuthenticated &&
    auth.isLoggedIn &&
    to.name !== 'verify-otp' &&
    to.name !== 'reset-password'
  ) {
    return { name: 'home' }
  }

  // Not logged in → redirect to login
  if (!to.meta.public && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.adminOnly && auth.user?.role !== 'admin') {
    return { name: 'home' }
  }
})

// ── Chat State Guard (Task 2 Fix) ─────────────────────────────────────────────
// When the user navigates AWAY from /messages, clear the active conversation.
//
// WHY THIS MATTERS:
// The strict "seen" logic in useChatStore only emits mark_as_seen when
// `activeConversationId === payload.conversationId`. If we don't reset
// activeConversationId on route leave, any message arriving while the user
// is on the Home Feed will still match the last open conversation ID and be
// silently marked as 'seen' — bypassing the unread_count increment entirely.
//
// After this guard fires, activeConversationId = null, so:
//   isActiveConv = (payload.conversationId === null) → always false
//   → mark_as_seen is NOT emitted
//   → message_delivered IS emitted (recipient is online)
//   → unread_count += 1 → sidebar badge updates correctly
router.afterEach((to, from) => {
  const wasOnMessages = from.name === 'messages'
  const nowOnMessages = to.name === 'messages'

  if (wasOnMessages && !nowOnMessages) {
    // Lazy import to avoid circular dependency at module init time
    import('@/store/useChatStore').then(({ useChatStore }) => {
      useChatStore().clearActiveConversation()
    })
  }
})

export default router
