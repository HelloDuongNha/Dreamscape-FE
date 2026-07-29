<template>
  <div v-if="items.length" class="oracle-prompt-queue" aria-live="polite">
    <div class="oracle-prompt-queue__header">
      <span>{{ t('oracle.promptQueueTitle') }}</span>
      <small>{{ t('oracle.promptQueueCount', { count: items.length }) }}</small>
    </div>
    <button
      v-for="(item, index) in items"
      :key="item.id"
      type="button"
      class="oracle-prompt-queue__item"
      @click="openEditor(item)"
    >
      <span class="oracle-prompt-queue__position">{{ index + 1 }}</span>
      <span class="oracle-prompt-queue__content">{{ item.content }}</span>
      <span class="oracle-prompt-queue__edit">{{ t('oracle.promptQueueEdit') }}</span>
    </button>
  </div>

  <Teleport to="body">
    <Transition name="oracle-queue-modal">
      <div
        v-if="editingItem"
        class="oracle-queue-editor__overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('oracle.promptQueueEditTitle')"
        @click.self="closeEditor"
        @keydown.esc="closeEditor"
      >
        <section class="oracle-queue-editor">
          <header>
            <div>
              <strong>{{ t('oracle.promptQueueEditTitle') }}</strong>
              <span>{{ t('oracle.promptQueueEditHint') }}</span>
            </div>
            <button type="button" :aria-label="t('oracle.cancel')" @click="closeEditor">×</button>
          </header>
          <textarea
            ref="editor"
            v-model="draft"
            rows="5"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
            @keydown.enter.exact="confirmWithEnter"
          />
          <footer>
            <AppButton variant="danger-outline" size="sm" @click="removeEditingItem">
              {{ t('oracle.promptQueueDelete') }}
            </AppButton>
            <div>
              <AppButton variant="ghost" size="sm" @click="closeEditor">
                {{ t('oracle.cancel') }}
              </AppButton>
              <AppButton variant="smart" size="sm" :disabled="!draft.trim()" @click="confirmEdit">
                {{ t('oracle.promptQueueConfirm') }}
              </AppButton>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/common/AppButton.vue'
import type { QueuedOraclePrompt } from '@/store/useOracleChatStore'

defineProps<{ items: QueuedOraclePrompt[] }>()

const emit = defineEmits<{
  edit: [id: string, content: string]
  remove: [id: string]
  'editing-change': [editing: boolean]
}>()

const { t } = useI18n()
const editingItem = ref<QueuedOraclePrompt | null>(null)
const draft = ref('')
const editor = ref<HTMLTextAreaElement | null>(null)
const isComposing = ref(false)

function openEditor(item: QueuedOraclePrompt) {
  editingItem.value = item
  draft.value = item.content
  emit('editing-change', true)
  void nextTick(() => {
    editor.value?.focus()
    editor.value?.setSelectionRange(draft.value.length, draft.value.length)
  })
}

function closeEditor() {
  editingItem.value = null
  draft.value = ''
  emit('editing-change', false)
}

function confirmEdit() {
  if (!editingItem.value || !draft.value.trim()) return
  emit('edit', editingItem.value.id, draft.value.trim())
  closeEditor()
}

function confirmWithEnter(event: KeyboardEvent) {
  if (event.isComposing || isComposing.value || event.keyCode === 229) return
  event.preventDefault()
  confirmEdit()
}

function removeEditingItem() {
  if (!editingItem.value) return
  emit('remove', editingItem.value.id)
  closeEditor()
}
</script>

<style scoped>
.oracle-prompt-queue {
  display: grid;
  width: 100%;
  max-width: 800px;
  max-height: 180px;
  margin: 0 auto var(--space-2);
  gap: 6px;
  overflow-y: auto;
}

.oracle-prompt-queue__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.oracle-prompt-queue__header small {
  color: var(--color-text-muted);
}

.oracle-prompt-queue__item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
}

.oracle-prompt-queue__item:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-hover);
}

.oracle-prompt-queue__position {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 7px;
  background: var(--color-bg-active);
  color: var(--color-text-secondary);
  font-size: 10px;
}

.oracle-prompt-queue__content {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oracle-prompt-queue__edit {
  color: var(--color-text-muted);
  font-size: 10px;
}

.oracle-queue-editor__overlay {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.72);
}

.oracle-queue-editor {
  width: min(620px, 100%);
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-bg-elevated);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.36);
}

.oracle-queue-editor header,
.oracle-queue-editor footer,
.oracle-queue-editor footer > div {
  display: flex;
  align-items: center;
}

.oracle-queue-editor header,
.oracle-queue-editor footer {
  justify-content: space-between;
  gap: 12px;
}

.oracle-queue-editor header div {
  display: grid;
  gap: 3px;
}

.oracle-queue-editor header span {
  color: var(--color-text-muted);
  font-size: 11px;
}

.oracle-queue-editor header button {
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 22px;
}

.oracle-queue-editor textarea {
  width: 100%;
  min-height: 130px;
  margin: 16px 0;
  padding: 12px;
  resize: vertical;
  border: 1px solid var(--color-border-input);
  border-radius: 12px;
  outline: none;
  background: var(--color-bg-base);
  color: var(--color-text-primary);
  font: inherit;
  line-height: 1.55;
}

.oracle-queue-editor textarea:focus {
  border-color: var(--color-border-hover);
}

.oracle-queue-editor footer > div {
  gap: 8px;
}

.oracle-queue-modal-enter-active,
.oracle-queue-modal-leave-active {
  transition: opacity 150ms ease;
}

.oracle-queue-modal-enter-from,
.oracle-queue-modal-leave-to {
  opacity: 0;
}
</style>
