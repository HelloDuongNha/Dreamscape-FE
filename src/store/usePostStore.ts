import { defineStore }   from 'pinia'
import { ref, computed }  from 'vue'
import apiClient          from '@/api/client'
import { useDreamStore }  from '@/store/useDreamStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import type { ApiComment, CommentListResponse, ApiDream } from '@/api/types'

export const usePostStore = defineStore('post', () => {

  // ── Focused post id ──────────────────────────────────────────────
  const focusedId       = ref<string | null>(null)
  const isLoadingComments = ref(false)
  const fetchedDream    = ref<ApiDream | null>(null)
  const editRequested   = ref(false)
  const focusedCommentId = ref<string | null>(null)

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
  async function openPost(
    id: string,
    options?: { edit?: boolean; commentId?: string },
  ): Promise<void> {
    focusedId.value       = id
    editRequested.value   = options?.edit === true
    focusedCommentId.value = options?.commentId || null
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
      mergeDreamSnapshot(dreamRes.data.data, existingDream)
    } catch (err) {
      console.error('Failed to open post:', err)
      useSettingsStore().showToastKey('home.postLoadError', undefined, 'error')
    } finally {
      isLoadingComments.value = false
    }
  }

  async function refreshFocusedDream(): Promise<void> {
    const id = focusedId.value
    if (!id) return
    const { data } = await apiClient.get<{ success: boolean; data: ApiDream }>(
      `/dreams/${id}`,
    )
    if (focusedId.value !== id) return
    const existingDream = useDreamStore().dreams.find(dream => dream._id === id)
    mergeDreamSnapshot(data.data, existingDream)
  }

  function mergeDreamSnapshot(snapshot: ApiDream, existingDream?: ApiDream): void {
    if (!existingDream) {
      fetchedDream.value = snapshot
      return
    }
    const populatedUser = existingDream.userId
    Object.assign(existingDream, snapshot, { userId: populatedUser })
    fetchedDream.value = existingDream
  }

  function closePost(): void {
    focusedId.value       = null
    focusedComments.value = []
    fetchedDream.value    = null
    editRequested.value   = false
    focusedCommentId.value = null
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
  async function addComment(
    content: string,
    replyToCommentId?: string,
  ): Promise<ApiComment | null> {
    if (!focusedId.value || !content.trim()) return null
    const { data } = await apiClient.post<{ success: boolean; data: ApiComment }>(
      `/dreams/${focusedId.value}/comments`,
      {
        content: content.trim(),
        ...(replyToCommentId ? { replyToCommentId } : {}),
      },
    )
    focusedComments.value.push(data.data)
    // Keep the feed card's comment count in sync
    useDreamStore().incrementCommentCount(focusedId.value)
    return data.data
  }

  async function editComment(commentId: string, content: string): Promise<void> {
    const normalized = content.trim()
    if (!normalized) return
    const { data } = await apiClient.patch<{ success: boolean; data: ApiComment }>(
      `/comments/${commentId}`,
      { content: normalized },
    )
    const index = focusedComments.value.findIndex(comment => comment._id === commentId)
    if (index !== -1) focusedComments.value[index] = data.data
  }

  async function deleteComment(commentId: string): Promise<void> {
    const focusedDreamId = focusedId.value
    const { data } = await apiClient.delete<{
      success: boolean
      data: { deletedCommentIds?: string[] }
    }>(`/comments/${commentId}`)
    const deletedIds = new Set(data.data.deletedCommentIds || [commentId])
    focusedComments.value = focusedComments.value.filter(
      comment => !deletedIds.has(comment._id),
    )
    if (focusedCommentId.value && deletedIds.has(focusedCommentId.value)) {
      focusedCommentId.value = null
    }
    if (focusedDreamId) {
      const dreamStore = useDreamStore()
      const storedDream = dreamStore.dreams.find(dream => dream._id === focusedDreamId)
      for (const _commentId of deletedIds) {
        dreamStore.decrementCommentCount(focusedDreamId)
      }
      if (
        fetchedDream.value
        && fetchedDream.value._id === focusedDreamId
        && fetchedDream.value !== storedDream
      ) {
        fetchedDream.value.comments_count = Math.max(
          0,
          fetchedDream.value.comments_count - deletedIds.size,
        )
      }
    }
  }

  async function setCommentsEnabled(enabled: boolean): Promise<void> {
    const dreamId = focusedId.value
    if (!dreamId) return
    const { data } = await apiClient.patch<{ success: boolean; data: ApiDream }>(
      `/dreams/${dreamId}/comments-policy`,
      { enabled },
    )
    const existingDream = useDreamStore().dreams.find(dream => dream._id === dreamId)
    mergeDreamSnapshot(data.data, existingDream)
  }

  return {
    focusedId,
    focusedDream,
    focusedUser,
    focusedComments,
    focusedCommentId,
    isLoadingComments,
    editRequested,
    openPost,
    refreshFocusedDream,
    closePost,
    consumeEditRequest,
    addComment,
    editComment,
    deleteComment,
    setCommentsEnabled,
  }
})
