'use client';

import type { ReactNode } from 'react';

import { TerminalDemo } from '@/components/terminal/Terminal';
import terminal from '@/components/terminal/Terminal.module.css';
import { BEAT, flow, handoff, handon, merge } from '@/lib/motion-system';
import { SCENE_COPY } from '@/lib/scenes';
import { sel, targets, useScrollScene } from '@/lib/scroll';

import scene from './Scene09.module.css';
import styles from './Scenes.module.css';

const COPY = SCENE_COPY.terminal;

/**
 * Deliberately not pinned — see the original note this scene shipped with: the transcript in
 * `TerminalDemo` runs on real timers with its own play/pause/speed controls, a scrub-driven pin
 * would fight that, and the terminal plus graph card can be taller than one viewport. The scene
 * still reveals on scroll, just not scrubbed-and-pinned.
 *
 * What changed: the terminal card and the graph card — both rendered by `TerminalDemo`, which
 * this file may read from via `Terminal.module.css` but may not edit — now arrive as one paired
 * composition (MERGE) rather than two unrelated boxes that happen to share a grid row, and a
 * short FLOW crosses the gap between them once they land, standing for "the command's effect
 * reaches the workflow" without pretending to track *which* command. Real per-line
 * synchronisation — lighting this connector exactly when a given transcript line prints — would
 * need `Terminal.tsx` to expose its `revealCount`/active step outward (a prop callback or a ref),
 * which this brief rules out touching; this scene does not attempt it.
 */
export function Scene09Terminal(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const heading = ctx.root.querySelector(sel(styles.headline));
    const body = ctx.root.querySelector(sel(styles.body));
    const pair = ctx.root.querySelector<HTMLElement>(sel(scene.pair));
    const terminalCard = ctx.root.querySelector<HTMLElement>(sel(terminal.terminalCard));
    const graphCard = ctx.root.querySelector<HTMLElement>(sel(terminal.graphCard));
    const bridgeDot = ctx.root.querySelector<HTMLElement>(sel(scene.bridgeDot));

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 18 });
    if (bridgeDot != null) gsap.set(bridgeDot, { xPercent: 0, autoAlpha: 0 });

    // Tracked and reverted automatically by the surrounding `gsap.context()` (see
    // `useScrollScene`) along with everything else it creates.
    const mm = gsap.matchMedia();

    mm.add({ desktop: '(min-width: 900px)', mobile: '(max-width: 899px)' }, (context) => {
      const conditions = context.conditions as { desktop?: boolean } | undefined;
      const desktop = conditions?.desktop ?? true;

      gsap.set(targets(terminalCard), { x: -70 });
      gsap.set(targets(graphCard), { x: 70 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: ctx.root, start: 'top 78%', end: 'top 30%', scrub: 0.6 },
      });

      // The pair arrives as one unit (HANDON, receiving from scene 8's own handoff) — `pair` is
      // a direct child of `.stage`, which is the element carrying `u-stage`'s perspective, so its
      // Z motion actually renders. `terminalCard`/`graphCard` sit several layers inside
      // `TerminalDemo`'s own markup, past an intermediate flat container this file cannot touch,
      // so their own arrival is X-only (MERGE) rather than reaching for depth it cannot deliver.
      handon(tl, targets(heading, body, pair), { at: 0 });
      merge(tl, targets(terminalCard, graphCard), { at: 0.16, duration: BEAT.long });

      // FLOW, desktop only — fewer pieces animated on a narrow screen, where the product's own
      // grid stacks the two cards vertically and a horizontal connector has nothing to sit on.
      if (desktop && bridgeDot != null) {
        flow(tl, bridgeDot, { at: 0.58, duration: BEAT.base, fromPercent: 0, toPercent: 600 });
      }

      const exit = gsap.timeline({
        scrollTrigger: { trigger: ctx.root, start: 'bottom 45%', end: 'bottom 5%', scrub: 0.6 },
      });
      handoff(exit, targets(heading, body, pair), { at: 0, duration: 1 });
    });
  });

  return (
    <section
      ref={ref}
      className={styles.terminalSection}
      aria-label="Terminal"
      data-scene="terminal"
    >
      <div className={`${styles.stage} u-stage`}>
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

        <div className={`${styles.terminalStage} ${scene.pair}`} data-animate>
          <div className={scene.bridge} aria-hidden="true">
            <span className={scene.bridgeLine} />
            <span className={scene.bridgeDot} />
          </div>
          <TerminalDemo />
        </div>
      </div>
    </section>
  );
}
