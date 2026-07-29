<template>
  <div class="settings-section">
    <h2 class="settings-section__title">{{ t('settings.navSecurity') }}</h2>
    <p class="settings-section__desc">{{ t('settings.securityDesc') }}</p>

    <!-- ── Change Password ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">{{ t('settings.changePasswordLabel') }}</h3>
        <p class="settings-block__hint">{{ t('settings.changePasswordHint') }}</p>
      </div>
      <div class="settings-block__field settings-block__field--col">
        <AppInput
          id="sec-current-password"
          v-model="currentPw"
          type="password"
          :label="t('settings.currentPasswordLabel')"
          :placeholder="t('settings.currentPasswordPlaceholder')"
          :error="currentPwErrorDisplay"
          autocomplete="current-password"
        />
        <AppInput
          id="sec-new-password"
          v-model="newPw"
          type="password"
          :label="t('settings.newPasswordLabel')"
          :placeholder="t('settings.newPasswordPlaceholder')"
          :error="newPwErrorDisplay"
          autocomplete="new-password"
        />
        <AppInput
          id="sec-confirm-password"
          v-model="confirmPw"
          type="password"
          :label="t('settings.confirmPasswordLabel')"
          :placeholder="t('settings.confirmPasswordPlaceholder')"
          :error="confirmPwErrorDisplay"
          autocomplete="new-password"
        />
        <div class="settings-block__actions">
          <AppButton
            id="save-password-btn"
            variant="smart"
            size="sm"
            :disabled="!!currentPwError || !!newPwError || !!confirmPwError || !currentPw || !newPw || !confirmPw || isSavingPassword"
            @click="changePassword"
          >
            {{ isSavingPassword ? t('settings.updatingPasswordBtn') : t('settings.updatePasswordBtn') }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- ── Email Address ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">{{ t('settings.emailHeading') }}</h3>
        <p class="settings-block__hint">{{ t('settings.emailHint') }}</p>
      </div>
      <div class="settings-block__field settings-block__field--col">
        <AppInput
          id="sec-email"
          v-model="localEmail"
          type="email"
          :label="t('settings.emailLabel')"
          :placeholder="t('settings.emailPlaceholder')"
          :error="emailErrorDisplay"
          autocomplete="email"
        />
        <AppInput
          id="sec-email-current-password"
          v-model="emailCurrentPw"
          type="password"
          :label="t('settings.emailCurrentPasswordLabel')"
          :placeholder="t('settings.currentPasswordPlaceholder')"
          autocomplete="current-password"
        />
        <!-- Verification badge — sits below the input -->
        <div class="email-status-row">
          <span
            class="settings-badge"
            :class="settingsStore.verified ? 'settings-badge--verified' : 'settings-badge--unverified'"
          >
            <svg v-if="settingsStore.verified" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {{ settingsStore.verified ? t('settings.emailVerified') : t('settings.emailUnverified') }}
          </span>
          <AppButton
            id="save-email-btn"
            variant="smart"
            size="sm"
            :disabled="!!emailError || !localEmail.trim() || localEmail === originalEmail || isSavingEmail"
            @click="saveEmail"
          >
            {{ isSavingEmail ? t('settings.updatingBtn') : t('settings.saveBtn') }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- ── Logged-in Devices ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">{{ t('settings.activeDevicesHeading') }}</h3>
        <p class="settings-block__hint">{{ t('settings.activeDevicesHint') }}</p>
      </div>
      <ul class="device-list" role="list">
        <li
          v-for="session in sortedSessions"
          :key="session._id"
          class="device-item"
          :class="{ 'device-item--current': session.is_current }"
        >
          <span class="device-item__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </span>
          <div class="device-item__info">
            <div class="device-item__name-row">
              <span class="device-item__name">{{ session.device_name }}</span>
              <span v-if="session.is_current" class="device-item__current-tag">{{ t('settings.currentDevice') }}</span>
            </div>
            <span class="device-item__meta">{{ session.browser }} · {{ session.location }}</span>
            <span class="device-item__time">{{ t('settings.lastActive', { time: timeAgo(session.last_active, localeStore.currentLocale) }) }}</span>
          </div>
          <AppButton
            v-if="!session.is_current"
            :id="`logout-session-${session._id}`"
            variant="danger-outline"
            size="sm"
            :disabled="sessionActionId === session._id"
            @click="requestSessionLogout(session)"
          >
            {{ t('settings.logoutBtn') }}
          </AppButton>
        </li>
      </ul>
    </div>
    <AppConfirm
      v-model="showRevokePrompt"
      :title="t('settings.revokeOtherSessionsTitle')"
      :message="t('settings.revokeOtherSessionsMessage')"
      :confirm-label="t('settings.revokeOtherSessionsConfirm')"
      :cancel-label="t('settings.keepOtherSessions')"
      :loading="isRevokingOthers"
      danger
      @confirm="confirmRevokeOtherSessions"
    />
    <AppConfirm
      v-model="showSessionRevokeConfirm"
      :title="t('settings.revokeSessionTitle')"
      :message="t('settings.revokeSessionMessage', { device: sessionToRevoke?.device_name || '' })"
      :confirm-label="t('settings.revokeSessionConfirm')"
      :cancel-label="t('common.confirm.cancel')"
      :loading="!!sessionActionId"
      danger
      @confirm="confirmSessionLogout"
      @cancel="sessionToRevoke = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n }            from 'vue-i18n'
import AppInput               from '@/components/common/AppInput.vue'
import AppButton              from '@/components/common/AppButton.vue'
import AppConfirm             from '@/components/common/AppConfirm.vue'
import { useSettingsStore, type DeviceSession } from '@/store/useSettingsStore'
import { useAuthStore }       from '@/store/useAuthStore'
import { useLocaleStore }     from '@/store/useLocaleStore'
import { timeAgo }            from '@/utils/timeAgo'
import apiClient              from '@/api/client'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const authStore     = useAuthStore()
const localeStore   = useLocaleStore()
const router        = useRouter()
const route         = useRoute()

// ── Password form ──────────────────────────────────────────────────
const currentPw = ref('')
const newPw     = ref('')
const confirmPw = ref('')

const INJECTION_RE = /[<>"'`;&|{}()\\]/

interface ApiErrorStruct {
  key?: string
  raw?: string
}

const apiCurrentPwError = ref<ApiErrorStruct | null>(null)
const apiNewPwError = ref<ApiErrorStruct | null>(null)
const apiConfirmPwError = ref<ApiErrorStruct | null>(null)

watch(currentPw, () => { apiCurrentPwError.value = null })
watch(newPw, () => { apiNewPwError.value = null })
watch(confirmPw, () => { apiConfirmPwError.value = null })

const currentPwError  = computed<{ key: string } | null>(() => {
  if (apiCurrentPwError.value) return null
  if (!currentPw.value) return null
  return null
})
const currentPwErrorDisplay = computed(() => {
  if (currentPwError.value) return t(currentPwError.value.key)
  if (apiCurrentPwError.value) {
    return apiCurrentPwError.value.key ? t(apiCurrentPwError.value.key) : (apiCurrentPwError.value.raw || '')
  }
  return ''
})

const newPwError = computed<{ key: string } | null>(() => {
  if (apiNewPwError.value) return null
  const v = newPw.value
  if (!v) return null
  if (v.length < 8)            return { key: 'errors.pwLengthError' }
  return null
})
const newPwErrorDisplay = computed(() => {
  if (newPwError.value) return t(newPwError.value.key)
  if (apiNewPwError.value) {
    return apiNewPwError.value.key ? t(apiNewPwError.value.key) : (apiNewPwError.value.raw || '')
  }
  return ''
})

const confirmPwError = computed<{ key: string } | null>(() => {
  if (apiConfirmPwError.value) return null
  if (!confirmPw.value) return null
  if (confirmPw.value !== newPw.value) return { key: 'errors.pwMatchError' }
  return null
})
const confirmPwErrorDisplay = computed(() => {
  if (confirmPwError.value) return t(confirmPwError.value.key)
  if (apiConfirmPwError.value) {
    return apiConfirmPwError.value.key ? t(apiConfirmPwError.value.key) : (apiConfirmPwError.value.raw || '')
  }
  return ''
})

const isSavingPassword = ref(false)
async function changePassword() {
  if (currentPwError.value || newPwError.value || confirmPwError.value) return
  if (!currentPw.value || !newPw.value || !confirmPw.value) {
    settingsStore.showToastKey('toasts.passwordFieldsEmptyToast', undefined, 'error')
    return
  }
  isSavingPassword.value = true
  try {
    const { data } = await apiClient.post('/auth/password/change', {
      currentPassword: currentPw.value,
      newPassword: newPw.value,
      confirmPassword: confirmPw.value,
    })
    if (data.success) {
      settingsStore.showToastKey('toasts.passwordUpdatedSuccess', undefined, 'success')
      currentPw.value = ''
      newPw.value = ''
      confirmPw.value = ''
      showRevokePrompt.value = true
    }
  } catch (err: any) {
    const response = err.response
    if (response) {
      const status = response.status
      if (status === 401) {
        apiCurrentPwError.value = { key: 'errors.currentPasswordInvalid' }
      } else {
        apiNewPwError.value = {
          key: response.data?.code === 'password_reused'
            ? 'errors.passwordReused'
            : response.data?.code === 'password_complexity_invalid'
              ? 'errors.passwordComplexity'
              : response.data?.code === 'password_provider_conflict'
                ? 'errors.passwordProviderConflict'
                : 'errors.savePasswordFailed'
        }
      }
    } else {
      apiNewPwError.value = { key: 'errors.networkError' }
    }
    settingsStore.showToastKey('errors.savePasswordFailed', undefined, 'error')
  } finally {
    isSavingPassword.value = false
  }
}

// ── Email ──────────────────────────────────────────────────────────
const localEmail    = ref(authStore.myUser?.email ?? '')
const emailCurrentPw = ref('')
const originalEmail = computed(() => authStore.myUser?.email ?? '')
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const apiEmailError = ref<ApiErrorStruct | null>(null)
watch(localEmail, () => { apiEmailError.value = null })

const emailError = computed<{ key: string } | null>(() => {
  if (apiEmailError.value) return null
  const v = localEmail.value.trim()
  if (!v)                   return null
  if (INJECTION_RE.test(v)) return { key: 'errors.emailInjectionError' }
  if (!EMAIL_RE.test(v))    return { key: 'errors.emailInvalidError' }
  return null
})
const emailErrorDisplay = computed(() => {
  if (emailError.value) return t(emailError.value.key)
  if (apiEmailError.value) {
    return apiEmailError.value.key ? t(apiEmailError.value.key) : (apiEmailError.value.raw || '')
  }
  return ''
})

const isSavingEmail = ref(false)
async function saveEmail() {
  if (emailError.value || !localEmail.value.trim()) return
  if (localEmail.value.trim() === originalEmail.value) {
    settingsStore.showToastKey('settings.noChangesToast', undefined, 'error')
    return
  }
  isSavingEmail.value = true
  try {
    const { data } = await apiClient.post('/auth/email-change/start', {
      email: localEmail.value.trim(),
      currentPassword: emailCurrentPw.value,
    })
    if (data.success) {
      if (data.status === 'pending') {
        settingsStore.showToastKey('toasts.verificationSentToast', undefined, 'success')
        router.push({
          path: '/verify-otp',
          query: {
            email: localEmail.value.trim(),
            purpose: 'update_email',
            resendAvailableAt: data.resendAvailableAt,
          }
        })
      } else {
        authStore.updateCurrentUser(data.user)
        settingsStore.verified = false // reset verification on change
        settingsStore.showToastKey('toasts.emailUpdatedToast', undefined, 'success')
      }
    }
  } catch (err: any) {
    const response = err.response
    if (response) {
      apiEmailError.value = {
        key: response.data?.code === 'email_already_used'
          ? 'errors.emailAlreadyUsed'
          : response.data?.code === 'current_password_invalid'
            ? 'errors.currentPasswordInvalid'
            : 'errors.saveEmailFailed'
      }
    } else {
      apiEmailError.value = { key: 'errors.networkError' }
    }
    settingsStore.showToastKey('errors.saveEmailFailed', undefined, 'error')
  } finally {
    isSavingEmail.value = false
  }
}

const sortedSessions = computed(() => {
  return [...settingsStore.sessions].sort((a, b) => {
    if (a.is_current && !b.is_current) return -1
    if (!a.is_current && b.is_current) return 1
    return 0
  })
})

const showRevokePrompt = ref(false)
const isRevokingOthers = ref(false)
const sessionToRevoke = ref<DeviceSession | null>(null)
const sessionActionId = ref<string | null>(null)
const showSessionRevokeConfirm = computed({
  get: () => sessionToRevoke.value !== null,
  set: (isOpen: boolean) => {
    if (!isOpen && !sessionActionId.value) sessionToRevoke.value = null
  },
})

function requestSessionLogout(session: DeviceSession) {
  if (session.is_current || sessionActionId.value) return
  sessionToRevoke.value = session
}

async function confirmSessionLogout() {
  const session = sessionToRevoke.value
  if (!session || sessionActionId.value) return
  sessionActionId.value = session._id
  const succeeded = await settingsStore.logoutSession(session._id)
  sessionActionId.value = null
  if (succeeded) sessionToRevoke.value = null
}

async function confirmRevokeOtherSessions() {
  if (isRevokingOthers.value) return
  isRevokingOthers.value = true
  try {
    await settingsStore.logoutOtherSessions()
    showRevokePrompt.value = false
  } finally {
    isRevokingOthers.value = false
  }
}

onMounted(() => {
  settingsStore.loadSessions()
  if (route.query.securityChange === 'email') {
    showRevokePrompt.value = true
    router.replace({ path: route.path, query: {} })
  }
})
</script>

<style>
/* Shared (non-scoped so they apply globally to settings sections) */
.settings-section { display: flex; flex-direction: column; gap: 0; padding: var(--space-6); }
.settings-section__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-text-primary); letter-spacing: var(--letter-spacing-tight); margin-bottom: var(--space-1); }
.settings-section__desc  { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-6); line-height: var(--line-height-relaxed); }
.settings-block { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5) 0; border-bottom: 1px solid var(--color-border); }
.settings-block:last-child { border-bottom: none; }
.settings-block__header { display: flex; flex-direction: column; gap: var(--space-1); }
.settings-block__label  { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.settings-block__hint   { font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: var(--line-height-relaxed); }
.settings-block__field  { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.settings-block__field--col { flex-direction: column; align-items: stretch; }
.settings-block__actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-2); }
.settings-block__actions--between { justify-content: space-between; }
.settings-char-count { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.settings-badge { display: inline-flex; align-items: center; gap: 4px; font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); padding: 3px 8px; border-radius: var(--radius-full); flex-shrink: 0; }
.settings-badge--verified   { background: #0e2a1c; color: #4ade80; border: 1px solid #1a3d2e; }
.settings-badge--unverified { background: #2a1e08; color: #f59e0b; border: 1px solid #3d2d10; }
</style>

<style scoped>
.email-status-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }

/* Device list */
.device-list { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.device-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); border-bottom: 1px solid var(--color-border); background: var(--color-bg-surface); }
.device-item:last-child { border-bottom: none; }
.device-item--current   { background: var(--color-bg-elevated); border-left: 3px solid #4ade80; padding-left: calc(var(--space-4) - 3px); }
.device-item__icon  { color: var(--color-text-muted); display: flex; align-items: center; flex-shrink: 0; }
.device-item__info  { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.device-item__name-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.device-item__name  { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.device-item__current-tag { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: #4ade80; background: #0e2a1c; border: 1px solid #1a3d2e; padding: 1px 6px; border-radius: var(--radius-full); }
.device-item__meta, .device-item__time { font-size: var(--font-size-xs); color: var(--color-text-muted); }
</style>
