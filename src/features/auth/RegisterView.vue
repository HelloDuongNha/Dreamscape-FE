<template>
  <div class="auth-page">
    <AuthLocaleSwitch />
    <div class="auth-card">

      <div class="auth-logo" aria-hidden="true">◈</div>
      <h1 class="auth-title">{{ t('auth.signUpTitle') }}</h1>
      <p class="auth-sub">{{ t('auth.signUpSub') }}</p>

      <div v-if="localError || backendError" class="auth-error" role="alert">
        <span v-if="localError">{{ t(localError.key, localError.params || {}) }}</span>
        <span v-else>{{ backendError }}</span>
      </div>

      <form class="auth-form" novalidate @submit.prevent="handleRegister">
        <div class="auth-field">
          <label for="reg-username" class="auth-label">{{ t('auth.usernameLabel') }}</label>
          <AppInput
            id="reg-username"
            v-model="username"
            type="text"
            :placeholder="t('auth.usernamePlaceholder')"
            autocomplete="username"
            :disabled="loading"
          />
        </div>

        <div class="auth-field">
          <label for="reg-displayname" class="auth-label">{{ t('auth.displayNameLabel') }}</label>
          <AppInput
            id="reg-displayname"
            v-model="displayName"
            type="text"
            :placeholder="t('auth.displayNamePlaceholder')"
            autocomplete="name"
            :disabled="loading"
          />
        </div>

        <div class="auth-field">
          <label for="reg-email" class="auth-label">{{ t('auth.emailLabel') }}</label>
          <AppInput
            id="reg-email"
            v-model="email"
            type="email"
            :placeholder="t('auth.emailPlaceholder')"
            autocomplete="email"
            :disabled="loading"
          />
        </div>

        <div class="auth-field">
          <label for="reg-password" class="auth-label">{{ t('auth.passwordLabel') }}</label>
          <AppInput
            id="reg-password"
            v-model="password"
            type="password"
            :placeholder="t('auth.passwordMinLength')"
            autocomplete="new-password"
            :disabled="loading"
          />
        </div>

        <AppButton
          id="register-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          :disabled="loading || !username || !displayName || !email || password.length < 8"
          style="width: 100%; margin-top: var(--space-2);"
        >
          {{ loading ? t('auth.creatingAccount') : t('auth.createAccountBtn') }}
        </AppButton>
      </form>

      <p class="auth-switch">
        {{ t('auth.hasAccountText') }}
        <RouterLink to="/login" class="auth-link">{{ t('auth.signInLink') }}</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppInput          from '@/components/common/AppInput.vue'
import AppButton         from '@/components/common/AppButton.vue'
import AuthLocaleSwitch  from '@/components/common/AuthLocaleSwitch.vue'
import { useAuthStore }  from '@/store/useAuthStore'

const { t } = useI18n()
const router    = useRouter()
const authStore = useAuthStore()

const username    = ref('')
const displayName = ref('')
const email       = ref('')
const password    = ref('')
const loading     = ref(false)

const localError = ref<{ key: string; params?: Record<string, string | number> } | null>(null)
const backendError = ref<string | null>(null)

async function handleRegister() {
  localError.value = null
  backendError.value = null

  if (!username.value.trim()) {
    localError.value = { key: 'errors.usernameRequired' }
    return
  }
  if (!displayName.value.trim()) {
    localError.value = { key: 'errors.displayNameRequired' }
    return
  }
  if (!email.value.trim()) {
    localError.value = { key: 'errors.emailRequired' }
    return
  }
  if (!password.value) {
    localError.value = { key: 'errors.passwordRequired' }
    return
  }
  if (password.value.length < 8) {
    localError.value = { key: 'errors.passwordTooShort' }
    return
  }
  if (!/[a-z]/.test(password.value) || !/[A-Z]/.test(password.value) || !/\d/.test(password.value)) {
    localError.value = { key: 'errors.passwordComplexity' }
    return
  }

  loading.value  = true
  try {
    const data = await authStore.register({
      username:     username.value.trim(),
      display_name: displayName.value.trim(),
      email:        email.value.trim(),
      password:     password.value,
    })
    if (data.status === 'pending') {
      router.push({
        path: '/verify-otp',
        query: {
          email: email.value.trim(),
          purpose: 'register',
          resendAvailableAt: data.resendAvailableAt,
        }
      })
    } else {
      router.push('/')
    }
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })
      .response?.data?.message
    if (msg) {
      backendError.value = msg
    } else {
      localError.value = { key: 'errors.registrationFailed' }
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
</style>
