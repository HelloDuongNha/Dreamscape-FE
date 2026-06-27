<template>
  <article
    :class="['app-card', `app-card--${variant}`, { 'app-card--hoverable': hoverable, 'app-card--active': active }]"
    v-bind="$attrs"
  >
    <!-- Header -->
    <header v-if="$slots.header || title" class="app-card__header">
      <slot name="header">
        <div class="app-card__title-row">
          <span v-if="icon" class="app-card__icon" aria-hidden="true">{{ icon }}</span>
          <div>
            <h3 v-if="title" class="app-card__title">{{ title }}</h3>
            <p  v-if="subtitle" class="app-card__subtitle">{{ subtitle }}</p>
          </div>
          <div class="app-card__header-actions">
            <slot name="header-actions" />
          </div>
        </div>
      </slot>
    </header>

    <!-- Body -->
    <div class="app-card__body">
      <slot />
    </div>

    <!-- Footer -->
    <footer v-if="$slots.footer" class="app-card__footer">
      <slot name="footer" />
    </footer>
  </article>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?:   'default' | 'glass' | 'neon' | 'flat'
  hoverable?: boolean
  active?:    boolean
  title?:     string
  subtitle?:  string
  icon?:      string
}>(), {
  variant: 'default',
})
</script>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────── */
.app-card {
  position: relative;
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

/* ── Variants ──────────────────────────────────────────────────── */
.app-card--default {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
}

/* 'glass' maps to flat surface in the new design system */
.app-card--glass {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
}

/* 'neon' uses a slightly brighter border — no glow */
.app-card--neon {
  background: var(--color-bg-surface);
  border: 1px solid #3a3a3a;
}

.app-card--flat {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
}

/* ── Hoverable ─────────────────────────────────────────────────── */
.app-card--hoverable { cursor: pointer; }
.app-card--hoverable:hover {
  border-color: #3a3a3a;
  background: var(--color-bg-hover);
}
.app-card--active {
  border-color: #3a3a3a;
}

/* ── Header ────────────────────────────────────────────────────── */
.app-card__header {
  padding: var(--space-6) var(--space-6) 0;
}
.app-card__title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.app-card__icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  margin-top: 2px;
}
.app-card__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
}
.app-card__subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
  line-height: var(--line-height-normal);
}
.app-card__header-actions {
  margin-left: auto;
  flex-shrink: 0;
}

/* ── Body ──────────────────────────────────────────────────────── */
.app-card__body {
  padding: var(--space-6);
}

/* ── Footer ────────────────────────────────────────────────────── */
.app-card__footer {
  padding: 0 var(--space-6) var(--space-6);
  border-top: 1px solid var(--color-border-subtle);
  padding-top: var(--space-4);
}
</style>
