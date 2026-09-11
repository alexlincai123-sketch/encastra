import type { MetadataRoute } from 'next';
import { SITE } from '@/config/site';

/**
 * What a crawler may read.
 *
 * Everything, because everything here is public documentation of a product. There is no
 * account area, no user content and no private route to keep out of an index — and a
 * `Disallow` on a site with nothing to hide is a rule somebody later has to work out the
 * reason for.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
