'use client';

import { Fragment, type ReactNode } from 'react';

import type { FlowStep } from '@/components/graph/Graph';
import { GraphFlow } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import type { Locale } from '@/lib/i18n/locale';
import { assemble, DEPTH, handoff, handon, morph, settle, snap, stack } from '@/lib/motion-system';
import {
  BUILD_STAGE_3,
  BUILD_STAGE_8_ADDED,
  BUILD_STAGE_20_ADDED,
  CONNECT_ACCEPTED_LABEL,
  RUN_SECOND_WIRE_LABEL,
  sceneCopy,
} from '@/lib/scenes';
import type { SceneCtx } from '@/lib/scroll';
import { pinnedTimeline, sel, sunflowerLayout, targets, useScrollScene } from '@/lib/scroll';

import { MiniNode } from './MiniNode';
import local from './Scene04.module.css';
import styles from './Scenes.module.css';

/**
 * Real ids only, from `lib/scenes.ts` — nothing here is invented.
 *
 * SLOT — the five parts that assemble one at a time into the visible chain. The first three are
 * exactly `BUILD_STAGE_3`: Watch Folder, Resize Image, Save File. That is also what the scene
 * resolves onto at the end, so the opening chain and the closing flow are the same three cards,
 * not a coincidence dressed up to look like one.
 * PILE — the rest of `BUILD_STAGE_8_ADDED`, which physically stack rather than scatter.
 * FIELD — all of `BUILD_STAGE_20_ADDED`, the wide field revealed behind everything else.
 */
const SLOT_IDS = [...BUILD_STAGE_3, BUILD_STAGE_8_ADDED[0], BUILD_STAGE_8_ADDED[1]] as const;
const PILE_IDS = BUILD_STAGE_8_ADDED.slice(2);
const FIELD_IDS = BUILD_STAGE_20_ADDED;
const TOTAL_COUNT = SLOT_IDS.length + PILE_IDS.length + FIELD_IDS.length;

const SLOT_X = [12, 29, 50, 71, 88] as const;
const SLOT_Y = 42;
const WIRE_COUNT = SLOT_IDS.length - 1;
const PILE_X = 16;
const PILE_Y = 82;
const FIELD_LAYOUT = sunflowerLayout(FIELD_IDS.length, 0.46);

function categoryOf(id: string): string {
  return id.split('.').slice(0, 2).join('.');
}

const WATCH = componentNode(BUILD_STAGE_3[0]);
const RESIZE = componentNode(BUILD_STAGE_3[1]);
const SAVE = componentNode(BUILD_STAGE_3[2]);
const RESOLVED_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: RESIZE, wire: { type: 'file', label: CONNECT_ACCEPTED_LABEL } },
  { node: SAVE, wire: { type: 'image', label: RUN_SECOND_WIRE_LABEL } },
];

interface Variant {
  readonly vh: number;
  readonly slotSpread: number;
  readonly pileSpread: number;
  readonly fieldSpread: number;
  readonly pileStep: number;
  readonly pileDepth: number;
  readonly fieldZ: number;
  readonly fieldCount: number;
}

function buildVariant(ctx: SceneCtx, variant: Variant): void {
  const { gsap } = ctx;
  const heading = ctx.root.querySelector(sel(styles.headline));
  const body = ctx.root.querySelector(sel(styles.body));
  const caption = ctx.root.querySelector(sel(styles.buildCaption));
  const depthGroup = ctx.root.querySelector(sel(local.depthGroup));
  // `.buildResolve` (Scenes.module.css) is the element whose *own* base CSS carries `opacity: 0`
  // — its reduced-motion override flips that same rule to `opacity: 1`. MORPH and HANDOFF target
  // it directly for exactly that reason: revealing only `.buildResolveInner` inside it would
  // leave the outer wrapper's own opacity at 0, hiding everything inside it regardless.
  const resolveOuter = ctx.root.querySelector(sel(styles.buildResolve));
  const resolveNodes = gsap.utils.toArray<HTMLElement>(
    `${sel(styles.buildResolveInner)} figure`,
    ctx.root,
  );

  const slots = gsap.utils.toArray<HTMLElement>('[data-role="slot"]', ctx.root);
  const pins = gsap.utils.toArray<HTMLElement>('[data-role="pin"]', ctx.root);
  const wires = gsap.utils.toArray<HTMLElement>('[data-role="wire"]', ctx.root);
  const pile = gsap.utils.toArray<HTMLElement>('[data-role="pile"]', ctx.root);
  const field = gsap.utils
    .toArray<HTMLElement>('[data-role="field"]', ctx.root)
    .slice(0, variant.fieldCount);

  gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
  gsap.set(caption, { autoAlpha: 0 });
  // The field's hidden/receded state is set once, here — ASSEMBLE only ever touches the subset
  // `variant.fieldCount` selects, so on the mobile pass the remainder simply never appears rather
  // than sitting on stage unanimated.
  gsap.set(field, { autoAlpha: 0, z: variant.fieldZ });

  const tl = pinnedTimeline(ctx, { vh: variant.vh });

  // HANDON — receiving the composition from Scene 03's refused-and-accepted wires.
  handon(tl, targets(depthGroup), { at: 0 });
  tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0);

  // ASSEMBLE — the first five parts arrive from five different edges of the stage, a deterministic
  // scatter per index so each one travels in from somewhere the others did not.
  assemble(tl, slots, { at: 0.04, duration: 0.14, stagger: 0.03, spread: variant.slotSpread });

  // SNAP — the chain wires itself together one join at a time, left to right: each pin travels the
  // last few pixels into place while its wire latches and pulses, so the eye watches the workflow
  // extend by one link per beat rather than all the wires appearing at once.
  for (let i = 0; i < WIRE_COUNT; i += 1) {
    const pin = pins[i];
    const wire = wires[i];
    if (pin === undefined || wire === undefined) continue;
    snap(tl, pin, wire, { at: 0.31 + i * 0.035, duration: 0.06, from: { x: -14, autoAlpha: 0 } });
  }

  // SETTLE — the five-piece machine gives one small confirming bounce: the chain is complete.
  settle(tl, slots, { at: 0.48, duration: 0.06 });

  // ASSEMBLE then STACK — three more real parts arrive and then physically pile on top of one
  // another, rather than scattering — the "8" the copy counts up to. Only once they are piled does
  // the wider field below get its turn, so "8" is legible on its own before "20" arrives on top.
  assemble(tl, pile, { at: 0.48, duration: 0.08, stagger: 0.02, spread: variant.pileSpread });
  stack(tl, pile, { at: 0.6, duration: 0.08, step: variant.pileStep, depth: variant.pileDepth });

  // ASSEMBLE — the wider palette arrives behind everything else, already receded in depth (set
  // above) so perspective does most of the shrinking rather than a separate scale tween. This is
  // the "20" — pulling back far enough that the earlier scatter reads as one system.
  assemble(tl, field, { at: 0.68, duration: 0.1, stagger: 0.011, spread: variant.fieldSpread });

  tl.to(caption, { autoAlpha: 1, duration: 0.08 }, 0.7).to(
    caption,
    { autoAlpha: 0, duration: 0.05 },
    0.9,
  );

  // MORPH — pull back far enough and the assembled machine becomes the resolved, labelled
  // workflow: the same three cards the chain opened with, now named and typed.
  morph(tl, targets(depthGroup), targets(resolveOuter), { at: 0.9, duration: 0.09 });

  // SETTLE — the resolved workflow comes to rest.
  settle(tl, resolveNodes, { at: 0.97, duration: 0.03 });

  // HANDOFF — Scene 05 picks the composition back up and runs it.
  handoff(tl, targets(resolveOuter), { at: 0.97, duration: 0.03 });
}

export function Scene04Build({ locale }: { locale: Locale }): ReactNode {
  const COPY = sceneCopy(locale).build;
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const mm = ctx.gsap.matchMedia();

    mm.add('(min-width: 900px)', () => {
      buildVariant(ctx, {
        vh: 240,
        slotSpread: 1.3,
        pileSpread: 1,
        fieldSpread: 0.55,
        pileStep: 14,
        pileDepth: 34,
        fieldZ: DEPTH.back,
        fieldCount: FIELD_IDS.length,
      });
    });

    // Fewer pieces: only half the wider field ever arrives, depth halved, pin capped at 140vh —
    // not motion switched off, the same machine built with less room and less of it in the back.
    mm.add('(max-width: 899px)', () => {
      buildVariant(ctx, {
        vh: 135,
        slotSpread: 0.7,
        pileSpread: 0.6,
        fieldSpread: 0.35,
        pileStep: 9,
        pileDepth: 17,
        fieldZ: DEPTH.back / 2,
        fieldCount: Math.ceil(FIELD_IDS.length / 2),
      });
    });
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

          {/* Under reduced motion `.buildField` is hidden entirely (Scenes.module.css) and
              `.buildResolve` below is shown static instead — nothing in this block is ever the
              only place a fact lives. */}
          <div className={`${styles.buildField} u-stage`}>
            <div className={`${local.depthGroup} u-depth`}>
              {SLOT_IDS.map((id, i) => {
                const node = componentNode(id);
                const x = SLOT_X[i] ?? 50;
                return (
                  <div
                    key={id}
                    className={local.slotNode}
                    data-role="slot"
                    style={{ left: `${x}%`, top: `${SLOT_Y}%` }}
                  >
                    <MiniNode name={node.name} category={categoryOf(node.id)} />
                  </div>
                );
              })}

              {Array.from({ length: WIRE_COUNT }, (_, i) => {
                const fromX = SLOT_X[i] ?? 0;
                const toX = SLOT_X[i + 1] ?? 0;
                return (
                  // A fixed, ordered set of joins between fixed slots — position is a stable
                  // identity.
                  // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered.
                  <Fragment key={i}>
                    <span
                      className={local.chainWire}
                      data-role="wire"
                      style={{ left: `${fromX}%`, top: `${SLOT_Y}%`, width: `${toX - fromX}%` }}
                      aria-hidden="true"
                    />
                    <span
                      className={local.chainPin}
                      data-role="pin"
                      style={{ left: `${fromX}%`, top: `${SLOT_Y}%` }}
                      aria-hidden="true"
                    />
                  </Fragment>
                );
              })}

              {PILE_IDS.map((id) => {
                const node = componentNode(id);
                return (
                  <div
                    key={id}
                    className={local.pileNode}
                    data-role="pile"
                    style={{ left: `${PILE_X}%`, top: `${PILE_Y}%` }}
                  >
                    <MiniNode name={node.name} category={categoryOf(node.id)} />
                  </div>
                );
              })}

              {FIELD_IDS.map((id, i) => {
                const node = componentNode(id);
                const point = FIELD_LAYOUT[i];
                return (
                  <div
                    key={id}
                    className={local.fieldNode}
                    data-role="field"
                    style={{
                      left: `${(point?.x ?? 0.5) * 100}%`,
                      top: `${(point?.y ?? 0.5) * 100}%`,
                    }}
                  >
                    <MiniNode name={node.name} category={categoryOf(node.id)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.buildResolve}>
            <div className={styles.buildResolveInner}>
              <GraphFlow steps={RESOLVED_FLOW} dense caption={COPY.resolve} />
            </div>
          </div>

          <p className={styles.buildCaption} aria-hidden="true">
            {TOTAL_COUNT} real components, one graph
          </p>
        </div>
      </div>
    </section>
  );
}
