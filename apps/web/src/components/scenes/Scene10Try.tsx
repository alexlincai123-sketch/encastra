'use client';

import type { ReactNode } from 'react';

import { CTA } from '@/components/ui/Ui';
import { RELEASE } from '@/config/site';
import { COMPONENT_COUNT, TRIGGER_COUNT } from '@/lib/components.data';
import { SCENE_COPY } from '@/lib/scenes';
import { pinnedTimeline, targets, useScrollScene } from '@/lib/scroll';

import styles from './Scenes.module.css';

const COPY = SCENE_COPY.try;
const WORDS = COPY.headline.split(' ');

export function Scene10Try(): ReactNode {
  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const words = gsap.utils.toArray<HTMLElement>(`.${styles.word}`);
    const body = ctx.root.querySelector(`.${styles.body}`);
    const actions = ctx.root.querySelector(`.${styles.tryActions}`);
    const meta = ctx.root.querySelector(`.${styles.tryMeta}`);

    gsap.set(words, { yPercent: 115 });
    gsap.set(targets(body, actions, meta), { autoAlpha: 0, y: 14 });

    const tl = pinnedTimeline(ctx, { vh: 120 });

    tl.to(words, { yPercent: 0, stagger: 0.04, duration: 0.36 }, 0)
      .to(body, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.3)
      .to(actions, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'back.out(1.5)' }, 0.44)
      .to(meta, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.56);
  });

  return (
    <section ref={ref} className={styles.scene} aria-label="Try it" data-scene="try">
      <div className={styles.pin} data-pin>
        <div className={`${styles.stage} ${styles.centerCol}`}>
          <span className={styles.index} data-animate>
            {COPY.index} — {COPY.eyebrow}
          </span>
          <h2 className={styles.headline}>
            {WORDS.map((word, i) => (
              // Fixed, ordered words from a constant string — position is a stable identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered.
              <span key={i} className={styles.wordMask}>
                <span className={styles.word} data-animate>
                  {word}
                </span>
                {i < WORDS.length - 1 ? ' ' : ''}
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
