import { describe, expect, it } from 'vitest';
import {
  canvasMenuIds,
  clampToViewport,
  MENU_MARGIN,
  STEP_MENU_IDS,
  stepToggleKey,
} from '../src/canvas/menu';
import { lookup, type Messages } from '../src/i18n';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import fr from '../src/i18n/locales/fr';
import italian from '../src/i18n/locales/it';
import pt from '../src/i18n/locales/pt';

const VIEWPORT = { width: 1280, height: 820 };
const MENU = { width: 180, height: 120 };

describe('where the menu lands', () => {
  it('opens where the click was, when there is room', () => {
    expect(clampToViewport({ x: 400, y: 300 }, MENU, VIEWPORT)).toEqual({ x: 400, y: 300 });
  });

  it('is pulled back inside when the click is near the right edge', () => {
    const at = clampToViewport({ x: 1270, y: 300 }, MENU, VIEWPORT);
    expect(at.x + MENU.width).toBeLessThanOrEqual(VIEWPORT.width);
  });

  it('is pulled back inside when the click is near the bottom edge', () => {
    // The defect this prevents: a right-click low on the canvas opening a menu whose items are
    // below the window, on a page that does not scroll.
    const at = clampToViewport({ x: 400, y: 810 }, MENU, VIEWPORT);
    expect(at.y + MENU.height).toBeLessThanOrEqual(VIEWPORT.height);
  });

  it('pins a menu taller than the window to the top rather than above it', () => {
    const tall = { width: 180, height: 900 };
    expect(clampToViewport({ x: 400, y: 300 }, tall, VIEWPORT).y).toBe(MENU_MARGIN);
  });

  it('never opens flush against an edge', () => {
    const at = clampToViewport({ x: 0, y: 0 }, MENU, VIEWPORT);
    expect(at).toEqual({ x: MENU_MARGIN, y: MENU_MARGIN });
  });
});

describe('what the canvas menu offers', () => {
  it('offers both when there is something to paste and something to select', () => {
    expect(canvasMenuIds({ clipboard: true, nodes: true })).toEqual(['paste', 'selectAll']);
  });

  it('does not offer to paste nothing', () => {
    expect(canvasMenuIds({ clipboard: false, nodes: true })).toEqual(['selectAll']);
  });

  it('does not offer to select nothing', () => {
    expect(canvasMenuIds({ clipboard: true, nodes: false })).toEqual(['paste']);
  });

  it('offers nothing on an empty canvas with an empty clipboard', () => {
    // An empty menu is not opened at all. The browser's own menu stays refused either way.
    expect(canvasMenuIds({ clipboard: false, nodes: false })).toEqual([]);
  });
});

describe('the switch on the step menu', () => {
  it('offers to switch on a step that is off, and off a step that is on', () => {
    expect(stepToggleKey(true)).toBe('canvas.menu.enable');
    expect(stepToggleKey(false)).toBe('canvas.menu.disable');
  });
});

describe('every item has a word in every language', () => {
  const locales: Record<string, Messages> = { en, es, fr, de, it: italian, pt };
  // `disabled` is the one item whose label is chosen at open time, so its two words are listed
  // here instead of the item id.
  const keys = [
    'canvas.menu.label',
    'canvas.menu.duplicate',
    'canvas.menu.enable',
    'canvas.menu.disable',
    'canvas.menu.deleteStep',
    'canvas.menu.deleteConnection',
    'canvas.menu.paste',
    'canvas.menu.selectAll',
  ];

  for (const [name, messages] of Object.entries(locales)) {
    it(`${name} has all of them`, () => {
      for (const key of keys) {
        const word = lookup(messages, key);
        expect(word, `${name} is missing ${key}`).toBeTypeOf('string');
        expect(word).not.toBe('');
      }
    });
  }

  it('covers every id the step menu builds', () => {
    // If an id is added to the menu without a word to go with it, this fails rather than the
    // menu quietly drawing its own key at somebody.
    expect(STEP_MENU_IDS).toEqual(['duplicate', 'disabled', 'delete']);
  });
});
