<template>
  <span :class="['academic-category-badge', `academic-category-badge--${category}`]">
    {{ t(`library.tabs.${category}`) }}
  </span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AcademicSourceCategory } from '@/features/library/utils/academicSourceCategory'

defineProps<{ category: AcademicSourceCategory }>()

const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
.academic-category-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}
.academic-category-badge--science {
  color: #73b8ff; background: rgba(59, 130, 246, 0.11); border-color: rgba(59, 130, 246, 0.34);
}
.academic-category-badge--psychology {
  color: #c5a3ff; background: rgba(139, 92, 246, 0.11); border-color: rgba(139, 92, 246, 0.34);
}
.academic-category-badge--symbol {
  color: #f3bd60; background: rgba(245, 158, 11, 0.11); border-color: rgba(245, 158, 11, 0.34);
}
.academic-category-badge--culture {
  color: #63d6a0; background: rgba(16, 185, 129, 0.11); border-color: rgba(16, 185, 129, 0.34);
}
</style>
