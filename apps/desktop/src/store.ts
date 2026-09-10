/**
 * Editor state.
 *
 * The canvas holds React Flow's own node and edge shapes because that is what the library
 * needs to render; the runtime's `Graph` is derived from them on demand by {@link toGraph}.
 * Deriving in one direction only means there is no second copy of the graph to keep in step.
 */

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { create } from 'zustand';
import { ipc } from './ipc';
import type {
  ComponentManifest,
  EncastraGraph,
  GrantSpec,
  InputSpec,
  RunJournal,
  Validation,
} from './types';

export interface NodeData extends Record<string, unknown> {
  componentRef: string;
  config: Record<string, unknown>;
  label?: string;
  disabled: boolean;
}

export type EditorNode = Node<NodeData>;

interface EditorState {
  manifests: Record<string, ComponentManifest>;
  nodes: EditorNode[];
  edges: Edge[];
  selectedNodeId: string | null;

  validation: Validation | null;
  journal: RunJournal | null;
  /** True when the journal on screen is a recording rather than a run that just happened. */
  journalIsRecording: boolean;

  inputs: InputSpec[];
  grants: GrantSpec[];

  busy: boolean;
  message: { tone: 'info' | 'error'; text: string } | null;

  loadComponents: () => Promise<void>;
  addNode: (componentRef: string, position: { x: number; y: number }) => void;
  select: (id: string | null) => void;
  setConfig: (nodeId: string, key: string, value: unknown) => void;
  toggleDisabled: (nodeId: string) => void;
  deleteSelected: () => void;
  onNodesChange: (changes: NodeChange<EditorNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  connect: (connection: Connection) => void;
  setInput: (node: string, port: string, path: string) => void;
  setGrant: (grant: GrantSpec) => void;
  showRecording: (journal: RunJournal, label: string) => void;
  check: () => Promise<void>;
  run: () => Promise<void>;
  manifestFor: (nodeId: string) => ComponentManifest | undefined;
  portType: (nodeId: string, port: string, side: 'inputs' | 'outputs') => string | undefined;
  toGraph: () => EncastraGraph;
}

let nextId = 1;
function makeId(componentRef: string): string {
  const base = componentRef.split('@')[0]?.split('.').pop() ?? 'node';
  return `${base}-${nextId++}`;
}

export const useEditor = create<EditorState>((set, get) => ({
  manifests: {},
  nodes: [],
  edges: [],
  selectedNodeId: null,
  validation: null,
  journal: null,
  journalIsRecording: false,
  inputs: [],
  grants: [],
  busy: false,
  message: null,

  async loadComponents() {
    try {
      const list = await ipc.listComponents();
      const byRef: Record<string, ComponentManifest> = {};
      for (const manifest of list) {
        byRef[`${manifest.id}@${manifest.version}`] = manifest;
      }
      set({ manifests: byRef });
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    }
  },

  addNode(componentRef, position) {
    const manifest = get().manifests[componentRef];
    if (!manifest) return;

    const config: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(manifest.config)) {
      if (field.default !== undefined) config[key] = field.default;
    }

    set((s) => {
      // A node dropped on top of another is invisible, and clicking the palette four times
      // used to produce one visible node and three hidden underneath it. Placing each new
      // node to the right of the last also matches how these graphs are read: left to right.
      const clear = s.nodes.every(
        (n) => Math.abs(n.position.x - position.x) > 40 || Math.abs(n.position.y - position.y) > 40,
      );
      const rightmost = s.nodes.reduce<{ x: number; y: number } | null>(
        (best, n) => (best === null || n.position.x > best.x ? n.position : best),
        null,
      );
      const at = clear || rightmost === null ? position : { x: rightmost.x + 260, y: rightmost.y };

      const node: EditorNode = {
        id: makeId(componentRef),
        type: 'component',
        position: at,
        data: { componentRef, config, disabled: false },
      };
      // A newly placed node is the one you want to configure, so it is selected immediately.
      return { nodes: [...s.nodes, node], selectedNodeId: node.id, validation: null };
    });
  },

  select(id) {
    set({ selectedNodeId: id });
  },

  setConfig(nodeId, key, value) {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
          : n,
      ),
      validation: null,
    }));
  },

  toggleDisabled(nodeId) {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, disabled: !n.data.disabled } } : n,
      ),
      validation: null,
    }));
  },

  deleteSelected() {
    const id = get().selectedNodeId;
    if (!id) return;
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      // Edges that pointed at it go too, rather than dangling.
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: null,
      validation: null,
    }));
  },

  onNodesChange(changes) {
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }));
  },

  onEdgesChange(changes) {
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges), validation: null }));
  },

  connect(connection) {
    set((s) => {
      // One value per input. Replacing rather than adding matches what validation enforces,
      // so the editor never lets you build the thing it would then refuse.
      const withoutExisting = s.edges.filter(
        (e) => !(e.target === connection.target && e.targetHandle === connection.targetHandle),
      );
      return {
        edges: addEdge({ ...connection, type: 'wire' }, withoutExisting),
        validation: null,
      };
    });
  },

  setInput(node, port, path) {
    set((s) => ({
      inputs: [
        ...s.inputs.filter((i) => !(i.node === node && i.port === port)),
        { node, port, path },
      ],
      validation: null,
    }));
  },

  setGrant(grant) {
    set((s) => ({
      grants: [...s.grants.filter((g) => !(g.node === grant.node && g.kind === grant.kind)), grant],
    }));
  },

  showRecording(journal, label) {
    set({
      journal,
      journalIsRecording: true,
      message: { tone: 'info', text: `${label}. This is a recording, not a run on this machine.` },
    });
  },

  async check() {
    set({ busy: true, message: null });
    try {
      const validation = await ipc.validateGraph(get().toGraph(), get().inputs);
      const errors = validation.issues.filter((i) => i.severity === 'error').length;
      set({
        validation,
        message: errors
          ? { tone: 'error', text: `${errors} problem${errors === 1 ? '' : 's'} to fix.` }
          : { tone: 'info', text: 'This graph is ready to run.' },
      });
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    } finally {
      set({ busy: false });
    }
  },

  async run() {
    set({ busy: true, message: null, journal: null, journalIsRecording: false });
    try {
      const result = await ipc.runGraph(get().toGraph(), get().inputs, get().grants);
      if (result.outcome === 'invalid') {
        const errors = result.validation.issues.filter((i) => i.severity === 'error').length;
        set({
          validation: result.validation,
          message: {
            tone: 'error',
            text: `Nothing ran: ${errors} problem${errors === 1 ? '' : 's'} to fix first.`,
          },
        });
        return;
      }
      const { journal } = result;
      set({
        journal,
        validation: null,
        message: {
          tone: journal.status === 'ok' ? 'info' : 'error',
          text: summarise(journal),
        },
      });
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    } finally {
      set({ busy: false });
    }
  },

  manifestFor(nodeId) {
    const node = get().nodes.find((n) => n.id === nodeId);
    return node ? get().manifests[node.data.componentRef] : undefined;
  },

  portType(nodeId, port, side) {
    return get().manifestFor(nodeId)?.ports[side][port]?.type;
  },

  toGraph() {
    const { nodes, edges } = get();
    const graph: EncastraGraph = { nodes: {}, edges: [] };

    for (const node of nodes) {
      graph.nodes[node.id] = {
        component: node.data.componentRef,
        config: node.data.config,
        position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
        disabled: node.data.disabled,
        ...(node.data.label ? { label: node.data.label } : {}),
      };
    }

    for (const edge of edges) {
      // An edge without handles cannot name its ports, so it is not a connection the runtime
      // could act on. Dropping it here would hide the problem; it cannot be created in the
      // first place, because every handle in this editor is named.
      if (!edge.sourceHandle || !edge.targetHandle) continue;
      graph.edges.push({
        from: { node: edge.source, port: edge.sourceHandle },
        to: { node: edge.target, port: edge.targetHandle },
      });
    }

    return graph;
  },
}));

function summarise(journal: RunJournal): string {
  const failed = Object.values(journal.nodes).filter((n) => n.status === 'failed').length;
  const ms = journal.finished_at_ms ? journal.finished_at_ms - journal.started_at_ms : 0;
  switch (journal.status) {
    case 'ok':
      return `Finished in ${ms}ms.`;
    case 'partial':
      return `${failed} step${failed === 1 ? '' : 's'} failed. The rest of the graph still ran.`;
    case 'failed':
      return 'Nothing completed.';
    case 'cancelled':
      return 'Stopped.';
    default:
      return 'Running…';
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something in the runtime did not answer.';
}

/**
 * Development only: the store, reachable from the console and from browser-driven tests.
 *
 * Guarded by `import.meta.env.DEV`, so it is stripped from the shipped bundle. Exposing state
 * to page scripts in a packaged application would be a way for anything running in the webview
 * to drive the editor.
 */
if (import.meta.env.DEV) {
  (window as unknown as { __encastra?: unknown }).__encastra = useEditor;
}
