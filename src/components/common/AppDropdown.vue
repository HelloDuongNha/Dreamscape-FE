<template>
  <div ref="rootRef" class="app-dropdown" @click.stop>
    <!-- Trigger slot (the 3-dot button or whatever the parent provides) -->
    <slot name="trigger" :toggle="toggle" :isOpen="isOpen" />

    <!-- Dropdown panel -->
    <Transition name="dropdown-fade">
      <div
        v-if="isOpen"
        :id="panelId"
        class="app-dropdown__panel"
        :class="`app-dropdown__panel--${align}`"
        role="menu"
        :aria-label="label"
      >
        <template v-for="(item, i) in options" :key="i">
          <!-- Divider -->
          <div v-if="item.divider" class="app-dropdown__divider" role="separator" />

          <!-- Option -->
          <button
            v-else
            :id="`${panelId}-item-${i}`"
            class="app-dropdown__item"
            :class="{ 'app-dropdown__item--danger': item.danger }"
            role="menuitem"
            :disabled="item.disabled"
            @click="handleClick(item)"
          >
            <!-- Optional icon -->
            <span v-if="item.icon" class="app-dropdown__item-icon" aria-hidden="true" v-html="item.icon" />
            <span class="app-dropdown__item-label">{{ item.label }}</span>
            <!-- Optional right badge -->
            <span v-if="item.badge" class="app-dropdown__item-badge">{{ item.badge }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DropdownOption {
  label:    string
  value?:   string
  icon?:    string   // raw SVG string
  badge?:   string
  danger?:  boolean
  disabled?: boolean
  divider?: false    // never true for real options
}

export interface DropdownDivider {
  divider: true
  label?:  never
  value?:  never
}

export type DropdownItem = DropdownOption | DropdownDivider

// ── Props & Emits ─────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  options:  DropdownItem[]
  align?:   'left' | 'right'
  label?:   string
  panelId?: string
}>(), {
  align:   'right',
  label:   'Options menu',
  panelId: () => `dd-panel-${Math.random().toString(36).slice(2, 7)}`,
})

const emit = defineEmits<{
  select: [item: DropdownOption]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

function toggle() { isOpen.value = !isOpen.value }
function close()  { isOpen.value = false }

function handleClick(item: DropdownItem) {
  if ('divider' in item && item.divider) return
  const opt = item as DropdownOption
  if (opt.disabled) return
  emit('select', opt)
  close()
}

// ── Click-outside to close ────────────────────────────────────────────────────

function onPointerDown(event: PointerEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) close()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
onUnmounted(() => document.removeEventListener('pointerdown', onPointerDown, true))
</script>

<style scoped>
.app-dropdown {
  position: relative;
  display: inline-block;
}

/* ── Panel ── */
/* Strictly flat: #181818 bg, 1px solid #262626 border, NO shadow, NO blur */
.app-dropdown__panel {
  position: absolute;
  top: calc(100% + 6px);
  min-width: 190px;
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-lg);
  overflow: hidden;
  z-index: 300;
  box-shadow: none;
}
.app-dropdown__panel--right { right: 0; }
.app-dropdown__panel--left  { left:  0; }

/* ── Items ── */
.app-dropdown__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family-base);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.app-dropdown__item:hover:not(:disabled) {
  background: #222222;
  color: var(--color-text-primary);
}
.app-dropdown__item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.app-dropdown__item--danger       { color: #ed4956; }
.app-dropdown__item--danger:hover { background: #1a0e0e; color: #ff6b75; }

.app-dropdown__item-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  color: inherit;
}
.app-dropdown__item-label { flex: 1; }
.app-dropdown__item-badge {
  font-size: 10px;
  background: #2a2a2a;
  color: var(--color-text-muted);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  border: 1px solid #333;
}

/* ── Divider ── */
.app-dropdown__divider {
  height: 1px;
  background: #262626;
  margin: 2px 0;
}

/* ── Transition ── */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-fade-enter-from,
.dropdown-fade-leave-to     { opacity: 0; transform: translateY(-4px); }
</style>
