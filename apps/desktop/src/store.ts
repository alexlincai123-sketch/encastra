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
import type { Demo } from './demos';
import { subscribe, type WorkflowStatus } from './events';
import {
  cut,
  emptyHistory,
  type History,
  paste,
  record,
  redo as redoHistory,
  type Snapshot,
  undo as undoHistory,
} from './history';
import { ipc } from './ipc';
import { usePreferences } from './preferences';
import type {
  About,
  ComponentManifest,
  EncastraGraph,
  GrantSpec,
  InputSpec,
  NodeStatus,
  OpenProject,
  Snapshot as ProjectSnapshot,
  RunJournal,
  Validation,
} from './types';

/** Where the person is in the application. */
export type View = 'home' | 'builder' | 'components' | 'security' | 'settings';

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

  view: View;

  /** Live state while something is running. Distinct from the journal, which is the record. */
  running: boolean;
  watching: boolean;
  runs: number;
  pending: number;
  liveNodes: Record<string, NodeStatus>;
  notifications: { at: number; text: string }[];
  about: About | null;

  history: History;
  clipboard: Snapshot | null;

  projectPath: string | null;
  projectName: string;
  versions: ProjectSnapshot[];
  /** True when the canvas differs from what was last written to disk. */
  dirty: boolean;

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
  newProject: () => void;
  openProject: () => Promise<void>;
  /** Opens a known path without asking, for reopening what was open last time. */
  reopenProject: (path: string) => Promise<void>;
  saveProject: (options?: { as?: boolean; label?: string }) => Promise<void>;
  restoreVersion: (snapshot: string) => Promise<void>;

  setView: (view: View) => void;
  attachRuntime: () => Promise<() => void>;
  startWorkflow: () => Promise<void>;
  stopWorkflow: () => Promise<void>;
  loadDemo: (demo: Demo) => void;
  dismissNotifications: () => void;

  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  duplicateSelection: () => void;
  selectAll: () => void;

  /** What a node is doing now, or what it did last. */
  nodeStatus: (id: string) => NodeStatus | undefined;
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
  projectPath: null,
  projectName: 'Untitled',
  versions: [],
  dirty: false,
  view: 'home',
  running: false,
  watching: false,
  runs: 0,
  pending: 0,
  liveNodes: {},
  notifications: [],
  about: null,
  history: emptyHistory,
  clipboard: null,

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
      return {
        nodes: [...s.nodes, node],
        selectedNodeId: node.id,
        validation: null,
        dirty: true,
        history: record(s.history, { nodes: s.nodes, edges: s.edges }),
      };
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
      dirty: true,
    }));
  },

  toggleDisabled(nodeId) {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, disabled: !n.data.disabled } } : n,
      ),
      validation: null,
      dirty: true,
    }));
  },

  deleteSelected() {
    const id = get().selectedNodeId;
    if (!id) return;
    set((s) => ({
      history: record(s.history, { nodes: s.nodes, edges: s.edges }),
      nodes: s.nodes.filter((n) => n.id !== id),
      // Edges that pointed at it go too, rather than dangling.
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: null,
      validation: null,
      dirty: true,
    }));
  },

  onNodesChange(changes) {
    set((s) => {
      // A drag reports a position on every frame. Recording each one would fill the history
      // with a single gesture, so a move is recorded when the pointer is released.
      const dragEnded = changes.some((c) => c.type === 'position' && c.dragging === false);
      const structural = changes.some((c) => c.type === 'remove');
      return {
        nodes: applyNodeChanges(changes, s.nodes),
        // Dragging a node changes the file even though it does not change what runs. The
        // history diff is where that distinction belongs, not the save prompt.
        dirty: s.dirty || changes.some((c) => c.type !== 'select'),
        history:
          dragEnded || structural
            ? record(s.history, { nodes: s.nodes, edges: s.edges })
            : s.history,
      };
    });
  },

  onEdgesChange(changes) {
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges),
      validation: null,
      dirty: s.dirty || changes.some((c) => c.type !== 'select'),
    }));
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
        dirty: true,
        history: record(s.history, { nodes: s.nodes, edges: s.edges }),
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

  newProject() {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      validation: null,
      journal: null,
      journalIsRecording: false,
      inputs: [],
      grants: [],
      projectPath: null,
      projectName: 'Untitled',
      versions: [],
      dirty: false,
      history: emptyHistory,
      liveNodes: {},
      message: null,
    });
  },

  async openProject() {
    set({ busy: true, message: null });
    try {
      const path = await ipc.pickProjectToOpen();
      if (!path) return;
      applyProject(set, await ipc.openProject(path));
      rememberProject(path);
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    } finally {
      set({ busy: false });
    }
  },

  /**
   * Reopens a path that was open last time, if the preference asks for it.
   *
   * Failure here is deliberately quiet: a project that has since been moved, renamed or deleted
   * is an ordinary thing to find at start-up, and greeting somebody with an error about a file
   * they did not ask for would be worse than simply showing them Home. The path is forgotten so
   * the same failure does not repeat every launch.
   */
  async reopenProject(path) {
    try {
      applyProject(set, await ipc.openProject(path));
    } catch {
      rememberProject('');
    }
  },

  async saveProject(options) {
    set({ busy: true, message: null });
    try {
      const state = get();
      const path =
        options?.as || !state.projectPath
          ? await ipc.pickProjectToSave(state.projectName)
          : state.projectPath;
      if (!path) return;

      const name = fileStem(path) ?? state.projectName;
      const project = await ipc.saveProject(path, name, state.toGraph(), options?.label);
      rememberProject(path);
      set({
        projectPath: project.path,
        projectName: project.name,
        versions: project.history.snapshots,
        dirty: false,
        message: {
          tone: 'info',
          text: `Saved. ${project.history.snapshots.length} version(s) kept.`,
        },
      });
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    } finally {
      set({ busy: false });
    }
  },

  setView(view) {
    set({ view });
  },

  async attachRuntime() {
    // Asked for first, and on its own. This used to sit after the subscription, which meant a
    // subscription that failed also cost the version — and the version reading "unknown" was
    // the only visible symptom of a much larger failure. Two independent things, asked for
    // independently.
    try {
      set({ about: await ipc.about() });
    } catch {
      // Not knowing the version is not a reason to fail to start.
    }

    // One subscription for the whole application. The teardown is returned so that a reload in
    // development does not leave a second set of listeners updating the same state.
    const off = await subscribe({
      runStarted: ({ order }) => {
        const pending: Record<string, NodeStatus> = {};
        for (const id of order) pending[id] = 'pending';
        set({ liveNodes: pending, journal: null, journalIsRecording: false });
      },
      nodeStarted: ({ node }) => {
        set((s) => ({ liveNodes: { ...s.liveNodes, [node]: 'running' } }));
      },
      nodeFinished: ({ node, record: nodeRecord }) => {
        if (!nodeRecord) return;
        set((s) => ({ liveNodes: { ...s.liveNodes, [node]: nodeRecord.status } }));
      },
      runFinished: (journal) => {
        set({ journal, journalIsRecording: false });
      },
      status: (status: WorkflowStatus) => {
        set((s) => ({
          running: status.running,
          watching: status.watching,
          runs: status.runs,
          pending: status.pending,
          message: status.message
            ? { tone: 'error', text: status.message }
            : status.running
              ? s.message
              : null,
        }));
      },
      notification: (text) => {
        set((s) => ({
          // Newest first, and capped: a workflow that notifies on every file would otherwise
          // grow this list until the application slowed down.
          notifications: [{ at: Date.now(), text }, ...s.notifications].slice(0, 20),
        }));
      },
    });

    return off;
  },

  async startWorkflow() {
    set({ busy: true, message: null, journal: null, liveNodes: {} });
    try {
      const state = get();
      const status = await ipc.startWorkflow(state.toGraph(), state.inputs, state.grants);
      set({
        running: status.running,
        watching: status.watching,
        view: 'builder',
        message: {
          tone: 'info',
          text: status.watching ? 'Watching. It will run whenever something appears.' : 'Running.',
        },
      });
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) }, running: false });
    } finally {
      set({ busy: false });
    }
  },

  async stopWorkflow() {
    try {
      await ipc.stopWorkflow();
      set({ message: { tone: 'info', text: 'Stopping.' } });
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    }
  },

  loadDemo(demo) {
    const nodes: EditorNode[] = Object.entries(demo.graph.nodes).map(([id, node]) => ({
      id,
      type: 'component',
      position: node.position,
      data: {
        componentRef: node.component,
        config: { ...node.config },
        disabled: node.disabled ?? false,
      },
    }));
    const edges: Edge[] = demo.graph.edges.map((edge) => ({
      id: `${edge.from.node}.${edge.from.port}->${edge.to.node}.${edge.to.port}`,
      source: edge.from.node,
      sourceHandle: edge.from.port,
      target: edge.to.node,
      targetHandle: edge.to.port,
      type: 'wire',
    }));

    set({
      nodes,
      edges,
      selectedNodeId: null,
      validation: null,
      journal: null,
      liveNodes: {},
      inputs: [],
      grants: [],
      // A sample is not the person's project until they save it somewhere, so it starts
      // unattached — saving will ask where to put it rather than overwriting anything.
      projectPath: null,
      projectName: demo.name,
      versions: [],
      dirty: true,
      history: emptyHistory,
      view: 'builder',
      message: {
        tone: 'info',
        text: `${demo.name}: fill in ${demo.needs.join(', ').toLowerCase()}, then start it.`,
      },
    });
  },

  dismissNotifications() {
    set({ notifications: [] });
  },

  undo() {
    const s = get();
    const step = undoHistory(s.history, { nodes: s.nodes, edges: s.edges });
    if (!step) return;
    set({
      history: step.history,
      nodes: step.snapshot.nodes,
      edges: step.snapshot.edges,
      validation: null,
      dirty: true,
    });
  },

  redo() {
    const s = get();
    const step = redoHistory(s.history, { nodes: s.nodes, edges: s.edges });
    if (!step) return;
    set({
      history: step.history,
      nodes: step.snapshot.nodes,
      edges: step.snapshot.edges,
      validation: null,
      dirty: true,
    });
  },

  copySelection() {
    const s = get();
    const selected = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id));
    if (s.selectedNodeId) selected.add(s.selectedNodeId);
    if (selected.size === 0) return;
    set({ clipboard: cut(s.nodes, s.edges, selected) });
  },

  pasteClipboard() {
    const s = get();
    if (!s.clipboard || s.clipboard.nodes.length === 0) return;
    const pasted = paste(s.clipboard, new Set(s.nodes.map((n) => n.id)));
    set({
      history: record(s.history, { nodes: s.nodes, edges: s.edges }),
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...pasted.nodes],
      edges: [...s.edges, ...pasted.edges],
      selectedNodeId: pasted.ids[0] ?? null,
      validation: null,
      dirty: true,
    });
  },

  duplicateSelection() {
    get().copySelection();
    get().pasteClipboard();
  },

  selectAll() {
    set((s) => ({ nodes: s.nodes.map((n) => ({ ...n, selected: true })) }));
  },

  nodeStatus(id) {
    const s = get();
    return s.liveNodes[id] ?? s.journal?.nodes[id]?.status;
  },

  async restoreVersion(snapshot) {
    const path = get().projectPath;
    if (!path) return;
    set({ busy: true, message: null });
    try {
      applyProject(set, await ipc.restoreVersion(path, snapshot));
      set({
        message: {
          tone: 'info',
          text: 'Restored. The version you came from is still in the history.',
        },
      });
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    } finally {
      set({ busy: false });
    }
  },
}));

/** Replaces the canvas with what a project file contains. */
/**
 * Records which project was last open, for the "reopen last project" preference.
 *
 * Kept in the preference store rather than in this one: it outlives a session, and the editor
 * state is rebuilt from scratch every launch.
 */
function rememberProject(path: string): void {
  usePreferences.getState().set('lastProjectPath', path);
}

function applyProject(set: (partial: Partial<EditorState>) => void, project: OpenProject): void {
  const nodes: EditorNode[] = Object.entries(project.graph.nodes).map(([id, node]) => ({
    id,
    type: 'component',
    position: node.position,
    data: {
      componentRef: node.component,
      config: node.config,
      disabled: node.disabled ?? false,
      ...(node.label ? { label: node.label } : {}),
    },
  }));

  const edges: Edge[] = project.graph.edges.map((edge) => ({
    id: `${edge.from.node}.${edge.from.port}->${edge.to.node}.${edge.to.port}`,
    source: edge.from.node,
    sourceHandle: edge.from.port,
    target: edge.to.node,
    targetHandle: edge.to.port,
    type: 'wire',
  }));

  set({
    nodes,
    edges,
    selectedNodeId: null,
    validation: null,
    journal: null,
    journalIsRecording: false,
    inputs: [],
    grants: [],
    projectPath: project.path,
    projectName: project.name,
    versions: project.history.snapshots,
    dirty: false,
    // Undoing into the graph of a different project would look exactly like corruption.
    history: emptyHistory,
    liveNodes: {},
    // A project pinning components this build does not have cannot run as saved. Saying so on
    // open beats letting somebody press Run and read a confusing refusal.
    message: project.missing.length
      ? {
          tone: 'error',
          text: `This project needs ${project.missing.join(', ')}, which is not installed.`,
        }
      : null,
  });
}

function fileStem(path: string): string | undefined {
  const name = path.split(/[\\/]/).pop();
  return name?.replace(/\.encastra$/i, '');
}

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
// The `window` check is not defensive padding. Vitest runs in mode "test", so `DEV` is true
// there too, and the node environment has no `window` — which meant importing this module from
// any test threw `ReferenceError: window is not defined` before the store was even read. A test
// that cannot import the store is a store that cannot be tested.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __encastra?: unknown }).__encastra = useEditor;
}
