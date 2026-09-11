import { type NextRequest, NextResponse } from 'next/server';

import { contentSecurityPolicy } from './lib/security';

/**
 * Mints a nonce per request and attaches the Content-Security-Policy.
 *
 * This is the file convention Next.js 16 calls `proxy` — what earlier versions called
 * `middleware`, which is deprecated.
 *
 * Next.js reads the nonce back out of the request's CSP header and applies it to the scripts it
 * emits, which is what allows `'strict-dynamic'` without an `'unsafe-inline'` fallback.
 *
 * The cost is that pages are rendered per request rather than served as prebuilt HTML. For a
 * site of this size that is a rounding error, and the alternative — `'unsafe-inline'` in
 * `script-src` — is not a trade worth making on the website of a product whose argument is that
 * it does not let strangers' code run with ambient authority.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';
  const csp = contentSecurityPolicy(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except static assets and the prefetch requests React makes for them. Hashing a
     * nonce into an immutable asset response would defeat its caching for no gain — the policy
     * that matters is the one on the document.
     */
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|svg|ico|txt|xml)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
