import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import apiClient         from '@/api/client'
import { useAuthStore }  from '@/store/useAuthStore'
import type {
  ApiDream,
  DreamFeedResponse,
  DreamSearchItem,
  DreamSearchResponse,
  CreateDreamResponse,
  UpdateDreamResponse,
  LikeResponse,
} from '@/api/types'
import type { DreamMoodLevel } from '@/utils/dreamMood'

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
  const searchMood = ref<DreamMoodLevel | null>(null)
  const searchResults = ref<DreamSearchItem[]>([])
  const searchNextCursor = ref<string | null>(null)
  const isSearching = ref(false)
  const isSearchLoadingMore = ref(false)
  const searchError = ref(false)
  let searchRequestId = 0
  let searchController: AbortController | null = null

  watch([searchQuery, searchMood], invalidateSearchRequest, { flush: 'sync' })

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

  async function searchDreams(): Promise<void> {
    const criteria = currentSearchCriteria()
    if (!criteria.query && !criteria.mood) {
      resetSearchState()
      return
    }

    const requestId = beginSearchRequest()
    isSearching.value = true
    searchError.value = false
    try {
      const { data } = await apiClient.get<DreamSearchResponse>('/dreams/search', {
        params: buildSearchParams(criteria),
        signal: searchController?.signal,
      })
      if (requestId !== searchRequestId) return
      searchResults.value = data.data
      searchNextCursor.value = data.nextCursor
    } catch (error) {
      if (requestId !== searchRequestId || isCancelledRequest(error)) return
      searchError.value = true
    } finally {
      if (requestId === searchRequestId) isSearching.value = false
    }
  }

  async function loadMoreSearchResults(): Promise<void> {
    if (isSearchLoadingMore.value || !searchNextCursor.value) return
    const criteria = currentSearchCriteria()
    if (!criteria.query && !criteria.mood) return

    const requestId = beginSearchRequest()
    isSearchLoadingMore.value = true
    searchError.value = false
    try {
      const { data } = await apiClient.get<DreamSearchResponse>('/dreams/search', {
        params: buildSearchParams(criteria, searchNextCursor.value),
        signal: searchController?.signal,
      })
      if (requestId !== searchRequestId) return
      const existingIds = new Set(searchResults.value.map(item => item.dream._id))
      searchResults.value.push(...data.data.filter(item => !existingIds.has(item.dream._id)))
      searchNextCursor.value = data.nextCursor
    } catch (error) {
      if (requestId !== searchRequestId || isCancelledRequest(error)) return
      searchError.value = true
    } finally {
      if (requestId === searchRequestId) isSearchLoadingMore.value = false
    }
  }

  function clearSearch(): void {
    searchQuery.value = ''
    searchMood.value = null
    resetSearchState()
  }

  async function refreshDream(dreamId: string): Promise<ApiDream | null> {
    const index = dreams.value.findIndex(dream => dream._id === dreamId)
    const hasSearchItem = searchResults.value.some(item => item.dream._id === dreamId)
    if (index === -1 && !hasSearchItem) return null
    const { data } = await apiClient.get<{ success: boolean; data: ApiDream }>(
      `/dreams/${dreamId}`,
    )
    return updateDreamCollections(dreamId, data.data)
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
    const searchDream = searchResults.value.find(item => item.dream._id === dreamId)?.dream
    if (searchDream) {
      searchDream.likes = data.likes
      searchDream.likes_count = data.likes_count
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
    const updatedDream = updateDreamCollections(dreamId, response)
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
    const { useOracleStore } = await import('@/store/useOracleStore')
    useOracleStore().stopTracking(dreamId)
    dreams.value = dreams.value.filter(d => d._id !== dreamId)
    searchResults.value = searchResults.value.filter(item => item.dream._id !== dreamId)
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
    const updatedDream = updateDreamCollections(dreamId, data.data)
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

  function decrementCommentCount(dreamId: string): void {
    const d = dreams.value.find(d => d._id === dreamId)
    if (d) d.comments_count = Math.max(0, d.comments_count - 1)
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

  function updateDreamCollections(dreamId: string, response: ApiDream): ApiDream {
    const feedIndex = dreams.value.findIndex(dream => dream._id === dreamId)
    const feedDream = feedIndex === -1 ? null : dreams.value[feedIndex]
    const updatedDream = feedDream
      ? { ...response, userId: feedDream.userId }
      : response
    if (feedIndex !== -1) dreams.value[feedIndex] = updatedDream

    const searchItem = searchResults.value.find(item => item.dream._id === dreamId)
    if (searchItem) {
      searchItem.dream = { ...response, userId: searchItem.dream.userId }
      if (feedIndex === -1) return searchItem.dream
    }
    return updatedDream
  }

  function currentSearchCriteria(): { query: string; mood: DreamMoodLevel | null } {
    return {
      query: searchQuery.value.trim(),
      mood: searchMood.value,
    }
  }

  function beginSearchRequest(): number {
    searchController?.abort()
    searchController = new AbortController()
    searchRequestId += 1
    return searchRequestId
  }

  function invalidateSearchRequest(): void {
    searchController?.abort()
    searchController = null
    searchRequestId += 1
    searchResults.value = []
    searchNextCursor.value = null
    isSearching.value = Boolean(searchQuery.value.trim() || searchMood.value)
    isSearchLoadingMore.value = false
    searchError.value = false
  }

  /**
   * Invalidates in-flight results as soon as criteria change. The view calls
   * this before its debounce delay so an older response cannot render beneath
   * a newer query while the next request is still waiting to start.
   */
  function prepareSearchCriteriaChange(): void {
    invalidateSearchRequest()
  }

  function resetSearchState(): void {
    invalidateSearchRequest()
    searchResults.value = []
    searchNextCursor.value = null
  }

  function buildSearchParams(
    criteria: { query: string; mood: DreamMoodLevel | null },
    cursor?: string,
  ): Record<string, string | number> {
    const params: Record<string, string | number> = { limit: 20 }
    if (criteria.query) params.q = criteria.query
    if (criteria.mood) params.mood = criteria.mood
    if (cursor) params.nextCursor = cursor
    return params
  }

  function isCancelledRequest(error: unknown): boolean {
    return Boolean(
      error
      && typeof error === 'object'
      && 'code' in error
      && (error as { code?: string }).code === 'ERR_CANCELED',
    )
  }

  return {
    dreams,
    nextCursor,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    searchMood,
    searchResults,
    searchNextCursor,
    isSearching,
    isSearchLoadingMore,
    searchError,
    loadFeed,
    loadMore,
    searchDreams,
    prepareSearchCriteriaChange,
    loadMoreSearchResults,
    clearSearch,
    refreshDream,
    addDream,
    toggleLike,
    editDream,
    setAiAnalysis,
    removeDream,
    changePrivacy,
    incrementCommentCount,
    decrementCommentCount,
    getLikedDreams,
  }
})
