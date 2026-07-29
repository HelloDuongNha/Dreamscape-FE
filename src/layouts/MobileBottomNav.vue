<template>
  <nav class="mobile-bottom-nav" :aria-label="t('navigation.mobileNav')">
    <div class="mobile-bottom-nav__inner">
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="item.to"
        :class="['mobile-bottom-nav__item', { 'is-active': isActive(item) }]"
        :aria-label="t(item.labelKey)"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <NavigationIcon :name="item.icon" />
        <span v-if="item.badge" class="mobile-bottom-nav__badge">
          {{ item.badge > 9 ? '9+' : item.badge }}
        </span>
      </RouterLink>

      <button
        type="button"
        :class="['mobile-bottom-nav__item', { 'is-active': moreActive }]"
        :aria-label="t('navigation.more')"
        :aria-expanded="moreOpen"
        @click="$emit('toggle-more')"
      >
        <NavigationIcon name="more" />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import NavigationIcon from './navigation/NavigationIcon.vue'
import { isNavigationItemActive } from './navigation/navigation.config'
import type { NavigationItem } from './navigation/navigation.types'

const props = defineProps<{
  items: NavigationItem[]
  routePath: string
  moreOpen: boolean
  moreActive: boolean
}>()

defineEmits<{ 'toggle-more': [] }>()

const { t } = useI18n()
const isActive = (item: NavigationItem) => isNavigationItemActive(item, props.routePath)
</script>

<style scoped>
.mobile-bottom-nav {
  display: none;
}

@media (max-width: 767px) {
  .mobile-bottom-nav {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: var(--z-sidebar);
    display: block;
    height: var(--mobile-nav-height);
    padding: 0 var(--safe-area-right) var(--safe-area-bottom) var(--safe-area-left);
    background: color-mix(in srgb, var(--color-bg-base) 96%, transparent);
    border-top: 1px solid var(--color-border);
  }

  .mobile-bottom-nav__inner {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: center;
    width: min(100%, 540px);
    height: var(--mobile-nav-content-height);
    margin: 0 auto;
  }

  .mobile-bottom-nav__item {
    position: relative;
    display: grid;
    width: 100%;
    min-width: var(--touch-target-size);
    height: var(--mobile-nav-content-height);
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-muted);
    text-decoration: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-bottom-nav__item::after {
    position: absolute;
    bottom: 5px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    content: '';
    opacity: 0;
    transform: scale(.5);
    transition: opacity var(--transition-fast), transform var(--transition-fast);
  }

  .mobile-bottom-nav__item.is-active {
    color: var(--color-text-primary);
  }

  .mobile-bottom-nav__item.is-active::after {
    opacity: 1;
    transform: scale(1);
  }

  .mobile-bottom-nav__badge {
    position: absolute;
    top: 7px;
    left: calc(50% + 7px);
    display: grid;
    min-width: 17px;
    height: 17px;
    place-items: center;
    padding: 0 4px;
    border: 2px solid var(--color-bg-base);
    border-radius: 999px;
    background: var(--color-danger);
    color: white;
    font-size: 9px;
    font-weight: 800;
  }
}
</style>
