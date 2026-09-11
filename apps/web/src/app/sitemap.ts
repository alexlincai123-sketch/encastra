import type { MetadataRoute } from 'next';
import { LEGAL_DOCS } from '@/config/legal';
import { SITE } from '@/config/site';

/**
 * Every page, listed once.
 *
 * Built from the same arrays the navigation and the legal index are built from, so a page added
 * to the site is in the sitemap by virtue of existing rather than by somebody remembering to
 * add it here. A hand-maintained list is a list that is wrong within two releases.
 */
const ROUTES = [
  '',
  '/features',
  '/how-it-works',
  '/components',
  '/templates',
  '/community',
  '/marketplace',
  '/pricing',
  '/security',
  '/docs',
  '/tutorials',
  '/download',
  '/about',
  '/contact',
  '/legal',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...ROUTES.map((path) => ({
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
