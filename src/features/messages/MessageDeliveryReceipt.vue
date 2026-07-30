<template>
  <span
    class="message-receipt"
    :class="`message-receipt--${status}`"
    role="img"
    :aria-label="statusLabel"
    :title="statusLabel"
  >
    <span v-if="status === 'seen'" class="message-receipt__avatar" :style="{ background }">
      <img
        v-if="partner?.avatar"
        :src="partner.avatar"
        :alt="partner.display_name"
      >
      <span v-else aria-hidden="true">{{ initials }}</span>
    </span>
    <svg v-else viewBox="0 0 18 12" aria-hidden="true">
      <path d="m1.5 6.4 2.6 2.7L9.2 3.8" />
      <path v-if="status === 'delivered'" d="m6.8 6.4 2.6 2.7 6-6.2" />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ApiUser } from '@/api/types'
import { getAvatarBg, getInitials } from '@/utils/avatar'

const props = defineProps<{
  status: 'sent' | 'delivered' | 'seen'
  partner: ApiUser | null
}>()

const { t } = useI18n()
const statusLabel = computed(() => t(`messages.${props.status}`))
const initials = computed(() => getInitials(props.partner?.display_name || '?'))
const background = computed(() => getAvatarBg(props.partner?._id || 'message-receipt'))
</script>

<style scoped>
.message-receipt {
  display: inline-grid;
  width: 18px;
  height: 14px;
  place-items: center;
  vertical-align: middle;
}

.message-receipt svg {
  width: 18px;
  height: 12px;
  overflow: visible;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.9;
}

.message-receipt--sent svg {
  width: 13px;
  color: #3b82f6;
  stroke: currentColor;
}

.message-receipt--delivered svg {
  color: #22c55e;
  stroke: currentColor;
}

.message-receipt__avatar {
  display: grid;
  width: 14px;
  height: 14px;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: #fff;
  font-size: 7px;
  font-weight: 700;
  line-height: 1;
}

.message-receipt__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
