'use client';

import type { ReactNode } from 'react';

import type { FlowStep } from '@/components/graph/Graph';
import { GraphFlow } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import {
  BUILD_STAGE_3,
  BUILD_STAGE_8_ADDED,
  BUILD_STAGE_20_ADDED,
  CONNECT_ACCEPTED_LABEL,
  RUN_SECOND_WIRE_LABEL,
  SCENE_COPY,
} from '@/lib/scenes';
import { pinnedTimeline, sunflowerLayout, targets, useScrollScene } from '@/lib/scroll';
import { MiniNode } from './MiniNode';

import styles from './Scenes.module.css';

const COPY = SCENE_COPY.build;

const ALL_IDS = [...BUILD_STAGE_3, ...BUILD_STAGE_8_ADDED, ...BUILD_STAGE_20_ADDED] as const;
const NODES = ALL_IDS.map((id) => componentNode(id));
const LAYOUT = sunflowerLayout(NODES.length, 0.47);

const WATCH = componentNode(BUILD_STAGE_3[0]);
const RESIZE = componentNode(BUILD_STAGE_3[1]);
const SAVE = componentNode(BUILD_STAGE_3[2]);
const RESOLVED_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: RESIZE, wire: { type: 'file', label: CONNECT_ACCEPTED_LABEL } },
  { node: SAVE, wire: { type: 'image', label: RUN_SECOND_WIRE_LABEL } },
];

function stageOf(index: number): 1 | 2 | 3 {
  if (index < BUILD_STAGE_3.length) return 1;
  if (index < BUILD_STAGE_3.length + BUILD_STAGE_8_ADDED.length) return 2;
  return 3;
}

export function Scene04Build(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const field = ctx.root.querySelector(`.${styles.buildField}`);
    const stage2 = gsap.utils.toArray<HTMLElement>(`[data-stage='2']`, ctx.root);
    const stage3 = gsap.utils.toArray<HTMLElement>(`[data-stage='3']`, ctx.root);
    const stage1 = gsap.utils.toArray<HTMLElement>(`[data-stage='1']`, ctx.root);
    const resolve = ctx.root.querySelector(`.${styles.buildResolve}`);
    const caption = ctx.root.querySelector(`.${styles.buildCaption}`);
    const heading = ctx.root.querySelector(`.${styles.headline}`);
    const body = ctx.root.querySelector(`.${styles.body}`);

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
    gsap.set(field, { scale: 1, transformOrigin: '50% 50%' });
    gsap.set(stage2, { opacity: 0, scale: 0.6 });
    gsap.set(stage3, { opacity: 0, scale: 0.5 });
    gsap.set(resolve, { autoAlpha: 0, scale: 0.94 });
    gsap.set(caption, { autoAlpha: 0 });

    const tl = pinnedTimeline(ctx, { vh: 220 });

    tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0)
      // 3 -> 8: the field eases back a little as five more real components join it.
      .to(field, { scale: 0.82, duration: 0.3 }, 0.2)
      .to(stage2, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.04 }, 0.22)
      // 8 -> 20: the camera pulls back further — growth now reads as one dense structure.
      .to(field, { scale: 0.52, duration: 0.34 }, 0.46)
      .to(stage3, { opacity: 1, scale: 1, duration: 0.34, stagger: 0.02 }, 0.48)
      .to(caption, { autoAlpha: 1, duration: 0.14 }, 0.72)
      // Resolve: everything but the original three dims; the clean, fully-labelled workflow
      // fades in on top — the same three the terminal in scene 9 will run.
      .to(targets(...stage2, ...stage3), { opacity: 0.14, duration: 0.24 }, 0.8)
      .to(stage1, { opacity: 1, scale: 1.15, duration: 0.24 }, 0.8)
      .to(caption, { autoAlpha: 0, duration: 0.1 }, 0.8)
      .to(resolve, { autoAlpha: 1, scale: 1, duration: 0.26 }, 0.9);
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Build" data-scene="build">
      <div className={styles.pin} data-pin>
        <div className={styles.buildStage}>
          <span className={styles.index} data-animate>
            {COPY.index} — {COPY.eyebrow}
          </span>
          <h2 className={styles.headlineMd} data-animate>
            {COPY.headline}
          </h2>
          <p className={`lead ${styles.body}`} data-animate>
            {COPY.body}
          </p>

          <div className={styles.buildField}>
            {NODES.map((node, i) => {
              const point = LAYOUT[i];
              const stage = stageOf(i);
              return (
                <div
                  key={node.id}
                  className={styles.buildNode}
                  data-stage={stage}
                  data-dim={stage !== 1 ? 'true' : 'false'}
                  style={{
                    left: `${(point?.x ?? 0.5) * 100}%`,
                    top: `${(point?.y ?? 0.5) * 100}%`,
                  }}
                >
                  <MiniNode name={node.name} category={node.id.split('.').slice(0, 2).join('.')} />
                </div>
              );
            })}
          </div>

          <div className={styles.buildResolve}>
            <div className={styles.buildResolveInner}>
              <GraphFlow steps={RESOLVED_FLOW} dense caption={COPY.resolve} />
            </div>
          </div>

          <p className={styles.buildCaption} aria-hidden="true">
            {NODES.length} real components, one graph
          </p>
        </div>
      </div>
    </section>
  );
}
