'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { gsap } from '@/lib/motion';

import styles from './Cursor.module.css';

const HOVER_SELECTOR = 'a, button, [role="button"], input, [data-cursor-hover]';

/**
 * A minimal custom cursor: a dot that tracks the pointer exactly and a ring that trails it and
 * grows over anything interactive.
 *
 * Mounted only when the input actually has a mouse-like pointer (`pointer: fine` and
 * `hover: hover`) — a touch device never runs any of this, not even the `matchMedia` listener
 * setup, because the component returns `null` before its effect subscribes to anything. Also off
 * under reduced motion: a cursor that is only ever exactly where the pointer already is adds
 * nothing, and this skips deciding whether "following" itself counts as motion to reduce.
 *
 * And off for anybody who has asked their system for a stronger contrast or for its own colours.
 * This component does not merely draw a cursor, it *removes the native one* (`body.style.cursor =
 * 'none'` below) and replaces it with two small shapes drawn in this site's palette. Under
 * Windows High Contrast / `forced-colors`, a page's colours are overridden but these elements
 * still are not the operating system's pointer, which a visitor using forced colours may have
 * deliberately enlarged, recoloured or themed; under `prefers-contrast: more` the request is
 * explicitly for more legible chrome, and a thin dot with a faint trailing ring is less legible
 * than the arrow it replaced. In both cases the honest answer is to leave the pointer the
 * visitor already chose alone — nothing else on the page depends on this component existing.
 */
export function Cursor(): ReactNode {
  const [enabled, setEnabled] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);
  const ringRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const fine = window.matchMedia('(pointer: fine) and (hover: hover)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Two separate queries rather than one comma-joined list: a browser that does not know
    // `prefers-contrast` would fail to parse a list containing it and take the whole query with
    // it, silently disabling the escape hatch *and* the forced-colors one. Queried apart, an
    // unknown feature is simply a query that never matches, and the rest still work.
    const forcedColours = window.matchMedia('(forced-colors: active)');
    const moreContrast = window.matchMedia('(prefers-contrast: more)');
    const queries = [fine, reduced, forcedColours, moreContrast];

    function apply(): void {
      setEnabled(
        fine.matches && !reduced.matches && !forcedColours.matches && !moreContrast.matches,
      );
    }
    apply();
    for (const query of queries) query.addEventListener('change', apply);
    return () => {
      for (const query of queries) query.removeEventListener('change', apply);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const root = rootRef.current;
    if (dot === null || ring === null || root === null) return undefined;

    const moveDot = gsap.quickTo(dot, 'x', { duration: 0.05, ease: 'none' });
    const moveDotY = gsap.quickTo(dot, 'y', { duration: 0.05, ease: 'none' });
    const moveRing = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' });
    const moveRingY = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });

    function onMove(event: PointerEvent): void {
      moveDot(event.clientX);
      moveDotY(event.clientY);
      moveRing(event.clientX);
      moveRingY(event.clientY);
      const target = event.target;
      const hovering = target instanceof Element && target.closest(HOVER_SELECTOR) !== null;
      root?.setAttribute('data-hover', hovering ? 'true' : 'false');
    }

    function onLeave(): void {
      gsap.to(root, { opacity: 0, duration: 0.15, overwrite: true });
    }

    function onEnter(): void {
      gsap.to(root, { opacity: 1, duration: 0.15, overwrite: true });
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.documentElement.addEventListener('pointerenter', onEnter);
    // Set directly rather than through a stylesheet rule: `globals.css` is owned elsewhere, and
    // this way the native cursor's removal and this component's presence can never drift apart.
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'none';

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.documentElement.removeEventListener('pointerenter', onEnter);
      document.body.style.cursor = previousCursor;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={rootRef} className={styles.cursor} data-hover="false" aria-hidden="true">
      <span ref={ringRef} className={styles.ring} />
      <span ref={dotRef} className={styles.dot} />
    </div>
  );
}
