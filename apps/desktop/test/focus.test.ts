import { describe, expect, it } from 'vitest';
import { nextInCycle } from '../src/a11y/focus';

/**
 * The part of focus trapping that can be wrong without a browser: where Tab goes at the edges.
 * `aria-modal="true"` promises that Tab never leaves the dialog; this is the arithmetic behind
 * keeping that promise.
 */
describe('tab order inside a trapped container', () => {
  const list = ['first', 'middle', 'last'] as const;

  it('wraps from the last element to the first, and from the first back to the last', () => {
    expect(nextInCycle(list, 'last', false)).toBe('first');
    expect(nextInCycle(list, 'first', true)).toBe('last');
  });

  it('leaves an ordinary Tab alone', () => {
    // `null` means "let the browser do what it would have done": the next element is inside the
    // container anyway, so intervening would only fight the browser's own order.
    expect(nextInCycle(list, 'first', false)).toBeNull();
    expect(nextInCycle(list, 'middle', false)).toBeNull();
    expect(nextInCycle(list, 'middle', true)).toBeNull();
    expect(nextInCycle(list, 'last', true)).toBeNull();
  });

  it('enters the cycle at the right end when focus is on the container itself', () => {
    // A dialog receives focus as a whole first, so the two sentences above its first field are
    // read. The first Tab from there goes to the first control, Shift+Tab to the last.
    expect(nextInCycle(list, null, false)).toBe('first');
    expect(nextInCycle(list, null, true)).toBe('last');
    expect(nextInCycle(list, 'not in the list', false)).toBe('first');
  });

  it('has nowhere to go in an empty container', () => {
    expect(nextInCycle([], null, false)).toBeNull();
    expect(nextInCycle([], null, true)).toBeNull();
  });

  it('cycles a single element onto itself', () => {
    expect(nextInCycle(['only'], 'only', false)).toBe('only');
    expect(nextInCycle(['only'], 'only', true)).toBe('only');
  });
});
