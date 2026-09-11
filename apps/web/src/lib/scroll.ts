'use client';

import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { createScope, gsap, prefersReducedMotion, ScrollTrigger } from './motion';

/**
 * Shared ScrollTrigger lifecycle for the ten homepage scenes.
 *
 * `lib/motion.ts` already owns plugin registration and the reduced-motion contract — this file
 * only standardises how a scene *uses* that contract, so all ten scenes clean up identically and
 * a review of one scene tells you how every other one behaves.
 */

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface SceneCtx {
  /** The `<section>` a scene rendered its ref onto. Never `null` inside `build`. */
  readonly root: HTMLElement;
  /** The element marked `data-pin` inside `root`, if the scene has one. */
  readonly pin: HTMLElement | null;
  readonly gsap: typeof gsap;
  readonly ScrollTrigger: typeof ScrollTrigger;
}

export type SceneBuild = (ctx: SceneCtx) => void;

/**
 * Mounts a GSAP context scoped to the returned ref and reverts it on unmount.
 *
 * Under `prefers-reduced-motion`, `createScope` returns `null` and `build` never runs at all —
 * no timeline, no pin, no ScrollTrigger. That is why every scene's plain JSX must already render
 * its finished, readable state: the reduced-motion visitor never sees anything else. `build`
 * exists only to animate *between* states an unreduced visitor scrolls through.
 */
export function useScrollScene<T extends HTMLElement = HTMLElement>(
  build: SceneBuild,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useIsomorphicLayoutEffect(() => {
    const root = ref.current;
    const scope = createScope(root, () => {
      if (root === null) return;
      const pin = root.querySelector<HTMLElement>('[data-pin]');
      build({ root, pin, gsap, ScrollTrigger });
    });
    return () => scope?.revert();
    // The build function is created fresh every render but its logic is static per scene; scenes
    // pass a stable closure and re-running this on every render would tear down and rebuild the
    // pin on every scroll-driven state change, which is the opposite of what scrub needs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}

/**
 * A pinned, scroll-scrubbed timeline — the shape every full-bleed scene shares.
 *
 * `pinTarget` defaults to whatever the scene marked `data-pin`, or `root` itself if it did not.
 * `vh` is how many viewport-heights of scroll the scene consumes before it releases the pin;
 * ScrollTrigger inserts the spacer that reserves that scroll distance itself — nothing in CSS
 * has to reserve a tall, empty box for a reduced-motion visitor who never triggers this at all.
 */
export function pinnedTimeline(
  ctx: SceneCtx,
  opts: { vh?: number; scrub?: number | boolean } = {},
): gsap.core.Timeline {
  const { vh = 180, scrub = 1 } = opts;
  return gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: ctx.root,
      start: 'top top',
      // Viewport heights, resolved at refresh — not `+=180%`.
      //
      // A percentage in `end` is a percentage of the *trigger's* height, and the trigger here is
      // the section this very timeline is about to pin. Pinning inserts a spacer, the section
      // grows by the scroll distance, and on the next refresh the percentage is taken against
      // the taller section: the scene then consumes several times the scroll it was written for
      // and plays at a fraction of the intended pace. Measured on this page before the fix, a
      // scene asking for 320% of the viewport was given 320% of 3,780px.
      //
      // A function is re-evaluated on every refresh, so this also stays correct across a resize.
      end: () => `+=${Math.round(window.innerHeight * (vh / 100))}`,
      scrub,
      pin: ctx.pin ?? ctx.root,
      pinSpacing: true,
      anticipatePin: 1,
    },
  });
}

/**
 * A deterministic "sunflower" scatter in the unit square — the same output on every render, no
 * runtime physics or layout simulation. Used to place a growing set of component cards so the
 * arrangement reads as organic rather than gridded, without ever measuring the DOM to do it.
 */
export function sunflowerLayout(
  count: number,
  spread = 0.46,
): ReadonlyArray<{ x: number; y: number; rotate: number }> {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points: Array<{ x: number; y: number; rotate: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const r = Math.sqrt((i + 0.5) / count);
    const theta = i * golden;
    points.push({
      x: 0.5 + r * Math.cos(theta) * spread,
      y: 0.5 + r * Math.sin(theta) * spread,
      rotate: (((theta * 180) / Math.PI) % 14) - 7,
    });
  }
  return points;
}

export { prefersReducedMotion };

/**
 * GSAP targets with the misses dropped.
 *
 * `querySelector` returns `Element | null`, and a scene that looks up six elements will sooner
 * or later look up one that is not there — a conditional branch, a renamed class, a element that
 * only exists on wide viewports. GSAP forgives a bare `null` target with a warning. It does not
 * forgive a `null` *inside an array*: it reaches for `target._gsap` and throws, and an uncaught
 * throw during a layout effect takes the whole page down.
 *
 * So nothing is ever handed an array literal directly. The animation for a missing element
 * quietly does nothing, which is the correct outcome — the element is not on screen to animate.
 */
export function targets(...items: readonly (Element | null | undefined)[]): Element[] {
  return items.filter((item): item is Element => item != null);
}

/**
 * A valid CSS selector for a CSS-Modules class name.
 *
 * `styles.foo` is usually one generated class, and `` `.${styles.foo}` `` is usually fine. But a
 * class declared with `composes:` resolves to **two** class names separated by a space — a
 * perfectly good `className`, and a selector that throws `SyntaxError` the moment it reaches
 * `querySelector`. `Scenes.module.css` has five such classes today, and a scene that happens to
 * reach for one of them would take the page down.
 *
 * Splitting on whitespace and joining with dots turns either shape into a compound selector:
 * one class stays `.a`, two become `.a.b`, which matches exactly the same elements. There is no
 * case where this is wrong and one where it is the difference between a working page and a
 * crash, so scenes use it rather than interpolating a class name directly.
 */
export function sel(className: string | undefined): string {
  // `undefined` is accepted because that is what a CSS-Modules lookup is typed as, and refusing
  // it would only push the problem into ninety call sites that would each handle it slightly
  // differently. The result — `.undefined` — is a valid selector that matches nothing, which is
  // exactly what the old `` `.${styles.missing}` `` produced. Nothing is quietly papered over:
  // the lookup still returns null and GSAP still says so, which is how this bug was found.
  return `.${String(className).trim().split(/\s+/).join('.')}`;
}
