'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { Cursor } from '@/components/cursor/Cursor';
import { prefersReducedMotion, ScrollTrigger } from '@/lib/motion';

import { Backdrop } from './Backdrop';
import { Scene01Intro } from './Scene01Intro';
import { Scene02WhatIf } from './Scene02WhatIf';
import { Scene03Connect } from './Scene03Connect';
import { Scene04Build } from './Scene04Build';
import { Scene05Run } from './Scene05Run';
import { Scene06Result } from './Scene06Result';
import { Scene07Reuse } from './Scene07Reuse';
import { Scene08Ecosystem } from './Scene08Ecosystem';
import { Scene09Terminal } from './Scene09Terminal';
import { Scene10Try } from './Scene10Try';
import styles from './Scenes.module.css';

/**
 * The scroll-driven homepage narrative — ten scenes, a persistent canvas backdrop, and a custom
 * cursor. Mounted from `app/page.tsx`, which stays a server component for its `metadata` export
 * and for the static, always-crawlable closing section it renders below this.
 *
 * Every scene owns its own `ScrollTrigger` lifecycle (`lib/scroll.ts`'s `useScrollScene`); this
 * component's only added responsibility is one `ScrollTrigger.refresh()` after everything has
 * mounted, so the ten scenes' scroll distances are measured against the page's real final
 * height rather than whatever partial height existed when the first of them registered.
 */
export function HomeExperience(): ReactNode {
  useEffect(() => {
    // Under reduced motion, no scene ever registers the ScrollTrigger plugin at all (every one
    // of them returns before that point) — nothing to refresh, and nothing to call it on.
    if (prefersReducedMotion()) return undefined;
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={styles.experience}>
      <Backdrop />
      <Cursor />
      <Scene01Intro />
      <Scene02WhatIf />
      <Scene03Connect />
      <Scene04Build />
      <Scene05Run />
      <Scene06Result />
      <Scene07Reuse />
      <Scene08Ecosystem />
      <Scene09Terminal />
      <Scene10Try />
    </div>
  );
}
