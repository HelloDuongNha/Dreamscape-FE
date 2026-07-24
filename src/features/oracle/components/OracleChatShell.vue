<template>
  <main class="oracle-chat-shell" role="main" :aria-label="t('oracle.chatArea')">
    <button
      class="oracle-chat-shell__sidebar-toggle"
      :aria-expanded="isSidebarOpen"
      aria-controls="oracle-thread-sidebar"
      :aria-label="isSidebarOpen ? t('oracle.closeSidebar') : t('oracle.openSidebar')"
      :title="isSidebarOpen ? t('oracle.closeSidebar') : t('oracle.openSidebar')"
      @click="$emit('toggle-sidebar')"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    <header v-if="threadTitle" class="oracle-chat-shell__thread-header">
      <div class="oracle-chat-shell__thread-title" :title="threadTitle">{{ threadTitle }}</div>
    </header>

    <!-- Chat Area Content -->
    <div ref="scrollBody" class="oracle-chat-shell__body">
      <!-- Welcome State (when no messages exist) -->
      <div v-if="messages.length === 0" class="oracle-welcome">
        <div class="oracle-welcome__mark" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 12c1.5-2.5 5.5-2.5 7 0-1.5 2.5-5.5 2.5-7 0Z" />
            <circle cx="12" cy="12" r="1.3" />
          </svg>
        </div>
        <h2 class="oracle-welcome__title">{{ t('oracle.welcomeTitle') }}</h2>
        <p class="oracle-welcome__desc">{{ t('oracle.welcomeDescription') }}</p>
      </div>

      <!-- Empty Chat Timeline Reserved Space -->
      <div v-else class="oracle-timeline" role="log" aria-live="polite">
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="['oracle-msg', `oracle-msg--${msg.role}`]"
        >
          <div v-if="msg.role === 'assistant'" class="oracle-msg__identity">
            <span class="oracle-msg__mark" aria-hidden="true">◈</span>
            <span>Oracle</span>
            <span v-if="msg.runState" class="oracle-msg__timing">{{ timingLabel(msg) }}</span>
          </div>
          <div class="oracle-msg__bubble">
            <OracleMessageContent
              v-if="msg.content"
              :content="msg.content"
              @open-citation="$emit('open-citation', msg, $event)"
            />
            <span
              v-else-if="msg.runState === 'thinking' || msg.runState === 'preparing' || msg.runState === 'responding'"
              class="oracle-msg__thinking"
              aria-live="polite"
            >
              <i /><i /><i />
            </span>
          </div>
          <div v-if="msg.role === 'user'" class="oracle-msg__user-tools">
            <AppCopyButton
              class="oracle-msg__copy"
              :text="msg.content"
              :label="t('oracle.copyMessage')"
              :copied-label="t('oracle.copiedMessage')"
              :success-message="t('oracle.copiedMessageToast')"
              :error-message="t('oracle.copyMessageFailed')"
            />
            <button type="button" :title="t('oracle.editMessage')" :aria-label="t('oracle.editMessage')" @click="startEditing(msg)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
              </svg>
            </button>
            <span v-if="msg.branch" class="oracle-msg__branch-nav">
              <button
                type="button"
                :disabled="!msg.branch.previousLeafId"
                :aria-label="t('oracle.previousBranch')"
                @click="msg.branch.previousLeafId && $emit('select-branch', msg.branch.previousLeafId)"
              >‹</button>
              <span>{{ msg.branch.index }}/{{ msg.branch.total }}</span>
              <button
                type="button"
                :disabled="!msg.branch.nextLeafId"
                :aria-label="t('oracle.nextBranch')"
                @click="msg.branch.nextLeafId && $emit('select-branch', msg.branch.nextLeafId)"
              >›</button>
            </span>
          </div>
          <div v-if="msg.role === 'assistant' && msg.citations?.length" class="oracle-sources">
            <div class="oracle-sources__label">{{ t('oracle.references') }}</div>
            <div class="oracle-sources__grid">
              <button
                v-for="citation in msg.citations"
                :key="`${msg.id}:${citation.index}`"
                class="oracle-source-card"
                type="button"
                @click="$emit('open-citation', msg, citation.index)"
              >
                <span class="oracle-source-card__index">[{{ citation.index }}]</span>
                <span class="oracle-source-card__body">
                  <strong>{{ citation.title }}</strong>
                  <small>{{ sourceTypeLabel(citation.sourceType) }}</small>
                  <span v-if="citation.sourceType === 'academic_source' && (citation.ruleLinks?.length || 0) > 1">
                    {{ t('oracle.sourceMultipleRules', { count: citation.ruleLinks?.length || 0 }) }}
                  </span>
                  <span v-else>{{ citation.excerpt }}</span>
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Composer -->
    <footer class="oracle-chat-shell__footer">
      <div v-if="suggestedPrompts.length && !isSending" class="oracle-suggestions">
        <div
          ref="suggestionsTrack"
          class="oracle-suggestions__track"
          @wheel="handleSuggestionWheel"
        >
          <button
            v-for="suggestion in suggestedPrompts"
            :key="suggestion"
            type="button"
            @click="$emit('send', suggestion)"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>
      <div v-if="editingMessage" class="oracle-edit-context" role="status">
        <div>
          <strong>{{ t('oracle.editingMessage') }}</strong>
          <span>{{ editingMessage.content }}</span>
        </div>
        <button type="button" :aria-label="t('oracle.cancelEdit')" :title="t('oracle.cancelEdit')" @click="cancelEditing">
          ×
        </button>
      </div>
      <OracleComposer
        ref="composer"
        :is-sending="isSending"
        :wait-for-complete="waitForComplete"
        :context-usage="contextUsage"
        :context-message-count="contextMessageCount"
        @update:wait-for-complete="$emit('update:waitForComplete', $event)"
        @send="handleComposerSend"
        @cancel="$emit('cancel')"
      />
    </footer>
  </main>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OracleComposer from './OracleComposer.vue'
import OracleMessageContent from './OracleMessageContent.vue'
import AppCopyButton from '@/components/common/AppCopyButton.vue'
import type { OracleShellMessage } from '../oracleShell.types'

const props = withDefaults(
  defineProps<{
    messages?: OracleShellMessage[]
    isSidebarOpen?: boolean
    threadTitle?: string
    isSending?: boolean
    suggestedPrompts?: string[]
    waitForComplete?: boolean
    contextUsage?: OracleShellMessage['contextUsage']
    contextMessageCount?: number
    runEstimate?: { expectedMinMs?: number | null; expectedMaxMs?: number | null }
  }>(),
  {
    messages: () => [],
    isSidebarOpen: false,
    threadTitle: '',
    isSending: false,
    suggestedPrompts: () => [],
    waitForComplete: false,
    contextUsage: undefined,
    contextMessageCount: 0,
    runEstimate: undefined,
  }
)

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'send', content: string): void
  (e: 'cancel'): void
  (e: 'open-citation', message: OracleShellMessage, index: number): void
  (e: 'update:waitForComplete', value: boolean): void
  (e: 'edit-message', message: OracleShellMessage, content: string): void
  (e: 'select-branch', leafId: string): void
}>()

const { t } = useI18n()
const scrollBody = ref<HTMLElement | null>(null)
const composer = ref<InstanceType<typeof OracleComposer> | null>(null)
const suggestionsTrack = ref<HTMLElement | null>(null)
const clock = ref(Date.now())
const editingMessage = ref<OracleShellMessage | null>(null)
let clockTimer: number | null = null

function syncClock(active: boolean) {
  if (active && clockTimer === null) {
    clock.value = Date.now()
    clockTimer = window.setInterval(() => { clock.value = Date.now() }, 1000)
    return
  }
  if (!active && clockTimer !== null) {
    window.clearInterval(clockTimer)
    clockTimer = null
  }
}

onBeforeUnmount(() => {
  if (clockTimer !== null) window.clearInterval(clockTimer)
})

watch(
  () => props.messages.some((message) =>
    ['thinking', 'preparing', 'responding'].includes(String(message.runState))),
  (active) => syncClock(active),
  { immediate: true },
)

watch(
  () => props.suggestedPrompts.join('|'),
  async () => {
    await nextTick()
    suggestionsTrack.value?.scrollTo({ left: 0 })
  },
)

watch(
  () => props.messages.map((message) => `${message.id}:${message.content.length}:${message.runState}`).join('|'),
  async () => {
    await nextTick()
    if (scrollBody.value) scrollBody.value.scrollTop = scrollBody.value.scrollHeight
  },
)

function timingLabel(message: OracleShellMessage): string {
  const start = message.startedAt
  if (!start) return ''
  const end = message.completedAt || clock.value
  const expectedMaxMs = message.expectedMaxMs || props.runEstimate?.expectedMaxMs || 0
  if (message.runState === 'thinking') {
    if (expectedMaxMs) {
      const elapsed = end - start
      if (elapsed < expectedMaxMs) {
        return t('oracle.thinkingWithUpperEta', {
          seconds: Math.max(0, Math.floor(elapsed / 1000)),
          high: compactDuration(expectedMaxMs - elapsed),
        })
      }
      return t('oracle.thinkingOverExpected', {
        seconds: Math.max(0, Math.floor(elapsed / 1000)),
        over: compactDuration(Math.max(1_000, elapsed - expectedMaxMs)),
      })
    }
    return t('oracle.thinkingFor', { seconds: Math.max(0, Math.floor((end - start) / 1000)) })
  }
  if (message.runState === 'preparing') {
    const thoughtEnd = message.thoughtCompletedAt || end
    const elapsed = end - start
    const values = {
      thought: Math.max(0, Math.ceil((thoughtEnd - start) / 1000)),
      preparing: Math.max(0, Math.floor((end - thoughtEnd) / 1000)),
    }
    if (expectedMaxMs) {
      if (elapsed < expectedMaxMs) {
        return t('oracle.thoughtThenPreparingWithEta', {
          ...values,
          high: compactDuration(expectedMaxMs - elapsed),
        })
      }
      return t('oracle.thoughtThenPreparingOverExpected', {
        ...values,
        over: compactDuration(Math.max(1_000, elapsed - expectedMaxMs)),
      })
    }
    return t('oracle.thoughtThenPreparing', {
      ...values,
    })
  }
  if (message.runState === 'responding') {
    const thoughtEnd = message.thoughtCompletedAt || message.firstTokenAt || start
    const revealStart = message.presentationStartedAt || thoughtEnd
    return t('oracle.thoughtThenRevealing', {
      thought: Math.max(0, Math.ceil((thoughtEnd - start) / 1000)),
      revealing: Math.max(0, Math.floor((end - revealStart) / 1000)),
    })
  }
  if (message.runState === 'completed' && message.thoughtCompletedAt) {
    const thought = compactDuration(Math.max(0, message.thoughtCompletedAt - start))
    const preparing = compactDuration(Math.max(0, end - message.thoughtCompletedAt))
    if (expectedMaxMs) {
      const difference = end - start - expectedMaxMs
      if (difference > 1_000) {
        return t('oracle.completedTimingLate', {
          thought,
          preparing,
          difference: compactDuration(difference),
        })
      }
      if (difference < -1_000) {
        return t('oracle.completedTimingEarly', {
          thought,
          preparing,
          difference: compactDuration(Math.abs(difference)),
        })
      }
    }
    return t('oracle.completedTiming', { thought, preparing })
  }
  return t('oracle.respondedIn', { seconds: Math.max(0, Math.ceil((end - start) / 1000)) })
}

function compactDuration(ms: number): string {
  const seconds = ms > 0 ? Math.max(1, Math.round(ms / 1000)) : 0
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function sourceTypeLabel(type: NonNullable<OracleShellMessage['citations']>[number]['sourceType']): string {
  if (type === 'academic_source') return t('oracle.academicSource')
  if (type === 'own_dream') return t('oracle.ownDreamSource')
  return t('oracle.publicDreamSource')
}

function handleSuggestionWheel(event: WheelEvent) {
  if (!suggestionsTrack.value || suggestionsTrack.value.scrollWidth <= suggestionsTrack.value.clientWidth) return
  if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    event.preventDefault()
    suggestionsTrack.value.scrollBy({ left: event.deltaY, behavior: 'auto' })
  }
}

function startEditing(message: OracleShellMessage) {
  editingMessage.value = message
  void nextTick(() => composer.value?.setContent(message.content))
}

function cancelEditing() {
  editingMessage.value = null
  composer.value?.clear()
  composer.value?.focus()
}

function handleComposerSend(content: string) {
  if (editingMessage.value) {
    const message = editingMessage.value
    editingMessage.value = null
    emit('edit-message', message, content)
    return
  }
  emit('send', content)
}

function focusComposer() {
  composer.value?.focus()
}

defineExpose({ focusComposer })
</script>

<style scoped>
.oracle-chat-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-base, #0a0a0a);
  min-width: 0;
  position: relative;
}

.oracle-chat-shell__sidebar-toggle {
  display: none;
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  z-index: 2;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
}
.oracle-chat-shell__sidebar-toggle:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

.oracle-chat-shell__thread-header {
  display: flex;
  min-height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--color-border);
}

.oracle-chat-shell__thread-title {
  max-width: min(56vw, 520px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

/* Body */
.oracle-chat-shell__body {
  flex: 1;
  overflow-y: auto;
  padding: clamp(24px, 5vh, 64px) var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  scroll-behavior: smooth;
}

/* Welcome Screen */
.oracle-welcome {
  max-width: 580px;
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  margin: auto;
}

.oracle-welcome__mark {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.oracle-welcome__title {
  font-size: clamp(24px, 3vw, 32px);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.oracle-welcome__desc {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  margin: 0;
  max-width: 480px;
  line-height: 1.65;
}

/* Timeline */
.oracle-timeline {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.oracle-msg {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.oracle-msg--user {
  align-items: flex-end;
}
.oracle-msg--assistant {
  align-items: flex-start;
}

.oracle-msg__bubble {
  max-width: min(82%, 680px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-radius: var(--radius-lg, 12px);
  font-size: 15px;
  line-height: 1.72;
}
.oracle-msg--user .oracle-msg__bubble {
  background: #ffffff;
  color: #080808;
  -webkit-text-fill-color: #080808;
  font-weight: 500;
  border-bottom-right-radius: 4px;
}

.oracle-msg__user-tools {
  display: flex;
  min-height: 24px;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.25rem;
  opacity: 1;
}

.oracle-msg__user-tools button {
  display: grid;
  min-width: 26px;
  height: 26px;
  padding: 0 0.45rem;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
}

.oracle-msg__user-tools button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.oracle-msg__user-tools button:disabled {
  cursor: default;
  opacity: 0.3;
}

.oracle-msg__branch-nav {
  display: inline-flex;
  align-items: center;
  color: var(--color-text-muted);
  font-size: 0.7rem;
}

.oracle-edit-context {
  display: flex;
  width: 100%;
  max-width: 800px;
  margin: 0 auto -0.35rem;
  padding: 0.6rem 0.85rem 0.8rem;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--color-border-input);
  border-bottom: 0;
  border-radius: 14px 14px 0 0;
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
}

.oracle-edit-context > div {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.oracle-edit-context strong {
  color: var(--color-text-primary);
  font-size: 0.72rem;
}

.oracle-edit-context span {
  overflow: hidden;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oracle-edit-context button {
  display: grid;
  width: 25px;
  height: 25px;
  flex: 0 0 25px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.15rem;
}

.oracle-edit-context button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.oracle-msg--user .oracle-msg__bubble :deep(.oracle-content),
.oracle-msg--user .oracle-msg__bubble :deep(.oracle-content strong) {
  color: #080808;
  -webkit-text-fill-color: #080808;
}

.oracle-msg--user .oracle-msg__bubble::selection,
.oracle-msg--user .oracle-msg__bubble *::selection {
  color: #ffffff;
  -webkit-text-fill-color: #ffffff;
  background: #2457d6;
}
.oracle-msg--assistant .oracle-msg__bubble {
  max-width: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--color-text-primary, #f7f7f8);
}

.oracle-msg__identity {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.65rem;
  color: var(--color-text-primary, #f7f7f8);
  font-size: 0.78rem;
  font-weight: 650;
}

.oracle-msg__mark {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid var(--color-border, #303030);
  border-radius: 8px;
  background: var(--color-bg-elevated, #171717);
}

.oracle-msg__timing {
  color: var(--color-text-tertiary, #9a9a9a);
  font-weight: 450;
}

.oracle-msg__thinking {
  display: inline-flex;
  gap: 5px;
  padding: 0.55rem 0;
}

.oracle-msg__thinking i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: oracle-pulse 1s ease-in-out infinite;
}

.oracle-msg__thinking i:nth-child(2) { animation-delay: 0.15s; }
.oracle-msg__thinking i:nth-child(3) { animation-delay: 0.3s; }

@keyframes oracle-pulse {
  0%, 70%, 100% { opacity: 0.25; transform: translateY(0); }
  35% { opacity: 1; transform: translateY(-2px); }
}

.oracle-sources {
  width: 100%;
  margin-top: 1rem;
}

.oracle-sources__label {
  margin-bottom: 0.55rem;
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.oracle-sources__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.55rem;
}

.oracle-source-card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  padding: 0.72rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  cursor: pointer;
  text-align: left;
}

.oracle-source-card:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-hover);
}

.oracle-source-card__index {
  color: var(--color-primary, #8aa7ff);
  font-size: 0.75rem;
  font-weight: 700;
}

.oracle-source-card__body {
  display: grid;
  flex: 1;
  min-width: 0;
}

.oracle-source-card__body strong {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oracle-source-card__body small {
  color: var(--color-text-muted);
  font-size: 0.68rem;
}

.oracle-source-card__body span {
  display: -webkit-box;
  margin-top: 0.28rem;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 0.68rem;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.oracle-suggestions {
  display: flex;
  gap: 0.5rem;
  max-width: 800px;
  margin: 0 auto 0.65rem;
  align-items: center;
  overflow: hidden;
}

.oracle-suggestions__track {
  display: flex;
  width: 100%;
  gap: 0.5rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
}

.oracle-suggestions__track::-webkit-scrollbar { display: none; }

.oracle-suggestions__track button {
  flex: 0 0 auto;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
}

.oracle-suggestions__track button:hover {
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

/* Footer */
.oracle-chat-shell__footer {
  padding: 0 var(--space-5) var(--space-5);
  background: linear-gradient(to top, var(--color-bg-base) 78%, transparent);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .oracle-chat-shell__sidebar-toggle {
    display: flex;
  }
}
</style>
