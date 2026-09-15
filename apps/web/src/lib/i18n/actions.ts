'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { isLocale, LOCALE_COOKIE } from './locale';
import { isPathOnThisSite } from './redirect-path';

/**
 * Sets the locale cookie and sends the visitor back to the page they were on.
 *
 * Bound to a plain `<form>` in `LanguageSwitcher.tsx`, not driven by client-side `fetch` — the
 * switcher works with JavaScript disabled, degrading to an ordinary form submission, and needs no
 * addition to the Content-Security-Policy: a form post to the current origin is already permitted
 * by `form-action 'self'` in `lib/security.ts`, and a server action invoked from a `<form action>`
 * is exactly that, a same-origin POST, under Next.js's own progressive-enhancement machinery.
 *
 * A year-long cookie, `httpOnly`, matching the durability of the theme choice in
 * `ThemeToggle.tsx` (there, a year in practice, since nothing there expires it either) — the
 * difference is only where the choice is kept, because a server component has to know the
 * locale before any client script has had the chance to read `localStorage`.
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get('locale');
  const path = formData.get('path');
  const store = await cookies();

  if (typeof locale === 'string' && isLocale(locale)) {
    store.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
    });
  }

  // Falls back to the home page for anything that does not look like a path on this site — a
  // missing field, or a stray absolute URL nobody is meant to be able to submit through this
  // form in the first place.
  redirect(typeof path === 'string' && isPathOnThisSite(path) ? path : '/');
}
