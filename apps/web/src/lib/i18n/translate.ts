import en from './dictionaries/en';
import es from './dictionaries/es';
import type { Locale } from './locale';
import { interpolate, lookup, type Messages } from './messages';

const DICTIONARIES: Record<Locale, Messages> = { en, es };

export function getDictionary(locale: Locale): Messages {
  return DICTIONARIES[locale];
}

/**
 * Translates a key for a given locale, interpolating any `{placeholder}` values.
 *
 * English is the fallback, always: a key missing from `es.ts` renders the English string, never
 * a raw key and never a blank. A partly-translated page should read as a partly-translated page,
 * not a broken one — the same rule `apps/desktop/src/i18n/index.ts` follows, for the same reason.
 *
 * A plain function rather than a hook, because every caller here is a server component (or a
 * client component that received its locale as a prop from one) — there is no client-side store
 * to subscribe to.
 */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const active = DICTIONARIES[locale];
  const found = lookup(active, key) ?? lookup(DICTIONARIES.en, key);
  return interpolate(found ?? key, vars);
}
