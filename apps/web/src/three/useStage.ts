'use client';

import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { createScope, gsap, prefersReducedMotion, ScrollTrigger } from '@/lib/motion';

import { createStage, type Stage, type StageOptions } from './stage';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface Stage3DCtx {
  readonly host: HTMLElement;
  readonly stage: Stage;
  readonly gsap: typeof gsap;
  readonly ScrollTrigger: typeof ScrollTrigger;
}

/**
 * Mounts a 3D stage into a host element and tears it down completely on unmount.
 *
 * The contract mirrors `useScrollScene` in `lib/scroll.ts` deliberately, so a scene author has
 * one shape to learn: return a ref, put it on the element, write the build function, and never
 * think about cleanup. Both the GSAP context and the stage are reverted here.
 *
 * `build` runs only when there is a stage to build on. A visitor with no WebGL, or one who asked
 * for reduced motion, never reaches it — which is why every scene's DOM has to carry the whole
 * story on its own, with the 3D layer as an addition rather than a replacement.
 */
export function useStage3D<T extends HTMLElement = HTMLDivElement>(
  build: (ctx: Stage3DCtx) => void,
  options: StageOptions = {},
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useIsomorphicLayoutEffect(() => {
    const host = ref.current;
    if (host === null || prefersReducedMotion()) return undefined;

    const stage = createStage(host, options);
    if (stage === null) return undefined;

    const onResize = () => stage.resize();
    window.addEventListener('resize', onResize);

    // The marker the CSS reads to stand the DOM telling of the story down. It is set only once
    // a stage really exists, so every path that returns before this — no WebGL, reduced motion,
    // a refused context — leaves the DOM version showing, which is the point of it.
    host.dataset.three = 'on';

    const scope = createScope(host, () => {
      build({ host, stage, gsap, ScrollTrigger });
    });

    return () => {
      window.removeEventListener('resize', onResize);
      delete host.dataset.three;
      // Order matters. The GSAP context is reverted first so no tween can fire against objects
      // whose geometry is about to be disposed; only then is the stage given back.
      scope?.revert();
      stage.dispose();
    };
    // The build closure is recreated every render but its behaviour is fixed per scene. Running
    // this again would tear down and rebuild a WebGL context on every state change, which is
    // the single most expensive thing this file could do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
