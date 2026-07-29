import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import AvatarEditor from './AvatarEditor.vue'
import en from '@/i18n/locales/en'
import viMessages from '@/i18n/locales/vi'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import AvatarCropModal from './AvatarCropModal.vue'

const { put } = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { put } }))

afterEach(() => {
  put.mockReset()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('AvatarEditor', () => {
  it('uploads one validated image and updates the shared authenticated user', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.user = userFixture()
    put.mockResolvedValue({
      data: { success: true, avatar: 'https://cdn.example/avatar.webp' },
    })
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:avatar-preview'),
      revokeObjectURL: vi.fn(),
    })
    const wrapper = mountEditor(pinia)
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      'avatar.png',
      { type: 'image/png' },
    )
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })

    await input.trigger('change')
    await flushPromises()

    expect(put).not.toHaveBeenCalled()
    const cropModal = wrapper.findComponent(AvatarCropModal)
    expect(cropModal.props('modelValue')).toBe(true)
    cropModal.vm.$emit('confirm', file)
    await flushPromises()

    expect(put).toHaveBeenCalledOnce()
    expect(put.mock.calls[0][0]).toBe('/auth/profile/avatar')
    expect(put.mock.calls[0][1]).toBeInstanceOf(FormData)
    expect(put.mock.calls[0][2]).toEqual({
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    expect(authStore.user?.avatar).toBe('https://cdn.example/avatar.webp')
    expect(useSettingsStore().toast.content).toEqual({
      kind: 'key',
      key: 'settings.avatarUpdated',
      params: undefined,
    })
  })

  it('rejects an unsupported file locally without sending a request', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mountEditor(pinia)
    const file = new File(['plain text'], 'avatar.txt', { type: 'text/plain' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })

    await input.trigger('change')

    expect(put).not.toHaveBeenCalled()
    expect(useSettingsStore().toast.content).toEqual({
      kind: 'key',
      key: 'settings.avatarTypeError',
      params: undefined,
    })
  })
})

function mountEditor(pinia: ReturnType<typeof createPinia>) {
  return mount(AvatarEditor, {
    props: {
      avatar: '',
      displayName: 'Dreamer',
      userId: 'avatar-user',
      variant: 'settings',
    },
    global: {
      plugins: [
        pinia,
        createI18n({
          legacy: false,
          locale: 'en',
          fallbackLocale: 'vi',
          messages: { en, vi: viMessages },
        }),
      ],
    },
  })
}

function userFixture() {
  return {
    _id: 'avatar-user',
    username: '@dreamer',
    display_name: 'Dreamer',
    avatar: '',
    bio: '',
    follower_count: 0,
  }
}
