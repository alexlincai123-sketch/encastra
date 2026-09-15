/**
 * The website's Content-Security-Policy and the headers that travel with it.
 *
 * One definition, consumed by `proxy.ts` (which mints a per-request nonce) and by
 * `next.config.ts` (which sets everything that does not need one). Two places writing security
 * headers would be two places to forget one.
 *
 * The policy is deliberately close to the desktop application's — see `docs/SECURITY.md` §10.
 * The site loads no third-party script, no third-party font, no analytics and no embeds, so
 * there is nothing to open a hole for. The interactive terminal on the home page is an
 * animation replaying a fixed transcript; `'unsafe-eval'` is absent because nothing on this
 * site evaluates anything, and that is a constraint the policy is here to enforce rather than a
 * property it happens to have.
 */

/**
 * Built per request so the nonce is fresh. `script-src` carries `'strict-dynamic'` alongside
 * the nonce: Next.js loads its own chunks from a nonced bootstrap, and `'strict-dynamic'` is
 * what lets those chunks run without widening the policy to a host allowlist.
 */
export function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    [
      'script-src',
      isDev
        ? // The dev server's React Fast Refresh transport needs eval. Production does not, and
          // this branch cannot reach a deployed build.
          ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
        : ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    ],
    // Next.js emits its critical CSS inline, and the node/wire visuals position elements with
    // inline styles. Styles cannot execute; scripts can, which is why only this one is loose.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:']],
    ['font-src', ["'self'"]],
    ['connect-src', isDev ? ["'self'", 'ws:'] : ["'self'"]],
    ['media-src', ["'none'"]],
    ['object-src', ["'none'"]],
    ['frame-src', ["'none'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['upgrade-insecure-requests', []],
  ];

  return directives
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

/**
 * Everything that is the same on every request. Set from `next.config.ts` so that a route which
 * somehow bypassed `proxy.ts` still gets them.
 */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // The site asks for no device capability at all. Saying so explicitly means a future
    // dependency cannot quietly start asking.
    value:
      'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), xr-spatial-tracking=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];
