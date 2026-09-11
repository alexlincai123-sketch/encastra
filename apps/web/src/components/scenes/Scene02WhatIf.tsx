'use client';

import type { ReactNode } from 'react';

import { GraphNode, Wire } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import { assemble, handoff, handon, snap } from '@/lib/motion-system';
import { CONNECT_ACCEPTED_LABEL, SCENE_COPY, WHAT_IF_IDS } from '@/lib/scenes';
import { pinnedTimeline, sel, targets, useScrollScene } from '@/lib/scroll';

import scene from './Scene02.module.css';
import styles from './Scenes.module.css';

const COPY = SCENE_COPY.whatIf;

/**
 * The pair that gets a wire: `encastra.file.watch` and `encastra.image.resize`, the same real
 * FILE → IMAGE conversion `lib/scenes.ts` names for scene 3 — this scene does not invent a second
 * connection to make the point, it previews the one the page teaches properly two scenes later.
 */
const PAIR_SOURCE_ID = WHAT_IF_IDS[0];
const PAIR_TARGET_ID = WHAT_IF_IDS[1];
const LOOSE_IDS = WHAT_IF_IDS.slice(2);

const PAIR_SOURCE = componentNode(PAIR_SOURCE_ID);
const PAIR_TARGET = componentNode(PAIR_TARGET_ID);
const LOOSE_NODES = LOOSE_IDS.map((id) => componentNode(id));

/** Hand-placed, not `sunflowerLayout` — four corners read as "separate modules" more plainly
    than an organic scatter does, which is what "align" in the brief is asking this scene to show
    against scene 1's looser field. */
const LOOSE_LAYOUT = [
  { x: 0.12, y: 0.16 },
  { x: 0.88, y: 0.18 },
  { x: 0.1, y: 0.64 },
  { x: 0.9, y: 0.62 },
] as const;

export function Scene02WhatIf(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const composition = ctx.root.querySelector(sel(styles.stageFull));
    const modules = gsap.utils.toArray<HTMLElement>('[data-module]', ctx.root);
    const looseModules = gsap.utils.toArray<HTMLElement>('[data-loose]', ctx.root);
    const pairModules = gsap.utils.toArray<HTMLElement>('[data-pair-node]', ctx.root);
    const wireSlot = ctx.root.querySelector(sel(scene.wireSlot));
    const joint = ctx.root.querySelector(sel(scene.joint));
    const index = ctx.root.querySelector(sel(styles.index));
    const headline = ctx.root.querySelector(sel(styles.headlineMd));
    const body = ctx.root.querySelector(sel(styles.body));

    gsap.set(targets(index, headline, body), { autoAlpha: 0, y: 14 });

    const mm = gsap.matchMedia();

    mm.add('(min-width: 900px)', () => {
      const tl = pinnedTimeline(ctx, { vh: 190 });

      // Receiving scene 1's handoff: the whole composition arrives from just past the glass.
      handon(tl, composition, { at: 0, duration: 0.22 });
      // Six separate modules, one beat: they travel in from scatter and align onto the grid this
      // scene lays out for them (four corners plus the pair's shared spot). A tight stagger
      // (0.03 x 5 gaps = 0.15) keeps the whole arrival inside a 0.57 window, so the snap below
      // never has to grab a pair node that is still mid-flight.
      assemble(tl, modules, { at: 0.1, duration: 0.32, stagger: 0.03 });
      tl.to(
        targets(index, headline, body),
        { autoAlpha: 1, y: 0, duration: 0.2, stagger: 0.05 },
        0.14,
      );
      // Only once file.watch and image.resize have arrived does the wire between them latch.
      snap(tl, wireSlot, joint, {
        at: 0.64,
        duration: 0.16,
        from: { y: -36, autoAlpha: 0.35 },
      });

      handoff(tl, composition, { at: 0.94, duration: 0.28 });
    });

    // Fewer pieces animated: two of the four loose modules are set straight to rest, and only
    // the pair plus the remaining two travel in — the snap itself, the point of the scene, still
    // plays in full.
    mm.add('(max-width: 899px)', () => {
      const staticLoose = looseModules.slice(2);
      const animatedLoose = looseModules.slice(0, 2);
      gsap.set(staticLoose, { x: 0, y: 0, scale: 1, autoAlpha: 1 });

      const tl = pinnedTimeline(ctx, { vh: 132 });

      handon(tl, composition, { at: 0, duration: 0.2 });
      assemble(tl, targets(...animatedLoose, ...pairModules), {
        at: 0.1,
        duration: 0.28,
        spread: 0.6,
        stagger: 0.03,
      });
      tl.to(
        targets(index, headline, body),
        { autoAlpha: 1, y: 0, duration: 0.18, stagger: 0.04 },
        0.14,
      );
      snap(tl, wireSlot, joint, { at: 0.56, duration: 0.14, from: { y: -28, autoAlpha: 0.35 } });

      handoff(tl, composition, { at: 0.86, duration: 0.24 });
    });
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="What if" data-scene="what-if">
      <div className={`${styles.pin} u-stage`} data-pin>
        <div className={`${styles.stageFull} u-depth`}>
          <div className={styles.cluster}>
            {LOOSE_NODES.map((node, i) => {
              const point = LOOSE_LAYOUT[i] ?? { x: 0.5, y: 0.5 };
              return (
                <div
                  key={node.id}
                  className={styles.clusterChip}
                  data-module
                  data-loose
                  style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                >
                  <GraphNode node={node} />
                </div>
              );
            })}

            <div className={scene.pairWrap}>
              <div className={scene.pairNode} data-module data-pair-node>
                <GraphNode node={PAIR_SOURCE} />
              </div>
              <div className={scene.wireSlot}>
                <Wire type="file" label={CONNECT_ACCEPTED_LABEL} active />
                <span className={scene.joint} aria-hidden="true" />
              </div>
              <div className={scene.pairNode} data-module data-pair-node>
                <GraphNode node={PAIR_TARGET} highlighted />
              </div>
            </div>
          </div>

          <div className={scene.copyLayer}>
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
        </div>
      </div>
    </section>
  );
}
