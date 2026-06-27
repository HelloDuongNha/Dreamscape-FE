<template>
  <section class="oracle-view">
    <header class="oracle-view__header">
      <h1>Oracle <span class="gradient-text">◈</span></h1>
      <p>Speak your dream — the Oracle listens.</p>
    </header>
    <AppCard variant="neon" class="oracle-view__chat">
      <p class="oracle-view__placeholder">[ Oracle feature coming soon ]</p>
    </AppCard>
  </section>
</template>

<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
</script>

<style scoped>
.oracle-view { display: flex; flex-direction: column; gap: var(--space-8); }
.oracle-view__header h1 { font-size: var(--font-size-3xl); }
.oracle-view__header p  { color: var(--color-text-secondary); margin-top: var(--space-2); }
.oracle-view__chat      { min-height: 400px; }
.oracle-view__placeholder {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-16) 0;
  font-size: var(--font-size-lg);
}
</style>
