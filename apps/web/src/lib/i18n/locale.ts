/**
 * The `Locale` type and the constants around it — no `next/headers`, no `next/navigation`,
 * nothing that only runs on the server. Kept apart from `get-locale.ts` (which has all of that)
 * specifically so a client component can import `Locale`/`LOCALES`/`LOCALE_NAMES` — as
 * `LanguageSwitcher.tsx` does — without pulling a server-only API into the client bundle.
 *
 * Next.js's Server Components boundary is per *module*, not per *export*: a file that imports
 * `next/headers` anywhere in it cannot be imported from a Client Component at all, even for an
 * unrelated named export. `getLocale()` used to live in this same file, and moving it out is
 * what makes `LanguageSwitcher.tsx` buildable — see that file's own note, and the one on
 * `get-locale.ts`, for the two ends of the story.
 */

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = 'encastra-locale';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value !== undefined && value !== null && (LOCALES as readonly string[]).includes(value);
}
