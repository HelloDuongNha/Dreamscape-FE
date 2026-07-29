import { describe, expect, it } from 'vitest'
import en from './locales/en/index'
import vi from './locales/vi/index'

describe('locale contract', () => {
  it('keeps English and Vietnamese key trees in parity', () => {
    expect(flattenLocaleKeys(en)).toEqual(flattenLocaleKeys(vi))
  })
})

function flattenLocaleKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }

  return Object.entries(value)
    .flatMap(([key, nestedValue]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return flattenLocaleKeys(nestedValue, path)
    })
    .sort()
}
