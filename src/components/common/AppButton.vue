<template>
  <button
    :id="id"
    :type="type"
    :disabled="disabled || loading"
    :class="['app-btn', `app-btn--${variant}`, `app-btn--${size}`, { 'app-btn--loading': loading, 'app-btn--block': block }]"
    v-bind="$attrs"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="app-btn__spinner" aria-hidden="true" />
    <span v-if="prefixIcon && !loading" class="app-btn__icon app-btn__icon--prefix" aria-hidden="true">
      {{ prefixIcon }}
    </span>
    <span class="app-btn__label">
      <slot />
    </span>
    <span v-if="suffixIcon" class="app-btn__icon app-btn__icon--suffix" aria-hidden="true">
      <AppIcon v-if="namedSuffixIcon" :name="namedSuffixIcon" :size="14" />
      <template v-else>{{ suffixIcon }}</template>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{
  id?:         string
  type?:       'button' | 'submit' | 'reset'
  variant?:    'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'neon' | 'smart'
  size?:       'sm' | 'md' | 'lg'
  disabled?:   boolean
  loading?:    boolean
  block?:      boolean
  prefixIcon?: string
  suffixIcon?: string
}>(), {
  type:    'button',
  variant: 'primary',
  size:    'md',
})

const namedSuffixIcon = computed<'external-link' | 'chevron-down' | null>(() => {
  if (props.suffixIcon === 'external-link' || props.suffixIcon === 'chevron-down') {
    return props.suffixIcon
  }
  return null
})

defineEmits<{ click: [e: MouseEvent] }>()
</script>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────── */
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-wide);
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  white-space: nowrap;
  transition:
    background var(--transition-base),
    box-shadow  var(--transition-base),
    transform   var(--transition-fast),
    border-color var(--transition-base),
    opacity     var(--transition-fast);
  text-transform: uppercase;
  font-size: var(--font-size-sm);
}

.app-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.06);
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.app-btn:hover::before { opacity: 1; }
.app-btn:active        { transform: scale(0.97); }

/* ── Sizes ─────────────────────────────────────────────────────── */
.app-btn--sm  { padding: var(--space-2) var(--space-4);  height: 32px; font-size: var(--font-size-xs); }
.app-btn--md  { padding: var(--space-3) var(--space-6);  height: 42px; }
.app-btn--lg  { padding: var(--space-4) var(--space-8);  height: 52px; font-size: var(--font-size-md); }

/* ── Variants ──────────────────────────────────────────────────── */
.app-btn--primary {
  background: var(--color-primary);      /* solid white */
  color: var(--color-primary-fg);        /* dark text */
  border-color: var(--color-primary);
}
.app-btn--primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.app-btn--secondary {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border-color: var(--color-border-input);
}
.app-btn--secondary:hover {
  background: var(--color-bg-hover);
  border-color: #3a3a3a;
}

.app-btn--ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border-color: transparent;
}
.app-btn--ghost:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.app-btn--danger {
  background: var(--color-danger);
  color: #ffffff;
  border-color: var(--color-danger);
}
.app-btn--danger:hover {
  background: #d43545;
  border-color: #d43545;
}

/* Outlined danger — transparent bg, muted red border/text; fills softly on hover */
.app-btn--danger-outline {
  background: transparent;
  color: #b03a3a;
  border-color: #6b2020;
}
.app-btn--danger-outline:hover {
  background: #2d1010;
  color: #ed4956;
  border-color: #7a2525;
}

/* 'neon' is aliased to secondary in flat mode */
.app-btn--neon {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border-color: var(--color-border-input);
}
.app-btn--neon:hover {
  background: var(--color-bg-hover);
  border-color: #3a3a3a;
}

/**
 * 'smart' — disabled looks like secondary (dark/muted),
 *            enabled automatically flips to primary (white).
 * Usage: variant="smart" :disabled="someCondition"
 */
.app-btn--smart {
  /* default (will be overridden when not disabled) */
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  border-color: var(--color-border-input);
}
/* Enabled state → primary */
.app-btn--smart:not(:disabled) {
  background: var(--color-primary);
  color: var(--color-primary-fg);
  border-color: var(--color-primary);
  opacity: 1;
}
.app-btn--smart:not(:disabled):hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

/* ── States ────────────────────────────────────────────────────── */
.app-btn:disabled,
.app-btn--loading {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}
.app-btn--block { width: 100%; }

/* ── Spinner ───────────────────────────────────────────────────── */
.app-btn__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: btn-spin 0.65s linear infinite;
  flex-shrink: 0;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}

.app-btn__icon { font-size: 1.1em; line-height: 1; }
</style>
