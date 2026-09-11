'use client';

import type { ReactNode } from 'react';

import { CTA } from '@/components/ui/Ui';
import { RELEASE } from '@/config/site';
import { COMPONENT_COUNT, TRIGGER_COUNT } from '@/lib/components.data';
import { assemble, handon, settle } from '@/lib/motion-system';
import { SCENE_COPY } from '@/lib/scenes';
import { pinnedTimeline, sel, targets, useScrollScene } from '@/lib/scroll';

import scene from './Scene10.module.css';
import styles from './Scenes.module.css';

const COPY = SCENE_COPY.try;
const WORDS = COPY.headline.split(' ');

/**
 * The last scene never hands off — nine scenes of explanation resolve into one plain interface,
 * and the brief for it is explicitly to keep that resolution simple rather than add a tenth idea.
 * It opens the way every other scene does, with `handon`, and it closes the way none of the
 * others do: `settle`, the one verb reserved for a system actually coming to rest rather than
 * moving on to the next thing.
 */
export function Scene10Try(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const index = ctx.root.querySelector(sel(styles.index));
    const words = gsap.utils.toArray<HTMLElement>(sel(styles.word));
    const body = ctx.root.querySelector(sel(styles.body));
    const actionButtons = gsap.utils.toArray<HTMLElement>(
      `${sel(styles.tryActions)} > a`,
      ctx.root,
    );
    const meta = ctx.root.querySelector(sel(styles.tryMeta));

    gsap.set(words, { yPercent: 115 });
    gsap.set(targets(body, meta), { autoAlpha: 0, y: 14 });

    // Tracked and reverted automatically by the surrounding `gsap.context()` (see
    // `useScrollScene`) along with everything else it creates.
    const mm = gsap.matchMedia();

    mm.add({ desktop: '(min-width: 900px)', mobile: '(max-width: 899px)' }, (context) => {
      const conditions = context.conditions as { desktop?: boolean } | undefined;
      const desktop = conditions?.desktop ?? true;

      // Fewer pieces animated on mobile: the headline's closing wobble is a flourish the final
      // SETTLE resolves — skipped on a narrow screen along with the resolve itself, so the words
      // just arrive once, cleanly, instead of arriving twice.
      if (desktop) {
        gsap.set(words, {
          rotate: (i: number) => (i % 2 === 0 ? -3 : 3),
          scale: 0.96,
        });
      }

      const tl = pinnedTimeline(ctx, { vh: desktop ? 130 : 110 });

      handon(tl, targets(index), { at: 0, duration: 0.14 });
      tl.to(words, { yPercent: 0, stagger: 0.04, duration: 0.36 }, 0);
      tl.to(body, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.3);
      assemble(tl, targets(...actionButtons), { at: 0.42, duration: 0.22, spread: 0.3 });
      tl.to(meta, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.58);

      // SETTLE: the whole composition — copy, buttons, meta — has already arrived by 0.58+0.18;
      // this is the small overshoot-then-rest that says the page is finished, not paused. It has
      // real work to do only on the headline words, which are the one thing still carrying a
      // rotation/scale left over from their own arrival.
      if (desktop) {
        settle(tl, words, { at: 0.86, duration: 0.14, stagger: 0.02 });
      }
    });
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Try it" data-scene="try">
      <div className={`${styles.pin} u-stage`} data-pin>
        {/* `u-depth` here, not only where `index` itself sits, so the opening HANDON's Z motion
            survives the trip through this intermediate layer — see the equivalent note in
            Scene08Ecosystem.tsx for why a flat ancestor would otherwise collapse it. */}
        <div className={`${styles.stage} ${styles.centerCol} u-depth`}>
          <span className={styles.index} data-animate>
            {COPY.index} — {COPY.eyebrow}
          </span>
          <h2 className={styles.headline}>
            {WORDS.map((word, i) => (
              // Fixed, ordered words from a constant string — position is a stable identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered.
              <span key={i} className={styles.wordMask}>
                <span className={`${styles.word} ${scene.settleWord}`} data-animate>
                  {word}
                </span>
                {i < WORDS.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h2>
          <p className={`lead ${styles.body}`} data-animate>
            {COPY.body}
          </p>

          <div className={styles.tryActions} data-animate>
            <CTA href="/download">Download the beta</CTA>
            <CTA href="/docs" variant="secondary">
              Read the documentation
            </CTA>
          </div>

          <p className={styles.tryMeta} data-animate>
            {COMPONENT_COUNT} components + {TRIGGER_COUNT} triggers · v{RELEASE.installerVersion}
          </p>
        </div>
      </div>
    </section>
  );
}
