<template>
  <MobileBottomNav
    :items="navigation.mobilePrimary"
    :route-path="route.path"
    :more-open="moreOpen"
    :more-active="moreActive"
    @toggle-more="moreOpen = !moreOpen"
  />
  <MobileMoreSheet
    v-model="moreOpen"
    :route-path="route.path"
    :general-items="navigation.mobileMoreGeneral"
    :admin-items="navigation.mobileMoreAdmin"
    :display-name="displayName"
    :username="username"
    :avatar-url="authStore.user?.avatar"
    :avatar-bg="avatarBg"
    :initials="initials"
    @logout="handleLogout"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MobileBottomNav from './MobileBottomNav.vue'
import MobileMoreSheet from './MobileMoreSheet.vue'
import {
  buildNavigationModel,
  isNavigationItemActive,
} from './navigation/navigation.config'
import { useAuthStore } from '@/store/useAuthStore'
import { useChatStore } from '@/store/useChatStore'
import { getAvatarBg, getInitials } from '@/utils/avatar'
import { isAdminUser } from '@/utils/adminAccess'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()
const moreOpen = ref(false)

const navigation = computed(() => buildNavigationModel({
  isAdmin: isAdminUser(authStore.user),
  unreadMessages: chatStore.totalUnread,
}))

const displayName = computed(() =>
  authStore.user?.display_name || authStore.user?.username || 'DreamScape'
)
const username = computed(() => authStore.user?.username?.replace(/^@/, ''))
const initials = computed(() => getInitials(displayName.value))
const avatarBg = computed(() =>
  authStore.user?._id ? getAvatarBg(authStore.user._id) : '#262626'
)
const moreActive = computed(() =>
  [...navigation.value.mobileMoreGeneral, ...navigation.value.mobileMoreAdmin]
    .some((item) => isNavigationItemActive(item, route.path))
)

watch(() => route.fullPath, () => {
  moreOpen.value = false
})

async function handleLogout() {
  moreOpen.value = false
  await authStore.logout()
  await router.push('/login')
}
</script>
