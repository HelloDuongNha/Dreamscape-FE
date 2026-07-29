<template>
  <main class="recovery-page">
    <AuthLocaleSwitch />
    <section class="recovery-card">
      <div class="recovery-logo" aria-hidden="true">◈</div>
      <h1>{{ t('auth.resetPasswordTitle') }}</h1>
      <p>{{ t('auth.resetPasswordSub') }}</p>
      <div v-if="errorKey" class="recovery-error" role="alert">{{ t(errorKey) }}</div>
      <form class="recovery-form" @submit.prevent="submit">
        <AppInput id="reset-new-password" v-model="password" type="password" :label="t('auth.newPasswordLabel')" autocomplete="new-password" :disabled="loading" />
        <AppInput id="reset-confirm-password" v-model="confirmation" type="password" :label="t('auth.confirmPasswordLabel')" autocomplete="new-password" :disabled="loading" />
        <AppButton type="submit" variant="primary" size="lg" :disabled="loading || !password || !confirmation">
          {{ loading ? t('auth.resettingPassword') : t('auth.resetPasswordButton') }}
        </AppButton>
      </form>
      <AppConfirm
        v-model="showSessionPrompt"
        :title="t('auth.revokeRecoveredSessionsTitle')"
        :message="t('auth.revokeRecoveredSessionsMessage')"
        :confirm-label="t('auth.revokeRecoveredSessionsConfirm')"
        :cancel-label="t('auth.keepRecoveredSessions')"
        :loading="revoking"
        danger
        @confirm="revokePreviousSessions"
        @cancel="finish"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import apiClient from '@/api/client'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppConfirm from '@/components/common/AppConfirm.vue'
import AuthLocaleSwitch from '@/components/common/AuthLocaleSwitch.vue'
import { useSettingsStore } from '@/store/useSettingsStore'

const { t } = useI18n()
const router = useRouter()
const settings = useSettingsStore()
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const errorKey = ref('')
const showSessionPrompt = ref(false)
const revoking = ref(false)
const sessionRevocationGrant = ref('')

async function submit() {
  const email = sessionStorage.getItem('ds_password_recovery_email')
  const recoveryGrant = sessionStorage.getItem('ds_password_recovery_grant')
  if (!email || !recoveryGrant) {
    errorKey.value = 'errors.recoverySessionMissing'
    return
  }
  if (password.value !== confirmation.value) {
    errorKey.value = 'errors.passwordsDoNotMatch'
    return
  }
  loading.value = true
  errorKey.value = ''
  try {
    const { data } = await apiClient.post('/auth/reset-password', { email, recoveryGrant, newPassword: password.value, confirmPassword: confirmation.value })
    sessionStorage.removeItem('ds_password_recovery_email')
    sessionStorage.removeItem('ds_password_recovery_grant')
    settings.showToastKey('toasts.passwordUpdatedSuccess', undefined, 'success')
    sessionRevocationGrant.value = data.sessionRevocationGrant || ''
    showSessionPrompt.value = true
  } catch (error: any) {
    const code = error.response?.data?.code
    errorKey.value = code === 'password_reused'
      ? 'errors.passwordReused'
      : code === 'password_complexity_invalid'
        ? 'errors.passwordComplexity'
        : 'errors.recoverySessionMissing'
  } finally {
    loading.value = false
  }
}

async function revokePreviousSessions() {
  if (revoking.value) return
  revoking.value = true
  try {
    await apiClient.post('/auth/sessions/revoke-after-recovery', {
      sessionRevocationGrant: sessionRevocationGrant.value,
    })
    settings.showToastKey('toasts.otherSessionsLoggedOutSuccess', undefined, 'success')
    finish()
  } catch {
    errorKey.value = 'errors.logoutOtherSessionsFailed'
  } finally {
    revoking.value = false
  }
}

function finish() {
  showSessionPrompt.value = false
  router.push('/login')
}
</script>

<style scoped src="./recoveryFlow.css"></style>
