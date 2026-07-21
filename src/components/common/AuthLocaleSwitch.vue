<template>
  <button
    id="auth-locale-switch-btn"
    class="auth-locale-switch"
    :aria-label="localeStore.currentLocale === 'vi' ? t('common.switchToEnglish') : t('common.switchToVietnamese')"
    :title="localeStore.currentLocale === 'vi' ? t('common.switchToEnglish') : t('common.switchToVietnamese')"
    @click="localeStore.toggleLocale()"
  >
    <span class="auth-locale-switch__label" aria-hidden="true">
      {{ localeStore.currentLocale === 'vi' ? 'EN' : 'VI' }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '@/store/useLocaleStore'

const { t } = useI18n()
const localeStore = useLocaleStore()
</script>

<style scoped>
.auth-locale-switch {
  position: absolute;
  top: var(--space-6, 24px);
  right: var(--space-6, 24px);
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary, #a0a0a0);
  background: transparent;
  border: 1px solid var(--color-border, #262626);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  outline: none;
}

.auth-locale-switch:hover {
  background: var(--color-bg-hover, #202020);
  color: var(--color-text-primary, #f3f5f7);
  border-color: #4a4a4a;
}

.auth-locale-switch:focus-visible {
  outline: 2px solid var(--color-text-primary, #f3f5f7);
  outline-offset: 2px;
}

.auth-locale-switch__label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
</style>
