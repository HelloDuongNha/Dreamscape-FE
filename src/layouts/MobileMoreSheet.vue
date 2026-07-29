<template>
  <Teleport to="body">
    <Transition name="mobile-more">
      <div v-if="modelValue" class="mobile-more" @click.self="$emit('update:modelValue', false)">
        <section
          ref="sheet"
          class="mobile-more__sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="t('navigation.more')"
          tabindex="-1"
        >
          <div class="mobile-more__handle" aria-hidden="true" />
          <header class="mobile-more__profile">
            <div class="mobile-more__avatar" :style="{ background: avatarBg }">
              <img v-if="avatarUrl" :src="avatarUrl" alt="" />
              <span v-else>{{ initials }}</span>
            </div>
            <div class="mobile-more__identity">
              <strong>{{ displayName }}</strong>
              <span v-if="username">@{{ username }}</span>
            </div>
            <button type="button" class="mobile-more__close" :aria-label="t('common.close')" @click="$emit('update:modelValue', false)">
              ×
            </button>
          </header>

          <div class="mobile-more__group">
            <RouterLink
              v-for="item in generalItems"
              :key="item.id"
              :to="item.to"
              :class="['mobile-more__item', { 'is-active': isActive(item) }]"
              @click="$emit('update:modelValue', false)"
            >
              <NavigationIcon :name="item.icon" />
              <span>{{ t(item.labelKey) }}</span>
              <span class="mobile-more__chevron" aria-hidden="true">›</span>
            </RouterLink>
          </div>

          <div v-if="adminItems.length" class="mobile-more__group">
            <p class="mobile-more__group-label">{{ t('navigation.adminTools') }}</p>
            <RouterLink
              v-for="item in adminItems"
              :key="item.id"
              :to="item.to"
              :class="['mobile-more__item', { 'is-active': isActive(item) }]"
              @click="$emit('update:modelValue', false)"
            >
              <NavigationIcon :name="item.icon" />
              <span>{{ t(item.labelKey) }}</span>
              <span class="mobile-more__chevron" aria-hidden="true">›</span>
            </RouterLink>
          </div>

          <button type="button" class="mobile-more__item mobile-more__logout" @click="$emit('logout')">
            <NavigationIcon name="logout" />
            <span>{{ t('navigation.logout') }}</span>
          </button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import NavigationIcon from './navigation/NavigationIcon.vue'
import { isNavigationItemActive } from './navigation/navigation.config'
import type { NavigationItem } from './navigation/navigation.types'

const props = defineProps<{
  modelValue: boolean
  routePath: string
  generalItems: NavigationItem[]
  adminItems: NavigationItem[]
  displayName: string
  username?: string
  avatarUrl?: string
  avatarBg: string
  initials: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  logout: []
}>()

const { t } = useI18n()
const sheet = ref<HTMLElement | null>(null)
const isActive = (item: NavigationItem) => isNavigationItemActive(item, props.routePath)

watch(() => props.modelValue, async (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
  if (isOpen) {
    await nextTick()
    sheet.value?.focus()
  }
})

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.modelValue) {
    emit('update:modelValue', false)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleEscape)
}

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.mobile-more {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: none;
  align-items: flex-end;
  background: rgb(0 0 0 / 58%);
}

@media (max-width: 767px) {
  .mobile-more {
    display: flex;
  }

  .mobile-more__sheet {
    width: 100%;
    max-height: min(82dvh, 680px);
    overflow-y: auto;
    padding: 8px max(12px, var(--safe-area-right)) max(16px, var(--safe-area-bottom)) max(12px, var(--safe-area-left));
    border: 1px solid var(--color-border);
    border-bottom: 0;
    border-radius: 22px 22px 0 0;
    outline: none;
    background: var(--color-bg-elevated);
  }

  .mobile-more__handle {
    width: 40px;
    height: 4px;
    margin: 2px auto 12px;
    border-radius: 999px;
    background: var(--color-border);
  }

  .mobile-more__profile {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr) 44px;
    gap: 12px;
    align-items: center;
    padding: 4px 4px 14px;
  }

  .mobile-more__avatar {
    display: grid;
    width: 46px;
    height: 46px;
    overflow: hidden;
    place-items: center;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 700;
  }

  .mobile-more__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mobile-more__identity {
    display: grid;
    min-width: 0;
    gap: 2px;
  }

  .mobile-more__identity strong,
  .mobile-more__identity span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-more__identity span {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .mobile-more__close {
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 26px;
  }

  .mobile-more__group {
    padding: 8px 0;
    border-top: 1px solid var(--color-border);
  }

  .mobile-more__group-label {
    margin: 2px 12px 6px;
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .mobile-more__item {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    min-height: 52px;
    width: 100%;
    padding: 0 12px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    text-align: left;
    text-decoration: none;
  }

  .mobile-more__item:active,
  .mobile-more__item.is-active {
    background: var(--color-bg-hover);
  }

  .mobile-more__chevron {
    color: var(--color-text-muted);
    font-size: 24px;
  }

  .mobile-more__logout {
    margin-top: 8px;
    color: var(--color-danger);
  }
}

.mobile-more-enter-active,
.mobile-more-leave-active {
  transition: opacity var(--transition-base);
}

.mobile-more-enter-active .mobile-more__sheet,
.mobile-more-leave-active .mobile-more__sheet {
  transition: transform var(--transition-base);
}

.mobile-more-enter-from,
.mobile-more-leave-to {
  opacity: 0;
}

.mobile-more-enter-from .mobile-more__sheet,
.mobile-more-leave-to .mobile-more__sheet {
  transform: translateY(100%);
}
</style>
