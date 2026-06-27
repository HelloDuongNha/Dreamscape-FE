<template>
  <div class="settings-section">
    <h2 class="settings-section__title">Privacy</h2>
    <p class="settings-section__desc">Control who can see your dreams and interact with your profile.</p>

    <!-- ── Default Dream Visibility ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">Default Dream Visibility</h3>
        <p class="settings-block__hint">New dreams will use this setting unless overridden in the composer. Changes are saved automatically.</p>
      </div>
      <div class="privacy-option-group">
        <label class="privacy-option" :class="{ 'privacy-option--active': visibility === 'public' }">
          <input v-model="visibility" type="radio" value="public" class="privacy-option__radio" />
          <span class="privacy-option__content">
            <span class="privacy-option__label">Public</span>
            <span class="privacy-option__desc">Visible to all DreamScape users.</span>
          </span>
        </label>
        <label class="privacy-option" :class="{ 'privacy-option--active': visibility === 'private' }">
          <input v-model="visibility" type="radio" value="private" class="privacy-option__radio" />
          <span class="privacy-option__content">
            <span class="privacy-option__label">Private</span>
            <span class="privacy-option__desc">Only visible to you.</span>
          </span>
        </label>
      </div>
    </div>

    <!-- ── Account Privacy ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">Account Privacy</h3>
        <p class="settings-block__hint">When your account is private, only people you approve can see your dreams and profile details.</p>
      </div>
      <div class="privacy-toggle-row">
        <label for="private-account-toggle" class="privacy-toggle-label">Protect your Account</label>
        <label class="flat-switch">
          <input
            id="private-account-toggle"
            v-model="isPrivateAccount"
            type="checkbox"
            class="flat-switch__input"
          />
          <span class="flat-switch__slider"></span>
        </label>
      </div>
    </div>

    <!-- ── Direct Message Rules ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">Direct Messages</h3>
        <p class="settings-block__hint">Control who can send you direct chat messages.</p>
      </div>
      <div class="privacy-select-row">
        <label for="dm-privacy-select" class="privacy-select-label">Who can send you direct messages</label>
        <div class="select-container">
          <AppSelect
            id="dm-privacy-select"
            v-model="dmPrivacy"
            :options="dmPrivacyOptions"
          />
        </div>
      </div>
    </div>

    <!-- ── Followers List Rules ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">Followers List</h3>
        <p class="settings-block__hint">Control who can view the list of accounts following you.</p>
      </div>
      <div class="privacy-select-row">
        <label for="followers-privacy-select" class="privacy-select-label">Who can view your Followers list</label>
        <div class="select-container">
          <AppSelect
            id="followers-privacy-select"
            v-model="followersPrivacy"
            :options="listPrivacyOptions"
          />
        </div>
      </div>
    </div>

    <!-- ── Following List Rules ── -->
    <div class="settings-block">
      <div class="settings-block__header">
        <h3 class="settings-block__label">Following List</h3>
        <p class="settings-block__hint">Control who can view the list of accounts you are following.</p>
      </div>
      <div class="privacy-select-row">
        <label for="following-privacy-select" class="privacy-select-label">Who can view your Following list</label>
        <div class="select-container">
          <AppSelect
            id="following-privacy-select"
            v-model="followingPrivacy"
            :options="listPrivacyOptions"
          />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSettingsStore }      from '@/store/useSettingsStore'
import { useAuthStore }          from '@/store/useAuthStore'
import apiClient                 from '@/api/client'
import AppSelect                 from '@/components/common/AppSelect.vue'

const settingsStore    = useSettingsStore()
const authStore        = useAuthStore()

const visibility       = ref<'public' | 'private'>(authStore.myUser?.defaultPrivacy || 'public')
const isPrivateAccount = ref<boolean>(authStore.myUser?.isPrivateAccount || false)
const dmPrivacy        = ref<'everyone' | 'following' | 'friends'>(authStore.myUser?.dmPrivacy || 'everyone')
const followersPrivacy = ref<'everyone' | 'following' | 'only_me'>(authStore.myUser?.followersPrivacy || 'everyone')
const followingPrivacy = ref<'everyone' | 'following' | 'only_me'>(authStore.myUser?.followingPrivacy || 'everyone')

const dmPrivacyOptions = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'following', label: 'People you follow' },
  { value: 'friends', label: 'Friends (Mutual followers)' }
]

const listPrivacyOptions = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'following', label: 'People you follow' },
  { value: 'only_me', label: 'Only Me' }
]

let initialSync = true

onMounted(() => {
  if (authStore.myUser?.defaultPrivacy) {
    visibility.value = authStore.myUser.defaultPrivacy
  }
  if (authStore.myUser?.isPrivateAccount !== undefined) {
    isPrivateAccount.value = authStore.myUser.isPrivateAccount
  }
  if (authStore.myUser?.dmPrivacy) {
    dmPrivacy.value = authStore.myUser.dmPrivacy
  }
  if (authStore.myUser?.followersPrivacy) {
    followersPrivacy.value = authStore.myUser.followersPrivacy
  }
  if (authStore.myUser?.followingPrivacy) {
    followingPrivacy.value = authStore.myUser.followingPrivacy
  }
  setTimeout(() => {
    initialSync = false
  }, 100)
})

// Auto-save on change
watch(visibility, async (newVal) => {
  if (initialSync) return
  try {
    const { data } = await apiClient.put('/auth/profile', {
      defaultPrivacy: newVal
    })
    if (data.success) {
      authStore.updateCurrentUser(data.user)
      settingsStore.showToast('Default privacy preference saved.', 'success')
    }
  } catch (err) {
    settingsStore.showToast('Failed to save privacy preference.', 'error')
  }
})

watch(isPrivateAccount, async (newVal) => {
  if (initialSync) return
  try {
    const { data } = await apiClient.put('/auth/profile', {
      isPrivateAccount: newVal
    })
    if (data.success) {
      authStore.updateCurrentUser(data.user)
      settingsStore.showToast(`Account privacy updated to ${newVal ? 'Private' : 'Public'}.`, 'success')
    }
  } catch (err) {
    settingsStore.showToast('Failed to save account privacy.', 'error')
  }
})

watch(dmPrivacy, async (newVal) => {
  if (initialSync) return
  try {
    const { data } = await apiClient.put('/auth/profile', {
      dmPrivacy: newVal
    })
    if (data.success) {
      authStore.updateCurrentUser(data.user)
      settingsStore.showToast('Direct message privacy updated.', 'success')
    }
  } catch (err) {
    settingsStore.showToast('Failed to save direct message settings.', 'error')
  }
})

watch(followersPrivacy, async (newVal) => {
  if (initialSync) return
  try {
    const { data } = await apiClient.put('/auth/profile', {
      followersPrivacy: newVal
    })
    if (data.success) {
      authStore.updateCurrentUser(data.user)
      settingsStore.showToast('Followers list privacy updated.', 'success')
    }
  } catch (err) {
    settingsStore.showToast('Failed to save followers list privacy.', 'error')
  }
})

watch(followingPrivacy, async (newVal) => {
  if (initialSync) return
  try {
    const { data } = await apiClient.put('/auth/profile', {
      followingPrivacy: newVal
    })
    if (data.success) {
      authStore.updateCurrentUser(data.user)
      settingsStore.showToast('Following list privacy updated.', 'success')
    }
  } catch (err) {
    settingsStore.showToast('Failed to save following list privacy.', 'error')
  }
})
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
</style>

<style scoped>
.privacy-option-group { display: flex; flex-direction: column; gap: var(--space-2); }
.privacy-option { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; background: var(--color-bg-surface); transition: border-color var(--transition-fast), background var(--transition-fast); }
.privacy-option:hover { background: var(--color-bg-hover); }
.privacy-option--active { border-color: #4a4a4a; background: var(--color-bg-elevated); }
.privacy-option__radio   { accent-color: #fff; flex-shrink: 0; }
.privacy-option__content { display: flex; flex-direction: column; gap: 1px; }
.privacy-option__label   { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); }
.privacy-option__desc    { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.privacy-placeholder { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); font-size: var(--font-size-sm); padding: var(--space-3) 0; }
.privacy-placeholder__icon { font-size: var(--font-size-lg); }

/* flat toggle switch */
.privacy-toggle-row,
.privacy-select-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) 0;
}

.privacy-toggle-label,
.privacy-select-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.flat-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
}

.flat-switch__input {
  opacity: 0;
  width: 0;
  height: 0;
}

.flat-switch__slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-elevated);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-full);
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.flat-switch__slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: var(--color-text-muted);
  border-radius: 50%;
  transition: transform var(--transition-fast), background-color var(--transition-fast);
}

.flat-switch__input:checked + .flat-switch__slider {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.flat-switch__input:checked + .flat-switch__slider:before {
  transform: translateX(20px);
  background-color: var(--color-bg-base);
}

.select-container {
  width: 220px;
  flex-shrink: 0;
}
</style>

