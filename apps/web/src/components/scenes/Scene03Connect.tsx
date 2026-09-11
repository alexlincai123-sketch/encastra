'use client';

import type { ReactNode } from 'react';

import { GraphNode, Wire } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import { breakApart, handoff, handon, snap } from '@/lib/motion-system';
import {
  CONNECT_ACCEPTED_LABEL,
  CONNECT_REFUSED_LABEL,
  CONNECT_REFUSED_SOURCE_ID,
  CONNECT_SOURCE_ID,
  CONNECT_TARGET_ID,
  SCENE_COPY,
} from '@/lib/scenes';
import { pinnedTimeline, targets, useScrollScene } from '@/lib/scroll';

import scene from './Scene03.module.css';
import styles from './Scenes.module.css';

const COPY = SCENE_COPY.connect;

const SOURCE = componentNode(CONNECT_SOURCE_ID);
const TARGET = componentNode(CONNECT_TARGET_ID);
const REFUSED_SOURCE = componentNode(CONNECT_REFUSED_SOURCE_ID);
/** A second instance of the same target: two independent attempts at the one input. */
const TARGET_REFUSED: typeof TARGET = { ...TARGET, id: `${TARGET.id}-refused-attempt` };

export function Scene03Connect(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const composition = ctx.root.querySelector(`.${scene.composition}`);
    const heading = ctx.root.querySelector(`.${styles.headlineMd}`);
    const body = ctx.root.querySelector(`.${styles.body}`);
    const okAttempt = ctx.root.querySelector(`[data-attempt='ok']`);
    const badAttempt = ctx.root.querySelector(`[data-attempt='bad']`);
    const okWireSlot = ctx.root.querySelector(`[data-attempt='ok'] .${scene.wireSlot}`);
    const badWireSlot = ctx.root.querySelector(`[data-attempt='bad'] .${scene.wireSlot}`);
    const convertChip = ctx.root.querySelector(`.${styles.convertChip}`);
    const refusedMark = ctx.root.querySelector(`.${styles.refusedMark}`);
    const okLabel = ctx.root.querySelector(`[data-attempt='ok'] .${styles.connectLabel}`);
    const badLabel = ctx.root.querySelector(`[data-attempt='bad'] .${styles.connectLabel}`);
    const badEnds = gsap.utils.toArray<HTMLElement>(
      `[data-attempt='bad'] .${styles.connectNode}`,
      ctx.root,
    );

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
    gsap.set(targets(okLabel, badLabel), { autoAlpha: 0 });

    const mm = gsap.matchMedia();

    mm.add('(min-width: 900px)', () => {
      const tl = pinnedTimeline(ctx, { vh: 200 });

      // Receiving scene 2's handoff — the two attempts arrive from just past the glass together.
      handon(tl, targets(okAttempt, badAttempt), { at: 0, duration: 0.22, stagger: 0.05 });
      tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.16, stagger: 0.05 }, 0.06);

      // The compatible join: the wire finds its slot and the conversion badge pulses to confirm
      // it — a real, narrowing coercion, which is why it is a `snap`, not a silent match.
      snap(tl, okWireSlot, convertChip, {
        at: 0.42,
        duration: 0.16,
        from: { y: -30, autoAlpha: 0.35 },
      });
      tl.to(okLabel, { autoAlpha: 1, duration: 0.12 }, 0.58);

      // The incompatible one: refused outright. The wire retracts to the source end and the two
      // nodes recoil apart — a refusal, never a fade. `refusedMark` is chrome reporting that
      // outcome, not a composition move of its own, so it gets the same plain fade the labels
      // do rather than a bespoke twelfth kind of tween.
      breakApart(tl, badWireSlot, badEnds, { at: 0.6, duration: 0.16 });
      tl.to(refusedMark, { autoAlpha: 1, duration: 0.12 }, 0.64).to(
        badLabel,
        { autoAlpha: 1, duration: 0.12 },
        0.74,
      );

      handoff(tl, composition, { at: 0.88, duration: 0.26 });
    });

    mm.add('(max-width: 899px)', () => {
      const tl = pinnedTimeline(ctx, { vh: 138 });

      // Fewer pieces animated: the two attempts arrive as one group rather than a staggered
      // pair — the snap and the break, the actual lesson, still play in full below.
      handon(tl, targets(okAttempt, badAttempt), { at: 0, duration: 0.2 });
      tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0.06);

      snap(tl, okWireSlot, convertChip, {
        at: 0.4,
        duration: 0.14,
        from: { y: -22, autoAlpha: 0.35 },
      });
      tl.to(okLabel, { autoAlpha: 1, duration: 0.1 }, 0.54);

      breakApart(tl, badWireSlot, badEnds, { at: 0.58, duration: 0.14 });
      tl.to(refusedMark, { autoAlpha: 1, duration: 0.1 }, 0.62).to(
        badLabel,
        { autoAlpha: 1, duration: 0.1 },
        0.72,
      );

      handoff(tl, composition, { at: 0.86, duration: 0.22 });
    });
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Connect" data-scene="connect">
      <div className={`${styles.pin} u-stage`} data-pin>
        <div className={`${styles.stage} ${styles.centerCol} ${scene.composition} u-depth`}>
          <span className={styles.index} data-animate>
            {COPY.index} — {COPY.eyebrow}
          </span>
          <h2 className={styles.headlineMd} data-animate>
            {COPY.headline}
          </h2>
          <p className={`lead ${styles.body}`} data-animate>
            {COPY.body}
          </p>

          <div className={styles.connectGrid}>
            <div className={styles.connectAttempt} data-attempt="ok">
              <div className={styles.connectPair}>
                <div className={styles.connectNode}>
                  <GraphNode node={SOURCE} />
                </div>
                <div className={scene.wireSlot}>
                  <Wire type="file" label={CONNECT_ACCEPTED_LABEL} active />
                  <span className={styles.convertChip} data-animate>
                    Convert · decode-image
                  </span>
                </div>
                <div className={styles.connectNode}>
                  <GraphNode node={TARGET} highlighted />
                </div>
              </div>
              <span className={styles.connectLabel} data-tone="ok" data-animate>
                ✓ Connected — a real, narrowing conversion
              </span>
            </div>

            <div className={styles.connectAttempt} data-attempt="bad">
              <div className={styles.connectPair}>
                <div className={styles.connectNode}>
                  <GraphNode node={REFUSED_SOURCE} />
                </div>
                <div className={scene.wireSlot}>
                  <Wire label={CONNECT_REFUSED_LABEL} refused />
                  <span className={styles.refusedMark} aria-hidden="true" data-animate>
                    ×
                  </span>
                </div>
                <div className={styles.connectNode}>
                  <GraphNode node={TARGET_REFUSED} />
                </div>
              </div>
              <span className={styles.connectLabel} data-tone="danger" data-animate>
                Refused — no path from a number to an image
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
