import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import '@encastra/ui/tokens.css';
import './globals.css';

import { Footer } from '@/components/site/Footer';
import { Header } from '@/components/site/Header';
import { SITE, VERSION } from '@/config/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
  },
  // No Twitter card image is declared: there is no image to declare, and pointing at one that
  // does not exist would render as a broken preview.
  other: { 'encastra:version': VERSION },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark light',
};

/**
 * Applies the stored theme before first paint.
 *
 * Kept to one statement and no dependencies. It runs with the request's nonce, so it is
 * permitted by the Content-Security-Policy without opening `script-src` to inline code in
 * general. Falling back to `dark` matches the application, which is dark-first.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('encastra-theme');if(!t){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}`;

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          // The content is a constant defined above. No visitor input reaches it, and nothing
          // on this site evaluates anything at runtime.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a nonced constant with no dynamic part; the alternative is a blocking network round-trip before first paint.
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
          {...(nonce !== undefined ? { nonce } : {})}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
