<template>
  <div class="settings-section">
    <h2 class="settings-section__title">{{ t('settings.accountHeading') }}</h2>
    <p class="settings-section__desc">{{ t('settings.accountDesc') }}</p>

    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">{{ t('settings.avatarHeading') }}</h3>
        <p class="settings-block__hint">{{ t('settings.avatarHint') }}</p>
      </div>
      <AvatarEditor
        v-if="authStore.myUser"
        :avatar="authStore.myUser.avatar"
        :display-name="authStore.myUser.display_name"
        :user-id="authStore.myUser._id"
        variant="settings"
      />
    </div>

    <!-- Display Name -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">{{ t('settings.displayNameLabel') }}</h3>
        <p class="settings-block__hint">{{ t('settings.displayNameHint') }}</p>
      </div>
      <div class="settings-block__field settings-block__field--col">
        <AppInput
          id="account-display-name"
          v-model="displayName"
          :label="t('settings.displayNameLabel')"
          :placeholder="t('settings.displayNamePlaceholder')"
          :error="nameErrorDisplay"
          maxlength="50"
        />
        <div class="settings-block__actions">
          <AppButton
            id="save-display-name-btn"
            variant="smart"
            size="sm"
            :disabled="!!nameError || !displayName.trim() || displayName.trim() === originalName || isSavingName"
            @click="saveName"
          >
            {{ isSavingName ? t('settings.updatingBtn') : t('settings.saveBtn') }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Username -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">{{ t('settings.usernameLabel') }}</h3>
        <p class="settings-block__hint">{{ t('settings.usernameHint') }}</p>
      </div>
      <div class="settings-block__field settings-block__field--col">
        <AppInput
          id="account-username"
          v-model="username"
          :label="t('settings.usernameLabel')"
          prefix-icon="@"
          :placeholder="t('settings.usernamePlaceholder')"
          :error="usernameErrorDisplay"
          maxlength="30"
        />
        <div class="settings-block__actions">
          <AppButton
            id="save-username-btn"
            variant="smart"
            size="sm"
            :disabled="!!usernameError || !username.trim() || username.trim() === originalUsername || isSavingUsername"
            @click="saveUsername"
          >
            {{ isSavingUsername ? t('settings.updatingBtn') : t('settings.saveBtn') }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Birth Information -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">{{ t('settings.birthHeading') }}</h3>
        <p class="settings-block__hint">{{ t('settings.birthHint') }}</p>
      </div>
      
      <div class="settings-block__field settings-block__field--col">
        <div class="birth-form-grid">
          <div class="birth-input-group">
            <label for="birth-date-input" class="birth-input-label">{{ t('settings.birthDateLabel') }}</label>
            <div class="relative-container">
              <input
                id="birth-date-input"
                v-model="birthDate"
                type="date"
                class="settings-input custom-birth-input"
                required
              />
              <div class="input-actions-wrapper">
                <svg class="picker-icon custom-icon-white calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
            </div>
          </div>
          
          <div class="birth-input-group">
            <label for="birth-hour-input" class="birth-input-label">{{ t('settings.birthHourLabel') }}</label>
            <div class="relative-container">
              <input
                id="birth-hour-input"
                v-model="birthHour"
                type="time"
                class="settings-input custom-birth-input custom-birth-input--hour"
              />
              <div class="input-actions-wrapper">
                <button
                  v-if="birthHour"
                  type="button"
                  class="clear-trigger-btn"
                  @click="birthHour = ''"
                  :aria-label="t('settings.clearHourAria')"
                >
                  &times;
                </button>
                <svg class="picker-icon custom-icon-white clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-block__actions birth-form-actions">
          <AppButton
            id="save-birth-info-btn"
            variant="smart"
            size="sm"
            :disabled="!birthDate || (birthDate === originalBirthDate && birthHour === originalBirthHour) || isSavingBirth"
            @click="saveBirthInfo"
          >
            {{ isSavingBirth ? t('settings.updatingBtn') : t('settings.saveBtn') }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Bio -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">{{ t('settings.bioLabel') }}</h3>
        <p class="settings-block__hint">{{ t('settings.bioHint') }}</p>
      </div>
      <div class="settings-block__field settings-block__field--col">
        <AppInput
          id="account-bio"
          v-model="bio"
          type="textarea"
          :label="t('settings.bioLabel')"
          :placeholder="t('settings.bioPlaceholder')"
          :error="bioErrorDisplay"
          :rows="3"
          maxlength="160"
        />
        <div class="settings-block__actions settings-block__actions--between">
          <span class="settings-char-count">{{ bio.length }}/160</span>
          <AppButton
            id="save-bio-btn"
            variant="smart"
            size="sm"
            :disabled="!!bioError || bio.trim() === originalBio || isSavingBio"
            @click="saveBio"
          >
            {{ isSavingBio ? t('settings.savingBioBtn') : t('settings.saveBioBtn') }}
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n }              from 'vue-i18n'
import AppInput                  from '@/components/common/AppInput.vue'
import AppButton                 from '@/components/common/AppButton.vue'
import AvatarEditor              from '@/features/profile/AvatarEditor.vue'
import { useAuthStore }          from '@/store/useAuthStore'
import { useSettingsStore }      from '@/store/useSettingsStore'
import apiClient                 from '@/api/client'

const { t } = useI18n()
const authStore     = useAuthStore()
const settingsStore = useSettingsStore()

const displayName = ref(authStore.myUser?.display_name ?? '')
const username    = ref(authStore.myUser?.username.replace('@', '') ?? '')
const bio         = ref(authStore.myUser?.bio ?? '')

const birthDate = ref(authStore.myUser?.birth_date ?? '')
const birthHour = ref(authStore.myUser?.birth_hour ?? '')

// Original values — reactive to authStore updates
const originalName     = computed(() => authStore.myUser?.display_name ?? '')
const originalUsername = computed(() => authStore.myUser?.username.replace('@', '') ?? '')
const originalBio      = computed(() => authStore.myUser?.bio ?? '')

const originalBirthDate = computed(() => authStore.myUser?.birth_date ?? '')
const originalBirthHour = computed(() => authStore.myUser?.birth_hour ?? '')

interface ApiErrorStruct {
  key?: string
  raw?: string
}

// API errors state
const apiNameError = ref<ApiErrorStruct | null>(null)
const apiUsernameError = ref<ApiErrorStruct | null>(null)
const apiBioError = ref<ApiErrorStruct | null>(null)

// Clear API errors on user input change
watch(displayName, () => { apiNameError.value = null })

watch(username, (newVal) => {
  apiUsernameError.value = null
  const sanitized = newVal.replace(/[^a-zA-Z0-9_]/g, '')
  if (sanitized !== newVal) {
    username.value = sanitized
  }
})

watch(bio, () => { apiBioError.value = null })

// ── Validation helpers ─────────────────────────────────────────────
const INJECTION_RE = /[<>"'`;&|{}()\\]/   // block HTML/script injection
const USERNAME_RE  = /^[a-zA-Z0-9_]+$/    // only letters, numbers, and underscores (no dots)

const nameError = computed<{ key: string } | null>(() => {
  if (apiNameError.value) return null
  const v = displayName.value.trim()
  if (!v)                  return { key: 'errors.displayNameEmpty' }
  if (v.length < 2)        return { key: 'errors.displayNameTooShort' }
  if (INJECTION_RE.test(v)) return { key: 'errors.injectionBlocked' }
  return null
})
const nameErrorDisplay = computed(() => {
  if (nameError.value) return t(nameError.value.key)
  if (apiNameError.value) {
    return apiNameError.value.key ? t(apiNameError.value.key) : (apiNameError.value.raw || '')
  }
  return ''
})

const usernameError = computed<{ key: string } | null>(() => {
  if (apiUsernameError.value) return null
  const v = username.value.trim()
  if (!v)                    return { key: 'errors.usernameEmpty' }
  if (v.length < 2 || v.length > 29) return { key: 'errors.usernameLength' }
  if (!USERNAME_RE.test(v))  return { key: 'errors.usernameInvalid' }
  return null
})
const usernameErrorDisplay = computed(() => {
  if (usernameError.value) return t(usernameError.value.key)
  if (apiUsernameError.value) {
    return apiUsernameError.value.key ? t(apiUsernameError.value.key) : (apiUsernameError.value.raw || '')
  }
  return ''
})

const bioError = computed<{ key: string } | null>(() => {
  if (apiBioError.value) return null
  const v = bio.value
  if (INJECTION_RE.test(v))  return { key: 'errors.injectionBlocked' }
  return null
})
const bioErrorDisplay = computed(() => {
  if (bioError.value) return t(bioError.value.key)
  if (apiBioError.value) {
    return apiBioError.value.key ? t(apiBioError.value.key) : (apiBioError.value.raw || '')
  }
  return ''
})

const isSavingName = ref(false)
async function saveName() {
  if (nameError.value) return
  if (displayName.value.trim() === originalName.value) {
    settingsStore.showToastKey('settings.noChangesToast', undefined, 'error')
    return
  }
  isSavingName.value = true
  try {
    const { data } = await apiClient.put('/auth/profile', {
      display_name: displayName.value.trim()
    })
    if (data.success) {
      authStore.updateCurrentUser(data.user)
      settingsStore.showToastKey('toasts.displayNameUpdatedSuccess', undefined, 'success')
    }
  } catch (err: any) {
    const response = err.response
    if (response) {
      const msg = response.data?.message
      apiNameError.value = msg ? { raw: msg } : { key: 'errors.saveNameFailed' }
    } else {
      apiNameError.value = { key: 'errors.networkError' }
    }
    settingsStore.showToastKey('errors.saveNameFailed', undefined, 'error')
  } finally {
    isSavingName.value = false
  }
}

const isSavingUsername = ref(false)
async function saveUsername() {
  if (usernameError.value) return
  if (username.value.trim() === originalUsername.value) {
    settingsStore.showToastKey('settings.noChangesToast', undefined, 'error')
    return
  }
  isSavingUsername.value = true
  try {
    const { data } = await apiClient.put('/auth/profile', {
      username: '@' + username.value.trim()
    })
    if (data.success) {
      authStore.updateCurrentUser(data.user)
      settingsStore.showToastKey('toasts.usernameUpdatedSuccess', undefined, 'success')
    }
  } catch (err: any) {
    const response = err.response
    if (response) {
      const msg = response.data?.message
      apiUsernameError.value = msg ? { raw: msg } : { key: 'errors.saveUsernameFailed' }
    } else {
      apiUsernameError.value = { key: 'errors.networkError' }
    }
    settingsStore.showToastKey('errors.saveUsernameFailed', undefined, 'error')
  } finally {
    isSavingUsername.value = false
  }
}

const isSavingBio = ref(false)
async function saveBio() {
  if (bioError.value) return
  if (bio.value.trim() === originalBio.value) {
    settingsStore.showToastKey('settings.noChangesToast', undefined, 'error')
    return
  }
  isSavingBio.value = true
  try {
    const { data } = await apiClient.put('/auth/profile', {
      bio: bio.value.trim()
    })
    if (data.success) {
      authStore.updateCurrentUser(data.user)
      settingsStore.showToastKey('toasts.bioUpdatedSuccess', undefined, 'success')
    }
  } catch (err: any) {
    const response = err.response
    if (response) {
      const msg = response.data?.message
      apiBioError.value = msg ? { raw: msg } : { key: 'errors.saveBioFailed' }
    } else {
      apiBioError.value = { key: 'errors.networkError' }
    }
    settingsStore.showToastKey('errors.saveBioFailed', undefined, 'error')
  } finally {
    isSavingBio.value = false
  }
}

watch(() => authStore.myUser?.birth_date, (newVal) => {
  birthDate.value = newVal ?? ''
})
watch(() => authStore.myUser?.birth_hour, (newVal) => {
  birthHour.value = newVal ?? ''
})

const isSavingBirth = ref(false)
async function saveBirthInfo() {
  if (!birthDate.value) {
    settingsStore.showToastKey('errors.birthDateRequired', undefined, 'error')
    return
  }
  isSavingBirth.value = true
  try {
    const { data } = await apiClient.put('/auth/profile', {
      birth_date: birthDate.value,
      birth_hour: birthHour.value || ''
    })
    if (data.success) {
      authStore.updateCurrentUser(data.user)
      settingsStore.showToastKey('toasts.birthUpdatedSuccess', undefined, 'success')
    }
  } catch (err: any) {
    const response = err.response
    const msg = response?.data?.message
    if (msg) {
      settingsStore.showToast(msg, 'error')
    } else {
      settingsStore.showToastKey('errors.saveBirthFailed', undefined, 'error')
    }
  } finally {
    isSavingBirth.value = false
  }
}
</script>

<style>
.settings-section { display: flex; flex-direction: column; gap: 0; padding: var(--space-6); }
.settings-section__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-text-primary); letter-spacing: var(--letter-spacing-tight); margin-bottom: var(--space-1); }
.settings-section__desc  { font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-6); line-height: var(--line-height-relaxed); }
.settings-block { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5) 0; border-bottom: 1px solid var(--color-border); }
.settings-block:last-child { border-bottom: none; }
.settings-block__header { display: flex; flex-direction: column; gap: var(--space-1); }
.settings-block__label  { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.settings-block__hint   { font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: var(--line-height-relaxed); }
.settings-block__field  { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.settings-block__field--col { flex-direction: column; align-items: stretch; }
.settings-block__actions { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-2); }
.settings-block__actions--between { justify-content: space-between; }
.settings-char-count { font-size: var(--font-size-xs); color: var(--color-text-muted); }

/* Custom HTML5 Date/Time picker styles with white indicators on Safari/Chrome */
.relative-container {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
}

input[type="date"], input[type="time"] {
  appearance: none;
  -webkit-appearance: none;
  background: #1a1a1a;
  color: #ffffff;
  border: 1px solid #333333;
  padding: 10px 45px 10px 12px;
  border-radius: 6px;
  line-height: 1.5;
  display: flex;
  align-items: center;
  width: 100%;
}

.custom-birth-input:focus {
  border-color: #4a4a4a !important;
  outline: none;
}

input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator {
  position: absolute;
  right: 12px;
  opacity: 0;
  width: 24px;
  height: 24px;
  cursor: pointer;
  z-index: 5;
}

.custom-birth-input--hour {
  padding-right: 65px !important;
}

.input-actions-wrapper {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.clear-trigger-btn {
  pointer-events: auto;
  z-index: 10;
  cursor: pointer;
  color: #ffffff;
  background: transparent;
  border: none;
  font-size: 18px;
  line-height: 1;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-icon-white {
  color: #ffffff;
  width: 20px;
  height: 20px;
}

.picker-icon {
  pointer-events: none;
  z-index: 2;
}

.birth-form-grid {
  display: flex;
  gap: 16px;
  width: 100%;
}

.birth-input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.birth-input-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.birth-form-actions {
  margin-top: var(--space-4);
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 480px) {
  .birth-form-grid {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
