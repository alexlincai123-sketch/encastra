/**
 * The canvas.
 *
 * React Flow supplies the viewport — pan, zoom, marquee, minimap — and nothing the user sees
 * (ADR-0005). The rule that matters here is `isConnectionLegal`: it asks the shared type table
 * the same question the runtime will ask, so a connection the engine would refuse cannot be
 * drawn in the first place. That is the difference between a validator and a promise.
 */

import { checkCompatibility } from '@encastra/protocol';
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
import { useCallback, useRef } from 'react';
import { type EditorNode, useEditor } from '../store';
import { ComponentNode } from './ComponentNode';
import { Wire } from './Wire';

const nodeTypes = { component: ComponentNode };
const edgeTypes = { wire: Wire };

export function Canvas() {
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const connect = useEditor((s) => s.connect);
  const select = useEditor((s) => s.select);
  const addNode = useEditor((s) => s.addNode);
  const journal = useEditor((s) => s.journal);

  const instance = useRef<ReactFlowInstance<EditorNode, Edge> | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const isConnectionLegal: IsValidConnection = useCallback((connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || !sourceHandle || !targetHandle) return false;

    // A node feeding itself is a cycle of one. Validation would refuse it; refusing here means
    // the user never draws it.
    if (source === target) return false;

    const state = useEditor.getState();
    const from = state.portType(source, sourceHandle, 'outputs');
    const to = state.portType(target, targetHandle, 'inputs');
    if (!from || !to) return false;

    return checkCompatibility(from, to).ok;
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
        isValidConnection={isConnectionLegal}
        onNodeClick={(_, node) => select(node.id)}
        onPaneClick={() => select(null)}
        // The inspector follows the *selection*, not the click that usually causes one.
        // Wiring it to clicks alone meant a step selected with the keyboard — Tab to it, Enter
        // to select — left the inspector showing nothing, so somebody working without a mouse
        // could reach a step but never configure it.
        onSelectionChange={({ nodes: selected }) => select(selected[0]?.id ?? null)}
        nodesFocusable
        // Keeps hundreds of nodes affordable: offscreen ones are not in the DOM at all.
        onlyRenderVisibleElements
        snapToGrid
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
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        {/* An empty minimap is a black rectangle that looks like a rendering fault. */}
        {nodes.length > 0 ? (
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
          <h2>Nothing here yet</h2>
          <p>
            Pick a component on the left to place your first step. Connect its output to the next
            one, and press Run.
          </p>
        </div>
      ) : null}
    </div>
  );
}
