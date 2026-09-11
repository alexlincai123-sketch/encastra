import { cookies } from 'next/headers';

import { isLocale, LOCALE_COOKIE, type Locale } from './locale';

/**
 * Which language a request gets, and why that is a cookie rather than a `/es/` route segment.
 *
 * Two strategies were on the table:
 *
 * - **A `[locale]` route segment.** The stronger choice for SEO on a site that is translating
 *   every page — a crawler gets a stable, indexable URL per language, and `hreflang` links the
 *   two together. It costs a restructure of every route under `app/`, a rewrite of `sitemap.ts`
 *   and every internal `<Link>`, and a decision about what `/es/legal/privacy-policy` even means
 *   for a document `config/legal.ts` has not translated. That is the right trade for a site that
 *   is fully bilingual; it is a lot of surface area to open for the partial translation this pass
 *   actually delivers (see `dictionaries/` — several pages are deliberately still English-only).
 * - **A cookie, read in a server component.** One URL per page, in both languages. No route to
 *   duplicate, no sitemap entry to double, no internal link that needs a locale prefix threaded
 *   through it. The trade is that a URL's content now depends on a cookie rather than being
 *   fixed by its path — which is the reason `getLocale()` below never reads `Accept-Language`.
 *   If it did, the same URL would hand a crawler English on one crawl and Spanish on the next
 *   depending on what header it sent, which is a worse SEO story than translating nothing.
 *   Reading only the cookie means a request with no cookie — every crawler, every first visit —
 *   always gets English, and a URL's default content is stable. Spanish only appears once a
 *   visitor has explicitly chosen it through the switcher in the header, which also means the
 *   choice is exactly as durable and exactly as private as the theme choice in `ThemeToggle.tsx`
 *   already is, just server-side instead of in `localStorage` — it has to be, because the locale
 *   decides what a server component renders before any client script runs.
 *
 * The cookie read is also free in a way it would not be on a typical Next.js site: `proxy.ts`
 * already forces every page in this app to render per request, for the CSP nonce, and
 * `layout.tsx` already awaits `headers()` for that reason. Reading `cookies()` alongside it adds
 * no new cost to an architecture that is already paying for dynamic rendering — it would be a
 * real trade-off on a statically-generated site, and it is not one here.
 *
 * Should this site ever translate every page rather than a deliberate subset, the route-segment
 * approach is the one to revisit for — its SEO ceiling is higher. For what this pass actually
 * translates, a cookie is the honest-sized tool.
 *
 * Lives in its own module, apart from the plain constants in `locale.ts`, because it is the only
 * part of this system that touches `next/headers` — see that file's note on why the split
 * matters for `LanguageSwitcher.tsx` and any other client component that only needs the type.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : 'en';
}
