'use client';

import type { ReactNode } from 'react';

import { componentNode } from '@/lib/graph-nodes';
import { RESULT_AFTER, RESULT_BEFORE, RUN_FLOW_IDS, SCENE_COPY } from '@/lib/scenes';
import { pinnedTimeline, targets, useScrollScene } from '@/lib/scroll';

import { MiniNode } from './MiniNode';
import styles from './Scenes.module.css';

const COPY = SCENE_COPY.result;
const NODES = RUN_FLOW_IDS.map((id) => componentNode(id));

/** The category id a real manifest gives a component — same derivation `how-it-works` uses. */
function categoryOf(id: string): string {
  return id.split('.').slice(0, 2).join('.');
}

const DRIFT_X = [-140, 0, 140] as const;
const DRIFT_Y = [70, -90, 70] as const;
const DRIFT_ROTATE = [-14, 6, 16] as const;

function driftX(i: number): number {
  return DRIFT_X[i % DRIFT_X.length] ?? 0;
}
function driftY(i: number): number {
  return DRIFT_Y[i % DRIFT_Y.length] ?? 0;
}
function driftRotate(i: number): number {
  return DRIFT_ROTATE[i % DRIFT_ROTATE.length] ?? 0;
}

export function Scene06Result(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const heading = ctx.root.querySelector(`.${styles.headline}`);
    const body = ctx.root.querySelector(`.${styles.body}`);
    const row = ctx.root.querySelector(`.${styles.resultRow}`);
    const before = ctx.root.querySelector(`.${styles.resultFile}[data-file='before']`);
    const after = ctx.root.querySelector(`.${styles.resultFile}[data-file='after']`);
    const arrow = ctx.root.querySelector(`.${styles.resultArrow}`);
    const disassembleNodes = gsap.utils.toArray<HTMLElement>(`.${styles.disassembleNode}`);

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
    gsap.set(disassembleNodes, { autoAlpha: 1, x: 0, y: 0, rotate: 0 });
    gsap.set(targets(before, arrow, after, row), { autoAlpha: 0 });
    gsap.set(before, { y: 12 });
    gsap.set(after, { y: 12, scale: 0.7 });

    const tl = pinnedTimeline(ctx, { vh: 180 });

    tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0)
      .to(row, { autoAlpha: 1, duration: 0.1 }, 0.2)
      .to(before, { autoAlpha: 1, y: 0, duration: 0.22 }, 0.22)
      .to(arrow, { autoAlpha: 1, duration: 0.14 }, 0.42)
      .to(after, { autoAlpha: 1, y: 0, scale: 1, duration: 0.24, ease: 'back.out(1.6)' }, 0.48)
      // The run is over — the graph that made this one file comes apart.
      .to(
        disassembleNodes,
        {
          autoAlpha: 0,
          x: driftX,
          y: driftY,
          rotate: driftRotate,
          duration: 0.3,
          stagger: 0.05,
        },
        0.78,
      );
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Result" data-scene="result">
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

          <div className={styles.resultRow} data-animate>
            <div className={styles.resultFile} data-file="before">
              <div
                className={styles.resultSwatch}
                style={{ width: 168, height: 84 }}
                aria-hidden="true"
              />
              <span className={styles.resultMeta}>
                {RESULT_BEFORE.name} · {RESULT_BEFORE.dims}
              </span>
            </div>
            <span className={styles.resultArrow} aria-hidden="true">
              →
            </span>
            <div className={styles.resultFile} data-file="after">
              <div
                className={styles.resultSwatch}
                style={{ width: 42, height: 21 }}
                aria-hidden="true"
              />
              <span className={styles.resultMeta}>
                {RESULT_AFTER.name} · {RESULT_AFTER.dims}
              </span>
            </div>
          </div>

          <div className={styles.disassemble} aria-hidden="true">
            {NODES.map((node) => (
              <div key={node.id} className={styles.disassembleNode}>
                <MiniNode name={node.name} category={categoryOf(node.id)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
