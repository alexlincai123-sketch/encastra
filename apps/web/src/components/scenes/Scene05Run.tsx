'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import type { FlowStep, NodeState } from '@/components/graph/Graph';
import { GraphFlow } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import {
  CONNECT_ACCEPTED_LABEL,
  RUN_FLOW_IDS,
  RUN_SECOND_WIRE_LABEL,
  SCENE_COPY,
} from '@/lib/scenes';
import { pinnedTimeline, targets, useScrollScene } from '@/lib/scroll';

import styles from './Scenes.module.css';

const COPY = SCENE_COPY.run;

const [WATCH_ID, RESIZE_ID, SAVE_ID] = RUN_FLOW_IDS;
const WATCH = componentNode(WATCH_ID);
const RESIZE = componentNode(RESIZE_ID);
const SAVE = componentNode(SAVE_ID);

const FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: RESIZE, wire: { type: 'file', label: CONNECT_ACCEPTED_LABEL } },
  { node: SAVE, wire: { type: 'image', label: RUN_SECOND_WIRE_LABEL } },
];

const LOG_LINES = [
  'watch    idle → running',
  'ok   watch   (encastra.file.watch@1.0.0)   2ms',
  'resize   idle → running',
  'ok   resize  (encastra.image.resize@1.0.0)  38ms',
  'save     idle → running',
  'ok   save    (encastra.file.save@1.0.0)     4ms',
] as const;

type RunPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const STATES_BY_PHASE: readonly Readonly<Record<string, NodeState>>[] = [
  {},
  { [WATCH.id]: 'running' },
  { [WATCH.id]: 'ok' },
  { [WATCH.id]: 'ok', [RESIZE.id]: 'running' },
  { [WATCH.id]: 'ok', [RESIZE.id]: 'ok' },
  { [WATCH.id]: 'ok', [RESIZE.id]: 'ok', [SAVE.id]: 'running' },
  { [WATCH.id]: 'ok', [RESIZE.id]: 'ok', [SAVE.id]: 'ok' },
];

const ACTIVE_BY_PHASE: readonly number[] = [-1, 0, 0, 1, 1, 2, 2];

/** The start time (in the pinned timeline's own units) of each phase, index-matched to
    `STATES_BY_PHASE`/`ACTIVE_BY_PHASE`. */
const PHASE_START: readonly number[] = [0, 0.34, 0.44, 0.54, 0.64, 0.74, 0.84];

/** Which phase a given playhead time falls in — recomputed from scratch on every scrub tick, so
    scrolling back up unwinds the run correctly with no separate "reverse" bookkeeping. */
function phaseForTime(time: number): RunPhase {
  let result: RunPhase = 0;
  for (let i = 0; i < PHASE_START.length; i += 1) {
    const start = PHASE_START[i];
    if (start !== undefined && time >= start) result = i as RunPhase;
  }
  return result;
}

export function Scene05Run(): ReactNode {
  const [phase, setPhase] = useState<RunPhase>(0);

  const ref = useScrollScene<HTMLElement>((ctx) => {
    const { gsap } = ctx;
    const heading = ctx.root.querySelector(`.${styles.headline}`);
    const body = ctx.root.querySelector(`.${styles.body}`);
    const flow = ctx.root.querySelector(`.${styles.runStage} > div`);
    const logLines = gsap.utils.toArray<HTMLElement>(`.${styles.runLogLine}`);

    gsap.set(targets(heading, body), { autoAlpha: 0, y: 16 });
    gsap.set(flow, { autoAlpha: 0, y: 20 });
    gsap.set(logLines, { autoAlpha: 0 });

    const tl = pinnedTimeline(ctx, { vh: 170 });

    tl.to(targets(heading, body), { autoAlpha: 1, y: 0, duration: 0.14, stagger: 0.04 }, 0).to(
      flow,
      { autoAlpha: 1, y: 0, duration: 0.16 },
      0.14,
    );

    for (let i = 0; i < LOG_LINES.length; i += 1) {
      const at = PHASE_START[i + 1] ?? 0.34 + i * 0.1;
      const line = logLines[i];
      if (line !== undefined) tl.to(line, { autoAlpha: 1, duration: 0.06 }, at);
    }

    // One `onUpdate`, not a `.call()` per transition: it derives the run phase fresh from the
    // playhead's current time on every tick, forward or backward, so there is nothing to get out
    // of sync when a visitor scrolls back up mid-run.
    tl.eventCallback('onUpdate', () => {
      const next = phaseForTime(tl.time());
      setPhase((prev) => (prev === next ? prev : next));
    });
  });

  const states = STATES_BY_PHASE[phase] ?? {};
  const activeIndex = ACTIVE_BY_PHASE[phase] ?? -1;

  return (
    <section ref={ref} className={styles.scene} aria-label="Run" data-scene="run">
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

          <div className={styles.runStage} data-animate>
            <div>
              <GraphFlow steps={FLOW} states={states} activeIndex={activeIndex} dense />
            </div>
          </div>

          <div className={styles.runLog} aria-live="polite">
            {LOG_LINES.map((line, i) => (
              <span
                // A fixed, ordered transcript — position is a stable identity.
                // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered.
                key={i}
                className={styles.runLogLine}
                data-tone={line.startsWith('ok') ? 'ok' : undefined}
              >
                {line}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
