/**
 * I18N instance — Phase I18N-2A
 *
 * IMPORTANT: The initial locale is resolved from localStorage BEFORE
 * createI18n is called. This guarantees the correct locale from first render
 * and prevents any vi→en (or en→vi) flash on reload.
 */
import { createI18n } from 'vue-i18n'

import viMessages from './locales/vi/index.js'
import enMessages from './locales/en/index.js'

import { normalizeLocale, LOCALE_STORAGE_KEY } from './types'

// ── Resolve initial locale before createI18n ──────────────────────────────────
// Guard window access so this module is safe to import in Node test environments.
const _storedRaw = typeof window !== 'undefined'
  ? window.localStorage.getItem(LOCALE_STORAGE_KEY)
  : null

const initialLocale = normalizeLocale(_storedRaw)

// ── Create i18n instance ──────────────────────────────────────────────────────
export const i18n = createI18n({
  legacy: false,           // Composition API mode — required for vue-i18n v11
  locale: initialLocale,   // already correct; no flash possible
  fallbackLocale: 'vi',
  messages: {
    vi: viMessages,
    en: enMessages,
  },
})

/**
 * Typed global accessor for use outside Vue component setup
 * (stores, API interceptors, test utilities).
 * Do NOT call useI18n() outside <script setup> — use this instead.
 */
export const i18nGlobal = i18n.global
