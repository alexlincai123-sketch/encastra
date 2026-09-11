'use client';

import type { ReactNode } from 'react';

import { assemble, DEPTH, handoff, settle, stack } from '@/lib/motion-system';
import { SCENE_COPY } from '@/lib/scenes';
import { pinnedTimeline, sunflowerLayout, targets, useScrollScene } from '@/lib/scroll';

import scene from './Scene01.module.css';
import styles from './Scenes.module.css';

const COPY = SCENE_COPY.intro;
const WORDS = COPY.headline.split(' ');

/**
 * The field the headline rises out of.
 *
 * Sixteen blank shards, grouped into four depth roles so the assembly reads as a real structure
 * rather than one flat sheet of cards: `back` recedes into context, `lift` sits closest to the
 * viewer, `stack` is the handful that pile into a physical deck, and `plane` is everything else,
 * arriving flush with the page. `sunflowerLayout` gives every shard a deterministic resting spot
 * — the same one on every render — except the `stack` shards, which share a single spot so
 * `stack()`'s per-index offset reads as a pile rather than four unrelated cards landing near
 * each other.
 */
type DepthRole = 'back' | 'lift' | 'stack' | 'plane';

const SHARD_ROLES: readonly DepthRole[] = [
  'back',
  'back',
  'lift',
  'plane',
  'stack',
  'back',
  'plane',
  'lift',
  'stack',
  'back',
  'plane',
  'stack',
  'lift',
  'back',
  'plane',
  'stack',
];

const STACK_SPOT = { x: 0.76, y: 0.7 };
const SHARD_LAYOUT = sunflowerLayout(SHARD_ROLES.length, 0.46);

interface ShardSpec {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly role: DepthRole;
  readonly size: 'sm' | 'md';
}

const SHARDS: readonly ShardSpec[] = SHARD_ROLES.map((role, i) => {
  const point = SHARD_LAYOUT[i] ?? { x: 0.5, y: 0.5, rotate: 0 };
  const spot = role === 'stack' ? STACK_SPOT : point;
  return { id: i, x: spot.x, y: spot.y, role, size: i % 3 === 0 ? 'md' : 'sm' };
});

export function Scene01Intro(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const field = ctx.root.querySelector(`.${scene.field}`);
    const headlineGroup = ctx.root.querySelector(`.${scene.headlineGroup}`);
    const allShards = gsap.utils.toArray<HTMLElement>(`.${scene.shard}`, ctx.root);
    const stackShards = gsap.utils.toArray<HTMLElement>(`[data-role='stack']`, ctx.root);
    const backShards = gsap.utils.toArray<HTMLElement>(`[data-role='back']`, ctx.root);
    const liftShards = gsap.utils.toArray<HTMLElement>(`[data-role='lift']`, ctx.root);
    const planeShards = gsap.utils.toArray<HTMLElement>(`[data-role='plane']`, ctx.root);
    const words = gsap.utils.toArray<HTMLElement>(`.${styles.word}`, ctx.root);
    const index = ctx.root.querySelector(`.${styles.index}`);
    const sub = ctx.root.querySelector(`.${styles.body}`);
    const hint = ctx.root.querySelector('[data-hint]');

    // Running text only — index/words/sub are the one place plain autoAlpha + y is allowed, and
    // even here nothing is *visible* until the field beneath it has finished settling.
    gsap.set(targets(index, sub), { autoAlpha: 0, y: 12 });
    gsap.set(words, { yPercent: 115 });

    const mm = gsap.matchMedia();

    // `z` is a fixed depth placement, not a tween: setting it once, before the timeline plays,
    // means `assemble()` and `stack()` — which never touch `z` — carry each shard's plane with
    // them for the rest of the scene without a twelfth kind of animation being invented to do it.
    mm.add('(min-width: 900px)', () => {
      gsap.set(backShards, { z: DEPTH.back });
      gsap.set(liftShards, { z: DEPTH.lift });

      const tl = pinnedTimeline(ctx, { vh: 170 });

      // Structure: every shard travels in from its scattered start at once. A tight stagger
      // (0.012 x 15 gaps = 0.18) keeps the whole field's arrival inside its own window, so the
      // next beat never has to fight an assemble tween that is still running on a late shard.
      assemble(tl, allShards, { at: 0, duration: 0.28, stagger: 0.012 });
      // Movement: the four `stack` shards, having arrived at their shared spot, cascade into a
      // deck — the "several group" beat, distinct from the wider field settling around them.
      stack(tl, stackShards, { at: 0.48, duration: 0.14 });
      // Composition: the whole field comes to rest — rotation, scale and the back/lift planes
      // all resolve to the page's plane, which is what tells the eye construction is finished.
      settle(tl, allShards, { at: 0.8, duration: 0.16, stagger: 0.01 });

      // Message: the headline rises only once the structure beneath it is at rest.
      tl.to(words, { yPercent: 0, stagger: 0.05, duration: 0.34 }, 1.0)
        .to(index, { autoAlpha: 1, y: 0, duration: 0.14 }, 1.0)
        .to(sub, { autoAlpha: 1, y: 0, duration: 0.16 }, 1.16)
        .to(hint, { autoAlpha: 0, duration: 0.1 }, 0.06);

      handoff(tl, targets(field, headlineGroup), { at: 1.4, duration: 0.28 });
    });

    // Fewer pieces animated, not fewer pieces shown: the `back`/`lift` planes are set straight to
    // their resting transform instead of travelling there, and only the `stack` and `plane`
    // shards — the ones doing the actual "assembling into a structure" work — get a timeline.
    mm.add('(max-width: 899px)', () => {
      gsap.set(targets(...backShards, ...liftShards), {
        x: 0,
        y: 0,
        scale: 1,
        autoAlpha: 1,
        z: DEPTH.back / 2,
      });
      gsap.set(liftShards, { z: DEPTH.lift / 2 });
      const animated = targets(...stackShards, ...planeShards);

      const tl = pinnedTimeline(ctx, { vh: 130 });

      assemble(tl, animated, { at: 0, duration: 0.24, spread: 0.6, stagger: 0.02 });
      stack(tl, stackShards, { at: 0.4, duration: 0.12, step: 8, depth: 15 });
      settle(tl, animated, { at: 0.7, duration: 0.14, stagger: 0.01 });

      tl.to(words, { yPercent: 0, stagger: 0.05, duration: 0.3 }, 0.86)
        .to(index, { autoAlpha: 1, y: 0, duration: 0.12 }, 0.86)
        .to(sub, { autoAlpha: 1, y: 0, duration: 0.14 }, 1.0)
        .to(hint, { autoAlpha: 0, duration: 0.1 }, 0.05);

      handoff(tl, targets(field, headlineGroup), { at: 1.2, duration: 0.24 });
    });

    // `gsap.context` (the scope `useScrollScene` builds this inside) reverts every `matchMedia`
    // this creates automatically on unmount — nothing further to clean up here.
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Intro" data-scene="intro">
      <div className={`${styles.pin} u-stage`} data-pin>
        <div className={`${scene.field} u-depth`} aria-hidden="true">
          {SHARDS.map((s) => (
            <div
              key={s.id}
              className={scene.shard}
              data-role={s.role}
              data-size={s.size}
              style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
            />
          ))}
        </div>

        <div className={`${styles.stage} ${styles.centerCol} ${scene.headlineGroup}`}>
          <span className={styles.index} data-animate>
            {COPY.index} — {COPY.eyebrow}
          </span>
          <h1 className={styles.headline}>
            {WORDS.map((word, i) => (
              // Fixed, ordered words from a constant string — position is a stable identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered.
              <span key={i} className={styles.wordMask}>
                <span className={styles.word} data-animate>
                  {word}
                </span>
                {i < WORDS.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h1>
          <p className={`lead ${styles.body}`} data-animate>
            {COPY.sub}
          </p>

          <div className={styles.introScroll} data-hint aria-hidden="true">
            <span>Scroll</span>
            <span className={styles.introScrollLine} />
          </div>
        </div>
      </div>
    </section>
  );
}
