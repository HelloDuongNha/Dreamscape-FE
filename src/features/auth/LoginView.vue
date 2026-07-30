<template>
  <div class="auth-page">
    <AuthLocaleSwitch />
    <div class="auth-card">

      <!-- Logo -->
      <div class="auth-logo" aria-hidden="true">◈</div>
      <h1 class="auth-title">{{ t('auth.signInTitle') }}</h1>
      <p class="auth-sub">{{ t('auth.signInSub') }}</p>

      <!-- Error banner -->
      <div v-if="localError || backendError" class="auth-error" role="alert">
        <span v-if="localError">{{ t(localError.key, localError.params || {}) }}</span>
        <span v-else>{{ backendError }}</span>
      </div>

      <!-- Form -->
      <form class="auth-form" novalidate @submit.prevent="handleLogin">
        <div class="auth-field">
          <label for="login-email" class="auth-label">{{ t('auth.emailLabel') }}</label>
          <AppInput
            id="login-email"
            v-model="email"
            type="email"
            :placeholder="t('auth.emailPlaceholder')"
            autocomplete="email"
            :disabled="loading"
          />
        </div>

        <div class="auth-field">
          <label for="login-password" class="auth-label">{{ t('auth.passwordLabel') }}</label>
          <AppInput
            id="login-password"
            v-model="password"
            type="password"
            :placeholder="t('auth.passwordPlaceholder')"
            autocomplete="current-password"
            :disabled="loading"
          />
          <RouterLink to="/forgot-password" class="auth-link auth-link--forgot">
            {{ t('auth.forgotPasswordLink') }}
          </RouterLink>
        </div>

        <AppButton
          id="login-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          :disabled="loading || !email || !password"
          style="width: 100%; margin-top: var(--space-2);"
        >
          {{ loading ? t('auth.signingIn') : t('auth.signInBtn') }}
        </AppButton>
      </form>

      <GoogleAuthButton />

      <p class="auth-switch">
        {{ t('auth.noAccountText') }}
        <RouterLink to="/register" class="auth-link">{{ t('auth.createAccountLink') }}</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppInput  from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'
import AuthLocaleSwitch from '@/components/common/AuthLocaleSwitch.vue'
import GoogleAuthButton from './GoogleAuthButton.vue'
import { useAuthStore } from '@/store/useAuthStore'

const { t } = useI18n()
const router    = useRouter()
const authStore = useAuthStore()

const email    = ref('')
const password = ref('')
const loading  = ref(false)

const localError = ref<{ key: string; params?: Record<string, string | number> } | null>(null)
const backendError = ref<string | null>(null)

async function handleLogin() {
  localError.value = null
  backendError.value = null

  if (!email.value || !password.value) {
    localError.value = { key: 'errors.fieldsRequired' }
    return
  }

  loading.value  = true
  try {
    await authStore.login(email.value.trim(), password.value)
    router.push('/')
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })
      .response?.data?.message
    if (msg) {
      backendError.value = msg
    } else {
      localError.value = { key: 'errors.loginFailed' }
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  position: relative;
  min-height: 100dvh;
  background: var(--color-bg-main, #101010);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.auth-card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auth-logo {
  font-size: 2rem;
  color: var(--color-text-primary, #f3f5f7);
  text-align: center;
  line-height: 1;
}

.auth-title {
  font-size: var(--font-size-xl, 1.25rem);
  font-weight: var(--font-weight-bold, 700);
  color: var(--color-text-primary, #f3f5f7);
  text-align: center;
  margin: 0;
}

.auth-sub {
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-text-muted, #616161);
  text-align: center;
  margin: 0;
}

.auth-error {
  background: #2d1010;
  border: 1px solid #3d1515;
  color: #ed4956;
  font-size: var(--font-size-sm, 0.875rem);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md, 8px);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.auth-label {
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--color-text-secondary, #a0a0a0);
}

.auth-switch {
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-text-muted, #616161);
  text-align: center;
  margin: 0;
}

.auth-link {
  color: var(--color-text-primary, #f3f5f7);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.auth-link:hover { color: #fff; }
.auth-link--forgot { align-self: flex-end; font-size: var(--font-size-sm, 0.875rem); }
</style>
