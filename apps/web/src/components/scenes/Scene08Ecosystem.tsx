'use client';

import type { ReactNode } from 'react';

import { GraphNode } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import { Flip } from '@/lib/motion';
import { BEAT, DEPTH, EASE, handoff, handon, morph, scatterOrder, snap } from '@/lib/motion-system';
import { SCENE_COPY } from '@/lib/scenes';
import { pinnedTimeline, sel, targets, useScrollScene } from '@/lib/scroll';

import { MiniNode } from './MiniNode';
import eco from './Scene08.module.css';
import styles from './Scenes.module.css';

const COPY = SCENE_COPY.ecosystem;
const COMPONENT = componentNode('encastra.image.resize');

/**
 * Twelve real components, grouped the way the product's own sidebar groups them — by
 * `ComponentRecord.category`. Counts follow the manifest exactly: file has six members in the
 * app and three appear here, media/data/flow/system have two each, network has exactly one
 * component (`encastra.net.http`) because that is the whole category today.
 */
const CATEGORY_GROUPS = [
  { id: 'file', ids: ['encastra.file.watch', 'encastra.file.save', 'encastra.file.move'] },
  { id: 'media', ids: ['encastra.image.resize', 'encastra.image.thumbnail'] },
  { id: 'data', ids: ['encastra.data.csv.read', 'encastra.data.json'] },
  { id: 'flow', ids: ['encastra.flow.if', 'encastra.flow.switch'] },
  { id: 'network', ids: ['encastra.net.http'] },
  { id: 'system', ids: ['encastra.system.notify', 'encastra.system.clipboard'] },
].map((group) => ({ id: group.id, nodes: group.ids.map((id) => componentNode(id)) }));

export function Scene08Ecosystem(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const heading = ctx.root.querySelector(sel(styles.headline));
    const body = ctx.root.querySelector(sel(styles.body));
    const field = ctx.root.querySelector<HTMLElement>(sel(eco.field));
    const mixedPool = ctx.root.querySelector<HTMLElement>(sel(eco.mixedPool));
    const categories = ctx.root.querySelector<HTMLElement>(sel(eco.categories));
    const nestWrap = ctx.root.querySelector<HTMLElement>(sel(eco.nestWrap));
    const chips = gsap.utils.toArray<HTMLElement>(sel(eco.chip), ctx.root);
    const labels = gsap.utils.toArray<HTMLElement>(sel(eco.categoryLabel), ctx.root);
    const ticks = gsap.utils.toArray<HTMLElement>(sel(eco.categoryTick), ctx.root);

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
    gsap.set(labels, { y: -4, autoAlpha: 0.5 });
    gsap.set(ticks, { scaleX: 0, transformOrigin: 'left center', autoAlpha: 0 });
    gsap.set(targets(nestWrap), { autoAlpha: 0, scale: 1.08 });

    // `gsap.matchMedia()` created inside `gsap.context()` (which `useScrollScene` wraps this
    // whole build function in) is tracked and reverted automatically along with everything else
    // the context creates — nothing extra to clean up here.
    const mm = gsap.matchMedia();

    mm.add({ desktop: '(min-width: 900px)', mobile: '(max-width: 899px)' }, (context) => {
      const conditions = context.conditions as { desktop?: boolean } | undefined;
      const desktop = conditions?.desktop ?? true;
      // Fewer pieces animated on mobile: only every other chip makes the detour through the
      // mixed pool. The rest were already sitting in their category, correctly, from the first
      // paint, and simply stay there — still true, just not travelled-to.
      const flipChips = desktop ? chips : chips.filter((_, index) => index % 2 === 0);
      const nestDepth = desktop ? DEPTH.under : DEPTH.under / 2;
      gsap.set(targets(nestWrap), { z: nestDepth });

      // Flip is the one exception to "everything is one of eleven verbs" (see motion-system.ts):
      // grouping real components by category means moving each into a different container, and
      // where it lands depends on the category grid's own computed layout — three columns here,
      // two on a narrow screen — not a vector this file could author by hand. Flip measures the
      // real "before" and "after" and animates the difference, which is the one move none of the
      // eleven verbs can do on their own.
      //
      // 1. Move every chip into one flat, jumbled pool — a real DOM move, not a transform, so
      //    there is a genuine "before" arrangement to capture.
      scatterOrder(flipChips.length).forEach((index) => {
        const chip = flipChips[index];
        if (chip != null && mixedPool != null) mixedPool.appendChild(chip);
      });

      // 2. Capture that jumbled arrangement.
      const state = Flip.getState(flipChips);

      // 3. And put every chip back exactly where the page's own markup already has it — the
      //    reduced-motion composition, unmodified, grouped by `data-category`.
      flipChips.forEach((chip) => {
        const category = chip.dataset.category;
        const slot =
          category != null
            ? ctx.root.querySelector<HTMLElement>(`[data-slot="${category}"]`)
            : null;
        slot?.appendChild(chip);
      });

      // 4. Chips now render as though they never left the pool — Flip sets that up the moment
      //    this tween is created. Adding it to the master timeline (`paused` so scroll drives it,
      //    never GSAP's own clock) is what turns that standing illusion into a travel-and-settle
      //    the visitor scrubs through.
      const regroup = Flip.from(state, {
        targets: flipChips,
        duration: BEAT.base,
        stagger: 0.02,
        ease: EASE.arrive,
        paused: true,
      });

      const tl = pinnedTimeline(ctx, { vh: desktop ? 190 : 140 });

      handon(tl, targets(heading, body, field), { at: 0 });

      tl.add(regroup, 0.1);

      // SNAP: each category's joint ticks once its own chips have arrived, staggered so the
      // categories visibly lock in one at a time rather than as a single block.
      const snapStart = 0.56;
      labels.forEach((label, index) => {
        snap(tl, label, ticks[index] ?? null, {
          at: snapStart + index * 0.025,
          duration: BEAT.tick,
          from: { y: -4, autoAlpha: 0.5 },
        });
      });

      // MORPH: the palette of parts becomes the one concrete instance the copy describes — a
      // component, inside a workflow, inside a project. Not a new arrival; the same pieces,
      // now assembled into something.
      morph(tl, targets(categories), targets(nestWrap), { at: 0.78, duration: BEAT.base });
      tl.to(targets(nestWrap), { z: DEPTH.plane, duration: BEAT.base, ease: EASE.arrive }, 0.78);

      handoff(tl, targets(heading, body, nestWrap), { at: 0.92 });
    });
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Compose" data-scene="ecosystem">
      <div className={`${styles.pin} u-stage`} data-pin>
        {/* `u-depth` also has to sit here, not only on `.field` below: `transform-style: flat`
            (the default) on any element between the perspective root and a translateZ'd
            descendant collapses that descendant's depth back to zero, so the chain needs
            preserving at every level, not only at the immediate parent of the z-animated node. */}
        <div className={`${styles.stage} ${styles.centerCol} u-depth`}>
          <span className={styles.index} data-animate>
            {COPY.index} — {COPY.eyebrow}
          </span>
          <h2 className={styles.headlineMd} data-animate>
            {COPY.headline}
          </h2>
          <p className={`lead ${styles.body}`} data-animate>
            {COPY.body}
          </p>

          <div className={`${eco.field} u-depth`}>
            <div className={eco.mixedPool} aria-hidden="true" />

            <div className={eco.categories}>
              {CATEGORY_GROUPS.map((group) => (
                <div key={group.id} className={eco.category}>
                  <span className={eco.categoryLabel}>
                    {group.id}
                    <span className={eco.categoryTick} aria-hidden="true" />
                  </span>
                  <div className={eco.categoryChips} data-slot={group.id}>
                    {group.nodes.map((node) => (
                      <div key={node.id} className={eco.chip} data-category={group.id}>
                        <MiniNode name={node.name} category={group.id} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={eco.nestWrap}>
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
        </div>
      </div>
    </section>
  );
}
