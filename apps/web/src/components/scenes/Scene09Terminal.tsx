'use client';

import type { ReactNode } from 'react';

import { TerminalDemo } from '@/components/terminal/Terminal';
import { SCENE_COPY } from '@/lib/scenes';
import { targets, useScrollScene } from '@/lib/scroll';

import styles from './Scenes.module.css';

const COPY = SCENE_COPY.terminal;

/**
 * Deliberately not pinned. The terminal replays a transcript on real timers and already has its
 * own play/pause/restart/speed controls — a scrub-driven pin would fight that contract, and the
 * terminal plus the graph card beside it can be taller than one viewport, which `pin: true`
 * cannot show correctly anyway. Instead the whole scene reveals once, normally, as it scrolls
 * into view — still tied to scroll, just not scrubbed or pinned.
 */
export function Scene09Terminal(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const heading = ctx.root.querySelector(`.${styles.headline}`);
    const body = ctx.root.querySelector(`.${styles.body}`);
    const stage = ctx.root.querySelector(`.${styles.terminalStage}`);

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 18 });
    gsap.set(stage, { autoAlpha: 0, y: 28 });

    gsap
      .timeline({
        scrollTrigger: {
          trigger: ctx.root,
          start: 'top 78%',
          end: 'top 30%',
          scrub: 0.6,
        },
      })
      .to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.1 }, 0)
      .to(stage, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.3);
    // Cleanup: `useScrollScene` reverts the whole GSAP context on unmount, which kills this
    // ScrollTrigger and its timeline the same way it does for every other scene's pinned one.
  });

  return (
    <section
      ref={ref}
      className={styles.terminalSection}
      aria-label="Terminal"
      data-scene="terminal"
    >
      <div className={styles.stage}>
        <div className={styles.terminalIntro}>
          <span className={styles.index} data-animate>
            {COPY.index} — {COPY.eyebrow}
          </span>
          <h2 className={styles.headlineMd} data-animate>
            {COPY.headline}
          </h2>
          <p className={`lead ${styles.body}`} data-animate>
            {COPY.body}
          </p>
        </div>

        <div className={styles.terminalStage} data-animate>
          <TerminalDemo />
        </div>
      </div>
    </section>
  );
}
