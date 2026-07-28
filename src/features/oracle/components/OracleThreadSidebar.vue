<template>
  <div>
    <!-- Mobile Backdrop Overlay -->
    <div
      v-if="isOpen"
      class="oracle-sidebar-backdrop"
      aria-hidden="true"
      @click="closeSidebar"
    />

    <!-- Sidebar Container -->
    <aside
      id="oracle-thread-sidebar"
      :class="['oracle-sidebar', { 'oracle-sidebar--open': isOpen }]"
      :role="isMobile ? 'dialog' : 'region'"
      :aria-modal="isMobile ? 'true' : undefined"
      :aria-label="t('oracle.conversations')"
    >
      <div class="oracle-sidebar__top">
        <AppButton
          variant="ghost"
          size="md"
          block
          class="oracle-sidebar__new-btn"
          :aria-label="t('oracle.newConversation')"
          @click="$emit('new-thread')"
        >
          <svg class="oracle-sidebar__new-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
          </svg>
          <span>{{ t('oracle.newConversation') }}</span>
        </AppButton>
        <button
          type="button"
          class="oracle-sidebar__connection-btn"
          :aria-label="t('oracle.modelConnections')"
          :title="t('oracle.modelConnections')"
          @click="$emit('manage-connections')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M7 10V7a5 5 0 0 1 10 0v3" /><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M12 14v2" />
          </svg>
        </button>

        <button
          v-if="isMobile"
          class="oracle-sidebar__close-btn"
          :aria-label="t('oracle.closeSidebar')"
          :title="t('oracle.closeSidebar')"
          @click="closeSidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Search Bar -->
      <div class="oracle-sidebar__search-wrap">
        <label for="oracle-thread-search" class="sr-only">{{ t('oracle.searchConversations') }}</label>
        <div class="oracle-sidebar__search">
          <svg class="oracle-sidebar__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="oracle-thread-search"
            v-model="searchQuery"
            type="search"
            :placeholder="t('oracle.searchConversations')"
            autocomplete="off"
            spellcheck="false"
            class="oracle-sidebar__search-input"
          />
        </div>
      </div>

      <!-- Thread List Content -->
      <div class="oracle-sidebar__content">
        <ul v-if="filteredThreads.length > 0" class="oracle-sidebar__list" role="list">
          <li
            v-for="thread in filteredThreads"
            :key="thread.id"
            :class="['oracle-sidebar__item', { 'oracle-sidebar__item--active': activeThreadId === thread.id }]"
            @click="$emit('select-thread', thread.id)"
          >
            <input
              v-if="editingThreadId === thread.id"
              ref="renameInputs"
              v-model="renameDraft"
              class="oracle-sidebar__rename-input"
              :aria-label="t('oracle.renameConversation')"
              maxlength="120"
              @click.stop
              @keydown.enter.prevent="commitRename(thread.id)"
              @keydown.escape.prevent="cancelRename"
              @blur="commitRename(thread.id)"
            />
            <span v-else class="oracle-sidebar__item-title">
              <svg v-if="thread.pinned" class="oracle-sidebar__pin-mark" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="m15 4 5 5-4 2-3 5-2-2-5 5-1-1 5-5-2-2 5-3 2-4Z" />
              </svg>
              {{ thread.title }}
            </span>
            <span v-if="editingThreadId !== thread.id" class="oracle-sidebar__item-actions">
              <span v-if="thread.activeRunId" class="oracle-sidebar__run-spinner" :title="t('oracle.responseInProgress')" />
              <button
                v-else
                type="button"
                class="oracle-sidebar__item-action"
                :aria-label="t('oracle.conversationMenu')"
                :aria-expanded="openMenuThreadId === thread.id"
                @click.stop="toggleMenu(thread.id, $event)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                </svg>
              </button>
              <div
                v-if="openMenuThreadId === thread.id"
                :class="['oracle-sidebar__item-menu', { 'oracle-sidebar__item-menu--up': menuOpensUp }]"
                @click.stop
              >
                <button type="button" @click="emit('toggle-pin', thread.id); closeMenu()">
                  {{ thread.pinned ? t('oracle.unpinConversation') : t('oracle.pinConversation') }}
                </button>
                <button type="button" @click="startRename(thread); closeMenu()">{{ t('oracle.renameConversation') }}</button>
                <button type="button" class="oracle-sidebar__item-menu-danger" @click="emit('delete-thread', thread.id); closeMenu()">{{ t('oracle.deleteConversation') }}</button>
              </div>
            </span>
          </li>
        </ul>

        <!-- Empty State -->
        <div v-else-if="isLoading" class="oracle-sidebar__empty" role="status">
          <span class="oracle-sidebar__spinner" aria-hidden="true" />
          <p>{{ t('oracle.loadingConversations') }}</p>
        </div>
        <div v-else class="oracle-sidebar__empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p>{{ t('oracle.noConversations') }}</p>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/common/AppButton.vue'
import type { OracleThreadItem } from '../oracleShell.types'

const props = withDefaults(
  defineProps<{
    threads?: OracleThreadItem[]
    activeThreadId?: string | null
    isOpen?: boolean
    isLoading?: boolean
  }>(),
  {
    threads: () => [],
    activeThreadId: null,
    isOpen: false,
    isLoading: false,
  }
)

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
  (e: 'new-thread'): void
  (e: 'select-thread', id: string): void
  (e: 'rename-thread', id: string, title: string): void
  (e: 'toggle-pin', id: string): void
  (e: 'delete-thread', id: string): void
  (e: 'manage-connections'): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const searchQuery = ref('')
const isMobile = ref(false)
const editingThreadId = ref<string | null>(null)
const renameDraft = ref('')
const renameInputs = ref<HTMLInputElement[]>([])
const openMenuThreadId = ref<string | null>(null)
const menuOpensUp = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth <= 768
}

const filteredThreads = computed(() => {
  if (!searchQuery.value.trim()) return props.threads
  const query = searchQuery.value.toLowerCase()
  return props.threads.filter((t) => t.title.toLowerCase().includes(query))
})

function closeSidebar() {
  emit('update:isOpen', false)
  emit('close')
}

function startRename(thread: OracleThreadItem) {
  editingThreadId.value = thread.id
  renameDraft.value = thread.title
  void nextTick(() => renameInputs.value.at(-1)?.focus())
}

function toggleMenu(threadId: string, event: MouseEvent) {
  const button = event.currentTarget as HTMLElement | null
  menuOpensUp.value = Boolean(button && button.getBoundingClientRect().bottom + 132 > window.innerHeight)
  openMenuThreadId.value = openMenuThreadId.value === threadId ? null : threadId
}

function closeMenu() {
  openMenuThreadId.value = null
  menuOpensUp.value = false
}

function cancelRename() {
  editingThreadId.value = null
  renameDraft.value = ''
}

function commitRename(threadId: string) {
  if (editingThreadId.value !== threadId) return
  const title = renameDraft.value.trim()
  if (title) emit('rename-thread', threadId, title)
  cancelRename()
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) {
    closeSidebar()
  }
}

watch(
  () => props.isOpen,
  (val) => {
    if (val && isMobile.value) {
      window.addEventListener('keydown', handleKeyDown)
    } else {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }
)

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
/* Desktop layout */
.oracle-sidebar {
  width: 280px;
  height: 100%;
  background: var(--color-bg-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 10;
}

.oracle-sidebar__top {
  padding: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.oracle-sidebar__new-btn {
  flex: 1 1 auto;
  min-height: 36px;
  padding-block: 0.4rem;
  justify-content: flex-start;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  text-transform: none;
  letter-spacing: normal;
}

.oracle-sidebar__connection-btn {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.oracle-sidebar__connection-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.oracle-sidebar__new-btn :deep(.app-btn__label) {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-weight: var(--font-weight-medium);
}

.oracle-sidebar__new-icon {
  flex: 0 0 auto;
}

.oracle-sidebar__close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}
.oracle-sidebar__close-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

.oracle-sidebar__search-wrap {
  padding: 0 var(--space-3) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.oracle-sidebar__search {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
  padding: 0 var(--space-3);
  height: 38px;
}
.oracle-sidebar__search:focus-within {
  border-color: var(--color-border-hover);
}

.oracle-sidebar__search-icon {
  color: var(--color-text-muted, #737373);
  flex-shrink: 0;
  margin-right: var(--space-2, 8px);
}

.oracle-sidebar__search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text-primary, #ffffff);
  font-size: var(--font-size-sm, 13px);
  min-width: 0;
}
.oracle-sidebar__search-input::placeholder {
  color: var(--color-text-muted, #737373);
}

.oracle-sidebar__content {
  flex: 1;
  overflow-y: auto;
}

.oracle-sidebar__list {
  list-style: none;
  margin: 0;
  padding: var(--space-2, 8px);
}

.oracle-sidebar__item {
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  color: var(--color-text-secondary, #a3a3a3);
  font-size: var(--font-size-sm, 14px);
  transition: background 0.15s ease, color 0.15s ease;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  position: relative;
}
.oracle-sidebar__item:hover {
  background: var(--color-bg-hover, #262626);
  color: var(--color-text-primary, #ffffff);
}
.oracle-sidebar__item--active {
  background: var(--color-bg-selected, #262626);
  color: var(--color-text-primary, #ffffff);
  font-weight: var(--font-weight-semibold, 600);
}

.oracle-sidebar__item-title {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oracle-sidebar__pin-mark {
  flex: 0 0 auto;
  color: var(--color-text-muted);
}

.oracle-sidebar__item-actions {
  display: flex;
  flex: 0 0 auto;
  opacity: 1;
}

.oracle-sidebar__run-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary, #7890ff);
  border-radius: 50%;
  animation: oracle-spin 0.7s linear infinite;
}

.oracle-sidebar__item-action {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.oracle-sidebar__item-action:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.oracle-sidebar__item-action--danger:hover {
  color: var(--color-danger, #ed4956);
}

.oracle-sidebar__item-menu {
  position: absolute;
  top: calc(100% - 3px);
  right: 8px;
  z-index: 12;
  display: grid;
  min-width: 172px;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-elevated);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.32);
}

.oracle-sidebar__item-menu--up {
  top: auto;
  bottom: calc(100% - 3px);
}

.oracle-sidebar__item-menu button {
  padding: 0.62rem 0.72rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 0.76rem;
  text-align: left;
}

.oracle-sidebar__item-menu button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.oracle-sidebar__item-menu .oracle-sidebar__item-menu-danger {
  color: var(--color-danger, #ed4956);
}

.oracle-sidebar__rename-input {
  width: 100%;
  min-width: 0;
  height: 28px;
  border: 1px solid var(--color-border-strong, #404040);
  border-radius: var(--radius-sm);
  background: var(--color-bg-base);
  color: var(--color-text-primary);
  padding: 0 var(--space-2);
  outline: none;
}

.oracle-sidebar__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-text-primary);
  border-radius: 50%;
  animation: oracle-spin 0.7s linear infinite;
}

@keyframes oracle-spin {
  to { transform: rotate(360deg); }
}

.oracle-sidebar__empty {
  min-height: 180px;
  padding: var(--space-8) var(--space-5);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.oracle-sidebar__empty p {
  margin: 0;
  max-width: 180px;
  line-height: 1.5;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Mobile drawer overlay styling */
@media (max-width: 768px) {
  .oracle-sidebar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    z-index: var(--z-modal-backdrop, 100);
  }

  .oracle-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    z-index: var(--z-modal, 101);
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.5);
  }

  .oracle-sidebar--open {
    transform: translateX(0);
  }
}
</style>
