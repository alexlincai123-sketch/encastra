# Deploying the website

**Status: prepared, not deployed. Blocked on a host and a domain, both of which need an account
and money.**

Nothing has been published. The site builds, and these are the exact steps for somebody with
credentials to put it somewhere.

---

## 1. What is being deployed

`apps/web` — a Next.js App Router site. No database, no authentication, no API route that does
anything privileged, no server-side state. It is a static-leaning site with client-side motion.

That shape matters: it can be served by anything, and the cheapest correct answer is a static
CDN rather than a running server.

```bash
npm ci
npm run build --workspace @encastra/web
```

Output goes to `apps/web/.next`. A Node host runs it with `next start`; a static host needs
`output: 'export'` in `next.config.ts`, which is a change to make deliberately — check first
that nothing on the site relies on a server, because dynamic routes and OS detection may.

## 2. Before the first deploy — a checklist that is not optional

| Item | State | What is needed |
|---|---|---|
| Production build | ✅ passes | — |
| Typecheck, lint | ✅ pass | — |
| `robots.txt` | ✅ generated | — |
| `sitemap.xml` | ✅ generated from the real route list | — |
| Favicon and app icons | ✅ from the brand assets | — |
| Metadata, OpenGraph, Twitter cards | ✅ per route | — |
| Canonical URLs | ✅ built from `SITE.url` | Point `SITE.url` at the real domain first |
| OG image | ❌ missing | A real 1200×630 image; the mark alone is not enough |
| Structured data | ❌ missing | `SoftwareApplication` JSON-LD on `/` and `/download` |
| 404 page | ❌ default | A designed one |
| 500 page | ❌ default | A designed one |
| Analytics | ❌ none, by choice | See §5 |
| Security headers | ⚠️ partial | CSP is set in `next.config.ts`; verify it survives the host |
| HTTPS | n/a | Every credible host does this; confirm HSTS is on |

## 3. The domain

`SITE.url` is `https://encastra.dev`. **It is not registered**, and nothing on the site links to
it as if it were live — it exists only to build canonical URLs.

A DNS check on 2026-09-11 found **no A record** for `encastra.dev`, `encastra.com`,
`encastra.app` or `encastra.io`.

**That is not proof that any of them is available.** A registered domain can have no A record —
parked, held, or serving only mail. Availability has to be checked at a registrar, and that check
has not been done. Do not treat the absence of an A record as a free domain.

Also unresolved: the name itself has not been cleared for trademark. `docs/BRANDING.md` records
that availability of a domain and a package name is not clearance, and that has not changed.

When a domain is chosen:
1. Set `SITE.url` in `apps/web/src/config/site.ts`. It is the single place the URL appears.
2. Point an `A`/`AAAA` or `CNAME` at the host.
3. Confirm the certificate covers both apex and `www`, and that one redirects to the other.

## 4. Hosts

| Host | Fits because | Watch out for |
|---|---|---|
| **Vercel** | Built by the same people as Next; zero configuration | Vendor coupling; check the CSP survives their injected scripts |
| **Cloudflare Pages** | Cheap, fast, good CDN | Next on Pages needs the adapter; verify the build |
| **Netlify** | Straightforward | Same adapter question |
| **A plain VPS** | Total control, no vendor | You now run a server, a certificate and its renewal |

No recommendation is being made. All four work for a site this shape.

## 5. Analytics — a decision, not a default

There is **none**, and none has been added.

That is deliberate and it matches what the product says about itself: the application collects no
telemetry, and Settings states that as a fact. A website that quietly tracked every visitor while
the application boasted about collecting nothing would be an embarrassing contradiction to have
shipped.

If analytics is wanted later, it should be privacy-respecting and cookieless (Plausible, Fathom,
Umami), disclosed in the privacy policy before it is switched on, and it should not require a
cookie banner — because the correct way to avoid a cookie banner is to not need one.

## 6. After deploying — verify rather than assume

```bash
curl -sI https://<domain>/ | head -20          # status, headers, HSTS
curl -s  https://<domain>/robots.txt
curl -s  https://<domain>/sitemap.xml | head
```

Then in a browser: every route from the header and the footer, the scroll story on a real
machine, the terminal, mobile width, `prefers-reduced-motion`, and the console — which must be
clean.

Run Lighthouse. Performance and accessibility are the two that matter here; the scroll story is
the thing most likely to cost either of them.

## 7. What must never be deployed

- **No secrets in `NEXT_PUBLIC_*`.** Anything with that prefix is public, whatever it is called.
- **No analytics without disclosing it first.**
- **No claim that the build is signed** until it is. The download page states the opposite today
  and that statement is correct.
- **No marketplace, community, accounts or payments presented as working.** They are not built.

## Related

- `docs/WEBSITE.md` — what the site is and the rules it was written under
- `docs/BRANDING.md` — the name, and why availability is not clearance
- `docs/BETA-0.3.md` — where this sits among everything else outstanding
