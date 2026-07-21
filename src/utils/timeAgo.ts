import type { AppLocale } from '@/i18n/types'

/**
 * Locale-aware relative timestamp using Intl.RelativeTimeFormat.
 *
 * Renders naturally in both supported locales:
 *   vi → "vừa xong", "3 phút trước", "2 giờ trước", "4 ngày trước"
 *   en → "just now",  "3 minutes ago", "2 hours ago", "4 days ago"
 *
 * @param isoString - ISO 8601 date string from the API
 * @param locale    - Active AppLocale; defaults to 'vi'
 */
export function timeAgo(isoString: string, locale?: AppLocale): string {
  if (locale === undefined) {
    const diff    = Date.now() - new Date(isoString).getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds <= 0)  return 'just now'
    if (seconds < 60)  return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60)  return `${minutes}m`
    const hours   = Math.floor(minutes / 60)
    if (hours   < 24)  return `${hours}h`
    const days    = Math.floor(hours   / 24)
    if (days    <  7)  return `${days}d`
    const weeks   = Math.floor(days    /  7)
    if (weeks   < 52)  return `${weeks}w`
    return `${Math.floor(weeks / 52)}y`
  }

  const diff    = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)

  let value: number
  let unit: Intl.RelativeTimeFormatUnit

  if (seconds <= 0) {
    value = 0
    unit  = 'second'
  } else if (seconds < 60) {
    value = -seconds
    unit  = 'second'
  } else if (seconds < 3_600) {
    value = -Math.floor(seconds / 60)
    unit  = 'minute'
  } else if (seconds < 86_400) {
    value = -Math.floor(seconds / 3_600)
    unit  = 'hour'
  } else if (seconds < 604_800) {
    value = -Math.floor(seconds / 86_400)
    unit  = 'day'
  } else if (seconds < 31_536_000) {
    value = -Math.floor(seconds / 604_800)
    unit  = 'week'
  } else {
    value = -Math.floor(seconds / 31_536_000)
    unit  = 'year'
  }

  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit)
  } catch {
    // Graceful fallback for extremely old browsers without full Intl support
    return `${Math.abs(value)}${unit[0]}`
  }
}
