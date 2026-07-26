import { defineStore } from 'pinia'
import { ref } from 'vue'
import apiClient         from '@/api/client'
import { useAuthStore }  from '@/store/useAuthStore'
import type {
  ApiDream,
  DreamFeedResponse,
  CreateDreamResponse,
  UpdateDreamResponse,
  LikeResponse,
} from '@/api/types'

export type { ApiDream }

export const useDreamStore = defineStore('dream', () => {

  // ── State ──────────────────────────────────────────────────────────────────
  const dreams        = ref<ApiDream[]>([])
  const nextCursor    = ref<string | null>(null)
  const isLoading     = ref(false)
  const isLoadingMore = ref(false)
  const hasMore       = ref(true)

  /**
   * Shared search query — written by the header search input in MainLayout,
   * read by HomeView to filter the displayed feed reactively.
   * Storing it in the store avoids prop-drilling across layout boundaries.
   */
  const searchQuery = ref('')

  // ── Internal Fetch ─────────────────────────────────────────────────────────
  async function _fetchPage(cursor: string | null): Promise<DreamFeedResponse> {
    const params: Record<string, string | number> = { limit: 10 }
    if (cursor) params.nextCursor = cursor
    const { data } = await apiClient.get<DreamFeedResponse>('/dreams', { params })
    return data
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Load the first page (replaces the existing feed) */
  async function loadFeed(): Promise<void> {
    if (isLoading.value) return
    isLoading.value = true
    try {
      const result     = await _fetchPage(null)
      dreams.value     = result.data
      nextCursor.value = result.nextCursor
      hasMore.value    = result.nextCursor !== null
    } finally {
      isLoading.value = false
    }
  }

  /** Load the next page and append (infinite scroll) */
  async function loadMore(): Promise<void> {
    if (isLoadingMore.value || !hasMore.value || !nextCursor.value) return
    isLoadingMore.value = true
    try {
      const result     = await _fetchPage(nextCursor.value)
      dreams.value.push(...result.data)
      nextCursor.value = result.nextCursor
      hasMore.value    = result.nextCursor !== null
    } finally {
      isLoadingMore.value = false
    }
  }

  /** Create a dream and prepend it to the feed */
  async function addDream(
    content: string,
    isPublic: boolean,
    moodTag = '',
    aiAnalysisEnabled = true,
  ): Promise<{ dream: ApiDream }> {
    const { data } = await apiClient.post<CreateDreamResponse>('/dreams', {
      content,
      is_public: isPublic,
      mood_tag:  moodTag,
      ai_analysis_enabled: aiAnalysisEnabled,
    })
    const authStore = useAuthStore()
    const populatedDream: ApiDream = {
      ...data.data,
      userId: authStore.myUser ? {
        _id:            authStore.myUser._id,
        username:       authStore.myUser.username,
        display_name:   authStore.myUser.display_name,
        avatar:         authStore.myUser.avatar ?? '',
        bio:            authStore.myUser.bio ?? '',
        follower_count: authStore.myUser.follower_count ?? 0,
      } : data.data.userId,
    }
    dreams.value.unshift(populatedDream)
    const { useSettingsStore } = await import('@/store/useSettingsStore')
    useSettingsStore().showToastKey('home.postedSuccess', undefined, 'success')
    
    // Kick off Oracle analysis tracking UI & polling
    if (populatedDream.ai_analysis_enabled && populatedDream.ai_status === 'pending') {
      const { useOracleStore } = await import('@/store/useOracleStore')
      useOracleStore().startTracking(populatedDream)
    }
    return { dream: populatedDream }
  }

  /**
   * Toggle like — calls POST /api/dreams/:id/like.
   * Applies the server response in-place so the heart and count update instantly.
   * Works on any dream in dreams[] (both feed and profile views share this store).
   */
  async function toggleLike(dreamId: string): Promise<void> {
    const { data } = await apiClient.post<LikeResponse>(`/dreams/${dreamId}/like`)
    const idx = dreams.value.findIndex(d => d._id === dreamId)
    if (idx !== -1) {
      dreams.value[idx].likes        = data.likes
      dreams.value[idx].likes_count  = data.likes_count
    }
  }

  /**
   * Edit a dream's content.
   * Sends PUT /api/dreams/:id with the new content.
   * On success, replaces the dream in-place so the UI updates immediately.
   */
  async function editDream(
    dreamId: string,
    content: string,
    additions?: Array<{ sequence?: number; content: string }>,
  ): Promise<ApiDream> {
    const { data } = await apiClient.put<UpdateDreamResponse>(
      `/dreams/${dreamId}`,
      { content, ...(additions ? { additions } : {}) },
    )
    return applyContextualDreamUpdate(dreamId, data.data)
  }

  async function applyContextualDreamUpdate(dreamId: string, response: ApiDream): Promise<ApiDream> {
    const idx = dreams.value.findIndex(d => d._id === dreamId)
    const updatedDream = idx === -1
      ? response
      : { ...response, userId: dreams.value[idx].userId }
    if (idx !== -1) dreams.value[idx] = updatedDream
    if (updatedDream.ai_analysis_enabled && updatedDream.ai_status === 'pending') {
      const { useOracleStore } = await import('@/store/useOracleStore')
      useOracleStore().startTracking(updatedDream)
    }
    return updatedDream
  }

  async function setAiAnalysis(
    dreamId: string,
    enabled: boolean,
    resultPolicy?: 'keep' | 'delete',
  ): Promise<ApiDream> {
    const { data } = await apiClient.patch<UpdateDreamResponse>(
      `/dreams/${dreamId}/ai-analysis`,
      { enabled, ...(resultPolicy ? { resultPolicy } : {}) },
    )
    const updatedDream = await applyContextualDreamUpdate(dreamId, data.data)
    return updatedDream
  }

  /**
   * Delete a dream.
   * Sends DELETE /api/dreams/:id, then removes the card from the local array.
   */
  async function removeDream(dreamId: string): Promise<void> {
    await apiClient.delete(`/dreams/${dreamId}`)
    dreams.value = dreams.value.filter(d => d._id !== dreamId)
    const { useSettingsStore } = await import('@/store/useSettingsStore')
    useSettingsStore().showToastKey('home.deletedSuccess', undefined, 'success')
  }

  /**
   * Change the privacy setting of a dream.
   * Sends PATCH /api/dreams/:id/privacy, then updates the local dream.
   */
  async function changePrivacy(dreamId: string, privacy: 'public' | 'private'): Promise<ApiDream> {
    const { data } = await apiClient.patch<UpdateDreamResponse>(
      `/dreams/${dreamId}/privacy`,
      { privacy }
    )
    const idx = dreams.value.findIndex(d => d._id === dreamId)
    const updatedDream = idx === -1
      ? data.data
      : { ...data.data, userId: dreams.value[idx].userId }
    if (idx !== -1) dreams.value[idx] = updatedDream
    const { useSettingsStore } = await import('@/store/useSettingsStore')
    useSettingsStore().showToastKey(
      privacy === 'public' ? 'home.madePublicSuccess' : 'home.madePrivateSuccess',
      undefined,
      'success',
    )
    return updatedDream
  }

  /**
   * Increment comments_count locally after a new comment is posted.
   * Called by usePostStore after a successful POST /api/dreams/:id/comments.
   */
  function incrementCommentCount(dreamId: string): void {
    const d = dreams.value.find(d => d._id === dreamId)
    if (d) d.comments_count += 1
  }

  /**
   * Getter: dreams liked by myUserId.
   * Used by the LIKES tab in ProfileView.
   * myUserId is passed as a parameter to avoid importing useAuthStore here
   * (which would create a circular Pinia store dependency).
   */
  function getLikedDreams(myUserId: string): ApiDream[] {
    return dreams.value.filter(d =>
      Array.isArray(d.likes) && d.likes.includes(myUserId)
    )
  }

  return {
    dreams,
    nextCursor,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    loadFeed,
    loadMore,
    addDream,
    toggleLike,
    editDream,
    setAiAnalysis,
    removeDream,
    changePrivacy,
    incrementCommentCount,
    getLikedDreams,
  }
})
