import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AppConfirm from './AppConfirm.vue'
import en from '../../i18n/locales/en/index'
import vi from '../../i18n/locales/vi/index'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AppConfirm locale contract', () => {
  it.each([
    ['en', 'Close', 'Cancel', 'Confirm', 'Please wait…'],
    ['vi', 'Đóng', 'Hủy', 'Xác nhận', 'Vui lòng chờ…'],
  ] as const)(
    'renders default controls in %s and keeps the layout stable while loading',
    async (locale, close, cancel, confirm, loading) => {
      const wrapper = mountConfirm(locale)

      expect(document.querySelector('.app-confirm__close-btn')?.getAttribute('aria-label')).toBe(close)
      expect(document.querySelector('.app-confirm__btn--cancel')?.textContent?.trim()).toBe(cancel)
      expect(document.querySelector('.app-confirm__btn--confirm')?.textContent?.trim()).toBe(confirm)

      await wrapper.setProps({ loading: true })
      expect(document.querySelector('.app-confirm__btn--confirm')?.textContent?.trim()).toBe(loading)
      expect(document.querySelector('.app-confirm__btn--confirm')).toHaveProperty('disabled', true)

      wrapper.unmount()
    },
  )
})

function mountConfirm(locale: 'en' | 'vi') {
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'vi',
    messages: { en, vi },
  })

  return mount(AppConfirm, {
    attachTo: document.body,
    props: {
      modelValue: true,
      title: 'Confirm action',
      message: 'This action needs confirmation.',
    },
    global: {
      plugins: [i18n],
    },
  })
}
