<template>
  <div class="auth-page">
    <AuthLocaleSwitch />
    <div class="auth-card">
      <div class="auth-logo" aria-hidden="true">◈</div>
      <h1 class="auth-title">{{ t('auth.verifyOtpTitle') }}</h1>
      <i18n-t keypath="auth.verifyOtpSub" tag="p" class="auth-sub">
        <template #email><strong>{{ email }}</strong></template>
      </i18n-t>
      <p class="auth-mail-hint">{{ t('auth.checkSpamHint') }}</p>

      <div v-if="localError || backendError" id="otp-error" class="auth-error" role="alert">
        <span v-if="localError">{{ t(localError.key, localError.params || {}) }}</span>
        <span v-else>{{ backendError }}</span>
      </div>
      <div v-if="localSuccess" class="auth-success" role="alert">
        {{ t(localSuccess.key, localSuccess.params || {}) }}
      </div>

      <form class="auth-form" @submit.prevent="handleVerify">
        <label for="otp-code" class="otp-label">{{ t('auth.otpCodeLabel') }}</label>
        <input
          id="otp-code"
          ref="otpInput"
          :value="otpCode"
          type="text"
          inputmode="numeric"
          pattern="[0-9]{6}"
          maxlength="6"
          autocomplete="one-time-code"
          class="otp-code-field"
          :placeholder="t('auth.otpCodePlaceholder')"
          :aria-describedby="localError || backendError ? 'otp-error' : undefined"
          :disabled="loading"
          autofocus
          @input="handleOtpInput"
          @paste="handlePaste"
        />

        <AppButton
          id="otp-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          :loading="loading"
          :disabled="loading || !isComplete"
          style="width: 100%; margin-top: var(--space-4);"
        >
          {{ loading ? t('auth.verifyingBtn') : t('auth.verifyBtn') }}
        </AppButton>
      </form>

      <p class="auth-switch">
        {{ t('auth.noCodeText') }}
        <button
          type="button"
          class="resend-btn"
          :disabled="resending || resendSeconds > 0"
          @click="handleResend"
        >
          {{
            resending
              ? t('auth.resendingBtn')
              : resendSeconds > 0
                ? t('auth.resendIn', { seconds: resendSeconds })
                : t('auth.resendBtn')
          }}
        </button>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/common/AppButton.vue'
import AuthLocaleSwitch from '@/components/common/AuthLocaleSwitch.vue'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import {
  otpErrorKey,
  otpResendEndpoint,
  otpVerificationEndpoint,
  parseOtpDate,
  type OtpPurpose,
} from './otpPresentation'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const email = computed(() => (route.query.email as string) || '')
const purpose = computed<OtpPurpose>(() => {
  const candidate = route.query.purpose
  if (candidate === 'update_email' || candidate === 'forgot_password') return candidate
  return 'register'
})

const otpCode = ref('')
const otpInput = ref<HTMLInputElement | null>(null)

const loading = ref(false)
const resending = ref(false)
const resendAvailableAt = ref(parseOtpDate(route.query.resendAvailableAt))
const now = ref(Date.now())
let countdownTimer: number | undefined

const localError = ref<{ key: string; params?: Record<string, string | number> } | null>(null)
const backendError = ref<string | null>(null)
const localSuccess = ref<{ key: string; params?: Record<string, string | number> } | null>(null)

const isComplete = computed(() => /^\d{6}$/.test(otpCode.value))
const resendSeconds = computed(() =>
  Math.max(0, Math.ceil((resendAvailableAt.value - now.value) / 1000))
)

onMounted(() => {
  otpInput.value?.focus()
  countdownTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (countdownTimer !== undefined) window.clearInterval(countdownTimer)
})

function handleOtpInput(event: Event) {
  const input = event.target as HTMLInputElement
  const sanitized = input.value.replace(/\D/g, '').slice(0, 6)
  otpCode.value = sanitized
  if (input.value !== sanitized) input.value = sanitized
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  otpCode.value = (event.clipboardData?.getData('text') || '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

async function handleVerify() {
  if (!isComplete.value || loading.value) return
  loading.value = true
  localError.value = null
  backendError.value = null
  localSuccess.value = null

  try {
    const endpoint = otpVerificationEndpoint(purpose.value)
    const { data } = await apiClient.post(endpoint, {
      email: email.value,
      otpCode: otpCode.value,
      ...(purpose.value === 'update_email' ? {} : { purpose: purpose.value }),
    })

    if (data.success) {
      if (purpose.value === 'register') {
        // Login immediately
        authStore.updateCurrentUser(data.user)
        authStore.token = data.token
        localStorage.setItem('ds_token', data.token)
        localStorage.setItem('ds_user', JSON.stringify(data.user))

        // Reconnect chat socket
        import('@/store/useChatStore').then(({ useChatStore }) => {
          useChatStore().connectSocket()
        })

        settingsStore.showToastKey('toasts.otpVerifiedSuccess', undefined, 'success')
        router.push('/')
      } else if (purpose.value === 'update_email') {
        // Update user details
        authStore.updateCurrentUser(data.user)
        settingsStore.verified = true
        settingsStore.showToastKey('toasts.emailVerifiedSuccess', undefined, 'success')
        router.push({ path: '/settings/security', query: { securityChange: 'email' } })
      } else {
        if (data.recoveryGrant) {
          sessionStorage.setItem('ds_password_recovery_grant', data.recoveryGrant)
          sessionStorage.setItem('ds_password_recovery_email', email.value)
        }
        settingsStore.showToastKey('toasts.otpVerifiedSuccess', undefined, 'success')
        router.push('/reset-password')
      }
    }
  } catch (err: any) {
    const errorKey = otpErrorKey(err.response?.data?.code)
    localError.value = {
      key: errorKey,
      params: { count: err.response?.data?.attemptsRemaining ?? 0 },
    }
    settingsStore.showToastKey(errorKey, localError.value.params, 'error')
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (resending.value || resendSeconds.value > 0) return
  resending.value = true
  localError.value = null
  backendError.value = null
  localSuccess.value = null

  try {
    const endpoint = otpResendEndpoint(purpose.value)
    const { data } = await apiClient.post(endpoint, {
      email: email.value,
      ...(purpose.value === 'update_email' ? {} : { purpose: purpose.value }),
    })

    if (data.success) {
      localSuccess.value = { key: 'auth.otpResentSuccess' }
      settingsStore.showToastKey('auth.otpResentSuccess', undefined, 'success')
      resendAvailableAt.value = parseOtpDate(data.resendAvailableAt)
      now.value = Date.now()
      otpCode.value = ''
      otpInput.value?.focus()
    }
  } catch (err: any) {
    const errorCode = err.response?.data?.code
    if (errorCode === 'otp_resend_cooldown') {
      resendAvailableAt.value = Date.now() + Number(err.response?.data?.retryAfterSeconds || 0) * 1000
    }
    const errorKey = otpErrorKey(errorCode, true)
    localError.value = { key: errorKey }
    settingsStore.showToastKey(errorKey, undefined, 'error')
  } finally {
    resending.value = false
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
  line-height: 1.5;
}

.auth-mail-hint {
  margin: calc(var(--space-2) * -1) 0 0;
  color: var(--color-text-muted, #757575);
  font-size: var(--font-size-xs, 0.75rem);
  line-height: 1.5;
  text-align: center;
}

.auth-error {
  background: #2d1010;
  border: 1px solid #3d1515;
  color: #ed4956;
  font-size: var(--font-size-sm, 0.875rem);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md, 8px);
}

.auth-success {
  background: #0e2a1c;
  border: 1px solid #1a3d2e;
  color: #4ade80;
  font-size: var(--font-size-sm, 0.875rem);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md, 8px);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.otp-label {
  color: var(--color-text-secondary, #a0a0a0);
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
}

.otp-code-field {
  width: 100%;
  min-height: 52px;
  background: var(--color-bg-elevated, #181818);
  border: 1px solid var(--color-border-input, #262626);
  border-radius: var(--radius-md, 8px);
  color: var(--color-text-primary, #f3f5f7);
  font-size: 1.35rem;
  font-weight: 700;
  font-family: var(--font-family-mono, monospace);
  text-align: center;
  letter-spacing: 0.4em;
  padding: var(--space-3) var(--space-4);
  outline: none;
  transition: border-color var(--transition-fast, 0.15s);
}

.otp-code-field::placeholder {
  color: var(--color-text-muted, #616161);
  letter-spacing: 0.28em;
}

.otp-code-field:focus {
  border-color: #4a4a4a;
}

.otp-code-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-switch {
  font-size: var(--font-size-sm, 0.875rem);
  color: var(--color-text-muted, #616161);
  text-align: center;
  margin: 0;
}

.resend-btn {
  background: none;
  border: none;
  color: var(--color-text-primary, #f3f5f7);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
}

.resend-btn:hover {
  color: #fff;
}

.resend-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  text-decoration: none;
}
</style>
