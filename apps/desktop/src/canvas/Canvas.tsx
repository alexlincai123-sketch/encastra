/**
 * The canvas.
 *
 * React Flow supplies the viewport — pan, zoom, marquee, minimap — and nothing the user sees
 * (ADR-0005). The rule that matters here is `isConnectionLegal`: it asks the shared type table
 * the same question the runtime will ask, so a connection the engine would refuse cannot be
 * drawn in the first place. That is the difference between a validator and a promise.
 *
 * The canvas is a composite widget: one tab stop, `aria-activedescendant`, and a live region
 * that says what moved. Three things can be held inside it, and only ever one at a time — a
 * step (the arrow keys), a connection being made (`C`), and an existing connection (`E`). The
 * pure parts of the last two live in `connect-mode.ts` and `edge-focus.ts`; what is here is the
 * keyboard, the announcements, and the highlight the nodes are told about through a context.
 */

import {
  type AriaLabelConfig,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type IsValidConnection,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
  useReactFlow,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useComponentText } from '../component-text';
import { selectPlural, splitOnPlaceholder, translate, useI18n, useTranslation } from '../i18n';
import { usePreferences } from '../preferences';
import { type EditorNode, useEditor } from '../store';
import { ComponentNode } from './ComponentNode';
import { ContextMenu, type MenuItem, type MenuRequest } from './ContextMenu';
import {
  type Accepts,
  type CanvasFocus,
  CanvasFocusContext,
  candidateTargets,
  type PortAt,
  portsOf,
  stepPort,
  stepTarget,
  usablePorts,
} from './connect-mode';
import { incidentEdges, stepIncident } from './edge-focus';
import { canvasMenuIds, selectionToggleKey, stepToggleKey } from './menu';
import { explainConnection, type RefusalNo } from './refusal';
import { Wire } from './Wire';
import { indexOf, step, walkOrder } from './walk';

const nodeTypes = { component: ComponentNode };
const edgeTypes = { wire: Wire };

export function Canvas() {
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const connect = useEditor((s) => s.connect);
  const select = useEditor((s) => s.select);
  const selectedNodeId = useEditor((s) => s.selectedNodeId);
  const addNode = useEditor((s) => s.addNode);
  const deleteStep = useEditor((s) => s.deleteStep);
  const deleteSteps = useEditor((s) => s.deleteSteps);
  const deleteConnection = useEditor((s) => s.deleteConnection);
  const toggleDisabled = useEditor((s) => s.toggleDisabled);
  const toggleDisabledMany = useEditor((s) => s.toggleDisabledMany);
  const duplicateSelection = useEditor((s) => s.duplicateSelection);
  const pasteClipboard = useEditor((s) => s.pasteClipboard);
  const selectAll = useEditor((s) => s.selectAll);
  const clipboard = useEditor((s) => s.clipboard);
  const journal = useEditor((s) => s.journal);
  const manifests = useEditor((s) => s.manifests);
  const history = useEditor((s) => s.history);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const { t, locale } = useTranslation();

  // Read one at a time rather than as an object: a selector returning a fresh object would
  // re-render the canvas on every unrelated preference change.
  const showGrid = usePreferences((p) => p.showGrid);
  const snapToGrid = usePreferences((p) => p.snapToGrid);
  const showMinimap = usePreferences((p) => p.showMinimap);

  const instance = useRef<ReactFlowInstance<EditorNode, Edge> | null>(null);
  /** The canvas itself, so "is this step on screen?" can be asked of the real geometry. */
  const surface = useRef<HTMLDivElement | null>(null);
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();

  /** The order the arrow keys walk. Its rules, and their reasons, live in `walk.ts`. */
  const ordered = useMemo(() => walkOrder(nodes), [nodes]);

  // Read in the person's language, so the live region does not drop an English manifest name
  // into the middle of a Spanish sentence.
  const componentText = useComponentText();
  const nameOf = useCallback(
    (node: EditorNode) => {
      const manifest = manifests[node.data.componentRef];
      return node.data.label ?? (manifest ? componentText.name(manifest) : node.id);
    },
    [manifests, componentText],
  );

  /**
   * Why the last attempted connection was refused, so the drag can end with an explanation.
   *
   * Held in a ref rather than in state because `isValidConnection` runs on every pointer move
   * while a wire is being dragged; putting it in state would re-render the canvas continuously
   * for the whole drag. It is read once, at `onConnectEnd`.
   */
  const lastRefusal = useRef<RefusalNo | null>(null);
  const [refusal, setRefusal] = useState<RefusalNo | null>(null);

  const [menu, setMenu] = useState<MenuRequest | null>(null);

  /** The connection being made from the keyboard: where from, and which target is offered. */
  const [connecting, setConnecting] = useState<{ from: PortAt; to: PortAt } | null>(null);
  /** The existing connection the keyboard is holding, if it is holding one. */
  const [focusedEdgeId, setFocusedEdgeId] = useState<string | null>(null);
  /**
   * What the live region should say, when that is something other than the selection.
   *
   * One string rather than a second region: two live regions competing for the same reader is
   * how an announcement gets lost. Empty means "nothing to add", and the selection sentence is
   * read instead.
   */
  const [live, setLive] = useState('');

  const isConnectionLegal: IsValidConnection = useCallback((connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || !sourceHandle || !targetHandle) return false;

    // A node feeding itself is a cycle of one. Validation would refuse it; refusing here means
    // the user never draws it.
    //
    // Uses the plain `translate` rather than the `t` from `useTranslation()` so this callback's
    // dependency array — deliberately `[]`, since it must stay identical across renders while a
    // wire is being dragged — never has to change with it: `translate` reads the current locale
    // itself at call time instead of closing over one captured when the callback was created.
    if (source === target) {
      lastRefusal.current = {
        ok: false,
        headline: translate('canvas.refusal.selfCycle.headline'),
        detail: translate('canvas.refusal.selfCycle.detail'),
      };
      return false;
    }

    const state = useEditor.getState();
    const from = state.portType(source, sourceHandle, 'outputs');
    const to = state.portType(target, targetHandle, 'inputs');
    if (!from || !to) return false;

    const verdict = explainConnection(from, to);
    lastRefusal.current = verdict.ok ? null : verdict;
    return verdict.ok;
  }, []);

  /**
   * The one rule about which connections may exist, handed to the keyboard as a predicate.
   *
   * Asking it about a candidate leaves behind a refusal in `lastRefusal`, which exists for the
   * panel that explains a *drag* that would not land. None of these questions came from a drag,
   * so every caller clears it again — otherwise the next released wire could show a reason
   * belonging to a port nobody ever pointed at.
   */
  const accepts = useCallback<Accepts>(
    (candidate) => isConnectionLegal(candidate),
    [isConnectionLegal],
  );

  /** Centres the view on a step, without changing anything about the step. */
  const reveal = useCallback(
    (node: EditorNode | undefined) => {
      if (!node) return;
      setCenter(node.position.x + 110, node.position.y + 60, { zoom: getZoom(), duration: 180 });
    },
    [setCenter, getZoom],
  );

  /**
   * The same, but only when the step cannot already be seen.
   *
   * `onlyRenderVisibleElements` means an off-screen node is not in the DOM at all, so a
   * candidate target the viewport has not followed is a highlight that does not exist. Centring
   * on it unconditionally would be worse, though: it would push the *source* port off the other
   * edge, so a connection being made would never show both of its ends at once. Moving the view
   * only when it has to keeps both visible for as long as the canvas allows.
   */
  const revealIfHidden = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      // Measured rather than computed from the viewport transform: a node's height depends on
      // how many ports it has, and a culled node is simply not there — which is itself the
      // answer, and the case that matters most.
      const element = document.getElementById(`node-${nodeId}`);
      const box = surface.current?.getBoundingClientRect();
      if (element && box) {
        const rect = element.getBoundingClientRect();
        const visible =
          rect.left >= box.left &&
          rect.top >= box.top &&
          rect.right <= box.right &&
          rect.bottom <= box.bottom;
        if (visible) return;
      }
      reveal(node);
    },
    [nodes, reveal],
  );

  /**
   * Selects a step and brings it into view.
   *
   * The selection has to be made where React Flow keeps it, not only in this application's
   * store. Calling `select()` alone looked right and did nothing: React Flow still held the old
   * selection, `onSelectionChange` fired with it, and the store was set straight back — so every
   * arrow press appeared to be ignored. Going through `onNodesChange` moves the one selection
   * there is, and the store follows it through `onSelectionChange` as it does for a click.
   */
  const go = useCallback(
    (node: EditorNode | undefined) => {
      if (!node) return;
      // Moving to a step is the end of whatever the last announcement was about, including the
      // "Connected." that has no selection change of its own to clear it.
      setLive('');
      onNodesChange([
        ...nodes
          .filter((n) => n.selected && n.id !== node.id)
          .map((n) => ({ id: n.id, type: 'select' as const, selected: false })),
        { id: node.id, type: 'select' as const, selected: true },
      ]);
      reveal(node);
    },
    [nodes, onNodesChange, reveal],
  );

  /**
   * Both keyboard modes belong to the step that was selected when they started, so selecting
   * something else ends them rather than leaving a highlight pointing at a step nobody is on.
   *
   * The dependency is the whole point of the effect rather than something it reads — this is a
   * reset on change, and removing `selectedNodeId` as "unnecessary" would run it once and never
   * again, which is precisely the defect.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the dependency is the trigger
  useEffect(() => {
    setConnecting(null);
    setFocusedEdgeId(null);
  }, [selectedNodeId]);

  // --- Saying where the keyboard is --------------------------------------------------------

  /** `"Resize Image · width"` — a step and one of its ports, as one translated unit. */
  const describePort = useCallback(
    (ref: PortAt, side: 'inputs' | 'outputs') => {
      const node = nodes.find((n) => n.id === ref.node);
      const manifest = node ? manifests[node.data.componentRef] : undefined;
      return t('canvas.a11y.port', {
        step: node ? nameOf(node) : ref.node,
        port: manifest?.ports[side][ref.port]?.label ?? ref.port,
      });
    },
    [nodes, manifests, nameOf, t],
  );

  const describeEdge = useCallback(
    (edge: Edge) =>
      t('canvas.connection.focused', {
        from: describePort({ node: edge.source, port: edge.sourceHandle ?? '' }, 'outputs'),
        to: describePort({ node: edge.target, port: edge.targetHandle ?? '' }, 'inputs'),
      }),
    [describePort, t],
  );

  /**
   * What connect mode says when it opens, or when the source port changes.
   *
   * Two whole translated sentences joined by a space, rather than one key with the target
   * spliced into it: the instruction and the target it is currently offering are separate
   * statements, and joining finished sentences is the one kind of concatenation that stays
   * correct in every language.
   */
  const announceConnecting = useCallback(
    (from: PortAt, to: PortAt, count: number) => {
      const targets = t(`canvas.connect.targets.${selectPlural(locale, count)}`, { count });
      const opening = t('canvas.connect.started', { from: describePort(from, 'outputs'), targets });
      setLive(`${opening} ${describePort(to, 'inputs')}`);
    },
    [t, locale, describePort],
  );

  // --- Making a connection from the keyboard ------------------------------------------------

  /**
   * Enters connect mode on a step.
   *
   * From the first of its output ports that has somewhere legal to go, rather than flatly from
   * the first output port: a mode whose Enter cannot complete is worse than no mode, and a step
   * whose first output happens to fit nothing while its second fits everything is common enough
   * (a component with a `log` output beside its real one) to be worth the extra look.
   */
  const beginConnect = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const ports = usablePorts({ node, nodes, manifests, accepts });
      lastRefusal.current = null;
      const port = ports[0];
      if (!port) {
        const empty = portsOf(node, manifests, 'outputs').length === 0;
        setLive(
          t(empty ? 'canvas.connect.noOutputs' : 'canvas.connect.noTargets', {
            step: nameOf(node),
          }),
        );
        return;
      }
      const from: PortAt = { node: nodeId, port };
      const targets = candidateTargets({ source: from, nodes, manifests, accepts });
      lastRefusal.current = null;
      const to = targets[0];
      if (!to) return;
      setFocusedEdgeId(null);
      setConnecting({ from, to });
      revealIfHidden(to.node);
      announceConnecting(from, to, targets.length);
    },
    [nodes, manifests, accepts, t, nameOf, announceConnecting, revealIfHidden],
  );

  /** Moves the offered target, skipping every port the rule would refuse. */
  const moveTarget = useCallback(
    (direction: 'next' | 'previous') => {
      if (!connecting) return;
      const targets = candidateTargets({ source: connecting.from, nodes, manifests, accepts });
      lastRefusal.current = null;
      const next = stepTarget(targets, connecting.to, direction);
      if (!next) return;
      setConnecting({ from: connecting.from, to: next });
      revealIfHidden(next.node);
      setLive(describePort(next, 'inputs'));
    },
    [connecting, nodes, manifests, accepts, describePort, revealIfHidden],
  );

  /** Moves to another of the step's output ports — only ever one that has somewhere to go. */
  const moveSourcePort = useCallback(
    (direction: 'next' | 'previous') => {
      if (!connecting) return;
      const node = nodes.find((n) => n.id === connecting.from.node);
      if (!node) return;
      const ports = usablePorts({ node, nodes, manifests, accepts });
      lastRefusal.current = null;
      const next = stepPort(ports, connecting.from.port, direction);
      if (!next || next === connecting.from.port) return;
      const from: PortAt = { node: node.id, port: next };
      const targets = candidateTargets({ source: from, nodes, manifests, accepts });
      lastRefusal.current = null;
      const to = targets[0];
      if (!to) return;
      setConnecting({ from, to });
      revealIfHidden(to.node);
      announceConnecting(from, to, targets.length);
    },
    [connecting, nodes, manifests, accepts, announceConnecting, revealIfHidden],
  );

  /**
   * Completes the connection through the very same store action a released wire goes through,
   * with the same shape of `Connection`, so history, validation and the replace-an-occupied-
   * input rule behave identically whichever way the connection was made.
   */
  const finishConnect = useCallback(() => {
    if (!connecting) return;
    connect({
      source: connecting.from.node,
      sourceHandle: connecting.from.port,
      target: connecting.to.node,
      targetHandle: connecting.to.port,
    } satisfies Connection);
    setConnecting(null);
    setLive(t('canvas.connect.connected'));
  }, [connecting, connect, t]);

  const cancelConnect = useCallback(() => {
    setConnecting(null);
    setLive(t('canvas.connect.cancelled'));
  }, [t]);

  // --- Holding an existing connection -------------------------------------------------------

  /** Cycles through the connections touching the selected step. */
  const moveFocusedEdge = useCallback(
    (direction: 'next' | 'previous') => {
      if (!selectedNodeId) return;
      const incident = incidentEdges(edges, selectedNodeId);
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (incident.length === 0) {
        setLive(t('canvas.connection.none', { step: node ? nameOf(node) : selectedNodeId }));
        return;
      }
      const next = stepIncident(incident, focusedEdgeId, direction);
      if (!next) return;
      setConnecting(null);
      setFocusedEdgeId(next.id);
      setLive(describeEdge(next));
    },
    [selectedNodeId, edges, nodes, focusedEdgeId, nameOf, describeEdge, t],
  );

  const deleteFocusedEdge = useCallback(() => {
    if (!focusedEdgeId) return;
    deleteConnection(focusedEdgeId);
    setFocusedEdgeId(null);
    setLive(t('canvas.connection.removed'));
  }, [focusedEdgeId, deleteConnection, t]);

  /**
   * The canvas is one tab stop, and the arrow keys move within it.
   *
   * This is the composite-widget pattern, and it is also the only humane answer: putting every
   * node in the tab order would mean a graph of forty steps costs forty presses to tab past.
   * Before this, the canvas had no tab stop at all — tabbing went sidebar, toolbar, palette and
   * then wrapped — so a step could not be reached without a mouse, and a step that cannot be
   * reached cannot be configured, because its settings and its permission prompt live in the
   * inspector.
   *
   * Two modes sit in front of that, each announced when it opens and each left by Escape. A key
   * either mode handles is stopped here rather than merely defaulted: `Delete` is listened for
   * on the window by `Builder.tsx` and by React Flow itself, and both of them act on the
   * *selected step* — so a Delete meant for a connection would take the step with it unless the
   * event stops at the canvas.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (ordered.length === 0) return;
      // Never swallow a modified chord: Ctrl+Enter runs the workflow and Ctrl+S saves, and both
      // have to keep working while the canvas holds focus.
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key;
      const claim = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (connecting) {
        switch (key) {
          case 'ArrowRight':
          case 'ArrowDown':
            claim();
            moveTarget('next');
            return;
          case 'ArrowLeft':
          case 'ArrowUp':
            claim();
            moveTarget('previous');
            return;
          case 'Tab':
          case ']':
          case '[':
            // Tab cycles the source port rather than leaving the canvas, because while a
            // connection is half-made leaving is what Escape is for. `[` and `]` do the same
            // for anybody whose muscle memory refuses to believe Tab is safe here.
            claim();
            moveSourcePort(key === '[' || event.shiftKey ? 'previous' : 'next');
            return;
          case 'Enter':
          case ' ':
            claim();
            finishConnect();
            return;
          case 'Escape':
            claim();
            cancelConnect();
            return;
          case 'Delete':
          case 'Backspace':
            // Nothing is being deleted while a connection is being made, and least of all the
            // step it starts from.
            claim();
            return;
          default:
            return;
        }
      }

      if (focusedEdgeId) {
        switch (key) {
          case 'Delete':
          case 'Backspace':
            claim();
            deleteFocusedEdge();
            return;
          case 'Escape':
            claim();
            setFocusedEdgeId(null);
            setLive('');
            return;
          case 'e':
          case 'E':
            claim();
            moveFocusedEdge(event.shiftKey ? 'previous' : 'next');
            return;
          default:
            // An arrow key goes back to walking steps rather than being swallowed: a mode you
            // can only leave by knowing the way out is a trap, and Escape is not the only key
            // somebody will try.
            setFocusedEdgeId(null);
            break;
        }
      }

      switch (key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          go(step(ordered, selectedNodeId, 'forward'));
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          go(step(ordered, selectedNodeId, 'back'));
          break;
        case 'Home':
          event.preventDefault();
          go(ordered[0]);
          break;
        case 'End':
          event.preventDefault();
          go(ordered[ordered.length - 1]);
          break;
        case 'c':
        case 'C':
          if (!selectedNodeId) break;
          claim();
          beginConnect(selectedNodeId);
          break;
        case 'e':
        case 'E':
          if (!selectedNodeId) break;
          claim();
          moveFocusedEdge(event.shiftKey ? 'previous' : 'next');
          break;
        case 'Enter':
        case ' ': {
          // Selecting is what opens the inspector, so entering the canvas and pressing Enter
          // lands on something useful rather than doing nothing.
          event.preventDefault();
          const at = indexOf(ordered, selectedNodeId);
          go(at < 0 ? ordered[0] : ordered[at]);
          break;
        }
        case 'Escape':
          // Cleared where React Flow keeps it, for the same reason `go` selects there: clearing
          // only this application's store leaves React Flow holding the old selection, which it
          // then puts straight back.
          event.preventDefault();
          setLive('');
          onNodesChange(
            nodes
              .filter((n) => n.selected)
              .map((n) => ({ id: n.id, type: 'select' as const, selected: false })),
          );
          select(null);
          break;
        default:
          break;
      }
    },
    [
      ordered,
      selectedNodeId,
      go,
      select,
      nodes,
      onNodesChange,
      connecting,
      focusedEdgeId,
      moveTarget,
      moveSourcePort,
      finishConnect,
      cancelConnect,
      beginConnect,
      moveFocusedEdge,
      deleteFocusedEdge,
    ],
  );

  /** Selects one step where React Flow keeps its selection, for the reason `go` explains. */
  const selectOnly = useCallback(
    (nodeId: string) => {
      onNodesChange([
        ...nodes
          .filter((n) => n.selected && n.id !== nodeId)
          .map((n) => ({ id: n.id, type: 'select' as const, selected: false })),
        { id: nodeId, type: 'select' as const, selected: true },
      ]);
    },
    [nodes, onNodesChange],
  );

  /**
   * Right-clicking a step.
   *
   * Every one of these handlers begins by refusing the default, because the default here is the
   * WebView's own menu — Back, Reload, Save as, Print — which belongs to a browser and has
   * nothing to say about a workflow. Removing a step was already possible from the keyboard;
   * what was missing was anywhere to see that it was possible.
   *
   * Right-clicking *inside a selection* keeps that selection and offers to act on all of it.
   * Narrowing to the step under the pointer — which is what selecting always does, and what this
   * did — silently discarded a selection somebody had just built, and then did to one step what
   * they had asked for on six.
   */
  const openStepMenu = useCallback(
    (event: React.MouseEvent, node: EditorNode) => {
      event.preventDefault();
      const selected = nodes.filter((n) => n.selected);
      const ids = selected.map((n) => n.id);
      const items: MenuItem[] =
        ids.length > 1 && ids.includes(node.id)
          ? (() => {
              const count = ids.length;
              // The menu only opens on two or more today; the count still goes through the
              // locale's own plural rules rather than an assumption about which category a
              // number lands in, because that assumption is not this file's to make.
              const plural = selectPlural(locale, count);
              const allDisabled = selected.every((n) => n.data.disabled === true);
              return [
                {
                  id: 'duplicate',
                  label: t(`canvas.menu.many.duplicate.${plural}`, { count }),
                  run: duplicateSelection,
                },
                {
                  id: 'disabled',
                  label: t(`${selectionToggleKey(allDisabled)}.${plural}`, { count }),
                  run: () => toggleDisabledMany(ids),
                },
                {
                  id: 'delete',
                  label: t(`canvas.menu.many.delete.${plural}`, { count }),
                  danger: true,
                  run: () => deleteSteps(ids),
                },
              ];
            })()
          : (() => {
              // Right-clicking one step selects it, as it does in every editor: the menu then
              // acts on the thing under the pointer and the inspector shows the same thing the
              // menu is about.
              selectOnly(node.id);
              return [
                {
                  id: 'connect',
                  label: t('canvas.menu.connect'),
                  run: () => beginConnect(node.id),
                },
                { id: 'duplicate', label: t('canvas.menu.duplicate'), run: duplicateSelection },
                {
                  id: 'disabled',
                  label: t(stepToggleKey(node.data.disabled === true)),
                  run: () => toggleDisabled(node.id),
                },
                {
                  id: 'delete',
                  label: t('canvas.menu.deleteStep'),
                  danger: true,
                  run: () => deleteStep(node.id),
                },
              ];
            })();
      setMenu({ x: event.clientX, y: event.clientY, items });
    },
    [
      nodes,
      locale,
      selectOnly,
      t,
      duplicateSelection,
      toggleDisabled,
      toggleDisabledMany,
      deleteStep,
      deleteSteps,
      beginConnect,
    ],
  );

  const openConnectionMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          {
            id: 'delete',
            label: t('canvas.menu.deleteConnection'),
            danger: true,
            run: () => deleteConnection(edge.id),
          },
        ],
      });
    },
    [t, deleteConnection],
  );

  const openCanvasMenu = useCallback(
    // React Flow hands the pane a plain DOM event, not React's synthetic one — the pane listens
    // for itself rather than through the tree. The two agree on everything used here.
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const run: Record<string, () => void> = { paste: pasteClipboard, selectAll, undo, redo };
      const items: MenuItem[] = canvasMenuIds({
        clipboard: (clipboard?.nodes.length ?? 0) > 0,
        nodes: nodes.length > 0,
        undo: history.past.length > 0,
        redo: history.future.length > 0,
      }).map((id) => ({ id, label: t(`canvas.menu.${id}`), run: run[id] ?? (() => {}) }));
      // An empty canvas has nothing to offer, and a menu with no items in it is a worse answer
      // than no menu — but the default is still refused above, so the browser's does not appear.
      if (items.length === 0) return;
      setMenu({ x: event.clientX, y: event.clientY, items });
    },
    [clipboard, nodes.length, pasteClipboard, selectAll, undo, redo, history, t],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const componentRef = event.dataTransfer.getData('application/encastra-component');
      if (!componentRef) return;
      addNode(componentRef, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [addNode, screenToFlowPosition],
  );

  /** What the nodes and wires have to draw, for the reason `connect-mode.ts` gives. */
  const focus = useMemo<CanvasFocus>(
    () => ({
      from: connecting?.from ?? null,
      to: connecting?.to ?? null,
      edgeId: focusedEdgeId,
    }),
    [connecting, focusedEdgeId],
  );

  // React Flow names its own controls — the zoom buttons, the minimap, the panel around them —
  // and does it in English unless told otherwise. Only the labels this canvas actually shows are
  // given: the interactivity toggle is hidden, and node and edge focus are off (see below).
  const messages = useI18n((s) => s.messages);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `translate` reads locale and messages
  const ariaLabelConfig = useMemo<Partial<AriaLabelConfig>>(
    () => ({
      'controls.ariaLabel': translate('canvas.controls.panel'),
      'controls.zoomIn.ariaLabel': translate('canvas.controls.zoomIn'),
      'controls.zoomOut.ariaLabel': translate('canvas.controls.zoomOut'),
      'controls.fitView.ariaLabel': translate('canvas.controls.fitView'),
      'minimap.ariaLabel': translate('canvas.controls.minimap'),
    }),
    [locale, messages],
  );

  // Rendered once as `{bridge}` intact — see `splitOnPlaceholder` — so the `<code>` element can
  // be dropped in wherever the translated sentence actually puts the placeholder, rather than
  // the two halves being separately-translated fragments whose order silently assumes English.
  const bridge = refusal?.bridge ?? null;
  const [bridgeBefore, bridgeAfter] = bridge
    ? splitOnPlaceholder(t('canvas.refusal.bridge'), 'bridge')
    : ['', ''];

  const selectionSentence = (() => {
    if (!selectedNodeId) return '';
    const at = indexOf(ordered, selectedNodeId);
    const node = ordered[at];
    return node
      ? t('canvas.a11y.selected', { name: nameOf(node), index: at + 1, total: ordered.length })
      : '';
  })();

  return (
    <div
      ref={surface}
      className="canvas"
      // A canvas is a composite widget, not a document region: it owns its own keyboard and
      // pointer model, which is exactly what role="application" tells assistive technology.
      role="application"
      aria-label={t('canvas.ariaLabel')}
      aria-describedby="canvas-keys"
      aria-activedescendant={selectedNodeId ? `node-${selectedNodeId}` : undefined}
      /* role="application" is precisely the case this rule cannot see. An application region
         owns its own keyboard model, so it has to be focusable — an unfocusable one can never
         receive the arrow keys it exists to handle. Removing the tabindex would restore the
         defect this replaced: a canvas nobody could reach without a mouse. */
      // biome-ignore lint/a11y/noNoninteractiveTabindex: an application region must be focusable
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDrop={onDrop}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
    >
      <CanvasFocusContext.Provider value={focus}>
        <ReactFlow<EditorNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={(rf) => {
            instance.current = rf;
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={connect}
          onConnectStart={() => {
            lastRefusal.current = null;
            setRefusal(null);
          }}
          // The moment worth explaining. React Flow simply declines to complete an illegal
          // connection, which leaves somebody holding a wire that will not land and no idea
          // why — the most common moment of confusion in a node editor.
          onConnectEnd={() => setRefusal(lastRefusal.current)}
          isValidConnection={isConnectionLegal}
          onNodeClick={(_, node) => select(node.id)}
          onPaneClick={() => select(null)}
          onNodeContextMenu={openStepMenu}
          onEdgeContextMenu={openConnectionMenu}
          onPaneContextMenu={openCanvasMenu}
          // The inspector follows the *selection*, not the click that usually causes one, so a
          // step selected any other way — a box selection, an arrow key, anything programmatic —
          // also opens in the inspector. That is what lets the keyboard handler above do its job
          // by doing nothing more than selecting.
          onSelectionChange={({ nodes: selected }) => select(selected[0]?.id ?? null)}
          // Off deliberately. The canvas is one tab stop with its own arrow-key model, and
          // letting React Flow also put each node in the tab order would give a graph of forty
          // steps forty tab stops to get past.
          nodesFocusable={false}
          // Off for the same reason, and for one more: `E` already holds a connection as part of
          // this widget's own model, and React Flow's edge focus would put a second, competing
          // idea of "the current edge" in the tab order — one the live region does not describe
          // and Escape does not leave.
          edgesFocusable={false}
          // Keeps hundreds of nodes affordable: offscreen ones are not in the DOM at all.
          onlyRenderVisibleElements
          snapToGrid={snapToGrid}
          snapGrid={[8, 8]}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: false }}
          attributionPosition="bottom-left"
          deleteKeyCode={['Delete', 'Backspace']}
          fitView
          // Without a ceiling, a graph with one node fills the screen with one node.
          fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          ariaLabelConfig={ariaLabelConfig}
        >
          {showGrid ? <Background variant={BackgroundVariant.Dots} gap={16} size={1} /> : null}
          <Controls showInteractive={false} />
          {/* An empty minimap is a black rectangle that looks like a rendering fault — so it is
            shown only when there is something for it to show, and only if it is wanted. */}
          {showMinimap && nodes.length > 0 ? (
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => {
                const status = journal?.nodes[node.id]?.status;
                if (status === 'failed') return 'var(--danger)';
                if (status === 'ok') return 'var(--ok)';
                return 'var(--line-strong)';
              }}
              maskColor="rgb(0 0 0 / 55%)"
            />
          ) : null}
        </ReactFlow>
      </CanvasFocusContext.Provider>

      {menu ? (
        <ContextMenu request={menu} onClose={() => setMenu(null)} label={t('canvas.menu.label')} />
      ) : null}

      {nodes.length === 0 ? (
        <div className="canvas__empty">
          <h2>{t('canvas.empty.heading')}</h2>
          <p>{t('canvas.empty.body')}</p>
          <p className="canvas__empty-hint">{t('canvas.empty.hint')}</p>
        </div>
      ) : null}

      {refusal ? (
        <div className="refusal" role="status" aria-live="polite">
          <div className="refusal__body">
            <strong className="refusal__headline">{refusal.headline}</strong>
            <span className="refusal__detail">{refusal.detail}</span>
            {bridge ? (
              <span className="refusal__bridge">
                {bridgeBefore}
                <code>{bridge}</code>
                {bridgeAfter}
              </span>
            ) : null}
          </div>
          {/* No `aria-label`: the visible word is the accessible name. A label that differed from
              it ("Dismiss" on a button reading "Close") breaks speech control, where somebody says
              the word they can see. */}
          <button type="button" className="btn" onClick={() => setRefusal(null)}>
            {t('common.close')}
          </button>
        </div>
      ) : null}

      {/* Named by aria-describedby, so the keys are announced on entering the canvas rather
          than having to be discovered. Visible to screen readers only. */}
      <p id="canvas-keys" className="visually-hidden">
        {t('canvas.keysHint')}
      </p>

      {/* What changed, for somebody who cannot see it. Polite: it should not interrupt, it
          should be there when the reader gets to it. Whichever of the two keyboard modes is
          open speaks here; with neither open it is the selection. */}
      <p className="visually-hidden" aria-live="polite">
        {live || selectionSentence}
      </p>
    </div>
  );
}
