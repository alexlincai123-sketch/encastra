'use client';

import type { CSSProperties, ReactNode } from 'react';

import { GraphNode, typeColour, Wire } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import type { Locale } from '@/lib/i18n/locale';
import { execute, flow, handoff, handon } from '@/lib/motion-system';
import {
  CONNECT_ACCEPTED_LABEL,
  RUN_FLOW_IDS,
  RUN_SECOND_WIRE_LABEL,
  sceneCopy,
} from '@/lib/scenes';
import type { SceneCtx } from '@/lib/scroll';
import { pinnedTimeline, sel, targets, useScrollScene } from '@/lib/scroll';

import local from './Scene05.module.css';
import styles from './Scenes.module.css';

const [WATCH_ID, RESIZE_ID, SAVE_ID] = RUN_FLOW_IDS;
const WATCH = componentNode(WATCH_ID);
const RESIZE = componentNode(RESIZE_ID);
const SAVE = componentNode(SAVE_ID);
const STEPS = [WATCH, RESIZE, SAVE] as const;

/** The two wires of the chain, in crossing order, each paired with the step it feeds. The type
    each one carries decides the traveller's colour — the same `typeColour()` the product canvas
    itself uses for a port or an edge, never a colour invented for this page. */
const WIRES = [
  { type: 'file', label: CONNECT_ACCEPTED_LABEL },
  { type: 'image', label: RUN_SECOND_WIRE_LABEL },
] as const;

const LOG_LINES = [
  'watch    idle → running',
  'ok   watch   (encastra.file.watch@1.0.0)   2ms',
  'resize   idle → running',
  'ok   resize  (encastra.image.resize@1.0.0)  38ms',
  'save     idle → running',
  'ok   save    (encastra.file.save@1.0.0)     4ms',
] as const;

interface Variant {
  readonly vh: number;
}

function buildVariant(ctx: SceneCtx, variant: Variant): void {
  const { gsap } = ctx;
  const heading = ctx.root.querySelector(sel(styles.headline));
  const body = ctx.root.querySelector(sel(styles.body));
  const depthGroup = ctx.root.querySelector(sel(local.depthGroup));
  // Scoped to `depthGroup`, not `ctx.root` — `.staticRun` right beside it (below) renders the
  // same `.chainNode`/`.traveller` classes for its own, unrelated reduced-motion copy, and an
  // unscoped query would animate both copies as one array with double the elements.
  const nodes = gsap.utils.toArray<HTMLElement>(sel(local.chainNode), depthGroup);
  const figures = gsap.utils.toArray<HTMLElement>(`${sel(local.chainNode)} figure`, depthGroup);
  const travellers = gsap.utils.toArray<HTMLElement>(sel(local.traveller), depthGroup);
  const logLines = gsap.utils.toArray<HTMLElement>(sel(local.logLine), ctx.root);

  gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
  gsap.set(logLines, { autoAlpha: 0 });

  const tl = pinnedTimeline(ctx, { vh: variant.vh });

  // HANDON — receiving the built machine from Scene 04, already resolved into this exact chain.
  handon(tl, targets(depthGroup), { at: 0 });
  tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0);

  // EXECUTE — idle, then running, then done, in order, visibly. The beats it returns are where the
  // state stamps land, via `tl.set`, never a callback: a scrubbed timeline is rewound as often as
  // it is played forward, and a callback that flips `data-state` on the way down has no inverse —
  // a `set` positioned on the timeline does, because GSAP records what it overwrote and restores
  // it correctly when the visitor scrolls back up through this beat.
  const beats = execute(tl, nodes, { at: 0.24, duration: 0.6 });
  beats.start.forEach((at, i) => {
    const figure = figures[i];
    if (figure === undefined) return;
    tl.set(figure, { attr: { 'data-state': 'running', 'data-highlighted': 'true' } }, at);
  });
  beats.done.forEach((at, i) => {
    const figure = figures[i];
    if (figure === undefined) return;
    tl.set(figure, { attr: { 'data-state': 'ok' } }, at);
  });

  // FLOW — one traveller per wire, crossing right as the step it feeds wakes up: data moving from
  // a step that just finished to the one downstream of it, never a light sweeping the whole scene.
  WIRES.forEach((_wire, i) => {
    const traveller = travellers[i];
    const doneAt = beats.done[i];
    if (traveller === undefined || doneAt === undefined) return;
    flow(tl, traveller, { at: doneAt + 0.01, duration: 0.1 });
  });

  // The journal: each line lands with the exact state change it describes.
  LOG_LINES.forEach((_line, i) => {
    const stepIndex = Math.floor(i / 2);
    const at = i % 2 === 0 ? beats.start[stepIndex] : beats.done[stepIndex];
    const el = logLines[i];
    if (el === undefined || at === undefined) return;
    tl.to(el, { autoAlpha: 1, duration: 0.06 }, at);
  });

  // HANDOFF — Scene 06 picks the finished file back up.
  handoff(tl, targets(depthGroup), { at: 0.9, duration: 0.06 });
}

export function Scene05Run({ locale }: { locale: Locale }): ReactNode {
  const COPY = sceneCopy(locale).run;
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const mm = ctx.gsap.matchMedia();

    mm.add('(min-width: 900px)', () => {
      buildVariant(ctx, { vh: 220 });
    });

    // Same chain, same beats — fewer pixels of wire to cross and a pin no longer than 140vh, not a
    // simpler story.
    mm.add('(max-width: 899px)', () => {
      buildVariant(ctx, { vh: 138 });
    });
  });

  return (
    <section ref={ref} className={styles.scene} aria-label={COPY.label} data-scene="run">
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
                <div className={local.chainRow} aria-hidden="true">
                  {STEPS.map((step, i) => {
                    const wire = WIRES[i - 1];
                    return (
                      <div key={step.id} className={local.stepFragment}>
                        {wire !== undefined ? (
                          <div className={local.chainWireWrap}>
                            <span
                              className={local.chainLine}
                              style={{ background: typeColour(wire.type) }}
                            />
                            <span
                              className={local.chainHead}
                              style={{ borderLeftColor: typeColour(wire.type) }}
                            />
                            <span className={local.chainBadge}>{wire.label}</span>
                            <span
                              className={local.traveller}
                              style={{ '--dot-color': typeColour(wire.type) } as CSSProperties}
                            />
                          </div>
                        ) : null}
                        <div className={local.chainNode}>
                          <GraphNode node={step} locale={locale} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Reduced motion: the complete, finished run — three real steps, both real wires,
                every one of them already marked done. */}
            <div className={local.staticRun}>
              <div className={local.chainRow}>
                {STEPS.map((step, i) => {
                  const wire = WIRES[i - 1];
                  return (
                    <div key={step.id} className={local.stepFragment}>
                      {wire !== undefined ? (
                        <Wire type={wire.type} label={wire.label} active />
                      ) : null}
                      <div className={local.chainNode}>
                        <GraphNode node={step} state="ok" highlighted locale={locale} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.runLog} aria-live="polite">
            {LOG_LINES.map((line, i) => {
              const tone = line.startsWith('ok') ? 'ok' : undefined;
              return (
                // A fixed, ordered transcript from a constant array — position is a stable
                // identity.
                // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered.
                <span key={i} className={local.logLine} data-tone={tone}>
                  {line}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
