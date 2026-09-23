// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Canvas } from '../src/canvas/Canvas';
import { Palette } from '../src/panels/Palette';
import { useEditor } from '../src/store';
import type { ComponentManifest } from '../src/types';

/**
 * Pressing the palette selects the new step — asked after React Flow has had its say.
 *
 * `palette.test.tsx` asserts the store's half of this: the new node carries `selected`, every
 * other node is written unselected, and `selectedNodeId` names the new one. That is necessary and
 * not sufficient, because the defect it guards against was a round trip the store never sees on
 * its own. React Flow owns the selection; `Canvas.tsx` mirrors it back into the store with
 * `onSelectionChange={({ nodes }) => select(nodes[0]?.id ?? null)}`. A store that named the new
 * node without handing React Flow a selection that agreed was corrected on the very next render —
 * React Flow reported the selection it held, and `select()` overwrote `selectedNodeId` with it.
 *
 * So this suite renders what `Builder.tsx` renders for the editor — the real `Palette`, and the
 * real `Canvas` inside a `ReactFlowProvider` — over the real store, presses palette buttons, waits
 * for React Flow to settle, and only then asks where the selection is: in the store, and on the
 * node React Flow drew. `select` is wrapped so the test can also show that React Flow's
 * `onSelectionChange` really reached the store; a round trip that never ran would prove nothing.
 *
 * The stubs below exist because jsdom has no layout. React Flow measures its container and each
 * node with `offsetWidth`/`offsetHeight` and watches them with `ResizeObserver`, and the canvas
 * sets `onlyRenderVisibleElements` — a viewport that measures 0×0 would cull every node and leave
 * nothing in the DOM to assert on. They are installed for this file only, never in product code.
 */

// ---- jsdom has no layout: give React Flow something to measure --------------------------------

class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element): void {
    // Report the element once, as a browser would after its first layout, with the size the
    // `offsetWidth`/`offsetHeight` stubs below give it. React Flow reads nodes through those
    // properties and its pan-zoom extent through `contentRect`.
    const el = target as HTMLElement;
    const contentRect = { width: el.offsetWidth, height: el.offsetHeight };
    this.callback(
      [{ target, contentRect } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
}

class DOMMatrixReadOnlyStub {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
    this.m22 = scale !== undefined ? Number(scale) : 1;
  }
}

const saved: {
  name: 'offsetWidth' | 'offsetHeight';
  descriptor: PropertyDescriptor | undefined;
}[] = [];
const savedGlobals: Record<string, unknown> = {};

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  for (const name of ['ResizeObserver', 'DOMMatrixReadOnly']) savedGlobals[name] = g[name];
  g.ResizeObserver = ResizeObserverStub;
  g.DOMMatrixReadOnly = DOMMatrixReadOnlyStub;

  // A generous size for everything: the canvas, its viewport, and each node. Nodes are placed at
  // x 220, 480, 740 with fitView, so a 1600×1000 viewport keeps all of them visible.
  const sizes = { offsetWidth: 1600, offsetHeight: 1000 } as const;
  for (const name of ['offsetWidth', 'offsetHeight'] as const) {
    saved.push({ name, descriptor: Object.getOwnPropertyDescriptor(HTMLElement.prototype, name) });
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('react-flow__node')
          ? name === 'offsetWidth'
            ? 180
            : 60
          : sizes[name];
      },
    });
  }
});

afterAll(() => {
  const g = globalThis as Record<string, unknown>;
  for (const [name, value] of Object.entries(savedGlobals)) g[name] = value;
  for (const { name, descriptor } of saved) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
  }
});

// ---- the store, seeded the way palette.test.tsx seeds it --------------------------------------

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

const UPPERCASE = manifest({ id: 'dev.encastra.text.uppercase', name: 'Uppercase' });
const COUNT = manifest({
  id: 'dev.encastra.text.count',
  name: 'Count Words',
  category: 'analysis',
});

const INITIAL = useEditor.getState();

/** Every id React Flow's `onSelectionChange` handed to the store, in order. */
let selections: (string | null)[] = [];

function seed(manifests: ComponentManifest[]): void {
  const byRef: Record<string, ComponentManifest> = {};
  for (const m of manifests) byRef[`${m.id}@${m.version}`] = m;
  const original = INITIAL.select;
  useEditor.setState({
    manifests: byRef,
    // Wrapped, not replaced: the store still does exactly what it does, and the test can see
    // that React Flow called it. During a palette press nothing else calls `select` — the canvas
    // calls it from `onNodeClick` and `onPaneClick` too, and neither is pressed here.
    select: (id) => {
      selections.push(id);
      original(id);
    },
  });
}

function renderEditor(): void {
  render(
    <>
      <Palette />
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    </>,
  );
}

/** The node React Flow drew for `id`, if it drew one. */
function drawn(id: string): Element | null {
  return document.querySelector(`.react-flow__node[data-id="${id}"]`);
}

function selectedInDom(): string[] {
  return [...document.querySelectorAll('.react-flow__node.selected')].map(
    (el) => el.getAttribute('data-id') ?? '?',
  );
}

beforeEach(() => {
  useEditor.setState(INITIAL, true);
  selections = [];
});

afterEach(() => {
  cleanup();
});

/**
 * Waits until React Flow has drawn and measured the node — the point after which it has had its
 * say about the selection. Deliberately silent about *where* the selection is: the assertions
 * that follow are the ones that decide that, so a regression fails on them, with their message,
 * rather than on a timeout here.
 */
async function settled(id: string): Promise<void> {
  await waitFor(() => {
    const el = drawn(id) as HTMLElement | null;
    expect(el, `React Flow never drew ${id}`).not.toBeNull();
    expect(el?.style.visibility, `React Flow never measured ${id}`).not.toBe('hidden');
  });
}

/** Presses a palette button and returns the id of the step it placed, once React Flow settled. */
async function press(user: ReturnType<typeof userEvent.setup>, name: RegExp): Promise<string> {
  const before = useEditor.getState().nodes.length;
  await user.click(screen.getByRole('button', { name }));
  const id = useEditor.getState().nodes[before]?.id;
  if (!id) throw new Error(`pressing ${name} placed no step`);
  await settled(id);
  return id;
}

describe('the palette selects the step it placed, after React Flow has answered', () => {
  it('one press: the store and the drawn node agree on the new step', async () => {
    const user = userEvent.setup();
    seed([UPPERCASE, COUNT]);
    renderEditor();

    const first = await press(user, /Uppercase/);

    expect(useEditor.getState().selectedNodeId).toBe(first);
    expect(selectedInDom()).toEqual([first]);
    // The mirror is fed by React Flow: it reported the new step through `onSelectionChange`.
    expect(selections.at(-1)).toBe(first);
  });

  it('a second press moves the selection, and leaves exactly one step selected', async () => {
    const user = userEvent.setup();
    seed([UPPERCASE, COUNT]);
    renderEditor();

    const first = await press(user, /Uppercase/);
    const second = await press(user, /Count Words/);

    const state = useEditor.getState();
    expect(state.selectedNodeId).toBe(second);
    expect(state.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual([second]);
    expect(selectedInDom()).toEqual([second]);
    expect(drawn(first)?.classList.contains('selected')).toBe(false);
    // The last word React Flow had on the matter names the second step.
    expect(selections.at(-1)).toBe(second);
  });

  it('a step selected on the canvas gives the selection up to the one the palette places', async () => {
    // The shape of the original defect: React Flow already holds a selection — here, one made by
    // clicking a step on the canvas — and the palette places a new step. If the store names the
    // new step without React Flow agreeing, React Flow reports what it still holds and the
    // store's `selectedNodeId` is put back (or cleared) on the next render.
    const user = userEvent.setup();
    seed([UPPERCASE, COUNT]);
    renderEditor();

    const first = await press(user, /Uppercase/);
    const second = await press(user, /Count Words/);

    const target = drawn(first);
    if (!target) throw new Error('the first step was not drawn');
    // A `click` event rather than `user.click`: user-event's `mousedown` reaches d3-drag with no
    // `event.view` in jsdom, and d3-drag dereferences it. React Flow's own node `onClick` is what
    // selects here (a node is selected on click when `nodeDragThreshold` is above zero, which is
    // its default), so the selection below is made by React Flow, not written by the test.
    fireEvent.click(target);
    await waitFor(() => expect(selectedInDom()).toEqual([first]));
    expect(useEditor.getState().selectedNodeId).toBe(first);

    const third = await press(user, /Uppercase/);

    expect(useEditor.getState().selectedNodeId).toBe(third);
    expect(selectedInDom()).toEqual([third]);
    expect(
      useEditor
        .getState()
        .nodes.filter((n) => n.selected)
        .map((n) => n.id),
    ).toEqual([third]);
    expect(drawn(second)?.classList.contains('selected')).toBe(false);
    expect(selections.at(-1)).toBe(third);
  });
});
