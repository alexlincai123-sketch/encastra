'use client';

import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * GSAP setup, registered once.
 *
 * Two rules the rest of the site relies on:
 *
 * 1. **Reduced motion means no animation, not a fast one.** `prefersReducedMotion()` is checked
 *    before a timeline is constructed, so a motion-sensitive visitor gets the finished layout
 *    with no tween ever created — nothing eases, nothing pins, nothing scrubs. Shortening the
 *    duration would still move the page.
 * 2. **Every ScrollTrigger is owned by a context.** `createScope` returns the `revert` function
 *    a React effect must call on unmount. A ScrollTrigger that outlives its component keeps
 *    measuring a node that is gone, which is both a leak and a source of scroll jank.
 */

let registered = false;

function ensureRegistered(): void {
  if (registered) return;
  // Flip is registered alongside ScrollTrigger rather than on demand. It is used by exactly two
  // scenes — the ones where a set of parts is regrouped into a different arrangement, which is
  // the one move that cannot be expressed as a transform from a known start state — and
  // registering a GSAP plugin twice from two call sites is a class of bug worth not having.
  gsap.registerPlugin(ScrollTrigger, Flip);
  registered = true;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface Scope {
  /** Runs the build function with every tween and trigger recorded against this scope. */
  readonly context: gsap.Context;
  /** Kills everything the scope created and restores inline styles. Call it on unmount. */
  readonly revert: () => void;
}

/**
 * Builds a GSAP context bound to a root element.
 *
 * Returns `null` when motion is not wanted, which lets a caller write:
 *
 *     const scope = createScope(root, () => { ... });
 *     return () => scope?.revert();
 *
 * and get a correct no-op for a reduced-motion visitor without a second code path.
 */
export function createScope(
  root: Element | null,
  build: (self: gsap.Context) => void,
): Scope | null {
  if (root === null) return null;
  if (prefersReducedMotion()) return null;

  ensureRegistered();

  const context = gsap.context(build, root);
  return {
    context,
    revert: () => {
      context.revert();
    },
  };
}

/** Re-export so callers never import the plugin directly and risk a second registration. */
export { Flip, gsap, ScrollTrigger };
