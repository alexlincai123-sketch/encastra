'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Callout } from '@/components/ui/Ui';
import type { Locale } from '@/lib/i18n/locale';
import { t } from '@/lib/i18n/translate';

type DetectedOs = 'windows' | 'macos' | 'linux' | 'unknown';

function detect(): DetectedOs {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return 'windows';
  if (/mac os x|macintosh/i.test(ua)) return 'macos';
  if (/linux|x11/i.test(ua)) return 'linux';
  return 'unknown';
}

/**
 * The only thing this component does: read `navigator.userAgent` once, client-side, and say
 * whether the one real artefact on this page — the Windows installer — matches the machine
 * reading it. It changes no other content on the page and reaches no network.
 *
 * `locale` arrives as a prop from `download/page.tsx` (a server component) rather than being
 * re-read here, the same reason `Header.tsx`/`Footer.tsx` take it as a prop — see `locale.ts`.
 */
export function DownloadTarget({ locale }: { locale: Locale }): ReactNode {
  const [os, setOs] = useState<DetectedOs>('unknown');

  useEffect(() => {
    setOs(detect());
  }, []);

  if (os === 'windows') {
    return (
      <Callout tone="ok" title={t(locale, 'download.target.windowsTitle')}>
        {t(locale, 'download.target.windowsBody')}
      </Callout>
    );
  }

  if (os === 'macos' || os === 'linux') {
    const label =
      os === 'macos' ? t(locale, 'download.target.macos') : t(locale, 'download.target.linux');
    return (
      <Callout tone="warn" title={t(locale, 'download.target.otherTitle', { label })}>
        {t(locale, 'download.target.otherBody', { label })}
      </Callout>
    );
  }

  return null;
}
