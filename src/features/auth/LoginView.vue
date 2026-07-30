<template>
  <div class="auth-page">
    <AuthLocaleSwitch />
    <div class="auth-card">

      <!-- Logo -->
      <div class="auth-logo" aria-hidden="true">◈</div>
      <h1 class="auth-title">{{ t('auth.signInTitle') }}</h1>
      <p class="auth-sub">{{ t('auth.signInSub') }}</p>

      <!-- Error banner -->
      <div v-if="retrySeconds > 0 || localError || backendError" class="auth-error" role="alert">
        <span v-if="retrySeconds > 0">{{ t('errors.loginRetryAfter', { seconds: retrySeconds }) }}</span>
        <span v-else-if="localError">{{ t(localError.key, localError.params || {}) }}</span>
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

        <AuthDataConsent
          id="login-data-consent"
          v-model="dataConsent"
          :invalid="consentInvalid"
          :disabled="loading"
          @update:model-value="consentInvalid = false"
        />

        <AppButton
          id="login-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          :loading="loading"
          :disabled="loading || retrySeconds > 0 || !email || !password"
          style="width: 100%; margin-top: var(--space-2);"
        >
          {{
            loading
              ? t('auth.signingIn')
              : retrySeconds > 0
                ? t('auth.retryIn', { seconds: retrySeconds })
                : t('auth.signInBtn')
          }}
        </AppButton>
      </form>

      <GoogleAuthButton
        :consent-granted="dataConsent"
        @consent-required="requireDataConsent"
      />

      <p class="auth-switch">
        {{ t('auth.noAccountText') }}
        <RouterLink to="/register" class="auth-link">{{ t('auth.createAccountLink') }}</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppInput  from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'
import AuthLocaleSwitch from '@/components/common/AuthLocaleSwitch.vue'
import GoogleAuthButton from './GoogleAuthButton.vue'
import AuthDataConsent from './AuthDataConsent.vue'
import { resolveAuthRedirect } from './authRedirect'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'

const { t } = useI18n()
const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const email    = ref('')
const password = ref('')
const dataConsent = ref(false)
const consentInvalid = ref(false)
const loading  = ref(false)
const retryAvailableAt = ref(0)
const now = ref(Date.now())
let retryTimer: number | undefined

const localError = ref<{ key: string; params?: Record<string, string | number> } | null>(null)
const backendError = ref<string | null>(null)
const retrySeconds = computed(() =>
  Math.max(0, Math.ceil((retryAvailableAt.value - now.value) / 1000))
)

onMounted(() => {
  retryTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (retryTimer !== undefined) window.clearInterval(retryTimer)
})

async function handleLogin() {
  if (loading.value || retrySeconds.value > 0) return
  localError.value = null
  backendError.value = null

  if (!dataConsent.value) {
    requireDataConsent()
    return
  }

  if (!email.value || !password.value) {
    localError.value = { key: 'errors.fieldsRequired' }
    return
  }

  loading.value  = true
  try {
    await authStore.login(email.value.trim(), password.value)
    await router.replace(resolveAuthRedirect(route.query.redirect))
  } catch (err: unknown) {
    const response = (err as {
      response?: {
        data?: { code?: string; message?: string; retryAfterSeconds?: number }
      }
    }).response
    const retryAfterSeconds = Number(response?.data?.retryAfterSeconds || 0)
    if (response?.data?.code === 'rate_limit_exceeded' && retryAfterSeconds > 0) {
      retryAvailableAt.value = Date.now() + retryAfterSeconds * 1000
      now.value = Date.now()
    } else if (response?.data?.message) {
      backendError.value = response.data.message
    } else {
      localError.value = { key: 'errors.loginFailed' }
    }
  } finally {
    loading.value = false
  }
}

function requireDataConsent() {
  consentInvalid.value = true
  settingsStore.showToastKey('toasts.dataConsentRequired', undefined, 'error')
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
