/**
 * Keeping focus where a dialog says it is.
 *
 * Both dialogs in this application declare `aria-modal="true"`, which tells a screen reader that
 * everything outside them is inert. Nothing made that true: Tab walked straight out of the panel
 * into the sidebar behind it, and closing the panel left focus on the body, so somebody driving
 * the editor from the keyboard lost their place every time they opened Publish. The declaration
 * and the behaviour have to agree, or the declaration is the lie.
 *
 * Two small, separable promises:
 *
 * - **Tab stays inside.** While a container is active, Tab from its last focusable element goes
 *   to its first, and Shift+Tab from the first goes to the last. Nothing else about Tab changes.
 * - **Focus goes back where it came from.** Whatever had focus when the container opened gets it
 *   again when the container closes — the button that opened it, almost always. A dialog that
 *   drops focus on the body on close makes the next keypress land somewhere nobody chose.
 *
 * The pure parts are exported so they can be tested without a DOM.
 */

import { type RefObject, useEffect } from 'react';

/**
 * What counts as reachable by Tab. Disabled controls and anything removed from the sequence with
 * `tabindex="-1"` are left out, because Tab would skip them too.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Every element inside `root` that Tab could land on, in document order. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Where Tab should go next when it would otherwise leave the cycle.
 *
 * Returns the element to focus, or `null` when the default behaviour is right — a Tab from
 * anywhere but the last element, a Shift+Tab from anywhere but the first, or a Tab from outside
 * the list entirely (focus was on the container itself), which goes to the first element.
 */
export function nextInCycle<T>(
  list: readonly T[],
  current: T | null,
  backwards: boolean,
): T | null {
  const first = list[0];
  const last = list[list.length - 1];
  if (first === undefined || last === undefined) return null;
  if (current === null || !list.includes(current)) return backwards ? last : first;
  if (!backwards && current === last) return first;
  if (backwards && current === first) return last;
  return null;
}

/**
 * Traps Tab inside `container` while `active`, and hands focus back on the way out.
 *
 * The element that had focus when the trap became active is remembered at that moment, not at
 * mount: a dialog component that is always mounted and merely hidden would otherwise remember
 * whatever was focused at start-up.
 */
export function useFocusTrap(container: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = container.current;
    if (!root) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = focusableWithin(root);
      const current =
        document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
          ? document.activeElement
          : null;
      const target = nextInCycle(focusable, current, event.shiftKey);
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => {
      root.removeEventListener('keydown', onKeyDown);
      // Only if it is still there to receive it. The button that opened a dialog may have been
      // unmounted by whatever the dialog did — a project that closed, a view that changed — and
      // focusing a detached element does nothing useful.
      if (opener?.isConnected) opener.focus();
    };
  }, [container, active]);
}

/**
 * Hands focus back to whatever had it when this component mounted, once it unmounts.
 *
 * For things that are mounted only while open — the canvas menu — where the mount itself is the
 * moment to remember the opener.
 */
export function useRestoreFocusOnUnmount(): void {
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);
}
