/**
 * The canvas.
 *
 * React Flow supplies the viewport — pan, zoom, marquee, minimap — and nothing the user sees
 * (ADR-0005). The rule that matters here is `isConnectionLegal`: it asks the shared type table
 * the same question the runtime will ask, so a connection the engine would refuse cannot be
 * drawn in the first place. That is the difference between a validator and a promise.
 */

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type IsValidConnection,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
  useReactFlow,
} from '@xyflow/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { usePreferences } from '../preferences';
import { type EditorNode, useEditor } from '../store';
import { ComponentNode } from './ComponentNode';
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
  const journal = useEditor((s) => s.journal);
  const manifests = useEditor((s) => s.manifests);

  // Read one at a time rather than as an object: a selector returning a fresh object would
  // re-render the canvas on every unrelated preference change.
  const showGrid = usePreferences((p) => p.showGrid);
  const snapToGrid = usePreferences((p) => p.snapToGrid);
  const showMinimap = usePreferences((p) => p.showMinimap);

  const instance = useRef<ReactFlowInstance<EditorNode, Edge> | null>(null);
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();

  /** The order the arrow keys walk. Its rules, and their reasons, live in `walk.ts`. */
  const ordered = useMemo(() => walkOrder(nodes), [nodes]);

  const nameOf = useCallback(
    (node: EditorNode) => node.data.label ?? manifests[node.data.componentRef]?.name ?? node.id,
    [manifests],
  );

  /** Selects a step and brings it into view, because selecting something off-screen is a trap. */
  const go = useCallback(
    (node: EditorNode | undefined) => {
      if (!node) return;
      select(node.id);
      setCenter(node.position.x + 110, node.position.y + 60, {
        zoom: getZoom(),
        duration: 180,
      });
    },
    [select, setCenter, getZoom],
  );

  /**
   * The canvas is one tab stop, and the arrow keys move within it.
   *
   * This is the composite-widget pattern, and it is also the only humane answer: putting every
   * node in the tab order would mean a graph of forty steps costs forty presses to tab past.
   * Before this, the canvas had no tab stop at all — tabbing went sidebar, toolbar, palette and
   * then wrapped — so a step could not be reached without a mouse, and a step that cannot be
   * reached cannot be configured, because its settings and its permission prompt live in the
   * inspector.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (ordered.length === 0) return;
      // Never swallow a modified chord: Ctrl+Enter runs the workflow and Ctrl+S saves, and both
      // have to keep working while the canvas holds focus.
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      switch (event.key) {
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
          event.preventDefault();
          select(null);
          break;
        default:
          break;
      }
    },
    [ordered, selectedNodeId, go, select],
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

  const isConnectionLegal: IsValidConnection = useCallback((connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || !sourceHandle || !targetHandle) return false;

    // A node feeding itself is a cycle of one. Validation would refuse it; refusing here means
    // the user never draws it.
    if (source === target) {
      lastRefusal.current = {
        ok: false,
        headline: 'A step cannot feed itself.',
        detail:
          'A workflow runs forwards. To do the same work repeatedly, start it from a trigger — ' +
          'Watch Folder or Timer — which runs it once per event.',
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

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const componentRef = event.dataTransfer.getData('application/encastra-component');
      if (!componentRef) return;
      addNode(componentRef, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [addNode, screenToFlowPosition],
  );

  return (
    <div
      className="canvas"
      // A canvas is a composite widget, not a document region: it owns its own keyboard and
      // pointer model, which is exactly what role="application" tells assistive technology.
      role="application"
      aria-label="Workflow canvas"
      aria-describedby="canvas-keys"
      aria-activedescendant={selectedNodeId ? `node-${selectedNodeId}` : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDrop={onDrop}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
    >
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
        // The inspector follows the *selection*, not the click that usually causes one, so a
        // step selected any other way — a box selection, an arrow key, anything programmatic —
        // also opens in the inspector. That is what lets the keyboard handler above do its job
        // by doing nothing more than selecting.
        onSelectionChange={({ nodes: selected }) => select(selected[0]?.id ?? null)}
        // Off deliberately. The canvas is one tab stop with its own arrow-key model, and
        // letting React Flow also put each node in the tab order would give a graph of forty
        // steps forty tab stops to get past.
        nodesFocusable={false}
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

      {nodes.length === 0 ? (
        <div className="canvas__empty">
          <h2>Your canvas is empty</h2>
          <p>
            A workflow is a few components joined together. Pick one from the left to place your
            first step, connect its output to the next, and press Run.
          </p>
          <p className="canvas__empty-hint">
            Every component says what it can reach before it runs, and nothing touches your files
            until you allow it.
          </p>
        </div>
      ) : null}

      {refusal ? (
        <div className="refusal" role="status" aria-live="polite">
          <div className="refusal__body">
            <strong className="refusal__headline">{refusal.headline}</strong>
            <span className="refusal__detail">{refusal.detail}</span>
            {refusal.bridge ? (
              <span className="refusal__bridge">
                A step producing <code>{refusal.bridge}</code> in between would join them.
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => setRefusal(null)}
            aria-label="Dismiss"
          >
            Close
          </button>
        </div>
      ) : null}

      {/* Named by aria-describedby, so the keys are announced on entering the canvas rather
          than having to be discovered. Visible to screen readers only. */}
      <p id="canvas-keys" className="visually-hidden">
        Use the arrow keys to move between steps, Enter to open a step in the inspector, Escape to
        deselect, and Delete to remove the selected step.
      </p>

      {/* What changed, for somebody who cannot see the selection move. Polite: it should not
          interrupt, it should be there when the reader gets to it. */}
      <p className="visually-hidden" aria-live="polite">
        {selectedNodeId
          ? (() => {
              const at = indexOf(ordered, selectedNodeId);
              const node = ordered[at];
              return node ? `${nameOf(node)}, step ${at + 1} of ${ordered.length}, selected.` : '';
            })()
          : ''}
      </p>
    </div>
  );
}
