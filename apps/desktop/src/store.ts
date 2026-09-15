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
import { describeAppError, describeStatusMessage, importErrorIn } from './errors';
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
// A plain function rather than the `useTranslation()` hook: every action here is a store method,
// not a render, and `translate()` reads the active locale itself at call time the same way
// `canvas/Canvas.tsx` does inside `isConnectionLegal` — see `i18n/index.ts`'s own note on why.
import { selectPlural, translate, useI18n } from './i18n';
import {
  IMPORT_IDLE,
  type ImportState,
  importBlocksWindowClose,
  inspectedNow,
  transition,
} from './import-machine';
import { ipc } from './ipc';
import { decideRemoval } from './library';
import { usePreferences } from './preferences';
import type {
  About,
  ComponentManifest,
  EncastraGraph,
  EntryWithStatus,
  GrantSpec,
  ImportError,
  InputSpec,
  NodeStatus,
  OpenProject,
  Snapshot as ProjectSnapshot,
  RunJournal,
  Validation,
} from './types';

/** Where the person is in the application. */
export type View = 'home' | 'builder' | 'library' | 'components' | 'security' | 'settings';

/**
 * Why the canvas is about to be replaced — which is to say, which sentence the prompt shows.
 *
 * A reason rather than a ready-made sentence, because the sentence is a translation and the
 * store does not hold translated text: "opening another project" and "closing Encastra" decline
 * differently in most of the six languages, so each reason owns a whole sentence of its own in
 * the message tree rather than being interpolated into a shared one.
 */
export type DiscardReason = 'new' | 'open' | 'demo' | 'restore' | 'close' | 'library-open';

/** Something that would replace the canvas, held back until the work on it has been decided. */
export interface PendingDiscard {
  readonly reason: DiscardReason;
  /** What was about to happen, run unchanged once the work is saved or deliberately dropped. */
  readonly proceed: () => void;
}

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

  /** What this person has: what they made, what they took in, what they prepared. */
  library: EntryWithStatus[];
  /**
   * The name an unreadable index was moved to, if there was one. The runtime reports it once;
   * this holds it until somebody has read it and dismissed it.
   */
  libraryQuarantined: string | null;
  /** False until the list has been asked for once, so an empty library and an unread one differ. */
  libraryLoaded: boolean;
  /**
   * Where taking a publication in has got to: idle, busy, or settled one of three ways.
   *
   * One value rather than the three flags this used to be (`importOpen`, `importInspected`,
   * `importError`) plus the global `busy`. Whether the dialog is on screen, whether it may be
   * closed, and what is in it are all read off this through the selectors in `import-machine.ts`,
   * so there is nothing to keep in step and no combination of flags that means nothing.
   */
  importState: ImportState;

  /**
   * The question about unsaved work currently on screen, and what is waiting behind it.
   *
   * One field for every way of losing a canvas, rather than a flag per entry point: there is
   * one prompt, it can only be showing one question, and whatever it was asked about is held
   * here unchanged until somebody answers.
   */
  pendingDiscard: PendingDiscard | null;

  loadComponents: () => Promise<void>;
  addNode: (componentRef: string, position: { x: number; y: number }) => void;
  select: (id: string | null) => void;
  setConfig: (nodeId: string, key: string, value: unknown) => void;
  toggleDisabled: (nodeId: string) => void;
  deleteSelected: () => void;
  /** Removes one step by id, whichever step is selected — what a right-click acts on. */
  deleteStep: (nodeId: string) => void;
  /**
   * The same two actions over several steps at once, as one entry in the history.
   *
   * A right-click inside a selection acts on the whole selection, and doing that by calling the
   * singular action once per step would leave a selection of six needing six presses of undo to
   * put back — which is not what anybody means by "undo that".
   */
  deleteSteps: (nodeIds: readonly string[]) => void;
  toggleDisabledMany: (nodeIds: readonly string[]) => void;
  /** Removes one connection by id, leaving both steps where they are. */
  deleteConnection: (edgeId: string) => void;
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

  /** Puts the question on screen and holds `proceed` until it is answered. */
  requestDiscard: (reason: DiscardReason, proceed: () => void) => void;
  /** The work may go: run what was waiting. */
  confirmDiscard: () => void;
  /** Nothing happens, and the canvas is exactly as it was. */
  cancelDiscard: () => void;
  /** Saves first, and continues only if the save actually wrote something. */
  saveThenProceed: () => Promise<void>;

  setView: (view: View) => void;
  /** Whether the publication panel is open. One flag, because there is one of it. */
  publishOpen: boolean;
  setPublishOpen: (open: boolean) => void;

  /** Puts away the note about an index that could not be read. It is news once. */
  dismissLibraryNote: () => void;
  loadLibrary: () => Promise<void>;
  /** Opens something already in the library, without asking where it is. */
  openFromLibrary: (row: EntryWithStatus) => Promise<void>;
  removeFromLibrary: (row: EntryWithStatus, deleteCopy: boolean) => Promise<void>;
  /**
   * Puts the import dialog away, if it may be put away.
   *
   * Answers `false` while an import is being written — Close, Escape and anything else that
   * would dismiss it are refused there, because the bytes are going into the library whether
   * the panel is on screen or not and a dialog that vanished mid-copy would be lying.
   */
  closeImport: () => boolean;
  /**
   * Asks for a folder and reads it. Nothing is imported: that is `confirmImport`.
   *
   * Answers `false` when it did not start — a second press while one is already running, a
   * chooser somebody backed out of, or a folder that was refused.
   */
  beginImport: () => Promise<boolean>;
  confirmImport: () => Promise<boolean>;
  /**
   * Whether the window may not be closed yet, saying so on screen when it may not.
   *
   * The runtime refuses such a close itself; this is the same answer on this side so that the X
   * produces a sentence rather than appearing to do nothing.
   */
  importBlocksClose: () => boolean;
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
  // Empty rather than the translated word, and deliberately.
  //
  // This is module scope: it is evaluated when the store is first imported, which happens before
  // a locale has been chosen and before its messages have loaded. A `translate()` call here
  // resolves to English once and then never changes again, so a project that was never saved
  // kept an English name in every other language. The empty string means "not named yet", and
  // the two places that display a project's name resolve the word at render, where the active
  // locale is known and a change to it re-renders.
  projectName: '',
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
  library: [],
  libraryQuarantined: null,
  libraryLoaded: false,
  importState: IMPORT_IDLE,
  pendingDiscard: null,

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

  /**
   * Both of these take an id rather than acting on the selection. A menu opened on one thing
   * has to act on that thing, whatever the selection does in between — and a connection has no
   * place in the selection at all, so `deleteSelected` could never have removed one.
   */
  deleteStep(nodeId) {
    set((s) => {
      if (!s.nodes.some((n) => n.id === nodeId)) return {};
      return {
        history: record(s.history, { nodes: s.nodes, edges: s.edges }),
        nodes: s.nodes.filter((n) => n.id !== nodeId),
        // Connections that pointed at it go too, rather than dangling.
        edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
        validation: null,
        dirty: true,
      };
    });
  },

  deleteSteps(nodeIds) {
    const doomed = new Set(nodeIds);
    set((s) => {
      if (!s.nodes.some((n) => doomed.has(n.id))) return {};
      return {
        history: record(s.history, { nodes: s.nodes, edges: s.edges }),
        nodes: s.nodes.filter((n) => !doomed.has(n.id)),
        // Connections that pointed at any of them go too, rather than dangling.
        edges: s.edges.filter((e) => !doomed.has(e.source) && !doomed.has(e.target)),
        selectedNodeId:
          s.selectedNodeId !== null && doomed.has(s.selectedNodeId) ? null : s.selectedNodeId,
        validation: null,
        dirty: true,
      };
    });
  },

  toggleDisabledMany(nodeIds) {
    const chosen = new Set(nodeIds);
    set((s) => {
      const affected = s.nodes.filter((n) => chosen.has(n.id));
      if (affected.length === 0) return {};
      // One verb for the whole selection. A switch that turned some on and others off would
      // leave nobody able to say what the menu item is about to do: everything goes off unless
      // everything is already off, in which case everything comes back on. The label the menu
      // shows is chosen from the same rule, so the word and the effect cannot disagree.
      const disabled = !affected.every((n) => n.data.disabled === true);
      return {
        nodes: s.nodes.map((n) => (chosen.has(n.id) ? { ...n, data: { ...n.data, disabled } } : n)),
        validation: null,
        dirty: true,
      };
    });
  },

  deleteConnection(edgeId) {
    set((s) => {
      if (!s.edges.some((e) => e.id === edgeId)) return {};
      return {
        history: record(s.history, { nodes: s.nodes, edges: s.edges }),
        edges: s.edges.filter((e) => e.id !== edgeId),
        validation: null,
        dirty: true,
      };
    });
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
        //
        // A `dimensions` change is React Flow measuring a node it has just rendered — it arrives
        // for every node the moment a project opens, and again whenever a culled node scrolls
        // back into view. Nothing about the file changed. Counting it made every opened project
        // read as unsaved before anybody touched it, which disabled Publish and made the
        // unsaved-work prompt cry wolf on the window's close button.
        dirty: s.dirty || changes.some((c) => isEdit(c.type)),
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
      dirty: s.dirty || changes.some((c) => isEdit(c.type)),
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
      message: { tone: 'info', text: `${label}. ${translate('messages.recordingNote')}` },
    });
  },

  async check() {
    set({ busy: true, message: null });
    try {
      const validation = await ipc.validateGraph(get().toGraph(), get().inputs);
      const errors = validation.issues.filter((i) => i.severity === 'error').length;
      const locale = useI18n.getState().locale;
      set({
        validation,
        message: errors
          ? {
              tone: 'error',
              text: translate(`messages.problemsToFix.${selectPlural(locale, errors)}`, {
                count: errors,
              }),
            }
          : { tone: 'info', text: translate('messages.readyToRun') },
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
        const locale = useI18n.getState().locale;
        set({
          validation: result.validation,
          message: {
            tone: 'error',
            text: translate(`messages.nothingRanProblems.${selectPlural(locale, errors)}`, {
              count: errors,
            }),
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

  /**
   * Five ways to replace the canvas, one question in front of all five.
   *
   * The check lives here rather than in the callers because there are more ways to reach these
   * than there are of them — a toolbar button, a keyboard shortcut, a row in the library, a
   * sample on the Home screen, a version in the inspector — and a guard on a button is a guard
   * somebody can walk around. The work itself moved into the private `do…` functions below, so
   * asking and doing are separated exactly once: what runs after "Discard" is the same code
   * that would have run immediately, not a second copy of it that could drift.
   *
   * `reopenProject` deliberately has no guard. It runs once at start-up, against a canvas
   * nobody has touched yet, and a prompt there would be a question about nothing.
   */
  newProject() {
    if (get().dirty) {
      get().requestDiscard('new', () => doNewProject(set));
      return;
    }
    doNewProject(set);
  },

  async openProject() {
    if (get().dirty) {
      get().requestDiscard('open', () => {
        void doOpenProject(set, get);
      });
      return;
    }
    await doOpenProject(set, get);
  },

  requestDiscard(reason, proceed) {
    set({ pendingDiscard: { reason, proceed } });
  },

  confirmDiscard() {
    const pending = get().pendingDiscard;
    if (!pending) return;
    // Cleared before the work runs rather than after: `proceed` may open a project, that may
    // fail, and it says so in the status bar — with a prompt still on screen underneath it,
    // asking about a canvas that has already gone.
    set({ pendingDiscard: null });
    pending.proceed();
  },

  cancelDiscard() {
    set({ pendingDiscard: null });
  },

  /**
   * Saves, and goes on only if the save actually wrote something.
   *
   * A save ends in one of three ways and only one of them may continue: it wrote the file, or
   * somebody backed out of the file chooser, or it failed and said why. `saveProject` reports
   * none of that in its return — it resolves either way — so `dirty` is what tells them apart.
   * The two that did not write leave the work exactly where it was, which means the question is
   * still worth asking: the prompt stays where it is, with the reason underneath it.
   */
  async saveThenProceed() {
    const pending = get().pendingDiscard;
    if (!pending) return;
    await get().saveProject();
    if (get().dirty) return;
    set({ pendingDiscard: null });
    pending.proceed();
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
      const kept = project.history.snapshots.length;
      const locale = useI18n.getState().locale;
      set({
        projectPath: project.path,
        projectName: project.name,
        versions: project.history.snapshots,
        dirty: false,
        message: {
          tone: 'info',
          text: translate(`messages.saved.${selectPlural(locale, kept)}`, { count: kept }),
        },
      });
      await get().loadLibrary();
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    } finally {
      set({ busy: false });
    }
  },

  publishOpen: false,

  setPublishOpen(open) {
    set({ publishOpen: open });
  },

  dismissLibraryNote() {
    set({ libraryQuarantined: null });
  },

  /**
   * Reads the whole list, every time.
   *
   * Each row carries whether the file it names is still there, which is a question about the
   * filesystem and cannot be cached: somebody moving a project in Explorer does not tell this
   * application about it. The list is short by construction, and a stale "Present" on something
   * that has gone would be worse than asking again.
   */
  async loadLibrary() {
    try {
      const listing = await ipc.libraryList();
      set((s) => ({
        library: listing.entries,
        libraryLoaded: true,
        // The runtime reports a quarantined index once. Keeping what is already here means a
        // second listing does not silently clear a note nobody has read yet.
        libraryQuarantined: listing.quarantined ?? s.libraryQuarantined,
      }));
    } catch (error) {
      set({ libraryLoaded: true, message: { tone: 'error', text: describe(error) } });
    }
  },

  async openFromLibrary(row) {
    // Nothing destructive is offered here: the file is somewhere else or gone, and this
    // software has no business guessing where, nor tidying away somebody's record of it.
    //
    // Checked before the unsaved-work question, too — nothing is going to replace the canvas,
    // so asking whether it may be replaced would be asking about something that cannot happen.
    if (row.status === 'missing') {
      set({
        message: {
          tone: 'error',
          text: translate('messages.libraryMissing', { name: row.entry.name }),
        },
      });
      return;
    }

    if (get().dirty) {
      get().requestDiscard('library-open', () => {
        void doOpenFromLibrary(set, get, row);
      });
      return;
    }
    await doOpenFromLibrary(set, get, row);
  },

  async removeFromLibrary(row, deleteCopy) {
    const decision = decideRemoval(row.entry, deleteCopy);
    if (!decision.allowed) {
      set({ message: { tone: 'error', text: translate('library.remove.refused') } });
      return;
    }

    set({ busy: true, message: null });
    try {
      await ipc.libraryRemove(decision.id, decision.deleteCopy);
      await get().loadLibrary();
      set({
        message: {
          tone: 'info',
          text: translate(
            decision.deleteCopy ? 'messages.removedAndDeleted' : 'messages.removedFromLibrary',
            { name: row.entry.name },
          ),
        },
      });
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    } finally {
      set({ busy: false });
    }
  },

  closeImport() {
    // Closing throws away what was read, so reopening reads the folder again rather than showing
    // an answer about a folder somebody may have changed in between. The machine refuses this
    // outright while an import is in flight, and says so by handing back the state it was given.
    const before = get().importState;
    const next = transition(before, { type: 'acknowledge' });
    if (next === before) return false;
    set({ importState: next });
    return true;
  },

  /**
   * Asks for a folder and reads it. Nothing is taken in here, ever.
   *
   * Inspecting writes nothing, opens nothing and runs nothing; what it produces is something to
   * read. Importing is a second thing somebody presses, having read it.
   *
   * Busy from the moment the chooser opens rather than from the moment it returns: a second press
   * of Import while the first chooser is up used to open a second chooser. That refusal is now
   * the machine's — this only reports it.
   */
  async beginImport() {
    const before = get().importState;
    const started = transition(before, { type: 'begin' });
    if (started === before) {
      // Observable rather than silent: a press that does nothing is a bug report somebody
      // cannot write, and the button that produced it is disabled for exactly this reason.
      console.warn('[import] a second import was asked for while one was already running');
      return false;
    }
    setImportState(set, started);

    try {
      // Chosen to import *from*, and recorded as nothing else: the runtime will not let this
      // folder answer "may a component write here" or "may a publication be written into this"
      // later in the session on the strength of somebody having picked it here.
      const folder = await ipc.pickFolder('import-from');
      if (!folder) {
        // The chooser was closed with nothing. Not a refusal and not a failure: nobody said no
        // to this folder, because there was no folder.
        settleImport(set, get, { type: 'dismissed' });
        return false;
      }
      setImportState(set, transition(get().importState, { type: 'chose' }));
      const inspected = await ipc.inspectPublication(folder);
      settleImport(set, get, { type: 'inspected', folder, inspected });
      return true;
    } catch (error) {
      settleImport(set, get, { type: 'failed', error: asImportFailure(error) });
      return false;
    }
  },

  async confirmImport() {
    const pending = inspectedNow(get().importState);
    const started = transition(get().importState, { type: 'confirm' });
    if (!pending || started === get().importState) return false;

    setImportState(set, started, { message: null });
    try {
      const entry = await ipc.importPublication(pending.folder);
      setImportState(set, transition(get().importState, { type: 'imported', entry }));
      await get().loadLibrary();
      // Acknowledged here rather than by a button: what replaces the dialog is the library with
      // the thing in it, which is the confirmation. The machine is left idle, ready for the next.
      settleImport(
        set,
        get,
        { type: 'acknowledge' },
        {
          view: 'library',
          message: {
            tone: 'info',
            text: translate('messages.imported', { name: entry.name }),
          },
        },
      );
      return true;
    } catch (error) {
      settleImport(set, get, { type: 'failed', error: asImportFailure(error) });
      return false;
    }
  },

  importBlocksClose() {
    if (!importBlocksWindowClose(get().importState)) return false;
    set({ message: { tone: 'info', text: translate('messages.importInFlight') } });
    return true;
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
          // A tag, not a sentence: the runtime says what happened and this says it in whatever
          // language the person reads. It used to be printed verbatim, which made the one line
          // somebody watches while a workflow runs the one line that was always in English.
          message: status.message
            ? { tone: 'error', text: describeStatusMessage(status.message) }
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
          text: translate(status.watching ? 'messages.watchingChanges' : 'messages.running'),
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
      set({ message: { tone: 'info', text: translate('messages.stopping') } });
    } catch (error) {
      set({ message: { tone: 'error', text: describe(error) } });
    }
  },

  loadDemo(demo) {
    if (get().dirty) {
      get().requestDiscard('demo', () => doLoadDemo(set, demo));
      return;
    }
    doLoadDemo(set, demo);
  },

  dismissNotifications() {
    set({ notifications: [] });
  },

  async restoreVersion(snapshot) {
    if (!get().projectPath) return;
    if (get().dirty) {
      get().requestDiscard('restore', () => {
        void doRestoreVersion(set, get, snapshot);
      });
      return;
    }
    await doRestoreVersion(set, get, snapshot);
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
}));

/**
 * The two halves of the store, as the private functions below need them.
 *
 * The same narrow shape `applyProject` has always taken: each of these replaces the canvas
 * outright, so none of them has any business reading a draft of the state it is about to
 * overwrite.
 */
type SetEditor = (partial: Partial<EditorState>) => void;
type GetEditor = () => EditorState;

/**
 * What each entry point actually does, with no question attached.
 *
 * Private, and deliberately: the exported store methods are the only way in, so the prompt
 * cannot be skipped by calling the work directly from a panel. Keeping the bodies here rather
 * than inline in the guarded method keeps `confirmDiscard` honest — the thing it runs later is
 * the very same function that would have run immediately.
 */
/**
 * Whether a React Flow change is something a person did to the file.
 *
 * `select` is where the focus is; `dimensions` is the library measuring what it drew. Neither is
 * in the saved graph, so neither makes the project unsaved. Exported for the store's tests.
 */
export function isEdit(type: string): boolean {
  return type !== 'select' && type !== 'dimensions';
}

function doNewProject(set: SetEditor): void {
  set({
    // Whoever asked for a new project wants to be where it is made; Home used to switch the
    // view before the unsaved-work question was answered, which landed a person who cancelled
    // in the Builder they had not chosen to go to.
    view: 'builder',
    nodes: [],
    edges: [],
    selectedNodeId: null,
    validation: null,
    journal: null,
    journalIsRecording: false,
    inputs: [],
    grants: [],
    projectPath: null,
    projectName: '',
    versions: [],
    dirty: false,
    history: emptyHistory,
    liveNodes: {},
    message: null,
  });
}

async function doOpenProject(set: SetEditor, get: GetEditor): Promise<void> {
  set({ busy: true, message: null });
  try {
    const path = await ipc.pickProjectToOpen();
    if (!path) return;
    applyProject(set, await ipc.openProject(path));
    rememberProject(path);
    // Opening from Home used to leave the person on Home, with the project loaded somewhere
    // behind it. Opening from the library already went to the Builder; the two ways of opening
    // the same thing should end in the same place.
    set({ view: 'builder' });
    // The runtime has just recorded this in the library. Re-listing is how this side finds
    // out, rather than editing its own copy and hoping the two agree.
    await get().loadLibrary();
  } catch (error) {
    set({ message: { tone: 'error', text: describe(error) } });
  } finally {
    set({ busy: false });
  }
}

async function doOpenFromLibrary(
  set: SetEditor,
  get: GetEditor,
  row: EntryWithStatus,
): Promise<void> {
  set({ busy: true, message: null });
  try {
    applyProject(set, await ipc.openProject(row.entry.path));
    rememberProject(row.entry.path);
    set({ view: 'builder' });
    // Opening is what makes this the most recent thing, and the runtime is where that is
    // recorded. Re-listing is how this side finds out, rather than editing its own copy and
    // hoping the two agree.
    await get().loadLibrary();
  } catch (error) {
    set({ message: { tone: 'error', text: describe(error) } });
  } finally {
    set({ busy: false });
  }
}

async function doRestoreVersion(set: SetEditor, get: GetEditor, snapshot: string): Promise<void> {
  const path = get().projectPath;
  if (!path) return;
  set({ busy: true, message: null });
  try {
    applyProject(set, await ipc.restoreVersion(path, snapshot));
    set({
      message: {
        tone: 'info',
        text: translate('messages.restored'),
      },
    });
  } catch (error) {
    set({ message: { tone: 'error', text: describe(error) } });
  } finally {
    set({ busy: false });
  }
}

function doLoadDemo(set: SetEditor, demo: Demo): void {
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
    projectName: translate(demo.nameKey),
    versions: [],
    dirty: true,
    history: emptyHistory,
    view: 'builder',
    message: {
      tone: 'info',
      // Not lower-cased the way the English joins it inline — a translated need can be a
      // German noun phrase, and German capitalises nouns everywhere, not only at a sentence's
      // start, so forcing lower case would misspell it.
      text: translate('messages.demoLoaded', {
        name: translate(demo.nameKey),
        needs: demo.needsKeys.map((key) => translate(key)).join(', '),
      }),
    },
  });
}

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
          text: translate('messages.missingComponents', { missing: project.missing.join(', ') }),
        }
      : null,
  });
}

function fileStem(path: string): string | undefined {
  const name = path.split(/[\\/]/).pop();
  return name?.replace(/\.encastra$/i, '');
}

// Shares its wording with `panels/RunPanel.tsx`'s own `outcomeSummary` by reading the exact same
// `runPanel.outcome.*` keys — see that file's own note on why the status bar and the run panel
// must never describe the same run differently.
function summarise(journal: RunJournal): string {
  const failed = Object.values(journal.nodes).filter((n) => n.status === 'failed').length;
  const ms = journal.finished_at_ms ? journal.finished_at_ms - journal.started_at_ms : 0;
  switch (journal.status) {
    case 'ok':
      return translate('runPanel.outcome.finishedIn', { took: `${ms}ms` });
    case 'partial': {
      const locale = useI18n.getState().locale;
      return translate(`runPanel.outcome.partial.${selectPlural(locale, failed)}`, {
        count: failed,
      });
    }
    case 'failed':
      return translate('runPanel.outcome.failed');
    case 'cancelled':
      return translate('runPanel.outcome.cancelled');
    default:
      return translate('runPanel.outcome.running');
  }
}

/**
 * Moves the machine, and keeps the two things outside it that have to agree.
 *
 * `busy` is the store's own flag for "something is in flight", read by controls that have nothing
 * to do with importing; `report_busy` is the privileged side's copy, which exists because a window
 * close arrives from the operating system and has to be answered before the webview can be asked
 * anything. Both are derived from the phase here rather than set by hand at six call sites.
 */
function setImportState(
  set: (partial: Partial<EditorState>) => void,
  next: ImportState,
  extra: Partial<EditorState> = {},
): void {
  const busy = next.phase === 'busy';
  set({ importState: next, busy, ...extra });
  // Best effort, and deliberately not awaited: the import is the thing being done, and a runtime
  // that did not answer this must not fail it. The runtime's flag starting out false means the
  // worst case is a close that is allowed — which is what happens today.
  void ipc.reportBusy(busy).catch(() => {});
}

/** The same, for an event that ends the work in flight. */
function settleImport(
  set: (partial: Partial<EditorState>) => void,
  get: () => EditorState,
  event: Parameters<typeof transition>[1],
  extra: Partial<EditorState> = {},
): void {
  setImportState(set, transition(get().importState, event), extra);
}

/**
 * A rejection from a command that refuses in a shape, kept in that shape.
 *
 * `inspect_publication` and `import_publication` reject with an `ImportError` nested inside the
 * application's own refusal — `{kind: 'import', error: {...}}` — and everything else rejects with
 * an `AppError`, an `Error` or a string. The Import panel is built around the inner shape, so it
 * is unwrapped rather than flattened: that is the difference between the interface showing a
 * sentence somebody can act on and showing them the JSON the runtime happened to send.
 */
function asImportFailure(error: unknown): ImportError | string {
  return importErrorIn(error) ?? describe(error);
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  // A structured refusal from the runtime: a tag, and the values a sentence needs. Every tag has
  // a sentence in all six languages, which is the point of the whole contract — this line used to
  // render whatever English the runtime had built, to whoever happened to be reading.
  const described = describeAppError(error);
  if (described !== null) return described;
  // Anything else carrying a `message` is a rejection that crossed the bridge as a plain object
  // rather than as an `Error` — which is what a rejected Tauri command looks like on this side,
  // and which used to be reported as silence even though the runtime had said precisely what
  // was wrong.
  if (typeof error === 'object' && error !== null) {
    const { message } = error as { message?: unknown };
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return translate('messages.runtimeSilent');
}

/**
 * Keeps the window's copy of "is there unsaved work here" in step with this one.
 *
 * The window is closed by the operating system — a title-bar X, Alt+F4, a session ending — and
 * none of those routes through the editor. By the time anything here could be asked, the answer
 * would already be too late to matter, so the answer is pushed the moment it changes instead.
 *
 * A subscription rather than a line inside every action that touches `dirty`: there are a dozen
 * of those and one of them will eventually be written without the line. Only the transitions are
 * sent, because `dirty` is set on nearly every keystroke-sized change and a message per node drag
 * would be a lot of noise for a boolean that changed twice.
 */
let reportedDirty = false;
useEditor.subscribe((state) => {
  if (state.dirty === reportedDirty) return;
  reportedDirty = state.dirty;
  ipc.reportDirty(state.dirty).catch(() => {
    // Best effort, and deliberately silent. A runtime that does not know this command is an
    // older build of the shell around a newer editor: the close guard is what degrades, and
    // interrupting somebody's editing to tell them so would help nobody.
  });
});

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
