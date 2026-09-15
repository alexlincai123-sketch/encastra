/**
 * What the canvas menu contains, and where it fits.
 *
 * Kept apart from the component that draws it for the same reason `walk.ts` is: these are the
 * two decisions worth being sure about — which items exist at all, and whether the menu lands on
 * screen — and neither of them needs a DOM to answer.
 */

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/** How close to the window edge a menu may sit. */
export const MENU_MARGIN = 8;

/**
 * Keeps a menu inside the window.
 *
 * A right-click near the bottom of the screen would otherwise open a menu whose items are below
 * it — reachable only by scrolling a page that does not scroll.
 */
export function clampToViewport(at: Point, size: Size, viewport: Size): Point {
  const maxX = viewport.width - size.width - MENU_MARGIN;
  const maxY = viewport.height - size.height - MENU_MARGIN;
  return {
    // `Math.max` last, so a menu taller than the window is pinned to the top edge rather than
    // pushed off the top by a negative maximum.
    x: Math.max(MENU_MARGIN, Math.min(at.x, maxX)),
    y: Math.max(MENU_MARGIN, Math.min(at.y, maxY)),
  };
}

/** The items a right-click on a single step offers, in order. */
export const STEP_MENU_IDS = ['connect', 'duplicate', 'disabled', 'delete'] as const;
export type StepMenuId = (typeof STEP_MENU_IDS)[number];

/**
 * The items a right-click *inside a selection of several steps* offers, in order.
 *
 * Connecting is not among them, and cannot be: a connection has one source port, so "connect
 * from these six" is not something anybody could mean. Offering it would have to narrow the
 * selection to the step under the pointer first, which is the very behaviour this list exists
 * to stop.
 */
export const SELECTION_MENU_IDS = ['duplicate', 'disabled', 'delete'] as const;

/**
 * One item, two words. A step that is switched off offers to switch it on, and the other way
 * round — never a single label that leaves which state you are about to be in to guesswork.
 */
export function stepToggleKey(disabled: boolean): 'canvas.menu.enable' | 'canvas.menu.disable' {
  return disabled ? 'canvas.menu.enable' : 'canvas.menu.disable';
}

/**
 * The same choice for a whole selection, from the same rule the store applies: everything goes
 * off unless everything is already off. A mixed selection therefore offers to switch off, which
 * is exactly what the one press does — label and effect come from one fact, so they cannot
 * drift apart.
 */
export function selectionToggleKey(
  allDisabled: boolean,
): 'canvas.menu.many.enable' | 'canvas.menu.many.disable' {
  return allDisabled ? 'canvas.menu.many.enable' : 'canvas.menu.many.disable';
}

/**
 * The items a right-click on empty canvas offers.
 *
 * Every one of them acts on something that may not be there: undo needs an edit behind it, redo
 * needs an undo behind that, pasting needs something copied, and selecting all needs something
 * to select. An item that would do nothing is not shown, and when that leaves nothing at all the
 * menu does not open — the browser's menu stays refused either way, so a right-click on an empty
 * canvas is simply quiet.
 *
 * Undo and redo come first because they are about what just happened rather than about what is
 * on the canvas — and because on a canvas something has just been deleted from, they are the
 * only way back, which until now was reachable from the keyboard alone.
 */
export function canvasMenuIds(has: {
  clipboard: boolean;
  nodes: boolean;
  undo: boolean;
  redo: boolean;
}): string[] {
  const ids: string[] = [];
  if (has.undo) ids.push('undo');
  if (has.redo) ids.push('redo');
  if (has.clipboard) ids.push('paste');
  if (has.nodes) ids.push('selectAll');
  return ids;
}
