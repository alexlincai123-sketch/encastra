import { describe, expect, it } from 'vitest';
import { type Incident, incidentEdges, stepIncident } from '../src/canvas/edge-focus';

/**
 * Reaching a connection without a mouse.
 *
 * A connection is not part of the selection — `deleteSelected` could never remove one, and the
 * canvas's `aria-activedescendant` points at a step — so a wire drawn by mistake could only be
 * undone with a right-click. These are the rules that make `E` land somewhere predictable.
 */

const edge = (id: string, source: string, target: string): Incident => ({
  id,
  source,
  target,
  sourceHandle: 'out',
  targetHandle: 'in',
});

const EDGES = [
  edge('a', 'watch', 'resize'),
  edge('b', 'resize', 'save'),
  edge('c', 'watch', 'save'),
  edge('d', 'crop', 'resize'),
];

describe('incidentEdges', () => {
  it('gives the connections a step feeds before the ones that feed it', () => {
    // A step is read as "and then it goes here", so what leaves it is what somebody is usually
    // looking for.
    expect(incidentEdges(EDGES, 'resize').map((e) => e.id)).toEqual(['b', 'a', 'd']);
  });

  it('gives nothing for a step nothing touches', () => {
    expect(incidentEdges(EDGES, 'alone')).toEqual([]);
  });

  it('counts a connection once, even if a step were somehow both ends of it', () => {
    // The editor refuses a self-cycle, so this cannot be drawn — but listing the same wire
    // twice would make `E` appear to stall on it, which is worth being sure about.
    const loop = [edge('self', 'resize', 'resize')];
    expect(incidentEdges(loop, 'resize').map((e) => e.id)).toEqual(['self']);
  });
});

describe('stepIncident', () => {
  const incident = incidentEdges(EDGES, 'resize');

  it('moves forward and back through the connections of one step', () => {
    expect(stepIncident(incident, 'b', 'next')?.id).toBe('a');
    expect(stepIncident(incident, 'a', 'previous')?.id).toBe('b');
  });

  it('wraps at both ends', () => {
    expect(stepIncident(incident, 'd', 'next')?.id).toBe('b');
    expect(stepIncident(incident, 'b', 'previous')?.id).toBe('d');
  });

  it('enters from either end when nothing is held', () => {
    expect(stepIncident(incident, null, 'next')?.id).toBe('b');
    expect(stepIncident(incident, null, 'previous')?.id).toBe('d');
  });

  it('recovers when the connection that was held has just been deleted', () => {
    // Which is the common case: Delete removes it, and the next E has to land on a real one
    // rather than on the memory of the one that is gone.
    expect(stepIncident(incident, 'deleted', 'next')?.id).toBe('b');
  });

  it('has nothing to offer for a step with no connections', () => {
    expect(stepIncident([], null, 'next')).toBeUndefined();
  });
});
