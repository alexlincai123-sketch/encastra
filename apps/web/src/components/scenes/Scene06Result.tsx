'use client';

import type { ReactNode } from 'react';

import { Plate, PlateTiles } from '@/components/visual/Plate';
import { componentNode } from '@/lib/graph-nodes';
import type { Locale } from '@/lib/i18n/locale';
import { handoff, handon, merge, morph, settle, split } from '@/lib/motion-system';
import { RESULT_AFTER, RESULT_BEFORE, RUN_FLOW_IDS, sceneCopy } from '@/lib/scenes';
import type { SceneCtx } from '@/lib/scroll';
import { pinnedTimeline, sel, targets, useScrollScene } from '@/lib/scroll';

import { MiniNode } from './MiniNode';
import local from './Scene06.module.css';
import styles from './Scenes.module.css';

/** The real pipeline this scene shows resizing the picture — never retyped as a literal. */
const RESIZE_NODE = componentNode(RUN_FLOW_IDS[1]);

function categoryOf(id: string): string {
  return id.split('.').slice(0, 2).join('.');
}

/**
 * A radiating outward vector per tile, keyed to the tile's own position in the grid rather than a
 * hash. Corner tiles fly furthest, centre tiles barely move — the picture comes apart the way a
 * pane of glass does, not the way a hand of cards does.
 */
function radiatingVectors(
  cols: number,
  rows: number,
  spreadX: number,
  spreadY: number,
): ReadonlyArray<{ x: number; y: number; rotate: number }> {
  return Array.from({ length: cols * rows }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = cols > 1 ? col / (cols - 1) - 0.5 : 0;
    const cy = rows > 1 ? row / (rows - 1) - 0.5 : 0;
    return { x: cx * 2 * spreadX, y: cy * 2 * spreadY, rotate: cx * 18 };
  });
}

/** Desktop: full spread. Mobile halves it — the mobile matchMedia branch below, halving spread in
    place of `DEPTH`, since SPLIT's own z-offset per tile is fixed inside `motion-system.ts` and
    cannot be scaled per breakpoint without editing a frozen file. */
const DESKTOP_VECTORS = radiatingVectors(4, 3, 150, 100);
const MOBILE_VECTORS = radiatingVectors(3, 2, 75, 50);

const DESKTOP_MODULE_X = [-210, -70, 70, 210] as const;
const MOBILE_MODULE_X = [-100, -34, 34, 100] as const;

interface Variant {
  readonly tilesRoot: Element | null;
  readonly vectors: ReadonlyArray<{ x: number; y: number; rotate: number }>;
  readonly moduleX: ReadonlyArray<number>;
  readonly vh: number;
}

function buildVariant(ctx: SceneCtx, variant: Variant): void {
  const { gsap } = ctx;
  const heading = ctx.root.querySelector(sel(styles.headline));
  const body = ctx.root.querySelector(sel(styles.body));
  const depthGroup = ctx.root.querySelector(sel(local.depthGroup));
  const tiles = gsap.utils.toArray<HTMLElement>('[data-tile]', variant.tilesRoot);
  const moduleRow = ctx.root.querySelector(sel(local.moduleRow));
  const moduleCards = gsap.utils.toArray<HTMLElement>(sel(local.moduleCard), ctx.root);
  const outputLayer = ctx.root.querySelector(sel(local.outputLayer));

  gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
  // The module cards start collapsed onto the shared centre point MORPH will reveal them at —
  // MERGE later animates this same offset back to 0, which is what makes the convergence real
  // rather than a card sliding a few pixels within its own flex gap.
  gsap.set(moduleCards, { x: (i: number) => variant.moduleX[i] ?? 0 });

  const tl = pinnedTimeline(ctx, { vh: variant.vh });

  // HANDON — receiving the composition from Scene 05's finished run.
  handon(tl, targets(depthGroup), { at: 0 });
  tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0);

  // SPLIT — the picture comes apart into its tiles.
  split(tl, tiles, { at: 0.22, duration: 0.34, vectors: variant.vectors });

  // MORPH — the split picture becomes the four modules: a preview, its metadata, the real
  // processing step, and the output it will produce.
  morph(tl, targets(variant.tilesRoot), targets(moduleRow), { at: 0.56, duration: 0.22 });

  // MERGE — the four modules converge on the centre they were already anchored to.
  merge(tl, moduleCards, { at: 0.68, duration: 0.14 });

  // MORPH — the converged modules become the finished, smaller file.
  morph(tl, targets(moduleRow), targets(outputLayer), { at: 0.82, duration: 0.14 });

  // SETTLE — the result comes to rest before the scene hands off.
  settle(tl, targets(outputLayer), { at: 0.94, duration: 0.06 });

  // HANDOFF — Scene 07 picks the composition back up.
  handoff(tl, targets(depthGroup), { at: 0.94, duration: 0.06 });
}

export function Scene06Result({ locale }: { locale: Locale }): ReactNode {
  const COPY = sceneCopy(locale).result;
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const mm = ctx.gsap.matchMedia();

    mm.add('(min-width: 900px)', () => {
      const tilesRoot = ctx.root.querySelector('[data-role="tiles-desktop"]');
      buildVariant(ctx, {
        tilesRoot,
        vectors: DESKTOP_VECTORS,
        moduleX: DESKTOP_MODULE_X,
        vh: 180,
      });
    });

    // Fewer tiles, a tighter spread, and a pin no longer than 140vh — not motion switched off,
    // the same story told with less room to tell it in.
    mm.add('(max-width: 899px)', () => {
      const tilesRoot = ctx.root.querySelector('[data-role="tiles-mobile"]');
      buildVariant(ctx, { tilesRoot, vectors: MOBILE_VECTORS, moduleX: MOBILE_MODULE_X, vh: 130 });
    });
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

          <div className={local.visualStage}>
            <div className={`${local.compose} u-stage`}>
              <div className={`${local.depthGroup} u-depth`}>
                <div className={local.tilesFrame} data-role="tiles-desktop" data-bp="desktop">
                  <div className={local.tilesInner}>
                    <PlateTiles cols={4} rows={3} />
                  </div>
                </div>
                <div className={local.tilesFrame} data-role="tiles-mobile" data-bp="mobile">
                  <div className={local.tilesInner}>
                    <PlateTiles cols={3} rows={2} />
                  </div>
                </div>

                <div className={local.moduleRow} aria-hidden="true">
                  <div className={local.moduleCard}>
                    <span className={local.moduleLabel}>Preview</span>
                    <Plate className={local.moduleSwatch ?? ''} />
                  </div>
                  <div className={local.moduleCard}>
                    <span className={local.moduleLabel}>Metadata</span>
                    <span className={local.moduleText}>
                      {RESULT_BEFORE.name} · {RESULT_BEFORE.dims}
                    </span>
                  </div>
                  <div className={local.moduleCard}>
                    <span className={local.moduleLabel}>Step</span>
                    <MiniNode name={RESIZE_NODE.name} category={categoryOf(RESIZE_NODE.id)} />
                  </div>
                  <div className={local.moduleCard}>
                    <span className={local.moduleLabel}>Output</span>
                    <span className={local.moduleText}>
                      {RESULT_AFTER.name} · {RESULT_AFTER.dims}
                    </span>
                  </div>
                </div>

                <div className={local.outputLayer}>
                  <Plate className={local.outputPlate ?? ''} />
                  <span className={styles.resultMeta}>
                    {RESULT_AFTER.name} · {RESULT_AFTER.dims}
                  </span>
                </div>
              </div>
            </div>

            <div className={local.staticResult}>
              <div className={local.staticFile}>
                <Plate style={{ width: 168 }} />
                <span className={styles.resultMeta}>
                  {RESULT_BEFORE.name} · {RESULT_BEFORE.dims}
                </span>
              </div>
              <span className={styles.resultArrow} aria-hidden="true">
                →
              </span>
              <div className={local.staticStep}>
                <MiniNode name={RESIZE_NODE.name} category={categoryOf(RESIZE_NODE.id)} />
              </div>
              <span className={styles.resultArrow} aria-hidden="true">
                →
              </span>
              <div className={local.staticFile}>
                <Plate style={{ width: 42 }} />
                <span className={styles.resultMeta}>
                  {RESULT_AFTER.name} · {RESULT_AFTER.dims}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
