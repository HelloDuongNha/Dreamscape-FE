/**
 * I18N Type Contract — Phase I18N-1
 *
 * All locale-related constants and the pure normalizeLocale helper live here.
 * This module has zero side effects and is safe to import in Node test runners.
 */

export const SUPPORTED_LOCALES = ['vi', 'en'] as const
export type AppLocale = typeof SUPPORTED_LOCALES[number]

export const DEFAULT_LOCALE: AppLocale = 'vi'
export const LOCALE_STORAGE_KEY = 'dreamscape.locale'

/**
 * Normalize a raw persisted value to a supported AppLocale.
 * Returns DEFAULT_LOCALE for any missing, empty, or unrecognized value.
 *
 * Pure function — no DOM / window / localStorage access.
 */
export function normalizeLocale(raw: string | null | undefined): AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(raw as string)
    ? (raw as AppLocale)
    : DEFAULT_LOCALE
}
