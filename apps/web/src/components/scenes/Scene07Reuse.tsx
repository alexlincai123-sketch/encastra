'use client';

import type { ReactNode } from 'react';

import { componentNode } from '@/lib/graph-nodes';
import { encapsulate, execute, handoff, handon, morph, settle, stack } from '@/lib/motion-system';
import { RUN_FLOW_IDS, SCENE_COPY } from '@/lib/scenes';
import type { SceneCtx } from '@/lib/scroll';
import { pinnedTimeline, sel, targets, useScrollScene } from '@/lib/scroll';

import { MiniNode } from './MiniNode';
import local from './Scene07.module.css';
import styles from './Scenes.module.css';

const COPY = SCENE_COPY.reuse;
const NODES = RUN_FLOW_IDS.map((id) => componentNode(id));

function categoryOf(id: string): string {
  return id.split('.').slice(0, 2).join('.');
}

/**
 * The three templates that actually ship with the app (`/templates`) — Image Processor is the
 * flow this scene just built; File Organiser and Thumbnails are the other two, already saved.
 * Nothing here is invented: the pile is what "reuse" means once there is more than one template.
 */
const SAVED_TEMPLATES = ['Image Processor', 'File Organiser', 'Thumbnails'] as const;

const DESKTOP_MEMBER_X = [-170, 0, 170] as const;
const MOBILE_MEMBER_X = [-96, 0, 96] as const;

interface Variant {
  readonly memberX: ReadonlyArray<number>;
  readonly stackStep: number;
  readonly stackDepth: number;
  readonly vh: number;
}

function buildVariant(ctx: SceneCtx, variant: Variant): void {
  const { gsap } = ctx;
  const heading = ctx.root.querySelector(sel(styles.headline));
  const body = ctx.root.querySelector(sel(styles.body));
  const depthGroup = ctx.root.querySelector(sel(local.depthGroup));
  const members = gsap.utils.toArray<HTMLElement>(sel(local.memberNode), ctx.root);
  const shell = ctx.root.querySelector(sel(styles.reuseCard));
  const stackGroup = ctx.root.querySelector(sel(local.stackGroup));
  const templateCards = gsap.utils.toArray<HTMLElement>(sel(local.templateCard), ctx.root);
  const steps = gsap.utils.toArray<HTMLElement>(sel(styles.reuseStep), ctx.root);

  gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
  // Spread into a readable row on the same centre ENCAPSULATE will converge them back onto —
  // without this offset `x: 0` is already where they are, and convergence has nothing to do.
  gsap.set(members, { x: (i: number) => variant.memberX[i] ?? 0 });
  gsap.set(steps, { attr: { 'data-active': 'false' } });

  const tl = pinnedTimeline(ctx, { vh: variant.vh });

  // HANDON — receiving the finished result from Scene 06.
  handon(tl, targets(depthGroup), { at: 0 });
  tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0);

  // ENCAPSULATE — the three real steps converge, shrink out of sight, and the shell they are
  // made of grows into their place.
  encapsulate(tl, members, targets(shell), { at: 0.22, duration: 0.34 });

  // MORPH — the single template becomes the pile it now belongs to.
  morph(tl, targets(shell), targets(stackGroup), { at: 0.58, duration: 0.22 });

  // STACK — the saved templates pile with real depth, Image Processor on top.
  stack(tl, templateCards, {
    at: 0.7,
    duration: 0.14,
    step: variant.stackStep,
    depth: variant.stackDepth,
  });

  // EXECUTE — Build, Save, Reuse, Share, in order, visibly. `execute` returns the beat positions
  // rather than driving `data-active` itself, because a scrubbed timeline is rewound as often as
  // played forward and a callback-driven state flip has no inverse; `tl.set` does.
  const beats = execute(tl, steps, { at: 0.22, duration: 0.56 });
  beats.start.forEach((at, i) => {
    const step = steps[i];
    if (step !== undefined) tl.set(step, { attr: { 'data-active': 'true' } }, at);
  });

  // SETTLE — the pile gives one small confirming bounce before the scene closes.
  tl.set(targets(stackGroup), { scale: 1.05 }, 0.88);
  settle(tl, targets(stackGroup), { at: 0.9, duration: 0.06 });

  // HANDOFF — Scene 08 picks the composition back up.
  handoff(tl, targets(depthGroup), { at: 0.94, duration: 0.06 });
}

export function Scene07Reuse(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const mm = ctx.gsap.matchMedia();

    mm.add('(min-width: 900px)', () => {
      buildVariant(ctx, { memberX: DESKTOP_MEMBER_X, stackStep: 14, stackDepth: 34, vh: 180 });
    });

    // Halved depth on the pile, and a pin no longer than 140vh — not motion switched off, the
    // same collapse and the same pile with less room, and less drama, to make its case.
    mm.add('(max-width: 899px)', () => {
      buildVariant(ctx, { memberX: MOBILE_MEMBER_X, stackStep: 10, stackDepth: 17, vh: 130 });
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

          <div className={local.visualStage}>
            <div className={`${local.compose} u-stage`}>
              <div className={`${local.depthGroup} u-depth`}>
                <div className={local.memberRow} aria-hidden="true">
                  {NODES.map((node) => (
                    <div key={node.id} className={local.memberNode}>
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

                <div className={local.stackGroup} aria-hidden="true">
                  {SAVED_TEMPLATES.map((name) => (
                    <div key={name} className={local.templateCard}>
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={local.staticReuse}>
              <div className={local.staticMembers}>
                {NODES.map((node) => (
                  <div key={node.id} className={local.staticMember}>
                    <MiniNode name={node.name} category={categoryOf(node.id)} />
                  </div>
                ))}
              </div>
              <span className={styles.resultArrow} aria-hidden="true">
                →
              </span>
              <div className={local.staticStack}>
                {SAVED_TEMPLATES.map((name, i) => (
                  <span
                    key={name}
                    className={local.staticStackItem}
                    data-current={i === 0 ? 'true' : 'false'}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="u-stage">
            <div className={`${styles.reuseSteps} u-depth`}>
              {COPY.steps.map((step) => (
                <span key={step} className={styles.reuseStep} data-active="false">
                  {step}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
