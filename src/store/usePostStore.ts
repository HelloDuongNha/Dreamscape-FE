import { defineStore }   from 'pinia'
import { ref, computed }  from 'vue'
import apiClient          from '@/api/client'
import { useDreamStore }  from '@/store/useDreamStore'
import type { ApiComment, CommentListResponse, ApiDream } from '@/api/types'

export const usePostStore = defineStore('post', () => {

  // ── Focused post id ──────────────────────────────────────────────
  const focusedId       = ref<string | null>(null)
  const isLoadingComments = ref(false)
  const fetchedDream    = ref<ApiDream | null>(null)
  const editRequested   = ref(false)

  // ── Live comments for the focused post ──────────────────────────
  // Populated from GET /api/dreams/:id/comments when a post is opened.
  // Appended to optimistically when the user submits a new comment.
  const focusedComments = ref<ApiComment[]>([])

  // ── Derived ──────────────────────────────────────────────────────
  const focusedDream = computed(() => {
    const dreamStore = useDreamStore()
    if (!focusedId.value) return null
    return dreamStore.dreams.find(d => d._id === focusedId.value) ?? fetchedDream.value
  })

  /**
   * The author of the focused dream.
   * dream.userId is populated by the backend — it is an ApiUser object.
   */
  const focusedUser = computed(() => {
    const d = focusedDream.value
    if (!d) return null
    if (typeof d.userId === 'object' && d.userId !== null) return d.userId
    return null
  })

  // ── Actions ──────────────────────────────────────────────────────

  /**
   * Open a post detail modal.
   * Immediately sets the focused ID and fetches comments and dream details.
   */
  async function openPost(id: string, options?: { edit?: boolean }): Promise<void> {
    focusedId.value       = id
    editRequested.value   = options?.edit === true
    focusedComments.value = []
    fetchedDream.value    = null
    isLoadingComments.value = true
    try {
      const dreamStore = useDreamStore()
      const existingDream = dreamStore.dreams.find(d => d._id === id)
      const [commentsRes, dreamRes] = await Promise.all([
        apiClient.get<CommentListResponse>(`/dreams/${id}/comments`),
        apiClient.get<{ success: boolean; data: ApiDream }>(`/dreams/${id}`),
      ])
      focusedComments.value = commentsRes.data.data
      if (existingDream) {
        const populatedUser = existingDream.userId
        Object.assign(existingDream, dreamRes.data.data, { userId: populatedUser })
        fetchedDream.value = existingDream
      } else {
        fetchedDream.value = dreamRes.data.data
      }
    } catch (err) {
      console.error('Failed to open post:', err)
    } finally {
      isLoadingComments.value = false
    }
  }

  function closePost(): void {
    focusedId.value       = null
    focusedComments.value = []
    fetchedDream.value    = null
    editRequested.value   = false
  }

  function consumeEditRequest(): boolean {
    const requested = editRequested.value
    editRequested.value = false
    return requested
  }

  /**
   * Post a comment via the real API.
   * Appends the server-returned comment object to the local list immediately
   * and increments comments_count on the dream in useDreamStore.
   */
  async function addComment(content: string): Promise<void> {
    if (!focusedId.value || !content.trim()) return
    const { data } = await apiClient.post<{ success: boolean; data: ApiComment }>(
      `/dreams/${focusedId.value}/comments`,
      { content: content.trim() }
    )
    focusedComments.value.push(data.data)
    // Keep the feed card's comment count in sync
    useDreamStore().incrementCommentCount(focusedId.value)
  }

  return {
    focusedId,
    focusedDream,
    focusedUser,
    focusedComments,
    isLoadingComments,
    editRequested,
    openPost,
    closePost,
    consumeEditRequest,
    addComment,
  }
})
