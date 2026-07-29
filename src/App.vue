<template>
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>

  <!-- ── Global Toast ── -->
  <Transition name="toast-slide">
    <div
      v-if="settingsStore.toast.visible"
      class="global-toast"
      :class="`global-toast--${settingsStore.toast.type}`"
      role="status"
      aria-live="polite"
    >
      <svg v-if="settingsStore.toast.type === 'success'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <template v-if="settingsStore.toast.content.kind === 'key'">
        {{ t(settingsStore.toast.content.key, settingsStore.toast.content.params as any) }}
      </template>
      <template v-else>
        {{ settingsStore.toast.content.text }}
      </template>
    </div>
  </Transition>

  <!-- ── Stacked Message Toasts ── -->
  <MessageToastContainer />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/store/useAuthStore'
import { useChatStore } from '@/store/useChatStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useLocaleStore } from '@/store/useLocaleStore'
import MessageToastContainer from '@/components/common/MessageToastContainer.vue'

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const localeStore = useLocaleStore()

// Watch both current route titleKey and localeStore.currentLocale to reactively update document.title
watch(
  [() => route.meta.titleKey, () => localeStore.currentLocale],
  ([titleKey]) => {
    if (titleKey) {
      document.title = t(titleKey as string)
    } else {
      document.title = 'DreamScape'
    }
  },
  { immediate: true }
)

onMounted(async () => {
  registerZoomGuards()

  // Only fetch if the user is authenticated — avoids pointless 401 calls
  if (authStore.isLoggedIn) {
    try {
      await chatStore.loadConversations()
    } catch (err) {
      console.warn('Failed to load conversations on mount:', err)
    }
  }
})

onUnmounted(() => {
  unregisterZoomGuards()
})

function registerZoomGuards(): void {
  document.addEventListener('gesturestart', preventBrowserZoom, { passive: false })
  document.addEventListener('gesturechange', preventBrowserZoom, { passive: false })
  document.addEventListener('touchmove', preventMultiTouchZoom, { passive: false })
  window.addEventListener('wheel', preventTrackpadZoom, { passive: false })
}

function unregisterZoomGuards(): void {
  document.removeEventListener('gesturestart', preventBrowserZoom)
  document.removeEventListener('gesturechange', preventBrowserZoom)
  document.removeEventListener('touchmove', preventMultiTouchZoom)
  window.removeEventListener('wheel', preventTrackpadZoom)
}

function preventBrowserZoom(event: Event): void {
  if (event.cancelable) event.preventDefault()
}

function preventMultiTouchZoom(event: TouchEvent): void {
  if (event.touches.length > 1 && event.cancelable) event.preventDefault()
}

function preventTrackpadZoom(event: WheelEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.cancelable) event.preventDefault()
}
</script>

<style>
/* Global Toast styles (Strict Flat Design, no gradients, no shadows) */
.global-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-5, 20px);
  border-radius: var(--radius-lg, 8px);
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  white-space: nowrap;
}
.global-toast--success {
  background: #1a3d2e;
  color: #4ade80;
  border: 1px solid #2d5a42;
}
.global-toast--error {
  background: #2d1010;
  color: #ed4956;
  border: 1px solid #3d1515;
}

.toast-slide-enter-active, .toast-slide-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

@media (max-width: 767px) {
  .global-toast {
    top: max(8px, var(--safe-area-top));
    width: calc(100vw - max(24px, var(--safe-area-left) + var(--safe-area-right) + 16px));
    max-width: 420px;
    justify-content: center;
    padding: 10px 14px;
    text-align: center;
    white-space: normal;
  }
}
</style>
