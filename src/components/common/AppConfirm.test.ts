import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
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

  it('traps keyboard focus, closes on Escape and restores the trigger', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Open confirmation'
    document.body.appendChild(trigger)
    trigger.focus()

    const wrapper = mountConfirm('en', false)
    await wrapper.setProps({ modelValue: true })
    await nextTick()

    const close = document.querySelector<HTMLElement>('.app-confirm__close-btn')!
    const cancel = document.querySelector<HTMLElement>('.app-confirm__btn--cancel')!
    const confirm = document.querySelector<HTMLElement>('.app-confirm__btn--confirm')!
    expect(document.activeElement).toBe(cancel)

    confirm.focus()
    confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(close)

    close.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }))
    expect(document.activeElement).toBe(confirm)

    confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])

    await wrapper.setProps({ modelValue: false })
    await nextTick()
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('keeps focus inside the dialog when every action is loading-disabled', async () => {
    const wrapper = mountConfirm('en', true, true)
    await nextTick()

    expect(document.activeElement).toBe(document.querySelector('.app-confirm'))
    wrapper.unmount()
  })
})

function mountConfirm(locale: 'en' | 'vi', modelValue = true, loading = false) {
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'vi',
    messages: { en, vi },
  })

  return mount(AppConfirm, {
    attachTo: document.body,
    props: {
      modelValue,
      loading,
      title: 'Confirm action',
      message: 'This action needs confirmation.',
    },
    global: {
      plugins: [i18n],
    },
  })
}
