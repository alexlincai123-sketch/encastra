'use client';

import type { ReactNode } from 'react';

import { SCENE_COPY } from '@/lib/scenes';
import { pinnedTimeline, targets, useScrollScene } from '@/lib/scroll';

import styles from './Scenes.module.css';

const COPY = SCENE_COPY.intro;
const WORDS = COPY.headline.split(' ');

/** Three hairline rectangles, roughly the proportions of the cards scene 2 fills with real
    component names — the first hint of what is about to appear. Sized and spread wide enough to
    read as a backdrop behind a headline that wraps to three lines at this scale, not a small
    diagram floating unrelated to it. */
const GHOSTS = [
  { x: 40, y: 40, w: 220, h: 130 },
  { x: 420, y: 260, w: 220, h: 130 },
  { x: 40, y: 430, w: 220, h: 130 },
] as const;

export function Scene01Intro(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const ghosts = gsap.utils.toArray<SVGRectElement>(`.${styles.introGhostRect}`);
    const words = gsap.utils.toArray<HTMLElement>(`.${styles.word}`);
    const headline = ctx.root.querySelector(`.${styles.headline}`);
    const sub = ctx.root.querySelector(`.${styles.body}`);
    const hint = ctx.root.querySelector(`.${styles.introScroll}`);

    gsap.set(ghosts, { strokeDashoffset: 1 });
    gsap.set(words, { yPercent: 115 });
    gsap.set(sub, { autoAlpha: 0, y: 12 });

    const tl = pinnedTimeline(ctx, { vh: 150 });

    tl.to(ghosts, { strokeDashoffset: 0, stagger: 0.08, duration: 0.32 }, 0)
      .to(words, { yPercent: 0, stagger: 0.05, duration: 0.4 }, 0.08)
      .to(sub, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.34)
      .to(hint, { autoAlpha: 0, duration: 0.1 }, 0.2)
      // Outro: the title recedes and the ghost rectangles brighten and grow — the same shapes
      // scene 2 resolves into real cards, so the cut lands on something the eye already tracked.
      .to(targets(headline, sub), { autoAlpha: 0, y: -24, duration: 0.22 }, 0.68)
      .to(ghosts, { stroke: 'var(--focus)', strokeWidth: 1.4, duration: 0.22 }, 0.7)
      .to(`.${styles.introGhosts}`, { scale: 1.08, autoAlpha: 0, duration: 0.3 }, 0.78);
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Intro" data-scene="intro">
      <div className={styles.pin} data-pin>
        <div className={`${styles.stage} ${styles.centerCol}`}>
          <div className={styles.introGhosts} aria-hidden="true">
            <svg width="680" height="600" viewBox="0 0 680 600" role="presentation">
              {GHOSTS.map((g) => (
                <rect
                  key={`${g.x}-${g.y}`}
                  className={styles.introGhostRect}
                  x={g.x}
                  y={g.y}
                  width={g.w}
                  height={g.h}
                  rx={5}
                  pathLength={1}
                />
              ))}
            </svg>
          </div>

          <span className={styles.index} data-animate>
            {COPY.index} — {COPY.eyebrow}
          </span>
          <h1 className={styles.headline}>
            {WORDS.map((word, i) => (
              // Fixed, ordered words from a constant string — position is a stable identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered.
              <span key={i} className={styles.wordMask}>
                <span className={styles.word} data-animate>
                  {word}
                </span>
                {i < WORDS.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h1>
          <p className={`lead ${styles.body}`} data-animate>
            {COPY.sub}
          </p>

          <div className={styles.introScroll} aria-hidden="true">
            <span>Scroll</span>
            <span className={styles.introScrollLine} />
          </div>
        </div>
      </div>
    </section>
  );
}
