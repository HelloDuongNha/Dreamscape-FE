<template>
  <label class="app-switch" :class="{ 'app-switch--disabled': disabled }">
    <input
      class="app-switch__input"
      type="checkbox"
      role="switch"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel || label"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="app-switch__track" aria-hidden="true"><span /></span>
    <span v-if="label" class="app-switch__label">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: boolean
  label?: string
  ariaLabel?: string
  disabled?: boolean
}>(), {
  label: '',
  ariaLabel: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped>
.app-switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  user-select: none;
}
.app-switch--disabled { opacity: .5; cursor: default; }
.app-switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.app-switch__track {
  width: 36px;
  height: 20px;
  padding: 2px;
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border-input);
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.app-switch__track span {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
  transition: transform var(--transition-fast), background var(--transition-fast);
}
.app-switch__input:checked + .app-switch__track {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.app-switch__input:checked + .app-switch__track span {
  transform: translateX(16px);
  background: var(--color-bg-base);
}
.app-switch__input:focus-visible + .app-switch__track {
  outline: 2px solid var(--color-text-secondary);
  outline-offset: 2px;
}
.app-switch__label { white-space: nowrap; }
</style>
