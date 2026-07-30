<template>
  <button
    type="button"
    class="shared-post-card"
    :disabled="loading || !dream"
    @click="openPost"
  >
    <span v-if="loading" class="shared-post-card__loading">
      {{ t('messages.sharedPostLoading') }}
    </span>
    <template v-else-if="dream && author">
      <span class="shared-post-card__author">
        <UserAvatar :user="author" size="sm" />
        <span>
          <strong translate="no">{{ author.display_name }}</strong>
          <small>{{ t('messages.sharedPostLabel') }}</small>
        </span>
      </span>
      <strong class="shared-post-card__title">{{ title }}</strong>
      <span class="shared-post-card__excerpt">{{ excerpt }}</span>
      <span class="shared-post-card__open">
        {{ t('messages.openSharedPost') }}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </span>
    </template>
    <span v-else class="shared-post-card__unavailable">
      {{ t('messages.sharedPostUnavailable') }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import apiClient from '@/api/client'
import type { ApiDream, ApiUser } from '@/api/types'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { usePostStore } from '@/store/usePostStore'

const props = defineProps<{ postId: string }>()
const { t } = useI18n()
const postStore = usePostStore()
const dream = ref<ApiDream | null>(null)
const loading = ref(false)

const previewCache = new Map<string, ApiDream | null>()

const author = computed((): ApiUser | null => (
  dream.value && typeof dream.value.userId === 'object'
    ? dream.value.userId
    : null
))
const title = computed(() => (
  dream.value?.ai_result?.title
  || dream.value?.aiAnalysis?.title
  || t('messages.sharedPostFallbackTitle')
))
const excerpt = computed(() => {
  const content = String(dream.value?.content || '').replace(/\s+/g, ' ').trim()
  return content.length > 180 ? `${content.slice(0, 177).trimEnd()}…` : content
})

async function loadPreview(): Promise<void> {
  const postId = props.postId
  if (!postId) return
  if (previewCache.has(postId)) {
    dream.value = previewCache.get(postId) || null
    return
  }
  loading.value = true
  try {
    const response = await apiClient.get<{ success: boolean; data: ApiDream }>(
      `/dreams/${postId}`,
    )
    dream.value = response.data.data
    previewCache.set(postId, dream.value)
  } catch {
    dream.value = null
    previewCache.set(postId, null)
  } finally {
    loading.value = false
  }
}

function openPost(): void {
  if (!dream.value) return
  void postStore.openPost(dream.value._id)
}

onMounted(loadPreview)
watch(() => props.postId, loadPreview)
</script>

<style scoped>
.shared-post-card {
  width: min(340px, calc(100vw - 116px));
  display: grid;
  gap: 10px;
  padding: 13px;
  border: 1px solid color-mix(in srgb, var(--color-border) 88%, white 12%);
  border-radius: 15px;
  background: color-mix(in srgb, var(--color-bg-surface) 94%, white 6%);
  color: var(--color-text-primary);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease, transform 150ms ease;
}
.shared-post-card:hover:not(:disabled),
.shared-post-card:focus-visible {
  border-color: color-mix(in srgb, var(--color-text-muted) 60%, var(--color-border));
  background: color-mix(in srgb, var(--color-bg-surface) 88%, white 12%);
}
.shared-post-card:active:not(:disabled) { transform: scale(.992); }
.shared-post-card:focus-visible { outline: 2px solid var(--color-text-primary); outline-offset: 2px; }
.shared-post-card:disabled { cursor: default; }
.shared-post-card__author {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.shared-post-card__author > span:last-child { min-width: 0; display: grid; }
.shared-post-card__author strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.shared-post-card__author small,
.shared-post-card__loading,
.shared-post-card__unavailable {
  color: var(--color-text-muted);
  font-size: 11px;
}
.shared-post-card__title {
  font-size: 14px;
  line-height: 1.35;
}
.shared-post-card__excerpt {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text-secondary, var(--color-text-muted));
  font-size: 13px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.shared-post-card__open {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 650;
}
.shared-post-card__open svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
@media (max-width: 640px) {
  .shared-post-card { width: min(310px, calc(100vw - 82px)); }
}
</style>
