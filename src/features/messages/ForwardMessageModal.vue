<template>
  <Teleport to="body">
    <Transition name="forward-modal">
      <div v-if="message" class="forward-modal__overlay" @click.self="$emit('close')">
        <section class="forward-modal" role="dialog" aria-modal="true" :aria-label="t('messages.forwardMessage')">
          <header>
            <div>
              <h2>{{ t('messages.forwardMessage') }}</h2>
              <p>{{ t('messages.forwardSubtitle') }}</p>
            </div>
            <button type="button" :aria-label="t('common.confirm.close')" @click="$emit('close')">×</button>
          </header>
          <ul>
            <li
              v-for="item in chatStore.conversationsWithPartner"
              :key="item.conversation._id"
            >
              <label>
                <UserAvatar :user="item.partner" size="md" />
                <span>
                  <strong translate="no">{{ item.partner.display_name }}</strong>
                  <small translate="no">{{ formatUsername(item.partner.username) }}</small>
                </span>
                <input
                  v-model="selected"
                  type="checkbox"
                  :value="item.conversation._id"
                  :disabled="sending"
                >
                <i aria-hidden="true">✓</i>
              </label>
            </li>
          </ul>
          <footer>
            <AppButton
              block
              :loading="sending"
              :disabled="selected.length === 0"
              @click="forward"
            >
              {{ t('messages.forwardToCount', { count: selected.length }) }}
            </AppButton>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ApiMessage } from '@/api/types'
import AppButton from '@/components/common/AppButton.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { useChatStore } from '@/store/useChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { formatUsername } from '@/utils/username'

const props = defineProps<{ message: ApiMessage | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const selected = ref<string[]>([])
const sending = ref(false)

watch(() => props.message?._id, () => {
  selected.value = []
})

async function forward(): Promise<void> {
  const message = props.message
  if (!message || sending.value || selected.value.length === 0) return
  sending.value = true
  const targets = [...selected.value]
  const results = await Promise.all(targets.map(conversationId =>
    chatStore.sendMessageToConversation(conversationId, {
      content: message.messageType === 'shared_post'
        ? t('messages.sharedPostPreview')
        : message.content,
      messageType: message.messageType,
      sharedPostId: message.sharedPostId,
      forwarded: true,
    }),
  ))
  sending.value = false
  const successCount = results.filter(Boolean).length
  if (successCount === targets.length) {
    settingsStore.showToastKey('messages.forwardSuccess', { count: successCount })
    emit('close')
    return
  }
  settingsStore.showToastKey('messages.forwardFailed', undefined, 'error')
}
</script>

<style scoped>
.forward-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 300);
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(0, 0, 0, .76);
}
.forward-modal {
  width: min(460px, 100%);
  max-height: min(650px, calc(100dvh - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-bg-elevated);
}
.forward-modal header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 19px;
  border-bottom: 1px solid var(--color-border);
}
.forward-modal h2 { margin: 0; font-size: 19px; }
.forward-modal p { margin: 4px 0 0; color: var(--color-text-muted); font-size: 13px; }
.forward-modal header button {
  width: 32px; height: 32px; border: 0; border-radius: 50%;
  background: var(--color-bg-surface); color: var(--color-text-primary);
  font-size: 22px; cursor: pointer;
}
.forward-modal ul { margin: 0; padding: 8px; list-style: none; overflow-y: auto; }
.forward-modal label {
  display: flex; align-items: center; gap: 11px; padding: 10px;
  border-radius: 11px; cursor: pointer;
}
.forward-modal label:hover { background: var(--color-bg-surface); }
.forward-modal label > span { min-width: 0; flex: 1; display: grid; }
.forward-modal label strong,
.forward-modal label small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.forward-modal label small { color: var(--color-text-muted); font-size: 12px; }
.forward-modal input { position: absolute; opacity: 0; pointer-events: none; }
.forward-modal i {
  width: 22px; height: 22px; display: grid; place-items: center;
  border: 1px solid var(--color-border); border-radius: 50%;
  color: transparent; font-style: normal; font-size: 12px;
}
.forward-modal input:checked + i { border-color: #f3f5f7; background: #f3f5f7; color: #101010; }
.forward-modal footer { padding: 14px 18px 18px; border-top: 1px solid var(--color-border); }
.forward-modal-enter-active,
.forward-modal-leave-active { transition: opacity 150ms ease; }
.forward-modal-enter-from,
.forward-modal-leave-to { opacity: 0; }
</style>
