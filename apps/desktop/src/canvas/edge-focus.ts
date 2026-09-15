/**
 * Reaching a connection without a mouse.
 *
 * A connection is not part of the selection — `deleteSelected` could never have removed one, and
 * the canvas's `aria-activedescendant` points at a step — so before this there was no keyboard
 * path to a wire at all: it could be drawn and then only be removed by right-clicking it. This
 * is the stepping half of the answer, kept here rather than in the component for the reason
 * `walk.ts` gives for its own: it is the part that has to be right, and none of it needs a DOM.
 *
 * **Outgoing first, then incoming.** A step is read as "and then it goes here", so the
 * connections leaving it are the ones somebody is usually looking for; within each group the
 * graph's own order is kept, which is the order the edges were made. Sorting by geometry was
 * considered and rejected: an edge has two ends and no position of its own, so any spatial order
 * would be a claim about one end that the other contradicts.
 */

/** The least a connection has to be here. Structural, so a test needs no React Flow types. */
export interface Incident {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string | null;
  readonly targetHandle?: string | null;
}

/** Every connection touching a step: the ones it feeds first, then the ones that feed it. */
export function incidentEdges<T extends Incident>(edges: readonly T[], nodeId: string): T[] {
  return [
    ...edges.filter((edge) => edge.source === nodeId),
    ...edges.filter((edge) => edge.target === nodeId && edge.source !== nodeId),
  ];
}

/**
 * The next connection of a step's own, cycling.
 *
 * A ring rather than a run with ends, for the reason `connect-mode.ts` gives: this is a chooser
 * over a handful of things, not a movement across a layout. With nothing held, forward starts at
 * the first and back at the last, so either direction gets into the ring; an id that is no
 * longer there — the connection was just deleted — is treated as nothing held rather than as a
 * position, so the next press lands somewhere real instead of doing nothing for ever.
 */
export function stepIncident<T extends Incident>(
  edges: readonly T[],
  currentId: string | null,
  direction: 'next' | 'previous',
): T | undefined {
  if (edges.length === 0) return undefined;
  const at = currentId === null ? -1 : edges.findIndex((edge) => edge.id === currentId);
  if (at < 0) return direction === 'next' ? edges[0] : edges[edges.length - 1];
  const step = direction === 'next' ? 1 : -1;
  return edges[(at + step + edges.length) % edges.length];
}
