import { describe, expect, it } from 'vitest';
import { advance, isStepSatisfied, TOUR, type TourProgress } from '../src/onboarding/steps';

/**
 * The guided first workflow.
 *
 * The behaviour worth protecting is that the tour *watches* rather than drives: it waits for
 * something real to become true in the editor, and it never asks somebody to do a thing they
 * have already done. Both are easy to break by editing the script, so both are pinned here.
 */

const nothing: TourProgress = {
  nodes: 0,
  edges: 0,
  configuredFolders: 0,
  grants: 0,
  hasRun: false,
};

const finished: TourProgress = {
  nodes: 3,
  edges: 2,
  configuredFolders: 2,
  grants: 2,
  hasRun: true,
};

describe('the script', () => {
  it('is short enough to be read', () => {
    // A tour people abandon teaches nothing. Seven cards is about a minute.
    expect(TOUR.length).toBeLessThanOrEqual(8);
    expect(TOUR.length).toBeGreaterThan(0);
  });

  it('opens with something to read rather than something to do', () => {
    expect(TOUR[0]?.done).toBeNull();
  });

  it('ends by running the workflow, which is the point of the whole thing', () => {
    expect(TOUR[TOUR.length - 1]?.done).toBe('ran');
  });

  it('keeps every card brief', () => {
    for (const card of TOUR) {
      expect(card.title.length, card.title).toBeLessThanOrEqual(40);
      expect(card.body.length, card.title).toBeLessThanOrEqual(220);
    }
  });
});

describe('isStepSatisfied', () => {
  it('is unsatisfied at the start for every step that waits on something', () => {
    for (const card of TOUR.filter((c) => c.done !== null)) {
      expect(isStepSatisfied(card, nothing), card.title).toBe(false);
    }
  });

  it('is satisfied for every step once the work is done', () => {
    for (const card of TOUR) {
      expect(isStepSatisfied(card, finished), card.title).toBe(true);
    }
  });

  it('treats a card with nothing to wait for as already satisfied', () => {
    const readOnly = TOUR.find((c) => c.done === null);
    expect(readOnly && isStepSatisfied(readOnly, nothing)).toBe(true);
  });
});

describe('advance', () => {
  it('moves to the next card when nothing has been done yet', () => {
    expect(advance(0, nothing)).toBe(1);
  });

  it('skips past what the person already did', () => {
    // Somebody who placed two components before reading the second card must not be told to
    // place a component.
    const placedTwo: TourProgress = { ...nothing, nodes: 2 };
    const next = advance(0, placedTwo);
    expect(next).not.toBeNull();
    expect(TOUR[next as number]?.done).not.toBe('node-placed');
    expect(TOUR[next as number]?.done).not.toBe('two-nodes');
  });

  it('finishes when there is nothing left', () => {
    expect(advance(TOUR.length - 1, finished)).toBeNull();
  });

  it('finishes rather than looping when everything is already done', () => {
    // The whole tour satisfied at once must terminate, not walk off the end of the array.
    expect(advance(0, finished)).toBeNull();
  });

  it('never returns an index outside the script', () => {
    for (let i = 0; i < TOUR.length; i += 1) {
      const next = advance(i, nothing);
      if (next !== null) {
        expect(next).toBeGreaterThan(i);
        expect(next).toBeLessThan(TOUR.length);
      }
    }
  });
});
