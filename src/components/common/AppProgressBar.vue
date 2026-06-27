<template>
  <div class="app-progress-bar" :style="{ height }">
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{
          width: `${percentage}%`,
          backgroundColor: color
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    max: number
    color?: string
    height?: string
  }>(),
  {
    color: '#10B981',
    height: '8px'
  }
)

const percentage = computed(() => {
  if (props.max <= 0) return 0
  return Math.min(100, Math.max(0, (props.value / props.max) * 100))
})
</script>

<style scoped>
.app-progress-bar {
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  overflow: hidden;
  box-sizing: border-box;
}

.progress-track {
  width: 100%;
  height: 100%;
  background: #262626;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease, background-color 0.2s ease;
}
</style>
