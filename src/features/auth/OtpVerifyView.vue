<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo" aria-hidden="true">◈</div>
      <h1 class="auth-title">Verify OTP Code</h1>
      <p class="auth-sub">Enter the 6-digit verification code sent to <strong>{{ email }}</strong>.</p>

      <div v-if="errorMsg" class="auth-error" role="alert">{{ errorMsg }}</div>
      <div v-if="successMsg" class="auth-success" role="alert">{{ successMsg }}</div>

      <form class="auth-form" @submit.prevent="handleVerify">
        <div class="otp-inputs-row">
          <input
            v-for="(_, idx) in 6"
            :key="idx"
            :id="`otp-digit-${idx}`"
            ref="inputRefs"
            v-model="digits[idx]"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="1"
            class="otp-digit-field"
            :disabled="loading"
            @input="handleInput($event, idx)"
            @keydown.delete="handleDelete($event, idx)"
            @paste="handlePaste($event)"
          />
        </div>

        <AppButton
          id="otp-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          :disabled="loading || !isComplete"
          style="width: 100%; margin-top: var(--space-4);"
        >
          {{ loading ? 'Verifying...' : 'Verify' }}
        </AppButton>
      </form>

      <p class="auth-switch">
        Didn't receive a code?
        <button type="button" class="resend-btn" :disabled="resending" @click="handleResend">
          {{ resending ? 'Sending...' : 'Resend Code' }}
        </button>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/common/AppButton.vue'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()

const email = computed(() => (route.query.email as string) || '')
const purpose = computed(() => (route.query.purpose as string) || 'register')

const digits = ref<string[]>(['', '', '', '', '', ''])
const inputRefs = ref<HTMLInputElement[]>([])

const loading = ref(false)
const resending = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const isComplete = computed(() => digits.value.every(d => d !== ''))

onMounted(() => {
  if (inputRefs.value[0]) {
    inputRefs.value[0].focus()
  }
})

function handleInput(e: Event, idx: number) {
  const inputEl = e.target as HTMLInputElement
  const val = inputEl.value.replace(/[^0-9]/g, '') // only allow digits

  digits.value[idx] = val

  if (val && idx < 5) {
    inputRefs.value[idx + 1]?.focus()
  }
}

function handleDelete(_e: KeyboardEvent, idx: number) {
  if (digits.value[idx] === '' && idx > 0) {
    digits.value[idx - 1] = ''
    inputRefs.value[idx - 1]?.focus()
  } else {
    digits.value[idx] = ''
  }
}

function handlePaste(e: ClipboardEvent) {
  e.preventDefault()
  const data = e.clipboardData?.getData('text') || ''
  const numbersOnly = data.replace(/[^0-9]/g, '').slice(0, 6)

  for (let i = 0; i < numbersOnly.length; i++) {
    digits.value[i] = numbersOnly[i]
  }

  const nextIdx = Math.min(numbersOnly.length, 5)
  inputRefs.value[nextIdx]?.focus()
}

async function handleVerify() {
  if (!isComplete.value || loading.value) return
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''

  const otpCode = digits.value.join('')

  try {
    const { data } = await apiClient.post('/auth/verify-otp', {
      email: email.value,
      otpCode,
      purpose: purpose.value,
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

        settingsStore.showToast('Account created and verified!', 'success')
        router.push('/')
      } else if (purpose.value === 'update_email') {
        // Update user details
        authStore.updateCurrentUser(data.user)
        settingsStore.verified = true
        settingsStore.showToast('Email verified and updated successfully!', 'success')
        router.push('/settings/security')
      } else {
        settingsStore.showToast('Code verified successfully!', 'success')
      }
    }
  } catch (err: any) {
    const msg = err.response?.data?.message || 'Verification failed. Please check the code.'
    errorMsg.value = msg
    settingsStore.showToast(msg, 'error')
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (resending.value) return
  resending.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const { data } = await apiClient.post('/auth/resend-otp', {
      email: email.value,
      purpose: purpose.value,
    })

    if (data.success) {
      successMsg.value = 'A new verification code has been sent to your email.'
      settingsStore.showToast('Verification code resent.', 'success')
      // Reset inputs
      digits.value = ['', '', '', '', '', '']
      if (inputRefs.value[0]) {
        inputRefs.value[0].focus()
      }
    }
  } catch (err: any) {
    const msg = err.response?.data?.message || 'Failed to resend code. Please try again.'
    errorMsg.value = msg
    settingsStore.showToast(msg, 'error')
  } finally {
    resending.value = false
  }
}
</script>

<style scoped>
.auth-page {
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

.otp-inputs-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.otp-digit-field {
  width: 48px;
  height: 48px;
  background: var(--color-bg-elevated, #181818);
  border: 1px solid var(--color-border-input, #262626);
  border-radius: var(--radius-md, 8px);
  color: var(--color-text-primary, #f3f5f7);
  font-size: 1.5rem;
  font-weight: 700;
  font-family: var(--font-family-mono, monospace);
  text-align: center;
  outline: none;
  transition: border-color var(--transition-fast, 0.15s);
}

.otp-digit-field:focus {
  border-color: #4a4a4a;
}

.otp-digit-field:disabled {
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
