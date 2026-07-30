import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ApiDream } from '@/api/types'

export const usePostShareStore = defineStore('postShare', () => {
  const post = ref<ApiDream | null>(null)

  function open(dream: ApiDream): void {
    if (!dream.is_public || dream.privacy === 'private') return
    post.value = dream
  }

  function close(): void {
    post.value = null
  }

  return { post, open, close }
})
