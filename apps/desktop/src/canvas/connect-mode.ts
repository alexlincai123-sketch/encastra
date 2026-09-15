/**
 * Making a connection without a mouse.
 *
 * Until this existed, the canvas could be walked, a step could be selected, configured and
 * deleted from the keyboard — and the one thing the editor is actually for, joining two steps
 * together, could only be done by dragging a wire with a pointer. A workflow that cannot be
 * connected cannot be built, so the keyboard path stopped one step short of the product.
 *
 * Three decisions shape what is here.
 *
 * **Legality is not re-derived.** This module takes the same predicate the pointer drag uses —
 * `isConnectionLegal`, which asks `@encastra/protocol` the question the runtime will ask — and
 * simply calls it once per candidate. A second opinion about which connections are allowed is
 * exactly the drift `refusal.ts` exists to avoid; there is one rule and both paths ask it.
 *
 * **A refused target is skipped, not greyed out.** Arrow keys move between things you can
 * choose. Stepping onto a port only to be told no is the pointer's problem — it has to let you
 * aim anywhere — and the keyboard does not have to inherit it. The count of what survives is
 * returned with the list so the live region can say how many there are, which is the part a
 * sighted user gets from seeing the whole canvas at once.
 *
 * **An input that already has a connection is still a candidate.** `connect` in the store
 * replaces whatever was feeding that input rather than adding a second edge, because that is
 * what validation enforces. Hiding an occupied input here would make the keyboard refuse
 * something the pointer allows, so the rule is mirrored rather than re-invented: candidates are
 * computed from ports and legality alone, never from the edges that exist.
 *
 * The highlight also has to reach the nodes React Flow renders, which are not children of the
 * canvas component in any sense it can pass a prop through, so the context that carries it lives
 * here too — with the rest of what "a connection is being made" means.
 */

import { createContext, useContext } from 'react';
import { type Placed, walkOrder } from './walk';

/** One end of a connection: a step, and one of its ports. */
export interface PortAt {
  readonly node: string;
  readonly port: string;
}

/**
 * The least a node has to be for this module: where it sits, and which component it is.
 *
 * Structural rather than `EditorNode` so the tests can state a case in a line, the same reason
 * `walk.ts` takes a `Placed`.
 */
export interface Connectable extends Placed {
  readonly data: { readonly componentRef: string };
}

/** The least a manifest has to be: the names of its ports, in the order they were declared. */
export interface PortTable {
  readonly ports: {
    readonly inputs: Record<string, unknown>;
    readonly outputs: Record<string, unknown>;
  };
}

/**
 * The question `isValidConnection` answers, in the shape React Flow asks it. Taken as a
 * parameter rather than imported so this module never grows an opinion of its own about which
 * connections are legal.
 */
export type Accepts = (candidate: {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}) => boolean;

/** The ports on one side of a step, in declaration order — which is the order they are drawn. */
export function portsOf(
  node: Connectable,
  manifests: Readonly<Record<string, PortTable | undefined>>,
  side: 'inputs' | 'outputs',
): string[] {
  const manifest = manifests[node.data.componentRef];
  return manifest ? Object.keys(manifest.ports[side]) : [];
}

/**
 * Every input port this output could legally be joined to, in walk order.
 *
 * Walk order rather than graph order for the same reason the arrow keys use it: somebody
 * choosing a target is looking at the canvas, and the next press should land where the eye
 * would go next. A step never offers itself — a node feeding itself is a cycle of one, which
 * `isConnectionLegal` refuses anyway; skipping it here keeps the refusal out of the count.
 */
export function candidateTargets(params: {
  source: PortAt;
  nodes: readonly Connectable[];
  manifests: Readonly<Record<string, PortTable | undefined>>;
  accepts: Accepts;
}): PortAt[] {
  const { source, nodes, manifests, accepts } = params;
  const found: PortAt[] = [];
  for (const node of walkOrder(nodes)) {
    if (node.id === source.node) continue;
    for (const port of portsOf(node, manifests, 'inputs')) {
      const legal = accepts({
        source: source.node,
        sourceHandle: source.port,
        target: node.id,
        targetHandle: port,
      });
      if (legal) found.push({ node: node.id, port });
    }
  }
  return found;
}

export function samePort(a: PortAt | null, b: PortAt | null): boolean {
  return a !== null && b !== null && a.node === b.node && a.port === b.port;
}

/**
 * The next thing in a ring.
 *
 * Wraps, unlike `step` in `walk.ts`, and deliberately: walking the canvas is a movement across a
 * layout, where wrapping from the last step to the first reads as having lost the selection.
 * These are a list of choices with no geometry to them, and a ring is how every other menu-like
 * chooser behaves. Anything not in the list — a target that was legal a keystroke ago and is not
 * now — is treated as "nothing chosen yet", so the next press gets back into the ring.
 */
export function ring<T>(
  items: readonly T[],
  current: T | null,
  direction: 'next' | 'previous',
  same: (a: T, b: T) => boolean,
): T | undefined {
  if (items.length === 0) return undefined;
  const at = current === null ? -1 : items.findIndex((item) => same(item, current));
  if (at < 0) return direction === 'next' ? items[0] : items[items.length - 1];
  const step = direction === 'next' ? 1 : -1;
  return items[(at + step + items.length) % items.length];
}

/** The next candidate target the arrow keys should offer. */
export function stepTarget(
  candidates: readonly PortAt[],
  current: PortAt | null,
  direction: 'next' | 'previous',
): PortAt | undefined {
  return ring(candidates, current, direction, (a, b) => a.node === b.node && a.port === b.port);
}

/** The next output port to connect from, among a step's ports. */
export function stepPort(
  ports: readonly string[],
  current: string | null,
  direction: 'next' | 'previous',
): string | undefined {
  return ring(ports, current, direction, (a, b) => a === b);
}

/**
 * The output ports of a step that have somewhere legal to go, in declaration order.
 *
 * Connect mode only ever sits on one of these. A mode whose Enter does nothing is worse than no
 * mode, and cycling onto a port with no candidates would produce exactly that.
 */
export function usablePorts(params: {
  node: Connectable;
  nodes: readonly Connectable[];
  manifests: Readonly<Record<string, PortTable | undefined>>;
  accepts: Accepts;
}): string[] {
  const { node, nodes, manifests, accepts } = params;
  return portsOf(node, manifests, 'outputs').filter(
    (port) =>
      candidateTargets({ source: { node: node.id, port }, nodes, manifests, accepts }).length > 0,
  );
}

// --- What the nodes have to be told ---------------------------------------------------------

/**
 * What the keyboard is currently holding on the canvas, for the elements that have to show it.
 *
 * A context rather than a prop because React Flow renders the nodes and edges itself: a node
 * component is a descendant of `<ReactFlow>`, not a child of the canvas in any sense a prop can
 * cross. A context provider around `<ReactFlow>` reaches all of them without the canvas having
 * to push this into the editor store, where it would sit beside the document and be recorded,
 * saved and undone along with it — none of which is true of a highlight.
 */
export interface CanvasFocus {
  /** The output port a keyboard connection is being made from. */
  readonly from: PortAt | null;
  /** The input port the arrow keys are currently offering. */
  readonly to: PortAt | null;
  /** The connection the keyboard is holding, if it is holding one. */
  readonly edgeId: string | null;
}

export const NO_CANVAS_FOCUS: CanvasFocus = { from: null, to: null, edgeId: null };

export const CanvasFocusContext = createContext<CanvasFocus>(NO_CANVAS_FOCUS);

export function useCanvasFocus(): CanvasFocus {
  return useContext(CanvasFocusContext);
}
