import type { NextConfig } from 'next';

import { STATIC_SECURITY_HEADERS } from './src/lib/security';

/**
 * No CMS, no database, no auth, no privileged route handlers. The whole site is pages and data
 * files, which is why the configuration is short.
 *
 * The Content-Security-Policy is set in `src/proxy.ts` rather than here, because it carries a
 * per-request nonce. Everything that does not need one is set here so it applies even to a
 * response that file did not touch.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // A build that type-checks in CI and silently ignores errors in the product is not a check.
  // Linting is Biome's job, configured once at the repository root; Next.js 16 no longer takes
  // an `eslint` key at all, and there is no ESLint in this repository to configure.
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...STATIC_SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
