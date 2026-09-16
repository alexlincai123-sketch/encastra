// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Palette } from '../src/panels/Palette';
import { useEditor } from '../src/store';
import type { ComponentManifest } from '../src/types';

/**
 * Pressing a component in the palette puts a step on the canvas.
 *
 * This is the first test in the repository that renders a React component into a document and
 * presses it the way a person does. Every other claim about this button was made about the
 * functions behind it, which is a claim about the store, not about the button: a palette whose
 * `onClick` had been deleted would have kept all of those tests green.
 *
 * That gap is not hypothetical. A GUI harness pressed this button three ways against the built
 * application and no step appeared, and nobody could say whether the product was broken or the
 * harness was blind. This suite is the half of the answer that does not need a window manager:
 * it renders the real `Palette`, drives the real store, and asserts the whole contract of the
 * node that comes out — its type, its component reference, its configuration, its position and
 * the selection that follows it. Each of those assertions exists because a plausible way of
 * breaking the feature would leave the others passing.
 *
 * The three gestures are mouse, Enter and Space, because a `<button>` earns Enter and Space from
 * the platform and a `<div onClick>` does not — and the difference between them is invisible to
 * anything that calls the handler directly.
 *
 * The selection is asserted in both of the places a selection lives, because holding only one of
 * them is exactly how this broke. React Flow owns the selection and `selectedNodeId` mirrors it;
 * a store that named the new node without marking it `selected` was corrected back on the next
 * render — React Flow fired `onSelectionChange` with the selection it still held, the inspector
 * stayed on "select a step to configure it", and the step somebody had just placed could only be
 * reached again by hunting for it with the arrow keys. `selectedNodeId` alone was green through
 * all of that, so the node's own `selected` flag — and the absence of it on every other node —
 * is part of the contract here.
 */

function manifest(overrides: Partial<ComponentManifest> & { id: string }): ComponentManifest {
  return {
    schema: 1,
    version: '1.0.0',
    name: overrides.id,
    runtime: 'native',
    kind: 'core',
    category: 'text',
    ports: { inputs: {}, outputs: {} },
    config: {},
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    retryable: false,
    ...overrides,
  };
}

const UPPERCASE = manifest({
  id: 'dev.encastra.text.uppercase',
  name: 'Uppercase',
  description: 'Makes text louder.',
  config: {
    locale: { type: 'string', default: 'en' },
    trim: { type: 'boolean', default: true },
    // No default: the store copies defaults only, so this key must not appear on the node.
    suffix: { type: 'string' },
  },
});

const COUNT = manifest({
  id: 'dev.encastra.text.count',
  name: 'Count Words',
  category: 'analysis',
});

const UPPERCASE_REF = 'dev.encastra.text.uppercase@1.0.0';

/** Everything the store starts with, captured once, before any test has touched it. */
const INITIAL = useEditor.getState();

function seed(manifests: ComponentManifest[]): void {
  const byRef: Record<string, ComponentManifest> = {};
  for (const m of manifests) byRef[`${m.id}@${m.version}`] = m;
  useEditor.setState({ manifests: byRef });
}

beforeEach(() => {
  useEditor.setState(INITIAL, true);
});

afterEach(() => {
  cleanup();
});

describe('the palette button, as the person sees it', () => {
  it('names the component, and is something the keyboard can reach and press', () => {
    seed([UPPERCASE]);
    render(<Palette />);

    const button = screen.getByRole('button', { name: /Uppercase/ });
    expect(button).toBeDefined();
    expect(button.hasAttribute('disabled')).toBe(false);

    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('says nothing is installed, and offers nothing to press, when nothing is', () => {
    render(<Palette />);

    expect(screen.getByText('No components are installed.')).toBeDefined();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('pressing it places a step', () => {
  it('a click puts one node on the canvas, with the whole contract kept', async () => {
    const user = userEvent.setup();
    seed([UPPERCASE]);
    render(<Palette />);

    expect(useEditor.getState().nodes).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /Uppercase/ }));

    const state = useEditor.getState();
    expect(state.nodes).toHaveLength(1);

    const node = state.nodes[0];
    if (!node) throw new Error('a node was expected on the canvas');
    expect(node.type).toBe('component');
    expect(node.data.componentRef).toBe(UPPERCASE_REF);
    // Only the fields that declare a default, and exactly those.
    expect(node.data.config).toEqual({ locale: 'en', trim: true });
    expect(node.data.disabled).toBe(false);
    expect(node.position).toEqual({ x: 220, y: 140 });
    expect(node.id).toMatch(/^uppercase-\d+$/);

    // A step you just placed is the step you want to configure — in the store's mirror and on
    // the node itself, which is where React Flow reads the selection back from.
    expect(state.selectedNodeId).toBe(node.id);
    expect(node.selected).toBe(true);
    expect(state.dirty).toBe(true);
  });

  it('Enter places one, and Space places another beside it', async () => {
    const user = userEvent.setup();
    seed([UPPERCASE]);
    render(<Palette />);

    const button = screen.getByRole('button', { name: /Uppercase/ });
    button.focus();
    expect(document.activeElement).toBe(button);

    await user.keyboard('{Enter}');
    expect(useEditor.getState().nodes).toHaveLength(1);
    expect(useEditor.getState().nodes[0]?.position).toEqual({ x: 220, y: 140 });
    expect(useEditor.getState().nodes[0]?.selected).toBe(true);

    await user.keyboard(' ');
    const nodes = useEditor.getState().nodes;
    expect(nodes).toHaveLength(2);
    // Placed to the right of the last one rather than on top of it, where it would be invisible.
    expect(nodes[1]?.position).toEqual({ x: 480, y: 140 });
    expect(nodes[1]?.data.componentRef).toBe(UPPERCASE_REF);
    expect(useEditor.getState().selectedNodeId).toBe(nodes[1]?.id);
    // The one placed by Space is the selection, and the one placed by Enter has given it up.
    expect(nodes[0]?.selected).toBe(false);
    expect(nodes[1]?.selected).toBe(true);
  });

  it('a second click does not hide the second node under the first', async () => {
    const user = userEvent.setup();
    seed([UPPERCASE]);
    render(<Palette />);

    const button = screen.getByRole('button', { name: /Uppercase/ });
    await user.click(button);
    await user.click(button);

    const nodes = useEditor.getState().nodes;
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.position).toEqual({ x: 220, y: 140 });
    expect(nodes[1]?.position).toEqual({ x: 480, y: 140 });
    expect(nodes[0]?.id).not.toBe(nodes[1]?.id);
    // Nor does it leave two steps looking selected: the second click moves the selection, and
    // the inspector shows one step because there is one.
    expect(nodes.filter((n) => n.selected)).toHaveLength(1);
    expect(nodes[0]?.selected).toBe(false);
    expect(nodes[1]?.selected).toBe(true);
    expect(useEditor.getState().selectedNodeId).toBe(nodes[1]?.id);
  });

  it('presses the component that was pressed, not the first one in the list', async () => {
    const user = userEvent.setup();
    seed([UPPERCASE, COUNT]);
    render(<Palette />);

    expect(screen.getAllByRole('button')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Count Words/ }));

    const nodes = useEditor.getState().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.data.componentRef).toBe('dev.encastra.text.count@1.0.0');
    expect(nodes[0]?.id).toMatch(/^count-\d+$/);
  });
});

describe('a reference to a component that is not installed', () => {
  /**
   * The palette can only offer what it has a manifest for, so this half of the contract is
   * asked of the store directly: the same reference arrives from a drop onto the canvas, and
   * from a project file written against a component this machine does not have.
   */
  it('places nothing, and does not make the project look edited', () => {
    seed([UPPERCASE]);
    expect(useEditor.getState().dirty).toBe(false);

    useEditor.getState().addNode('dev.encastra.text.missing@0.0.0', { x: 0, y: 0 });

    expect(useEditor.getState().nodes).toHaveLength(0);
    expect(useEditor.getState().selectedNodeId).toBeNull();
    expect(useEditor.getState().dirty).toBe(false);
  });
});
