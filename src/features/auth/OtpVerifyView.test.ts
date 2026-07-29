import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import OtpVerifyView from './OtpVerifyView.vue'
import en from '../../i18n/locales/en/index'
import viMessages from '../../i18n/locales/vi/index'

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  sessionStorage.clear()
})

describe('OTP verification view', () => {
  it.each([
    ['en', 'Resend in 30s', 'Resend Code'],
    ['vi', 'Gửi lại sau 30 giây', 'Gửi lại mã'],
  ] as const)('shows a stable localized resend cooldown in %s', async (locale, waiting, ready) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T10:00:00.000Z'))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/verify-otp', component: OtpVerifyView }],
    })
    await router.push({
      path: '/verify-otp',
      query: {
        email: 'dreamer@example.test',
        purpose: 'register',
        resendAvailableAt: '2026-07-29T10:00:30.000Z',
      },
    })
    await router.isReady()

    const i18n = createI18n({
      legacy: false,
      locale,
      fallbackLocale: 'vi',
      messages: { en, vi: viMessages },
    })
    const wrapper = mount(OtpVerifyView, {
      global: {
        plugins: [createPinia(), router, i18n],
      },
    })

    const resend = wrapper.get<HTMLButtonElement>('.resend-btn')
    expect(resend.element.disabled).toBe(true)
    expect(resend.text()).toBe(waiting)

    await vi.advanceTimersByTimeAsync(31_000)
    expect(resend.element.disabled).toBe(false)
    expect(resend.text()).toBe(ready)
    wrapper.unmount()
  })
})
