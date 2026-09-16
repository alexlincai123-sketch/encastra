import { beforeEach, describe, expect, it } from 'vitest';
import { type EditorNode, useEditor } from '../src/store';
import type { ComponentManifest } from '../src/types';

/**
 * What `addNode` does to the selection when the canvas is not empty.
 *
 * A selection lives in two places: React Flow owns it on the nodes themselves, and the store
 * mirrors it in `selectedNodeId`. Writing only the mirror was undone on the next render — React
 * Flow fired `onSelectionChange` with the selection it still held and the store was corrected
 * back, so the step somebody had just placed never opened in the inspector. The palette suite
 * presses the real button; this one asks the store the same question with a canvas that already
 * has a selection on it, which is the case where "select the new one" and "deselect the old one"
 * can come apart.
 */

const UPPERCASE: ComponentManifest = {
  schema: 1,
  id: 'dev.encastra.text.uppercase',
  version: '1.0.0',
  name: 'Uppercase',
  runtime: 'native',
  kind: 'core',
  category: 'text',
  ports: { inputs: {}, outputs: {} },
  config: {},
  capabilities: [],
  platforms: ['windows', 'macos', 'linux'],
  retryable: false,
};

const UPPERCASE_REF = `${UPPERCASE.id}@${UPPERCASE.version}`;

function step(id: string, x: number, selected: boolean): EditorNode {
  return {
    id,
    type: 'component',
    position: { x, y: 0 },
    selected,
    data: { componentRef: UPPERCASE_REF, config: {}, disabled: false },
  };
}

const INITIAL = useEditor.getState();

beforeEach(() => {
  useEditor.setState(INITIAL, true);
  useEditor.setState({
    manifests: { [UPPERCASE_REF]: UPPERCASE },
    nodes: [step('first', 0, false), step('second', 300, true)],
    selectedNodeId: 'second',
  });
});

describe('placing a step on a canvas that already has one selected', () => {
  it('leaves exactly one selected step, and it is the new one', () => {
    useEditor.getState().addNode(UPPERCASE_REF, { x: 900, y: 400 });

    const nodes = useEditor.getState().nodes;
    expect(nodes).toHaveLength(3);

    const selected = nodes.filter((n) => n.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe(nodes[2]?.id);
    // The step that held the selection before has given it up rather than keeping a highlight.
    expect(nodes.find((n) => n.id === 'second')?.selected).toBe(false);
    expect(nodes.find((n) => n.id === 'first')?.selected).toBe(false);
  });

  it('names that same step in the store mirror the inspector reads', () => {
    useEditor.getState().addNode(UPPERCASE_REF, { x: 900, y: 400 });

    const state = useEditor.getState();
    const placed = state.nodes[2];
    if (!placed) throw new Error('a third node was expected on the canvas');
    expect(state.selectedNodeId).toBe(placed.id);
    expect(placed.selected).toBe(true);
  });

  it('touches nothing else about the steps that were already there', () => {
    useEditor.getState().addNode(UPPERCASE_REF, { x: 900, y: 400 });

    const nodes = useEditor.getState().nodes;
    expect(nodes[0]?.id).toBe('first');
    expect(nodes[0]?.position).toEqual({ x: 0, y: 0 });
    expect(nodes[1]?.id).toBe('second');
    expect(nodes[1]?.position).toEqual({ x: 300, y: 0 });
    expect(nodes[1]?.data).toEqual({ componentRef: UPPERCASE_REF, config: {}, disabled: false });
  });

  it('leaves the selection alone when there is no manifest to place', () => {
    useEditor.getState().addNode('dev.encastra.text.missing@0.0.0', { x: 900, y: 400 });

    const state = useEditor.getState();
    expect(state.nodes).toHaveLength(2);
    expect(state.selectedNodeId).toBe('second');
    expect(state.nodes.filter((n) => n.selected).map((n) => n.id)).toEqual(['second']);
  });
});
