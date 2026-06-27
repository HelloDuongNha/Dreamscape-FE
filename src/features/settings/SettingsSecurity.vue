<template>
  <div class="settings-section">
    <h2 class="settings-section__title">Security</h2>
    <p class="settings-section__desc">Manage your password, account email, and active login sessions.</p>

    <!-- ── Change Password ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">Change Password</h3>
        <p class="settings-block__hint">At least 8 characters. No HTML or injection characters.</p>
      </div>
      <div class="settings-block__field settings-block__field--col">
        <AppInput
          id="sec-current-password"
          v-model="currentPw"
          type="password"
          label="Current Password"
          placeholder="Current password"
          :error="currentPwError"
          autocomplete="current-password"
        />
        <AppInput
          id="sec-new-password"
          v-model="newPw"
          type="password"
          label="New Password"
          placeholder="New password (min 8 chars)"
          :error="newPwError"
          autocomplete="new-password"
        />
        <AppInput
          id="sec-confirm-password"
          v-model="confirmPw"
          type="password"
          label="Confirm New Password"
          placeholder="Repeat new password"
          :error="confirmPwError"
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
            {{ isSavingPassword ? 'Updating...' : 'Update password' }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- ── Email Address ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">Email Address</h3>
        <p class="settings-block__hint">Used for notifications and account recovery.</p>
      </div>
      <div class="settings-block__field settings-block__field--col">
        <AppInput
          id="sec-email"
          v-model="localEmail"
          type="email"
          label="Email"
          placeholder="your@email.com"
          :error="emailError"
          autocomplete="email"
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
            {{ settingsStore.verified ? 'Email verified' : 'Email unverified — check your inbox' }}
          </span>
          <AppButton
            id="save-email-btn"
            variant="smart"
            size="sm"
            :disabled="!!emailError || !localEmail.trim() || localEmail === originalEmail || isSavingEmail"
            @click="saveEmail"
          >
            {{ isSavingEmail ? 'Saving...' : 'Save' }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- ── Logged-in Devices ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">Logged-in Devices</h3>
        <p class="settings-block__hint">All active sessions. Log out any you don't recognise.</p>
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
              <span v-if="session.is_current" class="device-item__current-tag">Current</span>
            </div>
            <span class="device-item__meta">{{ session.browser }} · {{ session.location }}</span>
            <span class="device-item__time">Last active: {{ timeAgo(session.last_active) }}</span>
          </div>
          <AppButton
            v-if="!session.is_current"
            :id="`logout-session-${session._id}`"
            variant="danger-outline"
            size="sm"
            @click="settingsStore.logoutSession(session._id)"
          >
            Log out
          </AppButton>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter }          from 'vue-router'
import AppInput               from '@/components/common/AppInput.vue'
import AppButton              from '@/components/common/AppButton.vue'
import { useSettingsStore }   from '@/store/useSettingsStore'
import { useAuthStore }       from '@/store/useAuthStore'
import { timeAgo }            from '@/utils/timeAgo'
import apiClient              from '@/api/client'

const settingsStore = useSettingsStore()
const authStore     = useAuthStore()
const router        = useRouter()

// ── Password form ──────────────────────────────────────────────────
const currentPw = ref('')
const newPw     = ref('')
const confirmPw = ref('')

const INJECTION_RE = /[<>"'`;&|{}()\\]/

const apiCurrentPwError = ref('')
const apiNewPwError = ref('')
const apiConfirmPwError = ref('')

watch(currentPw, () => { apiCurrentPwError.value = '' })
watch(newPw, () => { apiNewPwError.value = '' })
watch(confirmPw, () => { apiConfirmPwError.value = '' })

const currentPwError  = computed<string>(() => {
  if (apiCurrentPwError.value) return apiCurrentPwError.value
  if (!currentPw.value) return ''  // only validate when user types
  if (INJECTION_RE.test(currentPw.value)) return 'Invalid characters detected.'
  return ''
})
const newPwError = computed<string>(() => {
  if (apiNewPwError.value) return apiNewPwError.value
  const v = newPw.value
  if (!v) return ''
  if (v.length < 8)            return 'Must be at least 8 characters.'
  if (INJECTION_RE.test(v))    return 'Invalid characters detected.'
  return ''
})
const confirmPwError = computed<string>(() => {
  if (apiConfirmPwError.value) return apiConfirmPwError.value
  if (!confirmPw.value) return ''
  if (confirmPw.value !== newPw.value) return 'Passwords do not match.'
  return ''
})

const isSavingPassword = ref(false)
async function changePassword() {
  if (currentPwError.value || newPwError.value || confirmPwError.value) return
  if (!currentPw.value || !newPw.value || !confirmPw.value) {
    settingsStore.showToast('Please fill in all password fields.', 'error')
    return
  }
  isSavingPassword.value = true
  try {
    const { data } = await apiClient.put('/auth/profile', {
      currentPassword: currentPw.value,
      newPassword: newPw.value
    })
    if (data.success) {
      settingsStore.showToast('Password updated successfully.', 'success')
      currentPw.value = ''
      newPw.value = ''
      confirmPw.value = ''
    }
  } catch (err: any) {
    const response = err.response
    if (response) {
      const status = response.status
      const msg = response.data?.message || 'Failed to update password.'
      if (status === 401) {
        apiCurrentPwError.value = msg
      } else {
        apiNewPwError.value = msg
      }
    } else {
      apiNewPwError.value = 'Network error.'
    }
    settingsStore.showToast('Failed to update password.', 'error')
  } finally {
    isSavingPassword.value = false
  }
}

// ── Email ──────────────────────────────────────────────────────────
const localEmail    = ref(authStore.myUser?.email ?? '')
const originalEmail = computed(() => authStore.myUser?.email ?? '')
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const apiEmailError = ref('')
watch(localEmail, () => { apiEmailError.value = '' })

const emailError = computed<string>(() => {
  if (apiEmailError.value) return apiEmailError.value
  const v = localEmail.value.trim()
  if (!v)                   return ''
  if (INJECTION_RE.test(v)) return 'Invalid characters in email.'
  if (!EMAIL_RE.test(v))    return 'Please enter a valid email address.'
  return ''
})

const isSavingEmail = ref(false)
async function saveEmail() {
  if (emailError.value || !localEmail.value.trim()) return
  if (localEmail.value.trim() === originalEmail.value) {
    settingsStore.showToast('No changes to save.', 'error')
    return
  }
  isSavingEmail.value = true
  try {
    const { data } = await apiClient.put('/auth/profile', {
      email: localEmail.value.trim()
    })
    if (data.success) {
      if (data.status === 'pending') {
        settingsStore.showToast('Verification code sent to your new email.', 'success')
        router.push({
          path: '/verify-otp',
          query: { email: localEmail.value.trim(), purpose: 'update_email' }
        })
      } else {
        authStore.updateCurrentUser(data.user)
        settingsStore.verified = false // reset verification on change
        settingsStore.showToast('Email updated. Please verify your new address.', 'success')
      }
    }
  } catch (err: any) {
    const response = err.response
    if (response) {
      apiEmailError.value = response.data?.message || 'Failed to update email.'
    } else {
      apiEmailError.value = 'Network error.'
    }
    settingsStore.showToast('Failed to update email.', 'error')
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

onMounted(() => {
  settingsStore.loadSessions()
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
