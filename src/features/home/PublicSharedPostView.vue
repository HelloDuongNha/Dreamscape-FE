<template>
  <main class="public-post">
    <header class="public-post__header">
      <RouterLink to="/" class="public-post__brand">DreamScape</RouterLink>
      <RouterLink
        v-if="!authStore.isLoggedIn"
        :to="{ name: 'login', query: { redirect: route.fullPath } }"
        class="public-post__login"
      >
        {{ t('home.publicPost.login') }}
      </RouterLink>
      <RouterLink v-else to="/" class="public-post__login">
        {{ t('home.publicPost.home') }}
      </RouterLink>
    </header>

    <section class="public-post__backdrop" aria-hidden="true">
      <span>◈</span>
      <h1>{{ t('home.publicPost.sharedDream') }}</h1>
      <p>{{ t('home.publicPost.sharedDreamHint') }}</p>
      <button
        v-if="postId && failed"
        type="button"
        :disabled="loading"
        @click="openRoutePost"
      >
        {{ loading ? t('home.publicPost.loading') : t('home.publicPost.reopen') }}
      </button>
    </section>

    <PostDetailModal />
    <SharePostModal />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PostDetailModal from './PostDetailModal.vue'
import SharePostModal from './SharePostModal.vue'
import { useAuthStore } from '@/store/useAuthStore'
import { usePostStore } from '@/store/usePostStore'

const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()
const postStore = usePostStore()
const postId = computed(() => String(route.params.id || ''))
const loading = ref(false)
const failed = ref(false)

async function openRoutePost(): Promise<void> {
  if (!postId.value || loading.value) return
  loading.value = true
  failed.value = !(await postStore.openPost(postId.value))
  loading.value = false
}

onMounted(openRoutePost)
watch(() => route.params.id, openRoutePost)
</script>

<style scoped>
.public-post {
  min-height: 100dvh;
  background: var(--color-bg, #101010);
  color: var(--color-text-primary, #f5f5f5);
}
.public-post__header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 420;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left));
  border-bottom: 1px solid rgba(255,255,255,.09);
  background: rgba(16,16,16,.96);
}
.public-post__brand {
  color: inherit;
  text-decoration: none;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: .03em;
}
.public-post__login {
  padding: 8px 14px;
  border-radius: 999px;
  background: #f4f4f4;
  color: #111;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
}
.public-post__backdrop {
  min-height: 100dvh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  padding: 80px 20px 30px;
  color: var(--color-text-muted, #8d8d8d);
  text-align: center;
}
.public-post__backdrop > span { font-size: 30px; }
.public-post__backdrop h1 { margin: 0; color: var(--color-text-primary); }
.public-post__backdrop p { max-width: 460px; margin: 0; }
.public-post__backdrop button {
  margin-top: 12px;
  padding: 9px 16px;
  border: 1px solid var(--color-border-input);
  border-radius: 999px;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  cursor: pointer;
}
</style>
