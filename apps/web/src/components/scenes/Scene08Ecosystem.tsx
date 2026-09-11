'use client';

import type { ReactNode } from 'react';

import { GraphNode } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import { SCENE_COPY } from '@/lib/scenes';
import { pinnedTimeline, targets, useScrollScene } from '@/lib/scroll';

import styles from './Scenes.module.css';

const COPY = SCENE_COPY.ecosystem;
const COMPONENT = componentNode('encastra.image.resize');

export function Scene08Ecosystem(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const heading = ctx.root.querySelector(`.${styles.headline}`);
    const body = ctx.root.querySelector(`.${styles.body}`);
    // `.tierProject`/`.tierWorkflow` both `composes: tier` in CSS, which makes `styles.tierProject`
    // a space-joined multi-class string — not a valid single-class selector. Querying the shared,
    // non-composed `.tier` base class instead and taking both matches in document order (project
    // is the outer, ancestor element, so it always comes first) sidesteps that cleanly.
    const [project, workflow] = gsap.utils.toArray<HTMLElement>(`.${styles.tier}`, ctx.root);
    const component = ctx.root.querySelector(`.${styles.tierComponent}`);

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
    gsap.set(targets(component), { autoAlpha: 0, scale: 0.7 });
    gsap.set(targets(workflow), { autoAlpha: 0, scale: 0.85 });
    gsap.set(targets(project), { autoAlpha: 0, scale: 0.92 });

    const tl = pinnedTimeline(ctx, { vh: 160 });

    tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0)
      // Outside in, matching how the copy reads it: component first, then what holds it.
      .to(
        targets(component),
        { autoAlpha: 1, scale: 1, duration: 0.2, ease: 'back.out(1.6)' },
        0.24,
      )
      .to(targets(workflow), { autoAlpha: 1, scale: 1, duration: 0.22 }, 0.4)
      .to(targets(project), { autoAlpha: 1, scale: 1, duration: 0.22 }, 0.58);
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Compose" data-scene="ecosystem">
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

          <div className={styles.tierWrap}>
            <div className={styles.tierProject}>
              <span className={styles.tierLabel}>Project · one .encastra file</span>
              <div className={styles.tierWorkflow}>
                <span className={styles.tierLabel}>Workflow</span>
                <div className={styles.tierComponent}>
                  <GraphNode node={COMPONENT} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
