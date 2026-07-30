import { defineStore } from 'pinia'
import { ref }         from 'vue'

export interface MessageToast {
  id:             string
  conversationId: string
  senderId:       string
  senderName:     string
  senderAvatar:   string
  senderUsername: string
  senderStreakCount?: number
  content:        string
  timestamp:      string
}

export interface ConversationStack {
  conversationId: string
  messages:       MessageToast[]
  timerId:        ReturnType<typeof setTimeout> | null
}

export const useMessageToastStore = defineStore('messageToast', () => {
  const activeStacks = ref<ConversationStack[]>([])

  function addMessageToast(toast: Omit<MessageToast, 'id'> & { id?: string }) {
    const id = toast.id || `msg-toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const toastItem: MessageToast = { ...toast, id }

    // Find existing stack for this conversation
    const stackIdx = activeStacks.value.findIndex(s => s.conversationId === toast.conversationId)

    if (stackIdx !== -1) {
      const stack = activeStacks.value[stackIdx]
      // Push new message to the top of the stack (index 0 is the newest message)
      stack.messages.unshift(toastItem)
      
      // Limit to max 3 items in the visual stack to keep UI clean and consistent
      if (stack.messages.length > 3) {
        stack.messages.pop()
      }

      // Reset auto-dismiss timer
      if (stack.timerId) {
        clearTimeout(stack.timerId)
      }
      stack.timerId = setTimeout(() => {
        dismissStack(toast.conversationId)
      }, 5000)

      // Move the active stack to the top of the container layout (index 0 in activeStacks)
      const [movedStack] = activeStacks.value.splice(stackIdx, 1)
      activeStacks.value.unshift(movedStack)
    } else {
      // Create a brand new stack
      const timerId = setTimeout(() => {
        dismissStack(toast.conversationId)
      }, 5000)

      const newStack: ConversationStack = {
        conversationId: toast.conversationId,
        messages:       [toastItem],
        timerId,
      }
      activeStacks.value.unshift(newStack)
    }
  }

  function dismissStack(conversationId: string) {
    const idx = activeStacks.value.findIndex(s => s.conversationId === conversationId)
    if (idx !== -1) {
      const stack = activeStacks.value[idx]
      if (stack.timerId) {
        clearTimeout(stack.timerId)
      }
      activeStacks.value.splice(idx, 1)
    }
  }

  function clearAll() {
    activeStacks.value.forEach(s => {
      if (s.timerId) {
        clearTimeout(s.timerId)
      }
    })
    activeStacks.value = []
  }

  return {
    activeStacks,
    addMessageToast,
    dismissStack,
    clearAll,
  }
})
