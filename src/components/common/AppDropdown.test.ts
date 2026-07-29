import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppDropdown from './AppDropdown.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AppDropdown keyboard contract', () => {
  it('moves through enabled actions and returns focus on Escape', async () => {
    const wrapper = mount(AppDropdown, {
      attachTo: document.body,
      props: {
        label: 'Comment options',
        options: [
          { label: 'Edit', value: 'edit' },
          { label: 'Unavailable', value: 'disabled', disabled: true },
          { label: 'Delete', value: 'delete', danger: true },
        ],
      },
      slots: {
        trigger: `
          <template #trigger="{ toggle, isOpen, panelId }">
            <button
              id="menu-trigger"
              aria-haspopup="menu"
              :aria-expanded="isOpen"
              :aria-controls="isOpen ? panelId : undefined"
              @click="toggle"
            >Options</button>
          </template>
        `,
      },
    })

    const trigger = wrapper.get('#menu-trigger')
    await trigger.trigger('click')

    const enabledItems = wrapper
      .findAll<HTMLButtonElement>('.app-dropdown__item')
      .filter(item => !item.element.disabled)
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(enabledItems[0].element)

    await enabledItems[0].trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(enabledItems[1].element)

    await enabledItems[1].trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(enabledItems[0].element)

    await enabledItems[0].trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)

    wrapper.unmount()
  })
})
