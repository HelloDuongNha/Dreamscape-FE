import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import apiClient from '@/api/client'
import router from '@/router'
import { useDreamStore } from '@/store/useDreamStore'
import { usePostStore } from '@/store/usePostStore'
import { SOCKET_URL } from '@/config/runtime'
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

const TOKEN_KEY  = 'ds_token'
const MUTED_CONVERSATIONS_KEY = 'ds_muted_conversations'
const ONLINE_HEARTBEAT_WINDOW_MS = 90_000
const MESSAGE_ACK_TIMEOUT_MS = 12_000

type SocketConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

interface SendMessageAcknowledgement {
  success: boolean
  code?: string
  message?: string
  data?: SocketMessage
}

interface MessageComposeInput {
  content: string
  messageType?: 'text' | 'shared_post'
  sharedPostId?: string
  replyToMessageId?: string
  forwarded?: boolean
}

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
  const socketState          = ref<SocketConnectionState>('idle')
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
    socketState.value = 'connecting'

    socket.on('connect', handleSocketConnected)
    socket.on('connect_error', handleSocketConnectionError)
    socket.on('disconnect', handleSocketDisconnected)

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
    socket.on('message_deleted_for_me', (payload: {
      messageId: string
      conversationId: string
    }) => {
      removeMessageLocally(payload.messageId)
    })
    socket.on('message_unsent', (payload: {
      messageId: string
      conversationId: string
      unsentAt: string
    }) => {
      markMessageUnsent(payload.messageId, payload.unsentAt)
    })

    socket.on('error_message', (err: { code?: string; tempId?: string }) => {
      const changed = err.tempId ? failOptimisticMessage(err.tempId) : true
      if (changed) showSendError(err.code)
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
    socketState.value = 'connected'
    void reconcileMessagingStateAfterConnect()
    void reconcileVisibleCitationState()
  }

  function handleSocketConnectionError(): void {
    socketState.value = 'error'
    // Socket.IO retries transient cold-start and network failures itself. Do not
    // show an error toast for the first failed handshake; the send/retry actions
    // still surface a clear error when the user actually needs the connection.
  }

  function handleSocketDisconnected(): void {
    socketState.value = 'disconnected'
  }

  async function reconcileMessagingStateAfterConnect(): Promise<void> {
    try {
      const { useNotificationStore } = await import('@/store/useNotificationStore')
      await Promise.all([
        loadConversations(),
        useNotificationStore().fetchNotifications(),
      ])
      if (activeConversationId.value) {
        await refreshConversationMessages(activeConversationId.value)
      }
    } catch (error) {
      console.warn('Could not reconcile messaging state after reconnect.', error)
    }
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
      messageType: payload.messageType || 'text',
      sharedPostId: payload.sharedPostId,
      replyToMessageId: payload.replyToMessageId,
      replyTo: payload.replyTo,
      forwarded: payload.forwarded,
      unsentAt: payload.unsentAt,
      timestamp: String(payload.timestamp),
      status: payload.status,
      clientMessageId: payload.clientMessageId,
      deliveryState: 'persisted',
    }
  }

  function updateConversationPreview(payload: SocketMessage): void {
    const conversation = _findConv(payload.conversationId)
    if (!conversation) return
    conversation.last_message = payload.content
    conversation.last_message_unsent = false
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
      senderStreakCount: partner?.streakCount ?? 0,
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
    socketState.value = 'idle'
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

  async function refreshConversationMessages(convId: string): Promise<void> {
    const { data } = await apiClient.get<{ success: boolean; data: ApiMessage[] }>(
      `/conversations/messages/${convId}`
    )
    const otherMessages = messages.value.filter(message => message.conversationId !== convId)
    const failedLocalMessages = messages.value.filter(message => (
      message.conversationId === convId && message.deliveryState === 'failed'
    ))
    messages.value = [
      ...otherMessages,
      ...data.data.map(message => ({ ...message, deliveryState: 'persisted' as const })),
      ...failedLocalMessages,
    ]
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
  async function sendMessage(content: string): Promise<boolean> {
    if (!activeConversationId.value) return false
    return sendMessageToConversation(activeConversationId.value, { content })
  }

  async function sendMessageToConversation(
    conversationId: string,
    input: MessageComposeInput,
  ): Promise<boolean> {
    if (!conversationId || !input.content.trim()) return false

    const tempId = createClientMessageId()

    const optimistic: ApiMessage = {
      _id:            tempId,
      conversationId,
      senderId:       currentUserId.value,
      content:        input.content.trim(),
      messageType:    input.messageType || 'text',
      sharedPostId:   input.sharedPostId,
      replyToMessageId: input.replyToMessageId,
      replyTo: input.replyToMessageId
        ? createReplyPreview(input.replyToMessageId)
        : undefined,
      forwarded:      input.forwarded === true,
      timestamp:      new Date().toISOString(),
      status:         'sent',
      clientMessageId: tempId,
      deliveryState: 'sending',
    }
    messages.value.push(optimistic)

    // Update conversation snippet immediately
    const conv = _findConv(conversationId)
    if (conv) {
      conv.last_message = input.content.trim()
      conv.updated_at   = optimistic.timestamp
    }

    return socket?.connected
      ? transmitMessage(optimistic)
      : transmitMessageOverHttp(optimistic)
  }

  async function retryMessage(message: ApiMessage): Promise<boolean> {
    if (message.deliveryState !== 'failed') return false
    message.deliveryState = 'sending'
    return socket?.connected
      ? transmitMessage(message)
      : transmitMessageOverHttp(message)
  }

  function transmitMessage(message: ApiMessage): Promise<boolean> {
    return new Promise(resolve => {
      if (!socket?.connected) {
        void transmitMessageOverHttp(message).then(resolve)
        return
      }
      socket.timeout(MESSAGE_ACK_TIMEOUT_MS).emit(
        'send_message',
        {
          conversationId: message.conversationId,
          content: message.content,
          messageType: message.messageType,
          sharedPostId: message.sharedPostId,
          replyToMessageId: message.replyToMessageId,
          forwarded: message.forwarded,
          tempId: message._id,
          clientMessageId: message.clientMessageId || message._id,
        },
        (timeoutError: Error | null, acknowledgement?: SendMessageAcknowledgement) => {
          if (timeoutError || !acknowledgement?.success || !acknowledgement.data) {
            void transmitMessageOverHttp(message, acknowledgement?.code).then(resolve)
            return
          }
          handleReceivedMessage(acknowledgement.data)
          resolve(true)
        },
      )
    })
  }

  async function transmitMessageOverHttp(
    message: ApiMessage,
    socketErrorCode?: string,
  ): Promise<boolean> {
    try {
      const { data } = await apiClient.post<{
        success: boolean
        data: SocketMessage
      }>(`/conversations/messages/${message.conversationId}`, {
        content: message.content,
        messageType: message.messageType,
        sharedPostId: message.sharedPostId,
        replyToMessageId: message.replyToMessageId,
        forwarded: message.forwarded,
        tempId: message._id,
        clientMessageId: message.clientMessageId || message._id,
      })
      if (!data.success || !data.data) throw new Error('message_not_persisted')
      handleReceivedMessage(data.data)
      return true
    } catch {
      const changed = failOptimisticMessage(message._id)
      if (changed) showSendError(socketErrorCode)
      return false
    }
  }

  function failOptimisticMessage(tempId: string): boolean {
    const message = messages.value.find(item => item._id === tempId)
    if (!message || message.deliveryState === 'failed') return false
    message.deliveryState = 'failed'
    return true
  }

  function createClientMessageId(): string {
    const randomId = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
    return `msg-${randomId}`
  }

  function showSendError(code?: string): void {
    void import('@/store/useSettingsStore').then(({ useSettingsStore }) => {
      const key = code === 'conversation_access_denied'
        ? 'messages.conversationUnavailable'
        : 'messages.sendFailed'
      useSettingsStore().showToastKey(key, undefined, 'error')
    })
  }

  function createReplyPreview(messageId: string): ApiMessage['replyTo'] | undefined {
    const message = messages.value.find(item => item._id === messageId)
    if (!message) return undefined
    return {
      _id: message._id,
      senderId: message.senderId,
      content: message.content,
      messageType: message.messageType,
      sharedPostId: message.sharedPostId,
      unsentAt: message.unsentAt,
      content_unavailable: message.content_unavailable,
    }
  }

  function removeMessageLocally(messageId: string): void {
    const message = messages.value.find(item => item._id === messageId)
    messages.value = messages.value.filter(item => item._id !== messageId)
    if (message) refreshConversationPreviewFromMessages(message.conversationId)
  }

  function markMessageUnsent(messageId: string, unsentAt: string): void {
    const message = messages.value.find(item => item._id === messageId)
    if (!message) return
    message.content = ''
    message.messageType = 'text'
    message.sharedPostId = undefined
    message.unsentAt = unsentAt
    message.deliveryState = 'persisted'
    refreshConversationPreviewFromMessages(message.conversationId)
  }

  function refreshConversationPreviewFromMessages(conversationId: string): void {
    const conversation = _findConv(conversationId)
    if (!conversation) return
    const latest = messages.value
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    conversation.last_message = latest?.unsentAt ? '' : (latest?.content || '')
    conversation.last_message_unsent = Boolean(latest?.unsentAt)
    if (latest) conversation.updated_at = latest.timestamp
  }

  async function deleteMessageForMe(messageId: string): Promise<void> {
    await apiClient.patch(`/conversations/messages/${messageId}/delete-for-me`)
    removeMessageLocally(messageId)
  }

  async function unsendMessage(messageId: string): Promise<void> {
    const { data } = await apiClient.patch<{
      success: boolean
      data: { unsentAt: string }
    }>(`/conversations/messages/${messageId}/unsend`)
    markMessageUnsent(messageId, data.data.unsentAt)
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
    socketState,
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
    sendMessageToConversation,
    retryMessage,
    deleteMessageForMe,
    unsendMessage,
    deleteConversation,
    toggleMute,
    clearActiveConversation,
  }
})
