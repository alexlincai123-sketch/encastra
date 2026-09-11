'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Callout } from '@/components/ui/Ui';

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
 */
export function DownloadTarget(): ReactNode {
  const [os, setOs] = useState<DetectedOs>('unknown');

  useEffect(() => {
    setOs(detect());
  }, []);

  if (os === 'windows') {
    return (
      <Callout tone="ok" title="This looks like Windows">
        The installer below should run here. It is still not code-signed — see the note further down
        before you run it.
      </Callout>
    );
  }

  if (os === 'macos' || os === 'linux') {
    const label = os === 'macos' ? 'macOS' : 'Linux';
    return (
      <Callout tone="warn" title={`This looks like ${label}`}>
        There is no {label} build yet. The components declare support for it and the engine is
        written to be platform-independent, but only the Windows installer has actually been built,
        packaged and tested.
      </Callout>
    );
  }

  return null;
}
