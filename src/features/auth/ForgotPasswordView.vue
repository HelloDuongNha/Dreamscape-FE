<template>
  <main class="recovery-page">
    <AuthLocaleSwitch />
    <section class="recovery-card">
      <div class="recovery-logo" aria-hidden="true">◈</div>
      <h1>{{ t('auth.forgotPasswordTitle') }}</h1>
      <p>{{ t('auth.forgotPasswordSub') }}</p>
      <div class="recovery-skip-status">
        <strong>{{ t('auth.otpSkipStatus') }}</strong>
        <span>{{ t('auth.googleVerificationRequired') }}</span>
      </div>
      <div v-if="errorKey" class="recovery-error" role="alert">{{ t(errorKey) }}</div>
      <div class="recovery-form">
        <AppInput id="recovery-new-password" v-model="password" type="password" :label="t('auth.newPasswordLabel')" autocomplete="new-password" :disabled="loading" />
        <AppInput id="recovery-confirm-password" v-model="confirmation" type="password" :label="t('auth.confirmPasswordLabel')" autocomplete="new-password" :disabled="loading" />
        <GoogleAuthButton
          manual
          :show-divider="false"
          :disabled="loading || !canSubmit"
          @verified="resetWithGoogle"
        />
      </div>
      <RouterLink to="/login" class="recovery-link">{{ t('auth.backToSignIn') }}</RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import apiClient from '@/api/client'
import AppInput from '@/components/common/AppInput.vue'
import AuthLocaleSwitch from '@/components/common/AuthLocaleSwitch.vue'
import GoogleAuthButton from './GoogleAuthButton.vue'
import { useSettingsStore } from '@/store/useSettingsStore'

const { t } = useI18n()
const router = useRouter()
const settings = useSettingsStore()
const password = ref('')
const confirmation = ref('')
const loading = ref(false)
const errorKey = ref('')
const canSubmit = computed(() => (
  password.value.length >= 8
  && password.value === confirmation.value
))

async function resetWithGoogle(idToken: string) {
  if (loading.value || !canSubmit.value) return
  if (!/[a-z]/u.test(password.value) || !/[A-Z]/u.test(password.value) || !/\d/u.test(password.value)) {
    errorKey.value = 'errors.passwordComplexity'
    return
  }
  loading.value = true
  errorKey.value = ''
  try {
    await apiClient.post('/auth/password/google-reset', {
      idToken,
      newPassword: password.value,
      confirmPassword: confirmation.value,
    })
    settings.showToastKey('toasts.passwordUpdatedSuccess', undefined, 'success')
    await router.replace('/login')
  } catch (error: unknown) {
    const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code
    errorKey.value = code === 'password_reused'
      ? 'errors.passwordReused'
      : code === 'password_complexity_invalid'
        ? 'errors.passwordComplexity'
        : 'errors.googlePasswordRecoveryFailed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped src="./recoveryFlow.css"></style>
