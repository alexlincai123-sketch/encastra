'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { createScope, prefersReducedMotion, ScrollTrigger } from '@/lib/motion';

/**
 * The fixed dot-grid behind every scene — the product's own canvas
 * (`--canvas-bg`/`--canvas-dot`/`--canvas-dot-strong` in `packages/ui/tokens.css`), brought
 * outside the app. Everything the visitor scrolls through happens "on the canvas": the same
 * surface the real editor draws components on.
 *
 * A single `<canvas>` rather than one grid per scene — cheaper, and it is what makes the ten
 * scenes read as one continuous surface instead of ten separate backgrounds.
 *
 * Cost discipline: colours are read from computed style once, and again only when the theme
 * attribute actually changes (a `MutationObserver`, not a per-frame read) — reading computed
 * style every scroll tick would be a needless style recalculation on every frame. The parallax
 * offset comes from one `ScrollTrigger` spanning the whole document with `scrub: true`; its
 * `onUpdate` already fires inside GSAP's own rAF batching, so there is no independent
 * `requestAnimationFrame` loop here to leak or to keep spinning off-screen.
 */
export function Backdrop(): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return undefined;

    let tokens = readTokens();
    let progress = 0;

    function readTokens(): { bg: string; dot: string; dotStrong: string } {
      const computed = getComputedStyle(document.documentElement);
      return {
        bg: computed.getPropertyValue('--canvas-bg').trim() || '#0e1116',
        dot: computed.getPropertyValue('--canvas-dot').trim() || '#1b2029',
        dotStrong: computed.getPropertyValue('--canvas-dot-strong').trim() || '#232a35',
      };
    }

    function resize(): void {
      if (canvas === null || ctx === null) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw(): void {
      if (canvas === null || ctx === null) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const step = 28;
      const drift = progress * step * 3;

      ctx.fillStyle = tokens.bg;
      ctx.fillRect(0, 0, w, h);

      const offsetY = drift % step;
      for (let y = -step + offsetY; y < h + step; y += step) {
        const rowIndex = Math.round((y - offsetY) / step);
        const strong = rowIndex % 4 === 0;
        ctx.fillStyle = strong ? tokens.dotStrong : tokens.dot;
        for (let x = 0; x < w + step; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, strong ? 1.3 : 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    resize();
    window.addEventListener('resize', resize);

    const themeObserver = new MutationObserver(() => {
      tokens = readTokens();
      draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const scope = prefersReducedMotion()
      ? null
      : createScope(canvas, () => {
          ScrollTrigger.create({
            trigger: document.documentElement,
            start: 'top top',
            end: () => Math.max(document.documentElement.scrollHeight - window.innerHeight, 1),
            scrub: true,
            onUpdate: (self) => {
              progress = self.progress;
              draw();
            },
          });
        });

    return () => {
      window.removeEventListener('resize', resize);
      themeObserver.disconnect();
      scope?.revert();
    };
  }, []);

  return (
    // A plain <canvas> with no tabindex and no interactive fallback content is never
    // keyboard-focusable — Biome flags the tag itself without checking for that, and there is no
    // attribute-only alternative it accepts instead (`role="presentation"` here trips the
    // opposite rule, noInteractiveElementToNoninteractiveRole).
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative canvas, no tabindex, nothing focusable.
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        display: 'block',
      }}
    />
  );
}
