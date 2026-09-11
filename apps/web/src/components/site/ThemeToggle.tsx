'use client';

import { type ReactNode, useEffect, useState } from 'react';

import type { Locale } from '@/lib/i18n/locale';
import { t } from '@/lib/i18n/translate';
import styles from './ThemeToggle.module.css';

/**
 * Dark and light, from the product's own tokens.
 *
 * `@encastra/ui/tokens.css` defines light under `:root[data-theme="light"]`, so switching theme
 * is one attribute on `<html>` and no duplicated palette. The initial value is set before paint
 * by the script in `layout.tsx`; this control only changes it afterwards and remembers the
 * choice.
 */

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'encastra-theme';

export function ThemeToggle({ locale }: { locale: Locale }): ReactNode {
  // Rendered as `null` until mounted: the server cannot know the visitor's theme, and
  // announcing the wrong one would be worse than announcing none.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'light' ? 'light' : 'dark');
  }, []);

  function apply(next: Theme): void {
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A private window can refuse storage. The theme still changes for this visit, which is
      // the part that matters; only the memory of it is lost.
    }
  }

  const next: Theme = theme === 'light' ? 'dark' : 'light';

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={() => apply(next)}
      disabled={theme === null}
      aria-label={
        theme === null
          ? t(locale, 'theme.changeTheme')
          : t(locale, 'theme.switchTo', { theme: t(locale, `theme.${next}`) })
      }
    >
      <span aria-hidden="true" className={styles.icon}>
        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

function SunIcon(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.3" />
      <path
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        d="M8 1.4v1.7M8 12.9v1.7M14.6 8h-1.7M3.1 8H1.4M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2M12.7 12.7l-1.2-1.2M4.5 4.5 3.3 3.3"
      />
    </svg>
  );
}

function MoonIcon(): ReactNode {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        d="M13.4 9.6A5.8 5.8 0 0 1 6.4 2.6a5.8 5.8 0 1 0 7 7Z"
      />
    </svg>
  );
}
