<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ApiUser } from '@/api/types'
import { getAvatarBg, getInitials } from '@/utils/avatar'
import { getStreakColor } from '@/utils/streak'

const props = withDefaults(defineProps<{
  user: Pick<ApiUser, '_id' | 'display_name' | 'avatar' | 'streakCount'>
  size?: 'sm' | 'md' | 'lg'
  showStreak?: boolean
}>(), {
  size: 'md',
  showStreak: false,
})

const { t } = useI18n()
const initials = computed(() => getInitials(props.user.display_name || '?'))
const background = computed(() => getAvatarBg(props.user._id))
const streak = computed(() => props.user.streakCount ?? 0)
const streakColor = computed(() => getStreakColor(streak.value))
</script>

<template>
  <span
    class="user-avatar"
    :class="`user-avatar--${size}`"
    :style="{ background }"
    :aria-label="user.display_name"
    translate="no"
  >
    <img
      v-if="user.avatar"
      :src="user.avatar"
      :alt="user.display_name"
      class="user-avatar__image"
    >
    <span v-else>{{ initials }}</span>
    <span
      v-if="showStreak && streak > 0"
      class="user-avatar__streak"
      :style="{ backgroundColor: streakColor }"
      :title="t('profile.streakTitle', { count: streak })"
      aria-label="streak"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.7 15.46 9.12 14.86 8.38C13.62 6.85 13.15 4.87 13.68 3C12.09 3.44 10.74 4.5 9.87 5.86C8.83 7.5 8.7 9.54 9.54 11.33C9.6 11.45 9.6 11.58 9.5 11.68C9.38 11.78 9.24 11.77 9.13 11.71C8.24 11.22 7.5 10.47 7.07 9.53C5.79 9.89 5.37 11.54 5.75 13.13C6.12 14.67 7.15 16.03 8.5 16.73C9.43 17.2 10.49 17.44 11.54 17.4C13.43 17.28 15.07 16.34 16.04 14.82C17.06 13.23 17.07 11.31 16.04 9.73Z" />
      </svg>
      <span>{{ streak }}</span>
    </span>
  </span>
</template>

<style scoped>
.user-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  font-weight: var(--font-weight-bold);
  flex: 0 0 auto;
}
.user-avatar--sm { width: 30px; height: 30px; font-size: var(--font-size-xs); }
.user-avatar--md { width: 38px; height: 38px; font-size: var(--font-size-sm); }
.user-avatar--lg { width: 44px; height: 44px; font-size: var(--font-size-base); }
.user-avatar__image { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.user-avatar__streak {
  position: absolute;
  top: -6px;
  right: -7px;
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 2px 4px;
  border: 1px solid #181818;
  border-radius: 10px;
  background: #F97316;
  color: #fff;
  font: 700 9px/1 var(--font-family-mono, monospace);
  z-index: 1;
  white-space: nowrap;
}
.user-avatar__streak svg { width: 10px; height: 10px; fill: currentColor; }
</style>
