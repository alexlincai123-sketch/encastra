'use client';

import type { ReactNode } from 'react';

import { GraphNode } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import type { Locale } from '@/lib/i18n/locale';
import { assemble, BEAT, DEPTH, EASE, handoff, handon, morph, snap } from '@/lib/motion-system';
import { sceneCopy } from '@/lib/scenes';
import { pinnedTimeline, sel, targets, useScrollScene } from '@/lib/scroll';

import { MiniNode } from './MiniNode';
import eco from './Scene08.module.css';
import styles from './Scenes.module.css';

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

export function Scene08Ecosystem({ locale }: { locale: Locale }): ReactNode {
  const COPY = sceneCopy(locale).ecosystem;
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const heading = ctx.root.querySelector(sel(styles.headline));
    const body = ctx.root.querySelector(sel(styles.body));
    const field = ctx.root.querySelector<HTMLElement>(sel(eco.field));
    const _mixedPool = ctx.root.querySelector<HTMLElement>(sel(eco.mixedPool));
    const categories = ctx.root.querySelector<HTMLElement>(sel(eco.categories));
    const nestWrap = ctx.root.querySelector<HTMLElement>(sel(eco.nestWrap));
    const chips = gsap.utils.toArray<HTMLElement>(sel(eco.chip), ctx.root);
    const labels = gsap.utils.toArray<HTMLElement>(sel(eco.categoryLabel), ctx.root);
    const ticks = gsap.utils.toArray<HTMLElement>(sel(eco.categoryTick), ctx.root);
    const boxes = gsap.utils.toArray<HTMLElement>(sel(eco.category), ctx.root);

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
    // The boxes are barely there until their own chips have arrived in them.
    //
    // While the chips are travelling they are, by construction, somewhere else — that is what
    // Flip is measuring. Drawn at full strength, six framed rectangles with nothing inside them
    // are the first thing the eye lands on, and the scene reads as broken for the half of its
    // scroll that it is doing its most interesting work. Faded back, the same frames read as
    // what they are: places these parts are about to belong to.
    gsap.set(boxes, { autoAlpha: 0.18 });
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

      // ASSEMBLE, not Flip.
      //
      // This scene used to move every chip into a flat pool, let Flip measure that arrangement,
      // put the chips back, and scrub the difference. It was a correct use of the plugin and it
      // looked wrong: for half the scene's scroll the chips sat in a heap across the middle of
      // the field while six framed rectangles stood empty behind them, and a visitor arriving
      // mid-scene saw a broken layout rather than a system being sorted.
      //
      // The chips are already in their categories in the markup, so a scattered `fromTo` says
      // the same thing — parts arriving where they belong — with no detour and nothing ever
      // rendered outside the box it ends in. Flip stays registered for a scene that needs to
      // measure a layout it cannot author; this one does not.
      const tl = pinnedTimeline(ctx, { vh: desktop ? 190 : 140 });

      handon(tl, targets(heading, body, field), { at: 0 });

      assemble(tl, flipChips, { at: 0.1, duration: BEAT.base, stagger: 0.02, spread: 0.55 });

      // SNAP: each category's joint ticks once its own chips have arrived, staggered so the
      // categories visibly lock in one at a time rather than as a single block.
      const snapStart = 0.56;
      labels.forEach((label, index) => {
        const at = snapStart + index * 0.025;
        snap(tl, label, ticks[index] ?? null, {
          at,
          duration: BEAT.tick,
          from: { y: -4, autoAlpha: 0.5 },
        });
        // The box comes up with its own label, so each category becomes solid at the moment its
        // contents settle rather than all six at once.
        const box = boxes[index];
        if (box) tl.to(box, { autoAlpha: 1, duration: BEAT.short, ease: EASE.arrive }, at - 0.04);
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
