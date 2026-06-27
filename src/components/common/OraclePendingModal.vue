<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="oracleStore.isDialogVisible && oracleStore.trackedDream"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Oracle đang phân tích giấc mơ..."
        @click.self="oracleStore.minimizeDialog()"
        @keydown.esc="oracleStore.minimizeDialog()"
      >
        <div class="modal-container" tabindex="-1">
          <!-- Modal header -->
          <div class="modal-header">
            <div class="modal-author">
              <div class="modal-author__avatar" :style="{ background: avatarBg }">
                {{ initials }}
              </div>
              <div class="modal-author__info">
                <span class="modal-author__name">{{ displayUser.display_name }}</span>
                <span class="modal-author__username">@{{ displayUser.username }}</span>
              </div>
            </div>

            <div class="modal-header__right">
              <button
                class="modal-close-btn"
                aria-label="Minimize dialog"
                @click="oracleStore.minimizeDialog()"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="modal-body-scrollable">
            <div class="modal-content-block">
              <p class="modal-content-text">{{ oracleStore.trackedDream.content }}</p>
              <span class="modal-timestamp">Đang gửi...</span>
            </div>

            <!-- Pending Loading Content -->
            <div class="pending-analysis-box">
              <div class="loading-spinner-wrapper">
                <div class="spinner"></div>
              </div>
              
              <div class="progress-details">
                <span class="progress-text">{{ oracleStore.statusMessage }}</span>
                <span class="progress-percent">{{ oracleStore.progress }}%</span>
              </div>

              <!-- Progress bar -->
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" :style="{ width: `${oracleStore.progress}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOracleStore } from '@/store/useOracleStore'
import { useAuthStore } from '@/store/useAuthStore'
import { getInitials, getAvatarBg } from '@/data/mockUsers'

const oracleStore = useOracleStore()
const authStore = useAuthStore()

const displayUser = computed(() => {
  return authStore.myUser || { display_name: 'Bạn', username: 'user' }
})

const initials = computed(() => getInitials(displayUser.value.display_name))
const avatarBg = computed(() => getAvatarBg(authStore.myId))
</script>

<style scoped>
/* Mirror modal classes from PostDetailModal.vue to feel like loading post detail state */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  z-index: var(--z-modal, 300);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.modal-container {
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-xl);
  width: 760px;
  max-width: calc(100vw - 32px);
  height: 80vh;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  outline: none;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid #262626;
  flex-shrink: 0;
}

.modal-author {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
  min-width: 0;
}

.modal-author__avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: #fff;
  flex-shrink: 0;
}

.modal-author__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.modal-author__name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  white-space: nowrap;
}

.modal-author__username {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.modal-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.modal-close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.modal-body-scrollable {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.modal-content-block {
  padding: var(--space-5);
  border-bottom: 1px solid #262626;
}

.modal-content-text {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: var(--space-2);
}

.modal-timestamp {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Pending Analysis Content Styling */
.pending-analysis-box {
  padding: var(--space-8) var(--space-5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  background: #141414;
  height: 100%;
}

.loading-spinner-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #262626;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.progress-details {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 400px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.progress-text {
  font-weight: var(--font-weight-medium);
}

.progress-percent {
  font-family: var(--font-family-mono, monospace);
  color: #3b82f6;
}

.progress-bar-bg {
  width: 100%;
  max-width: 400px;
  height: 6px;
  background: #262626;
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

/* Transition animations */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.18s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
