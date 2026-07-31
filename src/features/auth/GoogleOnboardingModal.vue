<template>
  <Teleport to="body">
    <div class="google-onboarding" role="presentation" @click.self="$emit('close')">
      <section
        class="google-onboarding__card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <button class="google-onboarding__close" type="button" :aria-label="t('common.close')" @click="$emit('close')">×</button>
        <img v-if="profile.avatar" class="google-onboarding__avatar" :src="profile.avatar" alt="" referrerpolicy="no-referrer" />
        <div v-else class="google-onboarding__avatar google-onboarding__avatar--fallback" aria-hidden="true">◈</div>
        <h2 :id="titleId">{{ t('auth.googleOnboardingTitle') }}</h2>
        <p class="google-onboarding__intro">{{ t('auth.googleOnboardingSub') }}</p>

        <form class="google-onboarding__form" @submit.prevent="submit">
          <AppInput v-model="displayName" :label="t('auth.displayNameLabel')" autocomplete="name" :disabled="loading" required />
          <AppInput
            :model-value="username"
            :label="t('auth.usernameLabel')"
            prefix-icon="@"
            autocomplete="username"
            :disabled="loading"
            required
            @update:model-value="setUsername"
          />
          <AppInput :model-value="profile.email" :label="t('auth.emailLabel')" type="email" readonly />
          <AppInput v-model="password" :label="t('auth.newPasswordLabel')" type="password" autocomplete="new-password" :hint="t('auth.passwordMinLength')" :disabled="loading" required />
          <AppInput v-model="confirmation" :label="t('auth.confirmPasswordLabel')" type="password" autocomplete="new-password" :disabled="loading" required />
          <AuthDataConsent
            id="google-onboarding-data-consent"
            v-model="dataConsent"
            :invalid="consentInvalid"
            :disabled="loading"
            @update:model-value="consentInvalid = false"
          />
          <p v-if="error" class="google-onboarding__error" role="alert">{{ error }}</p>
          <AppButton type="submit" variant="primary" size="lg" :disabled="loading || !canSubmit">
            {{ loading ? t('auth.completingGoogleAccount') : t('auth.completeGoogleAccount') }}
          </AppButton>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AuthDataConsent from './AuthDataConsent.vue'
import { useAuthStore, type GoogleOnboardingState } from '@/store/useAuthStore'

const props = defineProps<{ onboarding: GoogleOnboardingState }>()
const emit = defineEmits<{ close: []; completed: [] }>()
const { t } = useI18n()
const authStore = useAuthStore()
const profile = props.onboarding.profile
const titleId = `google-onboarding-${Math.random().toString(36).slice(2)}`
const displayName = ref(profile.display_name)
const username = ref(profile.username)
const password = ref('')
const confirmation = ref('')
const dataConsent = ref(false)
const consentInvalid = ref(false)
const loading = ref(false)
const error = ref('')
const canSubmit = computed(() => (
  displayName.value.trim().length > 0
  && username.value.replace(/^@+/u, '').trim().length >= 2
  && password.value.length >= 8
  && password.value === confirmation.value
  && dataConsent.value
))

// Keeps the visual @ prefix out of the canonical username stored by the API.
function setUsername(value: string): void {
  username.value = value.replace(/^@+/u, '')
}

async function submit() {
  error.value = ''
  if (!dataConsent.value) {
    consentInvalid.value = true
    return
  }
  if (!/[a-z]/u.test(password.value) || !/[A-Z]/u.test(password.value) || !/\d/u.test(password.value)) {
    error.value = t('errors.passwordComplexity')
    return
  }
  loading.value = true
  try {
    await authStore.completeGoogleOnboarding({
      onboardingToken: props.onboarding.onboardingToken,
      username: username.value.trim(),
      display_name: displayName.value.trim(),
      password: password.value,
      confirmPassword: confirmation.value,
    })
    emit('completed')
  } catch (cause) {
    error.value = (cause as { response?: { data?: { message?: string } } }).response?.data?.message
      || t('auth.googleSignInFailed')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.google-onboarding { position: fixed; inset: 0; z-index: 3000; display: grid; place-items: center; padding: 20px; background: rgb(0 0 0 / 72%); backdrop-filter: blur(7px); }
.google-onboarding__card { position: relative; width: min(100%, 430px); max-height: min(90dvh, 720px); overflow: auto; display: grid; gap: 14px; padding: 28px; border: 1px solid #303030; border-radius: 18px; background: #151515; box-shadow: 0 24px 80px rgb(0 0 0 / 45%); }
.google-onboarding__card h2 { margin: 0; text-align: center; font-size: 1.35rem; }
.google-onboarding__intro { margin: 0; color: var(--color-text-secondary); text-align: center; line-height: 1.5; }
.google-onboarding__close { position: absolute; top: 10px; right: 12px; border: 0; background: transparent; color: var(--color-text-secondary); font-size: 1.7rem; cursor: pointer; }
.google-onboarding__avatar { width: 72px; height: 72px; margin: 0 auto; border-radius: 50%; object-fit: cover; border: 2px solid #393939; }
.google-onboarding__avatar--fallback { display: grid; place-items: center; background: #222; font-size: 1.5rem; }
.google-onboarding__form { display: grid; gap: 14px; }
.google-onboarding__error { margin: 0; color: #ed4956; font-size: .875rem; }
@media (max-width: 520px) { .google-onboarding { align-items: end; padding: 0; } .google-onboarding__card { width: 100%; max-height: 94dvh; border-radius: 20px 20px 0 0; padding: 24px 18px calc(24px + env(safe-area-inset-bottom)); } }
</style>
