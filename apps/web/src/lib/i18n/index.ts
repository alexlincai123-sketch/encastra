/**
 * Public surface of the website's translation module — for a **server** component. Everything a
 * server component needs comes from this one import, `@/lib/i18n`, rather than reaching into
 * `locale.ts`, `get-locale.ts`, `translate.ts` or `dictionaries/*` directly, so the internal
 * split between "how a locale is chosen" and "how a string is looked up" can change without
 * every caller needing to know it happened.
 *
 * A **client** component (`Header.tsx`, `Footer.tsx`, `ThemeToggle.tsx`, `LanguageSwitcher.tsx`)
 * must not import this barrel: it re-exports `getLocale()`, which pulls in `next/headers` via
 * `get-locale.ts`, and Next.js's Server Components boundary is per module — one disallowed
 * import anywhere in a file blocks the whole file from a client bundle, not just that export.
 * Those components import `locale.ts` and `translate.ts` directly instead, which is deliberate,
 * not an oversight; see `locale.ts`'s own comment.
 */

export { setLocaleAction } from './actions';
export { getLocale } from './get-locale';
export { isLocale, LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from './locale';
export type { Messages } from './messages';
export { getDictionary, t } from './translate';
