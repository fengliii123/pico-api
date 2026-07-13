// i18n composable for Vue components.
//
// The locale ref is module-level so every component that calls
// useI18n() shares the same state — otherwise switching language in one
// LocaleSelector wouldn't propagate to anything else.

import { ref, computed } from 'vue'
import { type Locale, translations, detectLocale, type Translations } from '@/i18n'

const LS_KEY = 'mp2:locale'

const locale = ref<Locale>(detectLocale())

function setLocale(l: Locale) {
  locale.value = l
  try { localStorage.setItem(LS_KEY, l) } catch { /* ignore */ }
}

const t = computed<Translations>(() => translations[locale.value] || translations.en)

export function useI18n() {
  return { locale, setLocale, t }
}

export type { Locale }
