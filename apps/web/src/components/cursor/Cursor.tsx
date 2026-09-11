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

    function apply(): void {
      setEnabled(fine.matches && !reduced.matches);
    }
    apply();
    fine.addEventListener('change', apply);
    reduced.addEventListener('change', apply);
    return () => {
      fine.removeEventListener('change', apply);
      reduced.removeEventListener('change', apply);
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
