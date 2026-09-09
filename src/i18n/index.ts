// i18n aggregation: locale types live in ./types, the two translation
// tables in ./en and ./zh-CN. Everything callers need is re-exported here
// so '@/i18n' imports keep working unchanged.

import { en } from './en'
import { zhCN } from './zh-CN'
import type { Locale, Translations } from './types'

export { LOCALES } from './types'
export type { Locale, LocaleConfig, Translations } from './types'

export const translations: Record<Locale, Translations> = {
  'en': en,
  'zh-CN': zhCN
}

export function getTranslation(locale: Locale): Translations {
  return translations[locale] || en
}

/** Replace `{key}` placeholders in a translation string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

// Language detection helper
export function detectLocale(): Locale {
  const stored = localStorage.getItem('mp2:locale')
  if (stored && (stored === 'en' || stored === 'zh-CN')) {
    return stored as Locale
  }

  const browserLang = navigator.language
  if (browserLang.startsWith('zh')) {
    return 'zh-CN'
  }
  return 'en'
}

