import type { ReactNode } from 'react';

import { setLocaleAction } from '@/lib/i18n/actions';
import { LOCALE_NAMES, LOCALES, type Locale } from '@/lib/i18n/locale';
import { t } from '@/lib/i18n/translate';

import styles from './LanguageSwitcher.module.css';

/**
 * Two buttons — EN, ES — each its own one-field `<form>` posting to `setLocaleAction`.
 *
 * Small and quiet on purpose: this is a setting, the same weight in the header as
 * `ThemeToggle` beside it, not a feature to announce. No client component, no `useState`, no
 * `fetch` — a server action bound directly to a `<form action>` works with JavaScript on or off,
 * which a `<select onChange>` calling a client-side navigation would not.
 *
 * `setLocaleAction` is imported directly from `lib/i18n/actions.ts` rather than the `lib/i18n`
 * barrel — Next.js's server-action compiler wants the action's own module in the import, and a
 * re-export through `index.ts` is an unnecessary indirection to ask it to see through.
 */
export function LanguageSwitcher({ locale, path }: { locale: Locale; path: string }): ReactNode {
  return (
    <fieldset className={styles.switcher} aria-label={t(locale, 'language.label')}>
      {LOCALES.map((candidate) => (
        <form key={candidate} action={setLocaleAction}>
          <input type="hidden" name="path" value={path} />
          <button
            type="submit"
            name="locale"
            value={candidate}
            className={styles.option}
            data-active={candidate === locale ? 'true' : 'false'}
            aria-label={t(locale, 'language.switchTo', { language: LOCALE_NAMES[candidate] })}
            {...(candidate === locale ? { 'aria-current': 'true' } : {})}
          >
            {candidate.toUpperCase()}
          </button>
        </form>
      ))}
    </fieldset>
  );
}
