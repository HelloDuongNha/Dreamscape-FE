<template>
  <div class="auth-page">
    <div class="auth-card">

      <div class="auth-logo" aria-hidden="true">◈</div>
      <h1 class="auth-title">Create your account</h1>
      <p class="auth-sub">Join DreamScape and start archiving your dreams.</p>

      <div v-if="errorMsg" class="auth-error" role="alert">{{ errorMsg }}</div>

      <form class="auth-form" novalidate @submit.prevent="handleRegister">
        <div class="auth-field">
          <label for="reg-username" class="auth-label">Username</label>
          <AppInput
            id="reg-username"
            v-model="username"
            type="text"
            placeholder="@yourhandle"
            autocomplete="username"
            :disabled="loading"
          />
        </div>

        <div class="auth-field">
          <label for="reg-displayname" class="auth-label">Display name</label>
          <AppInput
            id="reg-displayname"
            v-model="displayName"
            type="text"
            placeholder="Your name"
            autocomplete="name"
            :disabled="loading"
          />
        </div>

        <div class="auth-field">
          <label for="reg-email" class="auth-label">Email</label>
          <AppInput
            id="reg-email"
            v-model="email"
            type="email"
            placeholder="you@dreamscape.io"
            autocomplete="email"
            :disabled="loading"
          />
        </div>

        <div class="auth-field">
          <label for="reg-password" class="auth-label">Password</label>
          <AppInput
            id="reg-password"
            v-model="password"
            type="password"
            placeholder="Min. 6 characters"
            autocomplete="new-password"
            :disabled="loading"
          />
        </div>

        <AppButton
          id="register-submit-btn"
          type="submit"
          variant="primary"
          size="lg"
          :disabled="loading || !canSubmit"
          style="width: 100%; margin-top: var(--space-2);"
        >
          {{ loading ? 'Creating account…' : 'Create account' }}
        </AppButton>
      </form>

      <p class="auth-switch">
        Already have an account?
        <RouterLink to="/login" class="auth-link">Sign in</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter }     from 'vue-router'
import AppInput          from '@/components/common/AppInput.vue'
import AppButton         from '@/components/common/AppButton.vue'
import { useAuthStore }  from '@/store/useAuthStore'

const router    = useRouter()
const authStore = useAuthStore()

const username    = ref('')
const displayName = ref('')
const email       = ref('')
const password    = ref('')
const loading     = ref(false)
const errorMsg    = ref('')

const canSubmit = computed(() =>
  username.value.trim() !== '' &&
  displayName.value.trim() !== '' &&
  email.value.trim() !== '' &&
  password.value.length >= 6
)

async function handleRegister() {
  if (!canSubmit.value) return
  loading.value  = true
  errorMsg.value = ''
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
        query: { email: email.value.trim(), purpose: 'register' }
      })
    } else {
      router.push('/')
    }
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })
      .response?.data?.message
    errorMsg.value = msg ?? 'Registration failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* Same flat design system as LoginView */
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
