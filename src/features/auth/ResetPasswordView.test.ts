import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import ResetPasswordView from './ResetPasswordView.vue'
import en from '../../i18n/locales/en/index'
import viMessages from '../../i18n/locales/vi/index'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { post } }))

afterEach(() => {
  post.mockReset()
  sessionStorage.clear()
  document.body.innerHTML = ''
})

describe('password recovery session choice', () => {
  it('keeps existing sessions when the user declines the post-success revoke prompt', async () => {
    sessionStorage.setItem('ds_password_recovery_email', 'dreamer@example.test')
    sessionStorage.setItem('ds_password_recovery_grant', 'verified-grant')
    post.mockResolvedValueOnce({
      data: { success: true, sessionRevocationGrant: 'short-lived-session-grant' },
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/reset-password', component: ResetPasswordView },
        { path: '/login', component: { template: '<div>Login</div>' } },
      ],
    })
    await router.push('/reset-password')
    await router.isReady()
    const wrapper = mount(ResetPasswordView, {
      attachTo: document.body,
      global: {
        plugins: [
          createPinia(),
          router,
          createI18n({
            legacy: false,
            locale: 'en',
            fallbackLocale: 'vi',
            messages: { en, vi: viMessages },
          }),
        ],
      },
    })

    await wrapper.get('#reset-new-password').setValue('RecoveredPass9')
    await wrapper.get('#reset-confirm-password').setValue('RecoveredPass9')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(document.body.textContent).toContain('Sign out previous devices?')

    const keepButton = [...document.body.querySelectorAll('button')]
      .find(button => button.textContent?.includes('Keep current sessions')) as HTMLButtonElement
    keepButton.click()
    await flushPromises()
    expect(post).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/login')
    wrapper.unmount()
  })
})
