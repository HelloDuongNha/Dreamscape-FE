<template>
  <div class="profile-header">

    <!-- Cover / top accent (flat 1px border only, no image) -->
    <div class="profile-header__cover" aria-hidden="true" />

    <!-- Avatar row -->
    <div class="profile-header__avatar-row">
      <div class="profile-header__avatar-container">
        <AvatarEditor
          v-if="isMe"
          :avatar="currentAvatar"
          :display-name="user.display_name"
          :user-id="user._id"
        />
        <div
          v-else
          class="profile-header__avatar"
          :style="{ background: avatarBg }"
          :aria-label="user.display_name"
          translate="no"
        >
          <img
            v-if="currentAvatar"
            :src="currentAvatar"
            :alt="user.display_name"
            class="profile-header__avatar-image"
          />
          <span v-else>{{ initials }}</span>
        </div>

        <!-- Streak Flame Icon -->
        <div
          v-if="streak > 0"
          class="profile-header__streak-flame"
          :style="{ backgroundColor: flameColor }"
          :title="t('profile.streakTitle', { count: streak })"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="currentColor"
            class="profile-header__flame-icon"
          >
            <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.7 15.46 9.12 14.86 8.38C13.62 6.85 13.15 4.87 13.68 3C12.09 3.44 10.74 4.5 9.87 5.86C8.83 7.5 8.7 9.54 9.54 11.33C9.6 11.45 9.61 11.58 9.5 11.68C9.38 11.78 9.24 11.77 9.13 11.71C8.24 11.22 7.5 10.47 7.07 9.53C5.79 9.89 5.37 11.54 5.75 13.13C6.12 14.67 7.15 16.03 8.5 16.73C9.43 17.2 10.49 17.44 11.54 17.4C13.43 17.28 15.07 16.34 16.04 14.82C17.06 13.23 17.07 11.31 16.04 9.73Z" />
          </svg>
          <span class="profile-header__streak-count">{{ streak }}</span>
        </div>
      </div>

      <!-- Action buttons (top-right) -->
      <div class="profile-header__actions">
        <!-- My profile -->
        <template v-if="isMe">
          <AppButton
            v-if="!editing"
            id="edit-profile-btn"
            variant="secondary"
            size="sm"
            @click="startEdit"
          >
            {{ t('profile.editProfileBtn') }}
          </AppButton>
          <template v-else>
            <AppButton id="save-profile-btn" variant="primary" size="sm" :disabled="isSaving" @click="saveEdit">{{ t('profile.saveBtn') }}</AppButton>
            <AppButton id="cancel-edit-btn" variant="ghost" size="sm" :disabled="isSaving" @click="cancelEdit">{{ t('profile.cancelBtn') }}</AppButton>
          </template>
        </template>

        <!-- Other's profile -->
        <template v-else>
          <AppButton
            id="follow-btn"
            :variant="isFollowing ? 'secondary' : 'primary'"
            size="sm"
            :disabled="isTogglingFollow"
            @click="toggleFollow"
          >
            {{ isFollowing ? t('profile.followingLabel') : t('profile.followBtn') }}
          </AppButton>
          <AppButton
            id="message-btn"
            variant="secondary"
            size="sm"
            @click="openMessage"
          >
            {{ t('profile.messageBtn') }}
          </AppButton>
        </template>
      </div>
    </div>

    <!-- Display name + username -->
    <div class="profile-header__info">
      <!-- Editable (my profile in edit mode) -->
      <template v-if="isMe && editing">
        <div class="profile-header__edit-field">
          <input
            id="edit-display-name"
            v-model="editName"
            class="profile-header__edit-input profile-header__edit-input--name"
            :placeholder="t('profile.displayNamePlaceholder')"
            maxlength="50"
          />
          <span v-if="nameError" class="profile-header__error">{{ t(nameError.key) }}</span>
          <span v-else-if="backendNameError" class="profile-header__error">{{ backendNameError }}</span>
        </div>
        <div class="profile-header__edit-field">
          <div class="profile-header__username-wrapper">
            <span class="profile-header__username-prefix">@</span>
            <input
              id="edit-username"
              v-model="editUsernameWithoutAt"
              class="profile-header__edit-input profile-header__edit-input--handle"
              :placeholder="t('profile.usernamePlaceholder')"
              maxlength="29"
            />
          </div>
          <span v-if="usernameError" class="profile-header__error">{{ t(usernameError.key) }}</span>
          <span v-else-if="backendUsernameError" class="profile-header__error">{{ backendUsernameError }}</span>
        </div>
      </template>

      <!-- Read-only -->
      <template v-else>
        <h1 class="profile-header__name" translate="no">{{ user.display_name }}</h1>
        <span class="profile-header__handle" translate="no">{{ user.username }}</span>
      </template>
    </div>

    <!-- Bio -->
    <p v-if="user.bio && !editing" class="profile-header__bio" translate="no">{{ user.bio }}</p>

    <!-- Rank Badge -->
    <div v-if="!editing" class="profile-header__rank-badge-container">
      <div
        class="profile-header__rank-badge"
        :style="{ backgroundColor: rankColor }"
      >
        <span class="profile-header__rank-text">{{ rankTitleDisplay }}</span>
        <div class="profile-header__badge-shine" />
      </div>
    </div>

    <!-- Joined Date -->
    <div v-if="user.createdAt && !editing" class="profile-header__joined">
      <span>{{ t('profile.joinedText', { date: formattedJoinedDate }) }}</span>
    </div>

    <!-- Stats row -->
    <div class="profile-header__stats">
      <div class="profile-header__stat">
        <span class="profile-header__stat-value">{{ dreamCount }}</span>
        <span class="profile-header__stat-label">{{ t('profile.dreamsLabel') }}</span>
      </div>
      <div class="profile-header__stat-divider" aria-hidden="true" />
      <div
        class="profile-header__stat profile-header__stat--clickable"
        role="button"
        tabindex="0"
        @click="emit('open-followers', 'followers')"
        @keydown.enter="emit('open-followers', 'followers')"
      >
        <span class="profile-header__stat-value">{{ user.followers ? user.followers.length : (user.follower_count || 0) }}</span>
        <span class="profile-header__stat-label">{{ t('profile.followersLabel') }}</span>
      </div>
      <div class="profile-header__stat-divider" aria-hidden="true" />
      <div
        class="profile-header__stat profile-header__stat--clickable"
        role="button"
        tabindex="0"
        @click="emit('open-followers', 'following')"
        @keydown.enter="emit('open-followers', 'following')"
      >
        <span class="profile-header__stat-value">{{ user.following ? user.following.length : 0 }}</span>
        <span class="profile-header__stat-label">{{ t('profile.followingLabel') }}</span>
      </div>
      <div class="profile-header__stat-divider" aria-hidden="true" />
      <div class="profile-header__stat">
        <span class="profile-header__stat-value">{{ approvedSourceCount || 0 }}</span>
        <span class="profile-header__stat-label">{{ t('profile.contributionsLabel') }}</span>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter }     from 'vue-router'
import { useI18n }       from 'vue-i18n'
import AppButton         from '@/components/common/AppButton.vue'
import { getInitials, getAvatarBg } from '@/data/mockUsers'
import type { User }     from '@/data/mockUsers'
import { useAuthStore }  from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import AvatarEditor from './AvatarEditor.vue'
import { useLocaleStore }   from '@/store/useLocaleStore'
import apiClient from '@/api/client'

const props = defineProps<{
  user:       User
  isMe:       boolean
  dreamCount: number
  approvedSourceCount?: number
}>()

const emit = defineEmits<{
  (e: 'updated', patch: Partial<User>): void
  (e: 'open-followers', tab: 'followers' | 'following'): void
}>()

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const localeStore = useLocaleStore()

const formattedJoinedDate = computed(() => {
  if (!props.user.createdAt) return ''
  const date = new Date(props.user.createdAt)
  return new Intl.DateTimeFormat(localeStore.currentLocale, { month: 'long', year: 'numeric' }).format(date)
})

// ── Computed ──────────────────────────────────────────────────────
const initials  = computed(() => getInitials(props.user.display_name))
const avatarBg  = computed(() => getAvatarBg(props.user._id))
const currentAvatar = computed(() => (
  props.isMe ? (authStore.myUser?.avatar || props.user.avatar) : props.user.avatar
))

const streak = computed(() => {
  if (props.isMe) {
    return authStore.user?.streakCount ?? 0
  }
  return props.user.streakCount ?? 0
})

type RankCode =
  | 'new_dreamer'
  | 'beginning_dreamer'
  | 'interpretation_master'
  | 'dream_manipulator'
  | 'solitary_star_traveler'
  | 'reality_creator'

const rankMap: Record<string, RankCode> = {
  'Đấng Sáng Tạo Thực Tại': 'reality_creator',
  'Độc Hành Tinh Không': 'solitary_star_traveler',
  'Kẻ Thao Túng Giấc Mơ': 'dream_manipulator',
  'Bậc Thầy Giải Mã': 'interpretation_master',
  'Người Bắt Đầu Mơ': 'beginning_dreamer',
  'Nhà Mơ Mộng Mới': 'new_dreamer',
}

const rawRank = computed(() => {
  if (props.isMe) {
    return authStore.user?.currentRank || ''
  }
  return props.user.currentRank || ''
})

const isKnownRank = computed(() => {
  const r = rawRank.value
  return r ? Object.prototype.hasOwnProperty.call(rankMap, r) : false
})

const rankCode = computed<RankCode>(() => {
  const r = rawRank.value
  if (!r) return 'new_dreamer'
  return rankMap[r] ?? 'new_dreamer'
})

const rankTitleDisplay = computed(() => {
  const r = rawRank.value
  if (!r) return t('profile.ranks.new_dreamer')
  if (isKnownRank.value) {
    return t(`profile.ranks.${rankCode.value}`)
  }
  return r // display unknown backend rank value unchanged
})

const rankColor = computed(() => {
  const code = rankCode.value
  if (code === 'reality_creator') return '#EF4444'
  if (code === 'solitary_star_traveler') return '#A855F7'
  if (code === 'dream_manipulator') return '#06B6D4'
  if (code === 'interpretation_master') return '#F59E0B'
  if (code === 'beginning_dreamer') return '#94A3B8'
  return '#B45309' // new_dreamer
})

const flameColor = computed(() => {
  const s = streak.value
  if (s >= 15) return '#06B6D4' // Cyber Cyan/Blue
  if (s >= 8)  return '#A855F7' // Deep Purple
  if (s >= 4)  return '#EF4444' // Crimson Red
  if (s >= 1)  return '#F97316' // Matte Orange
  return ''
})

const isFollowing = computed(() => {
  const myId = authStore.myId
  const followersList = props.user.followers || []
  return followersList.includes(myId)
})

// ── Edit mode (my profile) ─────────────────────────────────────────
const editing = ref(false)
const editName = ref(props.user.display_name)
const editUsernameWithoutAt = ref('')
const nameError = ref<{ key: string } | null>(null)
const usernameError = ref<{ key: string } | null>(null)
const backendNameError = ref<string | null>(null)
const backendUsernameError = ref<string | null>(null)
const isSaving = ref(false)

watch(editUsernameWithoutAt, (newVal) => {
  usernameError.value = null
  backendUsernameError.value = null
  const sanitized = newVal.replace(/[^a-zA-Z0-9_]/g, '')
  if (sanitized !== newVal) {
    editUsernameWithoutAt.value = sanitized
  }
})

watch(editName, () => {
  nameError.value = null
  backendNameError.value = null
})

function startEdit() {
  editName.value = props.user.display_name
  editUsernameWithoutAt.value = props.user.username.startsWith('@')
    ? props.user.username.slice(1)
    : props.user.username
  nameError.value = null
  usernameError.value = null
  backendNameError.value = null
  backendUsernameError.value = null
  editing.value = true
}

async function saveEdit() {
  nameError.value = null
  usernameError.value = null
  backendNameError.value = null
  backendUsernameError.value = null

  const nameVal = editName.value.trim()
  const usernameVal = editUsernameWithoutAt.value.trim()

  let hasError = false

  if (!nameVal) {
    nameError.value = { key: 'errors.displayNameEmpty' }
    hasError = true
  }

  if (!usernameVal) {
    usernameError.value = { key: 'errors.usernameEmpty' }
    hasError = true
  } else {
    const handleRegex = /^[a-zA-Z0-9_]+$/
    if (!handleRegex.test(usernameVal)) {
      usernameError.value = { key: 'errors.usernameInvalid' }
      hasError = true
    } else if (usernameVal.length < 2 || usernameVal.length > 29) {
      usernameError.value = { key: 'errors.usernameLength' }
      hasError = true
    }
  }

  if (hasError) return

  isSaving.value = true
  try {
    const { data } = await apiClient.put('/auth/profile', {
      display_name: nameVal,
      username: '@' + usernameVal
    })

    if (data.success) {
      authStore.updateCurrentUser(data.user)
      emit('updated', data.user)
      editing.value = false
      settingsStore.showToastKey('toasts.profileSavedSuccess', undefined, 'success')
    }
  } catch (err: any) {
    const response = err.response
    if (response) {
      const status = response.status
      const msg = response.data?.message || 'Failed to update profile.'
      const field = response.data?.field

      if (status === 409 || status === 400) {
        if (field === 'username') {
          backendUsernameError.value = msg
        } else if (field === 'display_name') {
          backendNameError.value = msg
        } else {
          backendUsernameError.value = msg
        }
      } else {
        backendUsernameError.value = msg
      }
    } else {
      usernameError.value = { key: 'errors.networkError' }
    }
  } finally {
    isSaving.value = false
  }
}

function cancelEdit() {
  editing.value = false
}

// ── Follow (other profile) ─────────────────────────────────────────
const isTogglingFollow = ref(false)

async function toggleFollow() {
  if (isTogglingFollow.value) return
  isTogglingFollow.value = true
  try {
    const { data } = await apiClient.post(`/users/${props.user._id}/follow`)
    if (data.success) {
      emit('updated', data.user)
      settingsStore.showToastKey(
        data.following ? 'toasts.followSuccess' : 'toasts.unfollowSuccess',
        { name: props.user.display_name },
        'success'
      )
    }
  } catch (err) {
    settingsStore.showToastKey('errors.followStatusFailed', undefined, 'error')
  } finally {
    isTogglingFollow.value = false
  }
}

// ── Message button ─────────────────────────────────────────────────
function openMessage() {
  router.push({ path: '/messages', query: { userId: props.user._id } })
}
</script>

<style scoped>
.profile-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

/* Flat accent strip at top */
.profile-header__cover {
  height: 80px;
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  flex-shrink: 0;
}

/* Avatar + actions row */
.profile-header__avatar-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 var(--space-5);
  margin-top: calc(-1 * 36px); /* pull avatar up over cover */
}

.profile-header__avatar-container {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}

.profile-header__streak-flame {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: 12px;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  border: 1px solid #181818;
  z-index: 10;
  user-select: none;
}

.profile-header__flame-icon {
  flex-shrink: 0;
  color: #ffffff;
}

.profile-header__streak-count {
  font-size: 10px;
  font-family: var(--font-family-mono, monospace);
  color: #ffffff;
}

.profile-header__avatar {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: #fff;
  border: 3px solid var(--color-bg-base);
  flex-shrink: 0;
  overflow: hidden;
}

.profile-header__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-header__actions {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-8); /* below the avatar overlap */
  flex-wrap: wrap;
}

/* Name + handle */
.profile-header__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: 0 var(--space-5);
}

.profile-header__name {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: var(--letter-spacing-tight);
}

.profile-header__handle {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* Bio */
.profile-header__bio {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
  padding: 0 var(--space-5);
}

/* Editable inputs */
.profile-header__edit-input {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  transition: border-color var(--transition-fast);
  width: 100%;
  max-width: 300px;
}
.profile-header__edit-input:focus { border-color: #4a4a4a; outline: none; }
.profile-header__edit-input--name { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); }
.profile-header__edit-input--handle { font-size: var(--font-size-sm); color: var(--color-text-secondary); }

/* Stats */
.profile-header__stats {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-5);
}

.profile-header__stat {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}
.profile-header__stat-value {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}
.profile-header__stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.profile-header__stat-divider {
  width: 1px;
  height: 14px;
  background: var(--color-border);
}

/* Username field wrapper and error styles */
.profile-header__edit-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  max-width: 300px;
}

.profile-header__username-wrapper {
  display: flex;
  align-items: center;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-md);
  padding: 0 var(--space-3);
  transition: border-color var(--transition-fast);
}

.profile-header__username-wrapper:focus-within {
  border-color: #4a4a4a;
}

.profile-header__username-prefix {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  user-select: none;
  margin-right: 2px;
}

.profile-header__username-wrapper .profile-header__edit-input--handle {
  border: none;
  background: transparent;
  padding: var(--space-2) 0;
  max-width: none;
}

.profile-header__error {
  color: #EF4444;
  font-size: var(--font-size-xs);
  display: block;
}

.profile-header__joined {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  padding: 0 var(--space-5);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: calc(-1 * var(--space-2));
  margin-bottom: var(--space-2);
}

.profile-header__stat--clickable {
  cursor: pointer;
  outline: none;
}

.profile-header__stat--clickable:hover .profile-header__stat-label {
  color: var(--color-text-primary);
  text-decoration: underline;
}

/* Rank Badge Styles */
.profile-header__rank-badge-container {
  padding: 0 var(--space-5);
  margin-top: calc(-1 * var(--space-2));
  margin-bottom: var(--space-2);
}

.profile-header__rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.profile-header__rank-text {
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1;
}

/* Diagonal sharp light overlay */
.profile-header__badge-shine {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  background: rgba(255, 255, 255, 0.15);
  transform: skewX(-25deg) translateX(-50px);
  animation: shiny-sweep 3.5s infinite ease-in-out;
}

@keyframes shiny-sweep {
  0% {
    transform: skewX(-25deg) translateX(-50px);
  }
  30% {
    transform: skewX(-25deg) translateX(150px);
  }
  100% {
    transform: skewX(-25deg) translateX(150px);
  }
}
</style>
