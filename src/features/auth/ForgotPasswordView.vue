<template>
  <main class="recovery-page">
    <AuthLocaleSwitch />
    <section class="recovery-card">
      <div class="recovery-logo" aria-hidden="true">◈</div>
      <h1>{{ t('auth.forgotPasswordTitle') }}</h1>
      <p>{{ t('auth.forgotPasswordSub') }}</p>
      <form class="recovery-form" @submit.prevent="submit">
        <AppInput id="recovery-email" v-model="email" type="email" :label="t('auth.emailLabel')" :placeholder="t('auth.emailPlaceholder')" autocomplete="email" :disabled="loading" />
        <AppButton type="submit" variant="primary" size="lg" :disabled="loading || !email.trim()">
          {{ loading ? t('auth.sendingRecoveryCode') : t('auth.sendRecoveryCode') }}
        </AppButton>
      </form>
      <RouterLink to="/login" class="recovery-link">{{ t('auth.backToSignIn') }}</RouterLink>
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
import AuthLocaleSwitch from '@/components/common/AuthLocaleSwitch.vue'
import { useSettingsStore } from '@/store/useSettingsStore'

const { t } = useI18n()
const router = useRouter()
const settings = useSettingsStore()
const email = ref('')
const loading = ref(false)

async function submit() {
  if (loading.value || !email.value.trim()) return
  loading.value = true
  try {
    const { data } = await apiClient.post('/auth/forgot-password', { email: email.value.trim() })
    settings.showToastKey('toasts.recoveryCodeSent', undefined, 'success')
    router.push({ path: '/verify-otp', query: { email: email.value.trim(), purpose: 'forgot_password', resendAvailableAt: data.resendAvailableAt } })
  } catch {
    settings.showToastKey('errors.networkError', undefined, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped src="./recoveryFlow.css"></style>
