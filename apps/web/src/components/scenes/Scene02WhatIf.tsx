'use client';

import type { ReactNode } from 'react';

import { GraphNode } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import { SCENE_COPY, WHAT_IF_IDS } from '@/lib/scenes';
import { pinnedTimeline, sunflowerLayout, useScrollScene } from '@/lib/scroll';

import styles from './Scenes.module.css';

const COPY = SCENE_COPY.whatIf;

/** Real manifests, never retyped — the same `componentNode()` every other page on the site uses. */
const NODES = WHAT_IF_IDS.map((id) => componentNode(id));
const LAYOUT = sunflowerLayout(NODES.length, 0.4);

export function Scene02WhatIf(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const chips = gsap.utils.toArray<HTMLElement>(`.${styles.clusterChip}`);
    const intro = ctx.root.querySelector(`.${styles.clusterIntro}`);

    gsap.set(intro, { autoAlpha: 0, y: 16 });
    chips.forEach((chip, i) => {
      const point = LAYOUT[i];
      const angle = point === undefined ? 0 : Math.atan2(point.y - 0.5, point.x - 0.5);
      gsap.set(chip, {
        x: Math.cos(angle) * 240,
        y: Math.sin(angle) * 240,
        opacity: 0,
        scale: 0.82,
        rotate: (point?.rotate ?? 0) * 2.2,
      });
    });

    const tl = pinnedTimeline(ctx, { vh: 190 });

    tl.to(intro, { autoAlpha: 1, y: 0, duration: 0.16 }, 0).to(
      chips,
      {
        x: 0,
        y: 0,
        opacity: 1,
        scale: 1,
        // A per-target function value — GSAP calls this once per chip with its index, so each
        // one settles on its own `sunflowerLayout` rotation rather than sharing a single value.
        rotate: (index: number) => LAYOUT[index]?.rotate ?? 0,
        duration: 0.5,
        stagger: 0.07,
      },
      0.1,
    );

    // Outro: the cluster tightens toward the centre and dims — the scatter is about to become a
    // single wire in scene 3.
    tl.to(chips, { scale: 0.9, opacity: 0.35, duration: 0.22 }, 0.76).to(
      intro,
      { autoAlpha: 0, duration: 0.16 },
      0.78,
    );
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="What if" data-scene="what-if">
      <div className={styles.pin} data-pin>
        <div className={styles.stageFull}>
          <div className={styles.cluster}>
            {NODES.map((node, i) => {
              const point = LAYOUT[i];
              return (
                <div
                  key={node.id}
                  className={styles.clusterChip}
                  style={{
                    left: `${(point?.x ?? 0.5) * 100}%`,
                    top: `${(point?.y ?? 0.5) * 100}%`,
                  }}
                >
                  <GraphNode node={node} />
                </div>
              );
            })}
            <div className={styles.clusterIntro}>
              <span className={styles.index} data-animate>
                {COPY.index} — {COPY.eyebrow}
              </span>
              <h2 className={styles.headlineMd}>{COPY.headline}</h2>
              <p className="lead">{COPY.body}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
