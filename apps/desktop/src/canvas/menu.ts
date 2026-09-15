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

/** The items a right-click on a step offers, in order. */
export const STEP_MENU_IDS = ['duplicate', 'disabled', 'delete'] as const;
export type StepMenuId = (typeof STEP_MENU_IDS)[number];

/**
 * One item, two words. A step that is switched off offers to switch it on, and the other way
 * round — never a single label that leaves which state you are about to be in to guesswork.
 */
export function stepToggleKey(disabled: boolean): 'canvas.menu.enable' | 'canvas.menu.disable' {
  return disabled ? 'canvas.menu.enable' : 'canvas.menu.disable';
}

/**
 * The items a right-click on empty canvas offers.
 *
 * Both of them act on something that may not be there: pasting needs something copied, and
 * selecting all needs something to select. An item that would do nothing is not shown, and when
 * that leaves nothing at all the menu does not open — the browser's menu stays refused either
 * way, so a right-click on an empty canvas is simply quiet.
 */
export function canvasMenuIds(has: { clipboard: boolean; nodes: boolean }): string[] {
  const ids: string[] = [];
  if (has.clipboard) ids.push('paste');
  if (has.nodes) ids.push('selectAll');
  return ids;
}
