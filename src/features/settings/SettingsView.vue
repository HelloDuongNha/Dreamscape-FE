<template>
  <div class="settings-view">



    <!-- ── Dual-pane shell ── -->
    <div class="settings-layout">

      <!-- Left menu -->
      <aside class="settings-menu" aria-label="Settings categories">
        <h2 class="settings-menu__title">Settings</h2>
        <nav role="navigation">
          <ul class="settings-menu__list" role="list">
            <li v-for="item in menuItems" :key="item.id" role="none">
              <RouterLink
                :to="`/settings/${item.id}`"
                :id="`settings-menu-${item.id}`"
                class="settings-menu__item"
                :class="{ 'settings-menu__item--active': activeSection === item.id }"
                role="menuitem"
                :aria-current="activeSection === item.id ? 'page' : undefined"
              >
                <span class="settings-menu__item-icon" aria-hidden="true" v-html="item.icon" />
                <span class="settings-menu__item-label">{{ item.label }}</span>
                <svg class="settings-menu__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </RouterLink>
            </li>
          </ul>
        </nav>
      </aside>

      <!-- Right content -->
      <main class="settings-content" role="main">
        <Transition name="section-fade" mode="out-in">
          <component :is="activeComponent" :key="activeSection" />
        </Transition>
      </main>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed }            from 'vue'
import { useRoute }            from 'vue-router'
import SettingsAccount         from './SettingsAccount.vue'
import SettingsSecurity        from './SettingsSecurity.vue'
import SettingsPrivacy         from './SettingsPrivacy.vue'

const route         = useRoute()

const activeSection = computed(() => (route.params.section as string) || 'account')

const sectionMap: Record<string, ReturnType<typeof defineComponent> | unknown> = {
  account:       SettingsAccount,
  security:      SettingsSecurity,
  privacy:       SettingsPrivacy,
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activeComponent = computed(() => sectionMap[activeSection.value] ?? SettingsAccount)

const menuItems = [
  {
    id:    'account',
    label: 'Account Center',
    icon:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  },
  {
    id:    'security',
    label: 'Security',
    icon:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  },
  {
    id:    'privacy',
    label: 'Privacy',
    icon:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  },
]

function defineComponent(x: unknown) { return x }
</script>

<style scoped>
/* ── Page shell ── */
.settings-view {
  position: relative;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}



/* ── Dual-pane layout ── */
.settings-layout {
  display: flex;
  gap: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-surface);
  overflow: hidden;
  /* Fixed height — right pane scrolls internally */
  height: calc(100dvh - var(--header-height) - var(--space-10));
  min-height: 480px;
}

/* ── Left menu ── */
.settings-menu {
  width: 220px;
  flex-shrink: 0;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: var(--space-5) var(--space-3);
  gap: var(--space-4);
}

.settings-menu__title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  padding: 0 var(--space-3);
  letter-spacing: var(--letter-spacing-tight);
}

.settings-menu__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-menu__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: background var(--transition-fast), color var(--transition-fast);
  cursor: pointer;
}
.settings-menu__item:hover        { background: var(--color-bg-hover); color: var(--color-text-primary); }
.settings-menu__item--active      { background: var(--color-bg-active); color: var(--color-text-primary); font-weight: var(--font-weight-semibold); }

.settings-menu__item-icon { display: flex; align-items: center; flex-shrink: 0; }
.settings-menu__item-label { flex: 1; }
.settings-menu__chevron { flex-shrink: 0; opacity: 0.4; }
.settings-menu__item--active .settings-menu__chevron { opacity: 1; }

/* ── Right content ── */
.settings-content {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-base);
  overflow-y: auto;   /* scroll when content taller than panel */
}

/* Section fade transition */
.section-fade-enter-active, .section-fade-leave-active { transition: opacity 0.15s; }
.section-fade-enter-from, .section-fade-leave-to { opacity: 0; }
</style>
