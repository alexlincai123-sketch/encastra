import type { ReactNode } from 'react';

import { ButtonRow, CTA, PageHeader } from '@/components/ui/Ui';
import { getLocale, t } from '@/lib/i18n';

/**
 * What a visitor gets for an address that is not a page.
 *
 * There was no `not-found.tsx` before this one, so every mistyped URL — and every `notFound()`
 * from `legal/[slug]`, which is reachable by typing a slug that does not exist — fell through to
 * the framework's built-in "404 · This page could not be found": unstyled, English only, and
 * without the header or the footer, so the one thing a lost visitor needs (a way back into the
 * site) was the one thing not on the screen. Being a route under `app/`, this file renders inside
 * `layout.tsx` like every other page, which is what puts the navigation back.
 *
 * It says the page does not exist and stops there. It does not guess what was meant, and it does
 * not suggest the address will work later — nothing was removed, and `CLAUDE.md` rules out
 * implying a timeline the project has not decided on.
 *
 * No `generateMetadata()`: Next.js reads metadata exports from `layout` and `page` files, not
 * from `not-found`. The title is `layout.tsx`'s `title.default`, which is correct enough for a
 * page nobody links to and no crawler should index.
 */
export default async function NotFound(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={t(locale, 'notFound.eyebrow')}
        title={t(locale, 'notFound.title')}
        lead={t(locale, 'notFound.lead')}
      />

      <ButtonRow>
        <CTA href="/">{t(locale, 'notFound.home')}</CTA>
        <CTA href="/docs" variant="secondary">
          {t(locale, 'notFound.docs')}
        </CTA>
      </ButtonRow>
    </div>
  );
}
