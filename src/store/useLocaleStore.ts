/**
 * useLocaleStore — Phase I18N-1
 *
 * Manages the active AppLocale. Syncs vue-i18n, localStorage,
 * document.documentElement.lang and the HTTP client Accept-Language header.
 *
 * IMPORTANT:
 * - Do NOT call useI18n() here. This store runs outside Vue component setup.
 *   Use i18nGlobal (the exported global accessor from @/i18n) instead.
 * - This store is explicitly initialised in main.ts before router and mount
 *   so that all side-effects (html lang, Accept-Language) fire synchronously.
 */
import { defineStore } from 'pinia'
import { ref }         from 'vue'
import type { AppLocale } from '@/i18n/types'
import { normalizeLocale, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from '@/i18n/types'
import { i18nGlobal } from '@/i18n'
import apiClient      from '@/api/client'

export const useLocaleStore = defineStore('locale', () => {
  // Seed from the same normalized value used to initialise the i18n instance.
  const _storedRaw = typeof window !== 'undefined'
    ? window.localStorage.getItem(LOCALE_STORAGE_KEY)
    : null
  const currentLocale = ref<AppLocale>(normalizeLocale(_storedRaw))

  // ── Internal apply ──────────────────────────────────────────────────────────
  function _applyLocale(locale: AppLocale): void {
    // 1. Update vue-i18n global locale
    i18nGlobal.locale.value = locale

    // 2. Persist to localStorage
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
      // 3. Update <html lang>
      document.documentElement.lang = locale
    }

    // 4. Update HTTP client default header (also updated per-request in interceptor)
    apiClient.defaults.headers.common['Accept-Language'] = locale

    // 5. Update reactive state
    currentLocale.value = locale
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  function initialize(): void {
    _applyLocale(currentLocale.value)
  }

  function setLocale(locale: AppLocale): void {
    _applyLocale(locale)
  }

  function toggleLocale(): void {
    const next: AppLocale = currentLocale.value === 'vi' ? 'en' : 'vi'
    _applyLocale(next)
  }

  return {
    currentLocale,
    initialize,
    setLocale,
    toggleLocale,
    SUPPORTED_LOCALES,
  }
})
