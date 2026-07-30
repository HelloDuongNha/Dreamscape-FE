import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import apiClient from '@/api/client'
import router from '@/router'
import { useDreamStore } from '@/store/useDreamStore'
import { usePostStore } from '@/store/usePostStore'
import type {
  ApiConversation,
  ApiMessage,
  ApiNotification,
  ApiUser,
  MessagingSearchResponse,
  SocketMessage,
  SocketPresenceUpdate,
  SocketStatusUpdate,
} from '@/api/types'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001'
const TOKEN_KEY  = 'ds_token'
const MUTED_CONVERSATIONS_KEY = 'ds_muted_conversations'
const ONLINE_HEARTBEAT_WINDOW_MS = 90_000

// ─── Exported Types ───────────────────────────────────────────────────────────

export interface ConversationWithPartner {
  conversation: ApiConversation
  partner:      ApiUser
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useChatStore = defineStore('chat', () => {

  // ── State ──────────────────────────────────────────────────────────────────
  const conversations        = ref<ApiConversation[]>([])
  const messages             = ref<ApiMessage[]>([])
  const activeConversationId = ref<string | null>(null)
  const isLoadingConvs       = ref(false)
  const isLoadingMsgs        = ref(false)
  const sessionUserId        = ref<string>(
    (() => {
      try { return JSON.parse(localStorage.getItem('ds_user') ?? '{}')._id ?? '' }
      catch { return '' }
    })()
  )

  // Per-conversation mute state (conversationId → boolean)
  const mutedConversations = ref<Record<string, boolean>>({})
  const presenceByUserId = ref<Record<string, SocketPresenceUpdate>>({})

  // Socket — lazily initialized when user logs in
  let socket: Socket | null = null
  let sessionEpoch = 0
  let dreamCitationRefreshTimer: ReturnType<typeof setTimeout> | null = null
  const pendingDreamCitationRefreshes = new Set<string>()

  // ── Getters ────────────────────────────────────────────────────────────────

  /**
   * Task 3 (spec):
   * totalUnreadCount = conversations.reduce((total, conv) => total + (conv.unread_count || 0), 0)
   * This is the authoritative source — derived directly from conversations[].unread_count.
   */
  const totalUnread = computed<number>(() =>
    conversations.value.reduce((sum, c) => sum + (c.unread_count || 0), 0)
  )

  /** Conversations sorted by recency, with partner resolved from populated ids */
  const conversationsWithPartner = computed(() =>
    [...conversations.value]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map(conv => {
        const myId    = _myId()
        const partner = conv.participant_ids.find(u => u._id !== myId) ?? conv.participant_ids[0]
        return { conversation: conv, partner }
      })
  )

  const activeMessages = computed<ApiMessage[]>(() => {
    if (!activeConversationId.value) return []
    return [...messages.value]
      .filter(m => m.conversationId === activeConversationId.value)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  })

  const activePartner = computed<ApiUser | null>(() => {
    if (!activeConversationId.value) return null
    const conv = conversations.value.find(c => c._id === activeConversationId.value)
    if (!conv) return null
    return conv.participant_ids.find(u => u._id !== _myId()) ?? null
  })

  const currentUserId = computed<string>(() => _myId())

  const isActiveMuted = computed<boolean>(() =>
    activeConversationId.value
      ? (mutedConversations.value[activeConversationId.value] ?? false)
      : false
  )

  function isUserOnline(userId: string, lastHeartbeatAt?: string): boolean {
    const livePresence = presenceByUserId.value[userId]
    if (livePresence) return livePresence.isOnline
    if (!lastHeartbeatAt) return false
    return Date.now() - new Date(lastHeartbeatAt).getTime() <= ONLINE_HEARTBEAT_WINDOW_MS
  }

  function getUserLastActiveAt(userId: string, fallback?: string): string | undefined {
    return presenceByUserId.value[userId]?.lastActiveAt || fallback
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  function _myId(): string {
    return sessionUserId.value
  }

  /** Find a conversation by id in the reactive store */
  function _findConv(convId: string): ApiConversation | undefined {
    return conversations.value.find(c => c._id === convId)
  }

  function _mutedStorageKey(userId = sessionUserId.value): string {
    return `${MUTED_CONVERSATIONS_KEY}:${userId}`
  }

  function _loadMutedConversations(userId: string): void {
    if (!userId) {
      mutedConversations.value = {}
      return
    }
    try {
      const stored = JSON.parse(localStorage.getItem(_mutedStorageKey(userId)) || '{}')
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
        mutedConversations.value = {}
        return
      }
      mutedConversations.value = Object.entries(stored).reduce<Record<string, boolean>>(
        (result, [conversationId, muted]) => {
          if (conversationId && muted === true) result[conversationId] = true
          return result
        },
        {},
      )
    } catch {
      mutedConversations.value = {}
    }
  }

  function _persistMutedConversations(): void {
    if (!sessionUserId.value) return
    localStorage.setItem(
      _mutedStorageKey(),
      JSON.stringify(mutedConversations.value),
    )
  }

  // ── Socket Initialization ──────────────────────────────────────────────────

  /**
   * Connect to Socket.io, passing the JWT in the auth object.
   * Idempotent — calling multiple times is safe.
   */
  function connectSocket(): void {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    if (socket) {
      const socketToken = (socket.auth as { token?: string } | undefined)?.token
      if (socketToken === token) {
        if (!socket.connected) socket.connect()
        return
      }
      socket.removeAllListeners()
      socket.disconnect()
      socket = null
    }

    socket = io(SOCKET_URL, {
      auth:        { token },
      transports:  ['websocket', 'polling'],
      autoConnect: true,
    })

    socket.on('connect', handleSocketConnected)

    socket.on('user_presence_changed', handlePresenceChanged)

    // ── Incoming message ─────────────────────────────────────────────────────
    socket.on('receive_message', handleReceivedMessage)

    // ── Status update from server ────────────────────────────────────────────
    socket.on('message_status_updated', (payload: SocketStatusUpdate) => {
      if (payload.messageId) {
        const msg = messages.value.find(m => m._id === payload.messageId)
        if (msg) msg.status = payload.status
      } else if (payload.conversationId) {
        // Bulk-conversation update (seen) — update the last sent message
        const convMsgs = messages.value.filter(
          m => m.conversationId === payload.conversationId && m.senderId === _myId()
        )
        if (convMsgs.length) {
          convMsgs[convMsgs.length - 1].status = payload.status
        }
      }
    })

    socket.on('error_message', (err: { code?: string; tempId?: string }) => {
      if (err.tempId) {
        messages.value = messages.value.filter(message => message._id !== err.tempId)
      }
      void import('@/store/useSettingsStore').then(({ useSettingsStore }) => {
        const key = err.code === 'conversation_access_denied'
          ? 'messages.conversationUnavailable'
          : 'messages.sendFailed'
        useSettingsStore().showToastKey(key, undefined, 'error')
      })
    })

    // ── Incoming notification ────────────────────────────────────────────────
    socket.on('new_notification', (payload: ApiNotification) => {
      import('@/store/useNotificationStore').then(({ useNotificationStore }) => {
        useNotificationStore().addNotification(payload)
      })
    })

    socket.on('dream_citation_state_changed', (payload: { dreamIds?: string[] }) => {
      scheduleDreamCitationRefresh(payload?.dreamIds || [])
    })

    socket.on('oracle_citation_state_changed', (payload: {
      threadIds?: string[]
      turnIds?: string[]
    }) => {
      void import('@/store/useOracleChatStore').then(({ useOracleChatStore }) => {
        useOracleChatStore().notifyCitationStateChanged(payload)
      })
    })
  }

  function handleSocketConnected(): void {
    void reconcileVisibleCitationState()
  }

  function handlePresenceChanged(payload: SocketPresenceUpdate): void {
    if (!payload?.userId || !payload.lastActiveAt) return
    presenceByUserId.value[payload.userId] = payload

    for (const conversation of conversations.value) {
      const participant = conversation.participant_ids.find(user => user._id === payload.userId)
      if (participant) participant.lastHeartbeatAt = payload.lastActiveAt
    }
  }

  function handleReceivedMessage(payload: SocketMessage): void {
    const isFromMe = payload.senderId === _myId()
    const isActiveConversation = payload.conversationId === activeConversationId.value
    if (replaceOptimisticMessage(payload)) return

    const alreadyReceived = messages.value.some(message => message._id === String(payload._id))
    if (!alreadyReceived) messages.value.push(toApiMessage(payload))
    updateConversationPreview(payload)

    if (!isFromMe && !isActiveConversation && !alreadyReceived) {
      incrementUnreadCount(payload.conversationId)
      showIncomingMessageToast(payload)
    }
    if (!isFromMe && !alreadyReceived) {
      socket?.emit('message_delivered', { messageId: String(payload._id) })
    }
    if (!isFromMe && isActiveConversation) {
      socket?.emit('mark_as_seen', { conversationId: payload.conversationId })
    }
  }

  function replaceOptimisticMessage(payload: SocketMessage): boolean {
    if (!payload.tempId) return false
    const messageIndex = messages.value.findIndex(message => message._id === payload.tempId)
    if (messageIndex === -1) return false
    messages.value[messageIndex] = toApiMessage(payload)
    updateConversationPreview(payload)
    return true
  }

  function toApiMessage(payload: SocketMessage): ApiMessage {
    return {
      _id: String(payload._id),
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      content: payload.content,
      timestamp: String(payload.timestamp),
      status: payload.status,
    }
  }

  function updateConversationPreview(payload: SocketMessage): void {
    const conversation = _findConv(payload.conversationId)
    if (!conversation) return
    conversation.last_message = payload.content
    conversation.updated_at = String(payload.timestamp)
  }

  function incrementUnreadCount(conversationId: string): void {
    const conversation = _findConv(conversationId)
    if (!conversation) return
    conversation.unread_count = (conversation.unread_count || 0) + 1
  }

  function showIncomingMessageToast(payload: SocketMessage): void {
    const isOnMessagesPage = router.currentRoute.value.path === '/messages'
    const isMuted = mutedConversations.value[payload.conversationId] ?? false
    if (isOnMessagesPage || isMuted) return
    void loadAndShowIncomingMessageToast(payload)
  }

  async function loadAndShowIncomingMessageToast(payload: SocketMessage): Promise<void> {
    let conversation = _findConv(payload.conversationId)
    if (!conversation) {
      await loadConversations()
      conversation = _findConv(payload.conversationId)
    }

    const partner = conversation?.participant_ids.find(user => user._id === payload.senderId)
    const { useMessageToastStore } = await import('@/store/useMessageToastStore')
    useMessageToastStore().addMessageToast({
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      senderName: partner?.display_name ?? 'Unknown User',
      senderAvatar: partner?.avatar ?? '',
      senderUsername: partner?.username ?? '',
      content: payload.content,
      timestamp: payload.timestamp,
    })
  }

  async function reconcileVisibleCitationState(): Promise<void> {
    const postStore = usePostStore()
    if (postStore.focusedId) {
      try {
        await postStore.refreshFocusedDream()
      } catch (error) {
        console.warn('Could not reconcile the focused Dream after reconnect.', error)
      }
    }

    const { useOracleChatStore } = await import('@/store/useOracleChatStore')
    const oracleStore = useOracleChatStore()
    if (!oracleStore.activeThreadId) return
    oracleStore.notifyCitationStateChanged({
      threadIds: [oracleStore.activeThreadId],
      turnIds: [],
    })
  }

  /** Disconnect socket (called on logout) */
  function disconnectSocket(): void {
    if (dreamCitationRefreshTimer) clearTimeout(dreamCitationRefreshTimer)
    dreamCitationRefreshTimer = null
    pendingDreamCitationRefreshes.clear()
    socket?.removeAllListeners()
    socket?.disconnect()
    socket = null
  }

  function scheduleDreamCitationRefresh(dreamIds: string[]): void {
    for (const dreamId of dreamIds) {
      if (dreamId) pendingDreamCitationRefreshes.add(dreamId)
    }
    if (dreamCitationRefreshTimer || pendingDreamCitationRefreshes.size === 0) return
    dreamCitationRefreshTimer = setTimeout(() => {
      dreamCitationRefreshTimer = null
      void refreshChangedDreams()
    }, 120)
  }

  async function refreshChangedDreams(): Promise<void> {
    const dreamIds = [...pendingDreamCitationRefreshes]
    pendingDreamCitationRefreshes.clear()
    const dreamStore = useDreamStore()
    const postStore = usePostStore()
    await Promise.all(dreamIds.map(async dreamId => {
      try {
        if (postStore.focusedId === dreamId) {
          await postStore.refreshFocusedDream()
          return
        }
        await dreamStore.refreshDream(dreamId)
      } catch (error) {
        console.warn('Could not refresh a Dream citation update.', error)
      }
    }))
  }

  function resetSession(): void {
    sessionEpoch += 1
    disconnectSocket()
    conversations.value = []
    messages.value = []
    activeConversationId.value = null
    mutedConversations.value = {}
    presenceByUserId.value = {}
    isLoadingConvs.value = false
    isLoadingMsgs.value = false
    sessionUserId.value = ''
    void import('@/store/useMessageToastStore').then(({ useMessageToastStore }) => {
      useMessageToastStore().clearAll()
    })
  }

  function startSession(userId: string): void {
    resetSession()
    sessionUserId.value = userId
    _loadMutedConversations(userId)
    connectSocket()
    void loadConversations()
  }

  // ── HTTP Actions ───────────────────────────────────────────────────────────

  /** Fetch all conversations for the logged-in user (includes unread_count from server) */
  async function loadConversations(): Promise<void> {
    if (isLoadingConvs.value) return
    const requestEpoch = sessionEpoch
    const requestUserId = sessionUserId.value
    if (!requestUserId) return
    isLoadingConvs.value = true
    try {
      const { data } = await apiClient.get<{ success: boolean; data: ApiConversation[] }>('/conversations')
      if (requestEpoch === sessionEpoch && requestUserId === sessionUserId.value) {
        conversations.value = data.data
      }
    } finally {
      if (requestEpoch === sessionEpoch) {
        isLoadingConvs.value = false
      }
    }
  }

  /**
   * Fetch chat history for a conversation and activate it.
   * Task 2: immediately set unread_count = 0 in the store and emit mark_as_seen.
   */
  async function openConversation(convId: string): Promise<void> {
    const requestEpoch = sessionEpoch
    activeConversationId.value = convId

    // Task 2: reset this conversation's unread_count immediately in the store
    const conv = _findConv(convId)
    if (conv) conv.unread_count = 0

    // Join the Socket.io room for this conversation
    socket?.emit('join_room', { conversationId: convId })

    // Task 2: emit mark_as_seen so the backend updates MongoDB → status = 'seen'
    // This guarantees that on refresh the unread_count stays 0
    socket?.emit('mark_as_seen', { conversationId: convId })

    // Only fetch if we don't already have messages for this conversation
    const hasLocal = messages.value.some(m => m.conversationId === convId)
    if (hasLocal) return

    isLoadingMsgs.value = true
    try {
      const { data } = await apiClient.get<{ success: boolean; data: ApiMessage[] }>(
        `/conversations/messages/${convId}`
      )
      if (requestEpoch === sessionEpoch && activeConversationId.value === convId) {
        const knownIds = new Set(messages.value.map(message => message._id))
        messages.value.push(...data.data.filter(message => !knownIds.has(message._id)))
      }
    } finally {
      if (requestEpoch === sessionEpoch) {
        isLoadingMsgs.value = false
      }
    }
  }

  /** Search users by @username */
  async function searchUsers(query: string): Promise<ApiUser[]> {
    if (!query.trim()) return []
    const { data } = await apiClient.post<{ success: boolean; data: ApiUser[] }>(
      '/conversations/search',
      { username: query.trim() }
    )
    return data.data ?? []
  }

  async function searchMessaging(query: string): Promise<MessagingSearchResponse> {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return { conversations: [], messages: [] }
    const requestEpoch = sessionEpoch
    const { data } = await apiClient.post<{
      success: boolean
      data: MessagingSearchResponse
    }>('/conversations/search', {
      searchMode: 'messaging',
      query: normalizedQuery,
    })
    if (requestEpoch !== sessionEpoch) {
      return { conversations: [], messages: [] }
    }
    return data.data
  }

  /** Find-or-create a conversation with a given userId, then open it */
  async function openConversationWithUser(targetUserId: string): Promise<void> {
    const { data } = await apiClient.post<{ success: boolean; conversationId: string }>(
      '/conversations/search',
      { username: '', targetUserId, open: true }
    )
    const convId = data.conversationId

    // Reload full conversation list if this is a brand-new conversation
    const exists = conversations.value.find(c => c._id === convId)
    if (!exists) {
      await loadConversations()
    }

    await openConversation(convId)
  }

  /**
   * Send a message via socket.
   * Uses temp- prefixed ID so the server echo can locate and replace it in-place.
   */
  function sendMessage(content: string): void {
    if (!activeConversationId.value || !content.trim() || !socket) return

    const tempId = `temp-${Date.now()}`

    const optimistic: ApiMessage = {
      _id:            tempId,
      conversationId: activeConversationId.value,
      senderId:       currentUserId.value,
      content:        content.trim(),
      timestamp:      new Date().toISOString(),
      status:         'sent',
    }
    messages.value.push(optimistic)

    // Update conversation snippet immediately
    const conv = _findConv(activeConversationId.value)
    if (conv) {
      conv.last_message = content.trim()
      conv.updated_at   = optimistic.timestamp
    }

    socket.emit('send_message', {
      conversationId: activeConversationId.value,
      content:        content.trim(),
      tempId,
    })
  }

  /** Delete a conversation from the backend and clear local state */
  async function deleteConversation(convId: string): Promise<void> {
    await apiClient.delete(`/conversations/${convId}`)

    conversations.value = conversations.value.filter(c => c._id !== convId)
    messages.value      = messages.value.filter(m => m.conversationId !== convId)
    delete mutedConversations.value[convId]
    _persistMutedConversations()

    if (activeConversationId.value === convId) {
      activeConversationId.value = null
    }
  }

  /**
   * Task 2 (router guard): explicitly clear the active conversation.
   * Called whenever the user navigates AWAY from the /messages route.
   * Setting activeConversationId = null means any incoming socket message
   * will fail the strict `isActiveConv` check → unread_count increments
   * correctly instead of being silently marked as 'seen'.
   */
  function clearActiveConversation(): void {
    activeConversationId.value = null
  }

  /**
   * Toggle mute for a conversation.
   * When muted, incoming messages do NOT increment unread_count.
   */
  function toggleMute(convId: string): void {
    mutedConversations.value[convId] = !mutedConversations.value[convId]
    if (!mutedConversations.value[convId]) {
      delete mutedConversations.value[convId]
    }
    _persistMutedConversations()
  }

  return {
    // State
    conversations,
    messages,
    activeConversationId,
    isLoadingConvs,
    isLoadingMsgs,
    mutedConversations,
    // Getters
    totalUnread,
    conversationsWithPartner,
    activeMessages,
    activePartner,
    isUserOnline,
    getUserLastActiveAt,
    currentUserId,
    isActiveMuted,
    // Actions
    connectSocket,
    disconnectSocket,
    resetSession,
    startSession,
    loadConversations,
    openConversation,
    openConversationWithUser,
    searchUsers,
    searchMessaging,
    sendMessage,
    deleteConversation,
    toggleMute,
    clearActiveConversation,
  }
})
