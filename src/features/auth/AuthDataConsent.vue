<template>
  <label
    :for="id"
    :class="['auth-consent', { 'auth-consent--invalid': invalid }]"
  >
    <input
      :id="id"
      class="auth-consent__input"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-invalid="invalid"
      :aria-describedby="invalid ? `${id}-error` : undefined"
      @change="updateValue"
    />
    <span class="auth-consent__box" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path d="m3.5 8.2 2.8 2.8 6.2-6.2" />
      </svg>
    </span>
    <span class="auth-consent__content">
      <span>{{ t('auth.dataConsentLabel') }}</span>
      <span
        v-if="invalid"
        :id="`${id}-error`"
        class="auth-consent__error"
        role="alert"
      >
        {{ t('auth.dataConsentInlineError') }}
      </span>
    </span>
  </label>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  id: string
  modelValue: boolean
  invalid?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useI18n()

function updateValue(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}
</script>

<style scoped>
.auth-consent {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid #2d2d2d;
  border-radius: var(--radius-md, 8px);
  background: #181818;
  color: var(--color-text-secondary, #a0a0a0);
  font-size: var(--font-size-xs, .75rem);
  line-height: 1.5;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}

.auth-consent:hover {
  border-color: #444;
  background: #1d1d1d;
}

.auth-consent--invalid {
  border-color: var(--color-danger, #ed4956);
  background: #241416;
}

.auth-consent__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.auth-consent__box {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border: 1px solid #555;
  border-radius: 5px;
  background: #101010;
  color: #101010;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
}

.auth-consent__box svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.auth-consent__input:checked + .auth-consent__box {
  border-color: #f3f5f7;
  background: #f3f5f7;
  color: #101010;
}

.auth-consent__input:focus-visible + .auth-consent__box {
  outline: 2px solid #f3f5f7;
  outline-offset: 3px;
}

.auth-consent__input:disabled + .auth-consent__box,
.auth-consent:has(.auth-consent__input:disabled) {
  cursor: not-allowed;
  opacity: .6;
}

.auth-consent__content {
  display: grid;
  gap: 3px;
}

.auth-consent__error {
  color: var(--color-danger, #ed4956);
  font-weight: var(--font-weight-medium, 500);
}

@media (max-width: 480px) {
  .auth-consent {
    min-height: 48px;
    padding: var(--space-3);
  }
}
</style>
