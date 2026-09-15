import { beforeEach, describe, expect, it } from 'vitest';
import {
  canvasMenuIds,
  clampToViewport,
  MENU_MARGIN,
  SELECTION_MENU_IDS,
  STEP_MENU_IDS,
  selectionToggleKey,
  stepToggleKey,
} from '../src/canvas/menu';
import { lookup, type Messages } from '../src/i18n';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import fr from '../src/i18n/locales/fr';
import italian from '../src/i18n/locales/it';
import pt from '../src/i18n/locales/pt';
import { type EditorNode, useEditor } from '../src/store';

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
  const nothing = { clipboard: false, nodes: false, undo: false, redo: false };

  it('offers everything there is to offer', () => {
    expect(canvasMenuIds({ clipboard: true, nodes: true, undo: true, redo: true })).toEqual([
      'undo',
      'redo',
      'paste',
      'selectAll',
    ]);
  });

  it('does not offer to paste nothing', () => {
    expect(canvasMenuIds({ ...nothing, clipboard: false, nodes: true })).toEqual(['selectAll']);
  });

  it('does not offer to select nothing', () => {
    expect(canvasMenuIds({ ...nothing, clipboard: true, nodes: false })).toEqual(['paste']);
  });

  it('does not offer to undo nothing, or to redo what was never undone', () => {
    // Undo and redo were reachable by Ctrl+Z alone, which is folklore to anybody who has not
    // been told — but an item that would do nothing is still not shown.
    expect(canvasMenuIds({ ...nothing, undo: true })).toEqual(['undo']);
    expect(canvasMenuIds({ ...nothing, redo: true })).toEqual(['redo']);
  });

  it('offers nothing on an untouched, empty canvas with an empty clipboard', () => {
    // An empty menu is not opened at all. The browser's own menu stays refused either way.
    expect(canvasMenuIds(nothing)).toEqual([]);
  });
});

describe('the switch on the step menu', () => {
  it('offers to switch on a step that is off, and off a step that is on', () => {
    expect(stepToggleKey(true)).toBe('canvas.menu.enable');
    expect(stepToggleKey(false)).toBe('canvas.menu.disable');
  });

  it('offers to switch a whole selection off unless all of it is already off', () => {
    // The same rule the store applies, so the word and the effect cannot disagree: a mixed
    // selection reads "Switch off", and one press does exactly that.
    expect(selectionToggleKey(true)).toBe('canvas.menu.many.enable');
    expect(selectionToggleKey(false)).toBe('canvas.menu.many.disable');
  });
});

// --- Acting on a selection rather than on one step ------------------------------------------

/** Enough of a node for the store. Nothing renders in this file. */
function step(id: string, disabled = false): EditorNode {
  return {
    id,
    type: 'component',
    position: { x: 0, y: 0 },
    data: { componentRef: 'core.read@1.0.0', config: {}, disabled },
  };
}

describe('what a right-click inside a selection does', () => {
  beforeEach(() => {
    useEditor.setState({
      nodes: [step('a'), step('b'), step('c')],
      edges: [
        { id: 'a->b', source: 'a', target: 'b' },
        { id: 'b->c', source: 'b', target: 'c' },
      ],
      selectedNodeId: 'a',
      dirty: false,
      history: { past: [], future: [] },
    });
  });

  it('removes every step it was asked about, and their connections with them', () => {
    useEditor.getState().deleteSteps(['a', 'b']);
    expect(useEditor.getState().nodes.map((n) => n.id)).toEqual(['c']);
    // Both connections touched one of the two. One left pointing at a step that is gone is a
    // graph the runtime refuses for a reason nobody caused.
    expect(useEditor.getState().edges).toEqual([]);
  });

  it('is one entry in the history, not one per step', () => {
    // Six steps deleted together have to come back with one press of undo. That is what
    // anybody means by "undo that".
    useEditor.getState().deleteSteps(['a', 'b']);
    expect(useEditor.getState().history.past).toHaveLength(1);
  });

  it('lets go of the selection only if the selected step was one of them', () => {
    useEditor.getState().deleteSteps(['b']);
    expect(useEditor.getState().selectedNodeId).toBe('a');
    useEditor.getState().deleteSteps(['a']);
    expect(useEditor.getState().selectedNodeId).toBeNull();
  });

  it('does nothing at all when asked about steps that are not there', () => {
    useEditor.getState().deleteSteps(['ghost']);
    expect(useEditor.getState().nodes).toHaveLength(3);
    expect(useEditor.getState().dirty).toBe(false);
  });

  it('switches a mixed selection off rather than inverting each step', () => {
    // Inverting would leave the selection in the state it started in, differently arranged, and
    // nobody could say in advance what the one menu item was about to do.
    useEditor.setState({ nodes: [step('a', true), step('b', false), step('c')] });
    useEditor.getState().toggleDisabledMany(['a', 'b']);
    expect(useEditor.getState().nodes.map((n) => n.data.disabled)).toEqual([true, true, false]);
  });

  it('switches a selection that is wholly off back on', () => {
    useEditor.setState({ nodes: [step('a', true), step('b', true), step('c')] });
    useEditor.getState().toggleDisabledMany(['a', 'b']);
    expect(useEditor.getState().nodes.map((n) => n.data.disabled)).toEqual([false, false, false]);
  });

  it('leaves the steps it was not asked about alone', () => {
    useEditor.getState().toggleDisabledMany(['a']);
    expect(useEditor.getState().nodes.map((n) => n.data.disabled)).toEqual([true, false, false]);
  });
});

describe('every item has a word in every language', () => {
  const locales: Record<string, Messages> = { en, es, fr, de, it: italian, pt };
  // `disabled` is the one item whose label is chosen at open time, so its two words are listed
  // here instead of the item id — and the same again for a selection, where every word is also
  // counted and therefore has one form per plural category.
  const keys = [
    'canvas.menu.label',
    'canvas.menu.connect',
    'canvas.menu.duplicate',
    'canvas.menu.enable',
    'canvas.menu.disable',
    'canvas.menu.deleteStep',
    'canvas.menu.deleteConnection',
    'canvas.menu.paste',
    'canvas.menu.selectAll',
    'canvas.menu.undo',
    'canvas.menu.redo',
    'canvas.menu.many.duplicate.one',
    'canvas.menu.many.duplicate.other',
    'canvas.menu.many.enable.one',
    'canvas.menu.many.enable.other',
    'canvas.menu.many.disable.one',
    'canvas.menu.many.disable.other',
    'canvas.menu.many.delete.one',
    'canvas.menu.many.delete.other',
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
    // If an id is added to a menu without a word to go with it, this fails rather than the menu
    // quietly drawing its own key at somebody.
    expect(STEP_MENU_IDS).toEqual(['connect', 'duplicate', 'disabled', 'delete']);
    expect(SELECTION_MENU_IDS).toEqual(['duplicate', 'disabled', 'delete']);
  });

  it('does not offer to connect from a whole selection', () => {
    // A connection has one source port, so "connect from these six" is not something anybody
    // could mean — and offering it would have to narrow the selection first, which is the
    // behaviour the selection menu exists to stop.
    expect(SELECTION_MENU_IDS).not.toContain('connect');
  });
});
