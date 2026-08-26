// Guards against the classic i18n drift bug: a key added to the
// Translations interface / en but forgotten in zh-CN (or vice versa).
// TypeScript catches missing keys in the objects themselves, but nothing
// catches interface keys that exist in one object and are silently absent
// from the type in the other locale — this test does.
import { describe, expect, it } from 'vitest'
import { translations } from '@/i18n'

describe('i18n completeness', () => {
  it('en and zh-CN expose exactly the same key set', () => {
    const enKeys = Object.keys(translations.en).sort()
    const zhKeys = Object.keys(translations['zh-CN']).sort()
    expect(zhKeys).toEqual(enKeys)
  })

  it('no empty translations in either locale', () => {
    for (const [locale, dict] of Object.entries(translations)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `${locale}.${key}`).not.toBe('')
      }
    }
  })

  it('placeholders in en appear in zh-CN with the same names', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
    for (const key of Object.keys(translations.en)) {
      expect(
        placeholders(translations['zh-CN'][key as keyof typeof translations['zh-CN']] ?? ''),
        key
      ).toBe(placeholders(translations.en[key as keyof typeof translations.en]))
    }
  })
})
