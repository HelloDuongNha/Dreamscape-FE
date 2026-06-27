<template>
  <div :class="['app-input-wrapper', { 'app-input-wrapper--error': !!error, 'app-input-wrapper--focused': isFocused }]">
    <label v-if="label" :for="inputId" class="app-input__label">
      {{ label }}
      <span v-if="required" class="app-input__required" aria-hidden="true">*</span>
    </label>

    <div class="app-input__field-wrap">
      <span v-if="prefixIcon" class="app-input__icon app-input__icon--prefix" aria-hidden="true">
        {{ prefixIcon }}
      </span>

      <component
        :is="type === 'textarea' ? 'textarea' : 'input'"
        :id="inputId"
        :type="type !== 'textarea' ? type : undefined"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :rows="type === 'textarea' ? rows : undefined"
        :class="['app-input__field', { 'app-input__field--with-prefix': !!prefixIcon, 'app-input__field--with-suffix': !!suffixIcon, 'app-input__field--textarea': type === 'textarea' }]"
        v-bind="$attrs"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />

      <span v-if="suffixIcon" class="app-input__icon app-input__icon--suffix" aria-hidden="true">
        {{ suffixIcon }}
      </span>
    </div>

    <Transition name="fade">
      <p v-if="error" class="app-input__error" role="alert">{{ error }}</p>
      <p v-else-if="hint" class="app-input__hint">{{ hint }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  id?:         string
  label?:      string
  type?:       'text' | 'email' | 'password' | 'search' | 'number' | 'tel' | 'url' | 'textarea'
  placeholder?: string
  disabled?:   boolean
  readonly?:   boolean
  required?:   boolean
  error?:      string
  hint?:       string
  prefixIcon?: string
  suffixIcon?: string
  rows?:       number
}>(), {
  type: 'text',
  rows: 4,
})

defineEmits<{ 'update:modelValue': [value: string] }>()

const isFocused = ref(false)
const inputId   = computed(() => props.id ?? `app-input-${Math.random().toString(36).slice(2, 7)}`)
</script>

<style scoped>
.app-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Label */
.app-input__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  transition: color var(--transition-fast);
}
.app-input-wrapper--focused .app-input__label { color: var(--color-text-secondary); }
.app-input__required { color: var(--color-neon-pink); margin-left: 2px; }

/* Field wrap */
.app-input__field-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

/* Icons */
.app-input__icon {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  font-size: 1.1em;
  transition: color var(--transition-fast);
  pointer-events: none;
  z-index: 1;
}
.app-input__icon--prefix { left: var(--space-4); }
.app-input__icon--suffix { right: var(--space-4); }
.app-input-wrapper--focused .app-input__icon { color: var(--color-primary); }

/* Core field */
.app-input__field {
  width: 100%;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  transition:
    border-color var(--transition-base),
    box-shadow   var(--transition-base),
    background   var(--transition-base);
  resize: none;
}

.app-input__field::placeholder { color: var(--color-text-muted); }

.app-input__field--with-prefix  { padding-left:  calc(var(--space-4) * 2 + 1.1em); }
.app-input__field--with-suffix  { padding-right: calc(var(--space-4) * 2 + 1.1em); }
.app-input__field--textarea     { min-height: 100px; padding-top: var(--space-3); resize: vertical; }

/* Focus */
.app-input__field:focus {
  border-color: #4a4a4a;
  box-shadow: var(--shadow-sm);
  background: var(--color-bg-elevated);
  outline: none;
}

/* Error */
.app-input-wrapper--error .app-input__field {
  border-color: var(--color-danger);
}
.app-input-wrapper--error .app-input__field:focus {
  border-color: var(--color-danger);
  box-shadow: var(--shadow-sm);
}

/* Disabled */
.app-input__field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Messages */
.app-input__error {
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.app-input__hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Fade transition (defined globally, referenced here) */
.fade-enter-active, .fade-leave-active { transition: opacity var(--transition-fast); }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
