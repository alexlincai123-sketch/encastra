/**
 * Undo and redo for the canvas.
 *
 * Two decisions shape this.
 *
 * **A snapshot, not a command log.** The graph is small — hundreds of nodes at the very most —
 * and an edit is a handful of kilobytes. Inverse operations for every kind of edit would be
 * more code and more ways to be subtly wrong, and "undo put it back slightly differently" is
 * the worst bug a history can have.
 *
 * **Dragging is one entry, not two hundred.** A drag produces a position change on every frame.
 * Pushing each one would fill the history with a single gesture, so a move is recorded when the
 * pointer is released.
 */

import type { Edge } from '@xyflow/react';
import type { EditorNode } from './store';

export interface Snapshot {
  nodes: EditorNode[];
  edges: Edge[];
}

/** Enough to undo a long editing session; small enough to be free. */
const LIMIT = 100;

export interface History {
  past: Snapshot[];
  future: Snapshot[];
}

export const emptyHistory: History = { past: [], future: [] };

/**
 * Records the state *before* an edit.
 *
 * Redo is discarded, because editing after undoing creates a new line of history and keeping
 * the abandoned one reachable is how people end up somewhere they cannot explain.
 */
export function record(history: History, snapshot: Snapshot): History {
  const past = [...history.past, snapshot];
  return {
    past: past.length > LIMIT ? past.slice(past.length - LIMIT) : past,
    future: [],
  };
}

export function undo(
  history: History,
  current: Snapshot,
): { history: History; snapshot: Snapshot } | null {
  const previous = history.past.at(-1);
  if (!previous) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, LIMIT),
    },
    snapshot: previous,
  };
}

export function redo(
  history: History,
  current: Snapshot,
): { history: History; snapshot: Snapshot } | null {
  const next = history.future[0];
  if (!next) return null;
  return {
    history: {
      past: [...history.past, current].slice(-LIMIT),
      future: history.future.slice(1),
    },
    snapshot: next,
  };
}

/**
 * Copies a selection, keeping only the edges whose *both* ends are in it.
 *
 * An edge to a node that was not copied would paste as a connection to nothing, and the
 * runtime would refuse the graph for a reason the person never caused.
 */
export function cut(nodes: EditorNode[], edges: Edge[], selected: Set<string>): Snapshot {
  return {
    nodes: nodes.filter((n) => selected.has(n.id)),
    edges: edges.filter((e) => selected.has(e.source) && selected.has(e.target)),
  };
}

/**
 * Pastes a clipboard, giving everything new identifiers and nudging it clear of the original.
 *
 * The rewrite has to be consistent: an edge that still pointed at the node it was copied from
 * would silently join the pasted copy to the original.
 */
export function paste(
  clipboard: Snapshot,
  existingIds: Set<string>,
  offset = 32,
): { nodes: EditorNode[]; edges: Edge[]; ids: string[] } {
  const rename = new Map<string, string>();
  for (const node of clipboard.nodes) {
    let candidate = `${node.id}-copy`;
    let n = 2;
    while (existingIds.has(candidate) || rename.has(candidate)) {
      candidate = `${node.id}-copy${n}`;
      n += 1;
    }
    rename.set(node.id, candidate);
    existingIds.add(candidate);
  }

  const nodes: EditorNode[] = clipboard.nodes.map((node) => ({
    ...node,
    id: rename.get(node.id) ?? node.id,
    position: { x: node.position.x + offset, y: node.position.y + offset },
    selected: true,
    data: { ...node.data, config: { ...node.data.config } },
  }));

  const edges: Edge[] = clipboard.edges.map((edge) => {
    const source = rename.get(edge.source) ?? edge.source;
    const target = rename.get(edge.target) ?? edge.target;
    return {
      ...edge,
      id: `${source}.${edge.sourceHandle}->${target}.${edge.targetHandle}`,
      source,
      target,
      selected: false,
    };
  });

  return { nodes, edges, ids: [...rename.values()] };
}
