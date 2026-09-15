import { describe, expect, it } from 'vitest';

import { LEGAL_DOCS } from '../src/config/legal';
import { FOOTER_NAV, PRIMARY_NAV, SITE_ROUTES } from '../src/config/nav';

/**
 * The sitemap cannot quietly lose a page again.
 *
 * `/ecosystem` shipped in the primary navigation and in the footer while being absent from
 * `app/sitemap.ts`'s hand-typed route list — a page the site links to twice and offers to a
 * crawler zero times. The fix was to derive the list (`config/nav.ts`'s `SITE_ROUTES`); this is
 * the test that keeps it derived, because a derivation with a filter in it can still drop the
 * wrong thing.
 *
 * These tests read `config/nav.ts` and `config/legal.ts` rather than `app/sitemap.ts` itself.
 * That is deliberate and not laziness: the root `vitest.config.ts` (the one the repository's gate
 * runs) configures no `@/*` path alias, so importing anything under `src/app/**` — every file
 * there imports `@/config/...` — would fail to resolve. Both config modules import nothing at
 * all, so they load anywhere. What `sitemap.ts` adds on top of them is a `.map()` per entry and
 * nothing else: cover `SITE_ROUTES` ∪ `LEGAL_DOCS` and the sitemap is covered.
 */

/** Every href either navigation points at, deduplicated, in the order they appear. */
function navHrefs(): readonly string[] {
  return Array.from(
    new Set([
      ...PRIMARY_NAV.map((item) => item.href),
      ...FOOTER_NAV.flatMap((group) => group.items.map((item) => item.href)),
    ]),
  );
}

/** What `sitemap.ts` actually emits, as paths: the derived routes plus every legal document. */
function sitemapPaths(): readonly string[] {
  return [...SITE_ROUTES, ...LEGAL_DOCS.map((doc) => `/legal/${doc.slug}`)];
}

describe('sitemap covers every navigable page', () => {
  it('lists every href in the primary nav and the footer', () => {
    const covered = new Set(sitemapPaths());
    // An anchor is a position on a page that is already listed, not a page of its own.
    const pages = navHrefs().filter((href) => !href.includes('#'));
    expect(pages.filter((href) => !covered.has(href))).toEqual([]);
  });

  it('lists /ecosystem — the page that was missing', () => {
    expect(sitemapPaths()).toContain('/ecosystem');
  });

  it('lists the home page', () => {
    expect(SITE_ROUTES).toContain('');
  });

  it('lists every legal document, not only the three the footer links', () => {
    const covered = new Set(sitemapPaths());
    const missing = LEGAL_DOCS.filter((doc) => !covered.has(`/legal/${doc.slug}`));
    expect(missing).toEqual([]);
  });
});

describe('sitemap lists nothing twice', () => {
  it('has no duplicate paths', () => {
    const paths = sitemapPaths();
    expect(paths.length).toBe(new Set(paths).size);
  });

  it('leaves the individual legal documents out of SITE_ROUTES, so they are added once', () => {
    expect(SITE_ROUTES.filter((path) => path.startsWith('/legal/'))).toEqual([]);
  });

  it('keeps the legal index itself, which is a real page', () => {
    expect(SITE_ROUTES).toContain('/legal');
  });
});

describe('SITE_ROUTES holds paths, not URLs', () => {
  it('every entry is empty or starts with a single slash', () => {
    const malformed = SITE_ROUTES.filter(
      (path) => path !== '' && (!path.startsWith('/') || path.startsWith('//')),
    );
    expect(malformed).toEqual([]);
  });

  it('carries no query string and no fragment', () => {
    expect(SITE_ROUTES.filter((path) => path.includes('?') || path.includes('#'))).toEqual([]);
  });
});
