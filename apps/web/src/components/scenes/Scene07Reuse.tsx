'use client';

import type { ReactNode } from 'react';

import { componentNode } from '@/lib/graph-nodes';
import { RUN_FLOW_IDS, SCENE_COPY } from '@/lib/scenes';
import { pinnedTimeline, targets, useScrollScene } from '@/lib/scroll';

import { MiniNode } from './MiniNode';
import styles from './Scenes.module.css';

const COPY = SCENE_COPY.reuse;
const NODES = RUN_FLOW_IDS.map((id) => componentNode(id));

function categoryOf(id: string): string {
  return id.split('.').slice(0, 2).join('.');
}

const SPREAD_X = [-170, 0, 170] as const;
function spreadX(i: number): number {
  return SPREAD_X[i % SPREAD_X.length] ?? 0;
}

export function Scene07Reuse(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const heading = ctx.root.querySelector(`.${styles.headline}`);
    const body = ctx.root.querySelector(`.${styles.body}`);
    const flowNodes = gsap.utils.toArray<HTMLElement>(`.${styles.reuseFlowNode}`);
    const card = ctx.root.querySelector(`.${styles.reuseCard}`);
    const steps = gsap.utils.toArray<HTMLElement>(`.${styles.reuseStep}`);

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
    gsap.set(flowNodes, { x: spreadX, opacity: 1, scale: 1 });
    gsap.set(card, { autoAlpha: 0, scale: 0.88 });
    gsap.set(steps, { attr: { 'data-active': 'false' } });

    const tl = pinnedTimeline(ctx, { vh: 170 });

    tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0)
      // The three steps slide together and shrink into one another.
      .to(flowNodes, { x: 0, opacity: 0, scale: 0.5, duration: 0.32, stagger: 0.03 }, 0.3)
      .to(card, { autoAlpha: 1, scale: 1, duration: 0.26, ease: 'back.out(1.5)' }, 0.5);

    const stepSpan = 0.14;
    steps.forEach((step, i) => {
      tl.to(step, { attr: { 'data-active': 'true' } }, 0.62 + i * stepSpan);
    });
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Reuse" data-scene="reuse">
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

          <div className={styles.reuseStage}>
            <div className={styles.reuseFlow} aria-hidden="true">
              {NODES.map((node) => (
                <div key={node.id} className={styles.reuseFlowNode}>
                  <MiniNode name={node.name} category={categoryOf(node.id)} />
                </div>
              ))}
            </div>
            <div className={styles.reuseCard}>
              <p className={styles.reuseCardTitle}>Image Processor</p>
              <p className={styles.reuseCardNote}>
                Watch Folder → Resize Image → Save File, saved as one template.
              </p>
            </div>
          </div>

          <div className={styles.reuseSteps}>
            {COPY.steps.map((step) => (
              <span key={step} className={styles.reuseStep} data-active="false">
                {step}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
