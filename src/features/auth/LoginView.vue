<template>
  <div class="auth-page">
    <div class="auth-card">

      <!-- Logo -->
      <div class="auth-logo" aria-hidden="true">◈</div>
      <h1 class="auth-title">Sign in to DreamScape</h1>
      <p class="auth-sub">Enter your credentials to continue.</p>

      <!-- Error banner -->
      <div v-if="errorMsg" class="auth-error" role="alert">{{ errorMsg }}</div>

      <!-- Form -->
      <form class="auth-form" novalidate @submit.prevent="handleLogin">
        <div class="auth-field">
          <label for="login-email" class="auth-label">Email</label>
          <AppInput
            id="login-email"
            v-model="email"
            type="email"
            placeholder="you@dreamscape.io"
            autocomplete="email"
            :disabled="loading"
          />
        </div>

        <div class="auth-field">
          <label for="login-password" class="auth-label">Password</label>
          <AppInput
            id="login-password"
            v-model="password"
            type="password"
            placeholder="Your password"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>

        <AppButton
          id="login-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          :disabled="loading || !email || !password"
          style="width: 100%; margin-top: var(--space-2);"
        >
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </AppButton>
      </form>

      <p class="auth-switch">
        Don't have an account?
        <RouterLink to="/register" class="auth-link">Create one</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppInput  from '@/components/common/AppInput.vue'
import AppButton from '@/components/common/AppButton.vue'
import { useAuthStore } from '@/store/useAuthStore'

const router    = useRouter()
const authStore = useAuthStore()

const email    = ref('')
const password = ref('')
const loading  = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (!email.value || !password.value) return
  loading.value  = true
  errorMsg.value = ''
  try {
    await authStore.login(email.value.trim(), password.value)
    router.push('/')
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })
      .response?.data?.message
    errorMsg.value = msg ?? 'Login failed. Please check your credentials.'
  } finally {
    loading.value = false
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
