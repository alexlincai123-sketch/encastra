/**
 * The order the arrow keys walk the canvas.
 *
 * Separated from the component so it can be tested without a DOM, because this is the part that
 * has to be right: it is the only way somebody without a mouse reaches a step, and a step that
 * cannot be reached cannot be configured — its settings and its permission prompt live in the
 * inspector, which only opens for a selected step.
 */

/** The minimum a walkable thing has to be. Kept structural so tests need no editor types. */
export interface Placed {
  id: string;
  position: { x: number; y: number };
}

/**
 * How far apart two steps have to be horizontally before they count as different columns.
 *
 * Without a tolerance, two steps a pixel apart would order by that pixel and the arrow keys
 * would jump about in a way nobody could predict. The canvas snaps to an 8px grid, so a
 * threshold a few grid squares wide matches what a person would call "the same column".
 */
export const COLUMN_TOLERANCE = 24;

/**
 * Reading order: left to right, then top to bottom.
 *
 * Deliberately the layout order rather than the execution order. Somebody navigating by
 * keyboard is looking for the step they can see two along; matching what is on screen is what
 * makes the next keypress predictable. Execution order is a different question and the run
 * panel answers it.
 */
export function walkOrder<T extends Placed>(nodes: readonly T[]): T[] {
  return [...nodes].sort((a, b) =>
    Math.abs(a.position.x - b.position.x) > COLUMN_TOLERANCE
      ? a.position.x - b.position.x
      : a.position.y - b.position.y,
  );
}

/** Where an id sits in the walk, or `-1`. */
export function indexOf<T extends Placed>(ordered: readonly T[], id: string | null): number {
  return id === null ? -1 : ordered.findIndex((n) => n.id === id);
}

/**
 * The step an arrow key should land on.
 *
 * Stops at the ends rather than wrapping. Wrapping in a left-to-right pipeline means pressing
 * right at the last step silently jumps back to the first, which reads as the selection having
 * been lost. With nothing selected, forward starts at the beginning and back starts at the end,
 * so either key gets somebody into the graph.
 */
export function step<T extends Placed>(
  ordered: readonly T[],
  from: string | null,
  direction: 'forward' | 'back',
): T | undefined {
  if (ordered.length === 0) return undefined;
  const at = indexOf(ordered, from);
  if (at < 0) return direction === 'forward' ? ordered[0] : ordered[ordered.length - 1];
  const next = direction === 'forward' ? at + 1 : at - 1;
  return ordered[Math.min(Math.max(next, 0), ordered.length - 1)];
}
