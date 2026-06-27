<template>
  <div class="app-select-wrapper">
    <select
      :id="id"
      :value="modelValue"
      :disabled="disabled"
      class="app-select"
      @change="onChange"
    >
      <option
        v-for="opt in normalizedOptions"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label }}
      </option>
    </select>
    <div class="app-select-arrow" aria-hidden="true">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface OptionObject {
  value: string | number
  label: string
}

type Option = string | OptionObject

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    options: Option[]
    disabled?: boolean
    id?: string
  }>(),
  {
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
}>()

const normalizedOptions = computed(() => {
  return props.options.map(opt => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: opt, label: String(opt) }
    }
    return opt
  })
})

const onChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>

<style scoped>
.app-select-wrapper {
  position: relative;
  display: inline-block;
  width: 100%;
}

.app-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: 100%;
  background: #181818;
  border: 1px solid #262626;
  border-radius: var(--radius-md, 6px);
  color: var(--color-text-primary, #fff);
  font-family: var(--font-family-base, inherit);
  font-size: var(--font-size-sm, 14px);
  padding: 8px 36px 8px 12px;
  outline: none;
  cursor: pointer;
  transition: border-color var(--transition-fast, 0.2s);
}

.app-select:focus {
  border-color: #4a4a4a;
}

.app-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.app-select-arrow {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--color-text-muted, #737373);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
