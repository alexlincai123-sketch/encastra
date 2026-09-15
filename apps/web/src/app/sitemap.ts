import type { MetadataRoute } from 'next';
import { LEGAL_DOCS } from '@/config/legal';
import { SITE_ROUTES } from '@/config/nav';
import { SITE } from '@/config/site';

/**
 * Every page, listed once.
 *
 * The claim this file used to make in its own comment — "built from the same arrays the
 * navigation is built from" — was not true: the list below it was typed by hand, and `/ecosystem`
 * was in both navigations and in neither this list nor any crawler's idea of the site. It is now
 * literally true. `SITE_ROUTES` is derived from `config/nav.ts`; the legal documents come from
 * `config/legal.ts`, which is the only place that knows all ten of them; nothing here is a third
 * copy of either, and `test/sitemap.test.ts` fails if a navigable page stops being covered.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...SITE_ROUTES.map((path) => ({
      url: `${SITE.url}${path}`,
      lastModified: now,
      // The home page and the download page are the two anybody arrives at; the rest are read
      // after them.
      priority: path === '' ? 1 : path === '/download' ? 0.9 : 0.7,
    })),
    ...LEGAL_DOCS.map((doc) => ({
      url: `${SITE.url}/legal/${doc.slug}`,
      lastModified: now,
      priority: 0.3,
    })),
  ];
}
