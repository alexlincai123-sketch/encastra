import type { Metadata } from 'next';

import { SITE } from '@/config/site';
import type { Locale } from './locale';
import { t } from './translate';

/**
 * One page's metadata — the `<title>`, the description, the canonical URL, and the Open Graph
 * tags that go with them.
 *
 * **Why this exists.** Next.js merges metadata from a layout into a page field by field, not
 * value by value: a page that declares `openGraph` replaces the layout's `openGraph` outright,
 * and a page that declares none inherits the layout's *unchanged*. Only `app/layout.tsx` set
 * `openGraph` here, so every page on the site shared the home page's social title and the home
 * page's URL — a link to `/security` unfurled as "Encastra — Build software by assembling
 * components", pointing at `https://encastra.dev`. Eighteen pages, one preview between them.
 *
 * Declaring `openGraph` per page is the only fix, and eighteen hand-written copies of the same
 * four fields is eighteen chances to drift, so it is written once, here.
 *
 * **What it does not do.** No `openGraph.images`. There is no image, and `docs/BRANDING.md` has
 * not settled on one; pointing at a file that does not exist renders as a broken preview, which
 * is worse than a text-only card. `app/layout.tsx` declares `twitter: { card: 'summary' }` for
 * the same reason — `summary` is the card shape that does not require an image. `metadataBase`
 * also stays in the layout: it is one fact about the deployment, not one fact per page.
 *
 * Lives under `lib/i18n/` because everything it composes is either already translated by the
 * caller or translated here — the title template and the tagline both follow the request's
 * locale, exactly as `app/layout.tsx` explains for the tags it still owns.
 */
export interface PageMetadataInput {
  /** The request's locale, which every `generateMetadata()` on this site already resolved. */
  readonly locale: Locale;
  /**
   * The page's own title, already translated, without the site name — the layout's
   * `title.template` appends that. Omitted only by the home page, whose `<title>` is the
   * layout's `title.default` and must not have the site name appended to it twice.
   */
  readonly title?: string;
  /** The page's description, already translated. */
  readonly description: string;
  /** Path from the site root, with a leading slash. `''` is the home page. */
  readonly path: string;
}

export function pageMetadata({ locale, title, description, path }: PageMetadataInput): Metadata {
  const url = `${SITE.url}${path}`;

  // An unfurl has no template to expand, so the site name is composed in by hand — in the same
  // order `app/layout.tsx`'s `title.template` puts it, so a shared link and a browser tab read
  // the same way. With no title of its own, this is the home page, and its social title is the
  // layout's `title.default`: the site name and the tagline, in the visitor's language.
  const socialTitle =
    title === undefined ? `${SITE.name} — ${t(locale, 'site.tagline')}` : `${title} — ${SITE.name}`;

  return {
    ...(title === undefined ? {} : { title }),
    description,
    alternates: { canonical: url },
    openGraph: {
      // `type` and `siteName` are repeated from the layout rather than inherited from it,
      // because this object replaces the layout's rather than merging into it.
      type: 'website',
      siteName: SITE.name,
      title: socialTitle,
      description,
      url,
    },
  };
}
