<template>
  <Teleport to="body">
    <Transition name="share-modal">
      <div
        v-if="shareStore.post"
        class="share-modal__overlay"
        role="presentation"
        @click.self="shareStore.close()"
      >
        <section
          ref="dialogRef"
          class="share-modal"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <header class="share-modal__header">
            <div>
              <h2 :id="titleId">{{ t('home.share.title') }}</h2>
              <p>{{ t('home.share.subtitle') }}</p>
            </div>
            <button
              type="button"
              class="share-modal__close"
              :aria-label="t('home.share.close')"
              @click="shareStore.close()"
            >×</button>
          </header>

          <div class="share-modal__body">
            <div v-if="chatStore.isLoadingConvs" class="share-modal__state">
              {{ t('home.share.loadingChats') }}
            </div>
            <div
              v-else-if="!chatStore.conversationsWithPartner.length"
              class="share-modal__state"
            >
              {{ t('home.share.noChats') }}
            </div>
            <ul v-else class="share-modal__people">
              <li
                v-for="item in chatStore.conversationsWithPartner"
                :key="item.conversation._id"
              >
                <label class="share-person">
                  <UserAvatar :user="item.partner" size="md" />
                  <span class="share-person__identity">
                    <strong translate="no">{{ item.partner.display_name }}</strong>
                    <small translate="no">{{ formatUsername(item.partner.username) }}</small>
                  </span>
                  <input
                    v-model="selectedConversationIds"
                    type="checkbox"
                    :value="item.conversation._id"
                    :disabled="isSending"
                  >
                  <span class="share-person__checkbox" aria-hidden="true">✓</span>
                </label>
              </li>
            </ul>
          </div>

          <footer class="share-modal__footer">
            <AppButton
              v-if="chatStore.conversationsWithPartner.length"
              block
              :loading="isSending"
              :disabled="selectedConversationIds.length === 0"
              @click="sendToSelectedChats"
            >
              {{ t('home.share.send', { count: selectedConversationIds.length }) }}
            </AppButton>

            <label class="share-modal__link-label" :for="linkInputId">
              {{ t('home.share.copyLinkLabel') }}
            </label>
            <div class="share-link">
              <input
                :id="linkInputId"
                :value="shareUrl"
                type="text"
                readonly
                @focus="selectLinkInput"
              >
              <button
                type="button"
                class="share-link__copy"
                :class="{ 'share-link__copy--done': copied }"
                :aria-label="copied ? t('home.share.copied') : t('home.share.copy')"
                @click="copyLink"
              >
                <svg v-if="!copied" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="11" height="11" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 12 4 4L19 6"/>
                </svg>
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppButton from '@/components/common/AppButton.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { useChatStore } from '@/store/useChatStore'
import { useAuthStore } from '@/store/useAuthStore'
import { usePostShareStore } from '@/store/usePostShareStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { formatUsername } from '@/utils/username'
import { copyTextToClipboard } from '@/utils/clipboard'
import { PUBLIC_APP_URL } from '@/config/runtime'

const { t } = useI18n()
const router = useRouter()
const chatStore = useChatStore()
const authStore = useAuthStore()
const shareStore = usePostShareStore()
const settingsStore = useSettingsStore()
const selectedConversationIds = ref<string[]>([])
const isSending = ref(false)
const copied = ref(false)
const dialogRef = ref<HTMLElement | null>(null)
const titleId = `share-post-${Math.random().toString(36).slice(2, 8)}`
const linkInputId = `${titleId}-link`
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const shareUrl = computed(() => {
  const postId = shareStore.post?._id
  if (!postId) return ''
  const href = router.resolve({ name: 'shared-post', params: { id: postId } }).href
  return new URL(href, PUBLIC_APP_URL || window.location.origin).toString()
})

watch(
  () => shareStore.post?._id,
  async postId => {
    selectedConversationIds.value = []
    resetCopied()
    if (!postId) return
    if (authStore.isLoggedIn && !chatStore.conversations.length) {
      await chatStore.loadConversations().catch(() => undefined)
    }
    await nextTick()
    dialogRef.value?.focus()
  },
)

async function sendToSelectedChats(): Promise<void> {
  const post = shareStore.post
  if (!post || isSending.value || selectedConversationIds.value.length === 0) return
  isSending.value = true
  const selected = [...selectedConversationIds.value]
  const results = await Promise.all(selected.map(conversationId =>
    chatStore.sendMessageToConversation(conversationId, {
      content: t('messages.sharedPostPreview'),
      messageType: 'shared_post',
      sharedPostId: post._id,
    }),
  ))
  isSending.value = false

  const successCount = results.filter(Boolean).length
  if (successCount === selected.length) {
    settingsStore.showToastKey('home.share.sentSuccess', { count: successCount })
    shareStore.close()
    return
  }
  settingsStore.showToastKey(
    successCount > 0 ? 'home.share.sentPartial' : 'home.share.sentFailed',
    { success: successCount, total: selected.length },
    'error',
  )
}

async function copyLink(): Promise<void> {
  if (!shareUrl.value) return
  try {
    await copyTextToClipboard(shareUrl.value)
    copied.value = true
    settingsStore.showToastKey('home.share.copySuccess')
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
      copiedTimer = null
    }, 10_000)
  } catch {
    settingsStore.showToastKey('home.share.copyFailed', undefined, 'error')
  }
}

function resetCopied(): void {
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = null
  copied.value = false
}

function selectLinkInput(event: FocusEvent): void {
  ;(event.currentTarget as HTMLInputElement | null)?.select()
}

onBeforeUnmount(() => {
  resetCopied()
  shareStore.close()
})
</script>

<style scoped>
.share-modal__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal, 300);
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(0, 0, 0, .76);
}
.share-modal {
  width: min(480px, 100%);
  max-height: min(680px, calc(100dvh - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-bg-elevated);
  outline: none;
}
.share-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border-bottom: 1px solid var(--color-border);
}
.share-modal__header h2 { margin: 0; font-size: 19px; }
.share-modal__header p {
  margin: 5px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}
.share-modal__close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 22px;
}
.share-modal__body {
  min-height: 130px;
  overflow-y: auto;
  padding: 10px;
}
.share-modal__state {
  padding: 40px 16px;
  color: var(--color-text-muted);
  text-align: center;
}
.share-modal__people { margin: 0; padding: 0; list-style: none; }
.share-person {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 8px 10px;
  border-radius: var(--radius-lg);
  cursor: pointer;
}
.share-person:hover { background: var(--color-bg-hover); }
.share-person__identity {
  min-width: 0;
  display: grid;
  flex: 1;
}
.share-person__identity strong,
.share-person__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.share-person__identity small { color: var(--color-text-muted); }
.share-person input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.share-person__checkbox {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border-input);
  border-radius: 6px;
  color: transparent;
}
.share-person input:checked + .share-person__checkbox {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-primary-fg);
}
.share-modal__footer {
  display: grid;
  gap: 10px;
  padding: 16px 20px 20px;
  border-top: 1px solid var(--color-border);
}
.share-modal__link-label {
  color: var(--color-text-muted);
  font-size: 12px;
}
.share-link {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-lg);
}
.share-link input {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  outline: none;
}
.share-link__copy {
  width: 44px;
  display: grid;
  place-items: center;
  border: 0;
  border-left: 1px solid var(--color-border-input);
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  cursor: pointer;
}
.share-link__copy svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.share-link__copy--done { color: var(--color-success); }
.share-modal-enter-active,
.share-modal-leave-active { transition: opacity 150ms ease; }
.share-modal-enter-from,
.share-modal-leave-to { opacity: 0; }
@media (max-width: 560px) {
  .share-modal__overlay { align-items: end; padding: 0; }
  .share-modal {
    width: 100%;
    max-height: 82dvh;
    border-radius: 18px 18px 0 0;
  }
}
</style>
