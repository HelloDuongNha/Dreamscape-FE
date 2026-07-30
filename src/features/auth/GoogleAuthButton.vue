<template>
  <div class="google-auth">
    <div class="google-auth__divider" aria-hidden="true">
      <span />
      <span>{{ t('auth.orContinueWith') }}</span>
      <span />
    </div>
    <button
      class="google-auth__button"
      type="button"
      :disabled="loading"
      :aria-label="t('auth.continueWithGoogle')"
      @click="start"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.24-.2-1.8H12v3.41h5.52a4.72 4.72 0 0 1-2.05 3.1l2.9 2.25c1.69-1.56 3.23-3.86 3.23-6.96Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.97-.89 6.63-2.42l-3.16-2.45c-.88.59-2 1-3.47 1-2.6 0-4.81-1.76-5.6-4.12l-3 2.32A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.4 14.01A6 6 0 0 1 6.08 12c0-.7.12-1.38.32-2.01l-3-2.32A10 10 0 0 0 2 12c0 1.6.38 3.12 1.4 4.33l3-2.32Z" />
        <path fill="#EA4335" d="M12 5.87c1.6 0 3.03.55 4.16 1.63l3.12-3.12A10 10 0 0 0 3.4 7.67l3 2.32C7.19 7.63 9.4 5.87 12 5.87Z" />
      </svg>
      <span>{{ loading ? t('auth.connectingGoogle') : t('auth.continueWithGoogle') }}</span>
    </button>
    <p v-if="error" class="google-auth__error" role="alert">{{ error }}</p>
    <GoogleOnboardingModal
      v-if="onboarding"
      :onboarding="onboarding"
      @close="onboarding = null"
      @completed="complete"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore, type GoogleOnboardingState } from '@/store/useAuthStore'
import { beginGoogleSignIn, prepareGoogleSignIn } from './googleSignIn.service'
import GoogleOnboardingModal from './GoogleOnboardingModal.vue'
import { resolveAuthRedirect } from './authRedirect'

const { t } = useI18n()
const props = withDefaults(defineProps<{
  consentGranted?: boolean
}>(), {
  consentGranted: true,
})
const emit = defineEmits<{
  'consent-required': []
}>()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const error = ref('')
const onboarding = ref<GoogleOnboardingState | null>(null)

async function finish(idToken: string) {
  onboarding.value = await authStore.loginWithGoogle(idToken)
  if (onboarding.value) return
  await router.replace(resolveAuthRedirect(route.query.redirect))
}

async function complete() {
  onboarding.value = null
  await router.replace(resolveAuthRedirect(route.query.redirect))
}

async function start() {
  if (!props.consentGranted) {
    emit('consent-required')
    return
  }
  loading.value = true
  error.value = ''
  try {
    const idToken = await beginGoogleSignIn()
    if (idToken) await finish(idToken)
  } catch (cause) {
    error.value = readableError(cause)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await prepareGoogleSignIn()
  } catch (cause) {
    error.value = readableError(cause)
  } finally {
    loading.value = false
  }
})

function readableError(cause: unknown): string {
  const backendMessage = (cause as { response?: { data?: { message?: string } } })
    .response?.data?.message
  return backendMessage || t('auth.googleSignInFailed')
}
</script>

<style scoped>
.google-auth { display: grid; gap: var(--space-3); }
.google-auth__divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-muted, #616161);
  font-size: var(--font-size-xs, .75rem);
}
.google-auth__divider > :first-child,
.google-auth__divider > :last-child { height: 1px; background: #262626; }
.google-auth__button {
  min-height: 44px;
  width: 100%;
  border: 1px solid #2d2d2d;
  border-radius: var(--radius-md, 8px);
  background: #181818;
  color: var(--color-text-primary, #f3f5f7);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  font: inherit;
  font-weight: var(--font-weight-medium, 500);
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}
.google-auth__button:hover:not(:disabled) { border-color: #444; background: #1d1d1d; }
.google-auth__button:focus-visible { outline: 2px solid #f3f5f7; outline-offset: 2px; }
.google-auth__button:disabled { cursor: wait; opacity: .65; }
.google-auth__button svg { width: 18px; height: 18px; flex: 0 0 auto; }
.google-auth__error { margin: 0; color: #ed4956; font-size: var(--font-size-sm, .875rem); text-align: center; }
@media (max-width: 480px) { .google-auth__button { min-height: 48px; } }
</style>
