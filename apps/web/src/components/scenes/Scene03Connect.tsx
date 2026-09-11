'use client';

import type { ReactNode } from 'react';

import { GraphNode, Wire } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import {
  CONNECT_ACCEPTED_LABEL,
  CONNECT_REFUSED_LABEL,
  CONNECT_REFUSED_SOURCE_ID,
  CONNECT_SOURCE_ID,
  CONNECT_TARGET_ID,
  SCENE_COPY,
} from '@/lib/scenes';
import { pinnedTimeline, targets, useScrollScene } from '@/lib/scroll';

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
    const heading = ctx.root.querySelector(`.${styles.headline}`);
    const body = ctx.root.querySelector(`.${styles.body}`);
    const okWire = ctx.root.querySelector(`[data-attempt='ok'] .${styles.connectPair}`);
    const badWire = ctx.root.querySelector(`[data-attempt='bad'] .${styles.connectPair}`);
    const convertChip = ctx.root.querySelector(`.${styles.convertChip}`);
    const refusedMark = ctx.root.querySelector(`.${styles.refusedMark}`);
    const okLabel = ctx.root.querySelector(`[data-attempt='ok'] .${styles.connectLabel}`);
    const badLabel = ctx.root.querySelector(`[data-attempt='bad'] .${styles.connectLabel}`);

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
    gsap.set(targets(okWire, badWire), { autoAlpha: 0, y: 20 });
    gsap.set(targets(convertChip, okLabel, badLabel), { autoAlpha: 0 });
    gsap.set(refusedMark, { autoAlpha: 0, scale: 0.3 });

    const tl = pinnedTimeline(ctx, { vh: 200 });

    tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0)
      .to(targets(okWire, badWire), { autoAlpha: 1, y: 0, duration: 0.2, stagger: 0.06 }, 0.18)
      .to(convertChip, { autoAlpha: 1, y: -2, duration: 0.14 }, 0.42)
      .to(okLabel, { autoAlpha: 1, duration: 0.12 }, 0.46)
      .to(refusedMark, { autoAlpha: 1, scale: 1, duration: 0.16, ease: 'back.out(3)' }, 0.5)
      .fromTo(refusedMark, { x: -3 }, { x: 3, duration: 0.05, repeat: 5, yoyo: true }, 0.5)
      .to(badLabel, { autoAlpha: 1, duration: 0.12 }, 0.6);
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Connect" data-scene="connect">
      <div className={styles.pin} data-pin>
        <div className={`${styles.stage} ${styles.centerCol}`}>
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
              <div className={styles.connectPair} data-animate>
                <div className={styles.connectNode}>
                  <GraphNode node={SOURCE} />
                </div>
                <div style={{ position: 'relative' }}>
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
              <div className={styles.connectPair} data-animate>
                <div className={styles.connectNode}>
                  <GraphNode node={REFUSED_SOURCE} />
                </div>
                <div style={{ position: 'relative' }}>
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
