<template>
  <div :class="['avatar-editor', `avatar-editor--${variant}`]">
    <div
      class="avatar-editor__preview"
      :style="{ background: avatarBg }"
      :aria-busy="isUploading"
    >
      <img
        v-if="imageSource"
        :src="imageSource"
        :alt="displayName"
        class="avatar-editor__image"
      />
      <span v-else class="avatar-editor__initials" aria-hidden="true">{{ initials }}</span>
      <span v-if="isUploading" class="avatar-editor__loading" aria-hidden="true" />
    </div>

    <button
      type="button"
      class="avatar-editor__trigger"
      :disabled="isUploading"
      :aria-label="t('settings.avatarChangeAria')"
      @click="openPicker"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M14.5 4 16 6h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2h5Z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
      <span v-if="variant === 'settings'">
        {{ isUploading ? t('settings.avatarUploading') : t('settings.avatarChange') }}
      </span>
    </button>

    <input
      ref="fileInput"
      class="avatar-editor__input"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      :disabled="isUploading"
      @change="selectAvatar"
    />

    <AvatarCropModal
      v-model="cropOpen"
      :source-url="cropSourceUrl"
      :loading="isUploading"
      @confirm="uploadCroppedAvatar"
      @cancel="discardCrop"
      @error="handleCropError"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import apiClient from '@/api/client'
import { getAvatarBg, getInitials } from '@/utils/avatar'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { getApiErrorDataCode } from '@/utils/apiError'
import AvatarCropModal from './AvatarCropModal.vue'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const props = withDefaults(defineProps<{
  avatar?: string
  displayName: string
  userId: string
  variant?: 'profile' | 'settings'
}>(), {
  avatar: '',
  variant: 'profile',
})

const { t } = useI18n()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')
const cropSourceUrl = ref('')
const cropOpen = ref(false)
const isUploading = ref(false)

const imageSource = computed(() => previewUrl.value || props.avatar)
const initials = computed(() => getInitials(props.displayName))
const avatarBg = computed(() => getAvatarBg(props.userId))

function openPicker(): void {
  if (!isUploading.value) fileInput.value?.click()
}

function selectAvatar(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || isUploading.value) return

  if (!ALLOWED_TYPES.has(file.type)) {
    settingsStore.showToastKey('settings.avatarTypeError', undefined, 'error')
    return
  }
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    settingsStore.showToastKey('settings.avatarSizeError', undefined, 'error')
    return
  }

  releaseCropSource()
  cropSourceUrl.value = URL.createObjectURL(file)
  cropOpen.value = true
}

async function uploadCroppedAvatar(file: File): Promise<void> {
  releasePreview()
  previewUrl.value = URL.createObjectURL(file)
  isUploading.value = true
  try {
    const body = new FormData()
    body.append('avatar', file)
    const { data } = await apiClient.put<{ success: boolean; avatar: string }>(
      '/auth/profile/avatar',
      body,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    )
    if (!data.success || !data.avatar) throw new Error('avatar_response_invalid')

    const currentUser = authStore.myUser
    if (currentUser) {
      authStore.updateCurrentUser({ ...currentUser, avatar: data.avatar })
    }
    releasePreview()
    cropOpen.value = false
    releaseCropSource()
    settingsStore.showToastKey('settings.avatarUpdated', undefined, 'success')
  } catch (error: unknown) {
    releasePreview()
    const code = getApiErrorDataCode(error)
    const key = code === 'avatar_size_invalid'
      ? 'settings.avatarSizeError'
      : code === 'avatar_type_invalid' || code === 'avatar_content_invalid'
        ? 'settings.avatarTypeError'
        : 'settings.avatarUploadError'
    settingsStore.showToastKey(key, undefined, 'error')
  } finally {
    isUploading.value = false
  }
}

function discardCrop(): void {
  cropOpen.value = false
  releaseCropSource()
}

function handleCropError(): void {
  discardCrop()
  settingsStore.showToastKey('settings.avatarTypeError', undefined, 'error')
}

function releasePreview(): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

function releaseCropSource(): void {
  if (cropSourceUrl.value) URL.revokeObjectURL(cropSourceUrl.value)
  cropSourceUrl.value = ''
}

onBeforeUnmount(() => {
  releasePreview()
  releaseCropSource()
})
</script>

<style scoped>
.avatar-editor {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.avatar-editor__preview {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-full);
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

.avatar-editor--profile .avatar-editor__preview {
  width: 72px;
  height: 72px;
  border: 3px solid var(--color-bg-base);
  font-size: var(--font-size-2xl);
}

.avatar-editor--settings {
  gap: var(--space-3);
}

.avatar-editor--settings .avatar-editor__preview {
  width: 64px;
  height: 64px;
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xl);
}

.avatar-editor__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-editor__trigger {
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  transition: border-color 150ms ease, background-color 150ms ease;
}

.avatar-editor--profile .avatar-editor__trigger {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 30px;
  height: 30px;
  padding: 6px;
  border-radius: var(--radius-full);
}

.avatar-editor--settings .avatar-editor__trigger {
  min-height: 40px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.avatar-editor__trigger:hover:not(:disabled),
.avatar-editor__trigger:focus-visible {
  border-color: var(--color-text-muted);
  background: var(--color-bg-hover);
}

.avatar-editor__trigger:focus-visible {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 2px;
}

.avatar-editor__trigger:disabled {
  cursor: wait;
  opacity: .7;
}

.avatar-editor__trigger svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}

.avatar-editor__loading {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 2px solid rgb(255 255 255 / 35%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: avatar-spin .7s linear infinite;
}

.avatar-editor__preview[aria-busy="true"] .avatar-editor__image,
.avatar-editor__preview[aria-busy="true"] .avatar-editor__initials {
  opacity: .45;
}

.avatar-editor__input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

@keyframes avatar-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .avatar-editor--settings {
    width: 100%;
  }

  .avatar-editor--settings .avatar-editor__trigger {
    flex: 1;
  }
}
</style>
