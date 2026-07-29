import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificationStore } from './useNotificationStore'
import type { ApiNotification } from '@/api/types'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/api/client', () => ({ default: api }))

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useNotificationStore', () => {
  it('opens one typed target and marks only the selected notification read', async () => {
    const store = useNotificationStore()
    store.notifications = [
      notificationFixture('notification-1'),
      notificationFixture('notification-2'),
    ]
    api.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          target: {
            kind: 'dream_analysis',
            dream: { _id: 'dream-1', ai_status: 'completed' },
          },
        },
      },
    })

    const target = await store.openNotification('notification-1')

    expect(api.post).toHaveBeenCalledWith('/notifications/notification-1/open')
    expect(target.kind).toBe('dream_analysis')
    expect(store.notifications[0].isRead).toBe(true)
    expect(store.notifications[1].isRead).toBe(false)
    expect(store.unreadCount).toBe(1)
  })

  it('rolls back mark-all on failure and removes only a successfully deleted row', async () => {
    const store = useNotificationStore()
    store.notifications = [
      notificationFixture('notification-1'),
      notificationFixture('notification-2'),
    ]
    api.patch.mockRejectedValue(new Error('network unavailable'))

    const marked = await store.markAllRead()

    expect(marked).toBe(false)
    expect(store.notifications.every(item => !item.isRead)).toBe(true)

    api.delete.mockResolvedValue({ data: { success: true } })
    await store.deleteNotification('notification-1')

    expect(api.delete).toHaveBeenCalledWith('/notifications/notification-1')
    expect(store.notifications.map(item => item._id)).toEqual(['notification-2'])
  })
})

function notificationFixture(id: string): ApiNotification {
  return {
    _id: id,
    recipientId: 'owner-1',
    senderId: {
      _id: 'sender-1',
      username: '@sender',
      display_name: 'Sender',
      avatar: '',
      bio: '',
      follower_count: 0,
    },
    type: 'dream_analysis',
    postId: 'dream-1',
    isRead: false,
    timestamp: new Date().toISOString(),
  }
}
