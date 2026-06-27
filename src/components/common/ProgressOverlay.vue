<template>
  <div v-if="isVisible" class="progress-overlay" role="dialog" aria-modal="true">
    <div class="progress-card">
      <div class="progress-card__header">
        <h3 class="progress-card__title">Generating Birth Profile</h3>
        <span class="progress-card__percent">{{ progress }}%</span>
      </div>
      
      <div class="progress-card__bar-wrapper">
        <AppProgressBar :value="progress" :max="100" color="#3B82F6" height="8px" />
      </div>
      
      <p class="progress-card__status">{{ statusText }}</p>
      
      <div class="flat-spinner-container">
        <div class="flat-spinner"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppProgressBar from '@/components/common/AppProgressBar.vue'

defineProps<{
  isVisible: boolean
  progress: number
  statusText: string
}>()
</script>

<style scoped>
.progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85); /* Flat solid dark backdrop, no blur */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999; /* Ensure page-blocking behavior */
}

.progress-card {
  width: 400px;
  background: #181818;
  border: 1px solid #262626;
  border-radius: 6px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}

.progress-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

.progress-card__percent {
  font-size: 13px;
  font-weight: 700;
  color: #3B82F6;
  font-family: var(--font-family-mono, monospace);
}

.progress-card__bar-wrapper {
  margin-top: 4px;
}

.progress-card__status {
  margin: 0;
  font-size: 13px;
  color: #737373;
  line-height: 1.4;
  text-align: center;
  min-height: 38px;
}

.flat-spinner-container {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.flat-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #262626;
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
