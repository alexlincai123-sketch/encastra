'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { Cursor } from '@/components/cursor/Cursor';
import { SceneAssembly } from '@/components/scenes3d/SceneAssembly';
import type { Locale } from '@/lib/i18n/locale';
import { prefersReducedMotion, ScrollTrigger } from '@/lib/motion';

import { Backdrop } from './Backdrop';
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
 *
 * `locale`, computed server-side in `app/page.tsx` (a plain cookie read — see
 * `lib/i18n/locale.ts`), is threaded through as a prop to every 2D scene below rather than read
 * from context: it is one value, known before this component ever mounts, and prop-drilling it
 * eight levels deep is less machinery than a client-side provider would be for the same fact.
 * `SceneAssembly` — scenes 1 and 2, the WebGL layer — does not take it: that component is out of
 * scope for this pass (see `CLAUDE.md`'s note on `components/scenes3d/**`) and does not read
 * `lib/scenes.ts` copy today regardless.
 */
export function HomeExperience({ locale }: { locale: Locale }): ReactNode {
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
      <SceneAssembly locale={locale} />
      <Scene03Connect locale={locale} />
      <Scene04Build locale={locale} />
      <Scene05Run locale={locale} />
      <Scene06Result locale={locale} />
      <Scene07Reuse locale={locale} />
      <Scene08Ecosystem locale={locale} />
      <Scene09Terminal locale={locale} />
      <Scene10Try locale={locale} />
    </div>
  );
}
