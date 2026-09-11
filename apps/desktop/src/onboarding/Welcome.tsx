/**
 * The first thing a new person sees, and the guided first workflow behind it.
 *
 * Before this, Encastra opened on a Home screen with three cards and no explanation of what a
 * component was, what a port was, or why a connection might be refused. The engine worked and
 * nobody could tell.
 *
 * Three rules this follows:
 *
 * - **Skip always works, and is remembered.** A tour that is hard to escape is a tour people
 *   resent. Dismissing it any way at all counts as seen.
 * - **It watches rather than drives.** Each step waits for something real to be true in the
 *   editor — a node placed, an edge drawn, a permission granted — instead of taking over the
 *   interface. Somebody who does the thing before reading the card simply moves on.
 * - **It is short.** Seven cards, a minute or two. It teaches the vocabulary and gets out.
 */

import { useCallback, useEffect, useState } from 'react';
import { DEMOS } from '../demos';
import { usePreferences } from '../preferences';
import { useEditor } from '../store';
import { advance, isStepSatisfied, TOUR } from './steps';

export function Welcome() {
  const welcomeSeen = usePreferences((p) => p.welcomeSeen);
  const setPreference = usePreferences((p) => p.set);

  const setView = useEditor((s) => s.setView);
  const loadDemo = useEditor((s) => s.loadDemo);

  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const grants = useEditor((s) => s.grants);
  const journal = useEditor((s) => s.journal);

  /** `null` means the tour is not running; a number is the card being shown. */
  const [step, setStep] = useState<number | null>(null);

  const progress = {
    nodes: nodes.length,
    edges: edges.length,
    configuredFolders: nodes.filter(
      (n) => typeof n.data.config.folder === 'string' && n.data.config.folder.trim() !== '',
    ).length,
    grants: grants.length,
    hasRun: journal !== null,
  };

  const finish = useCallback(() => {
    setStep(null);
    setPreference('welcomeSeen', true);
  }, [setPreference]);

  // Escape leaves, from the welcome and from any card. A modal that traps somebody is a modal
  // they remember for the wrong reason.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  if (welcomeSeen && step === null) return null;

  // --- The tour ---------------------------------------------------------------------------

  const card = step === null ? undefined : TOUR[step];

  if (step !== null && card) {
    const satisfied = isStepSatisfied(card, progress);
    const next = advance(step, progress);

    return (
      <aside
        className="tour"
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        data-focus={card.focus}
      >
        <p className="tour__count">
          Step {step + 1} of {TOUR.length}
        </p>
        <h2 id="tour-title" className="tour__title">
          {card.title}
        </h2>
        <p className="tour__body">{card.body}</p>

        {card.done !== null ? (
          <p className={satisfied ? 'tour__state is-done' : 'tour__state'}>
            {satisfied ? 'Done — carry on when you are ready.' : 'Waiting for you to try it.'}
          </p>
        ) : null}

        <div className="tour__actions">
          <button type="button" className="btn" onClick={finish}>
            Close
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => (next === null ? finish() : setStep(next))}
          >
            {next === null ? 'Finish' : 'Next'}
          </button>
        </div>
      </aside>
    );
  }

  // --- The welcome ------------------------------------------------------------------------

  const firstDemo = DEMOS[0];

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome__card">
        <h1 id="welcome-title" className="welcome__title">
          Welcome to Encastra
        </h1>
        <p className="welcome__lead">
          Build software by assembling components. You pick the parts, connect them, and press run —
          on this machine, with nothing reaching your files until you allow it.
        </p>

        <div className="welcome__choices">
          <button
            type="button"
            className="welcome__choice welcome__choice--primary"
            onClick={() => {
              setPreference('welcomeSeen', true);
              setView('builder');
              setStep(0);
            }}
          >
            <span className="welcome__choice-title">Create your first workflow</span>
            <span className="welcome__choice-note">A short guided run through, about a minute</span>
          </button>

          {firstDemo ? (
            <button
              type="button"
              className="welcome__choice"
              onClick={() => {
                setPreference('welcomeSeen', true);
                loadDemo(firstDemo);
                setView('builder');
              }}
            >
              <span className="welcome__choice-title">Explore a sample</span>
              <span className="welcome__choice-note">
                {firstDemo.name}, already built — you choose its folders
              </span>
            </button>
          ) : null}

          <button type="button" className="welcome__choice" onClick={finish}>
            <span className="welcome__choice-title">Skip</span>
            <span className="welcome__choice-note">
              Go straight in. This is in Settings if you want it later.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
