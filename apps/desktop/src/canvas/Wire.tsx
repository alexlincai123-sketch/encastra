/**
 * A connection between two ports.
 *
 * Its job beyond drawing a line: when the type system inserted a conversion on this edge, say
 * so. A graph where `json` quietly becomes `string` somewhere invisible is a graph nobody can
 * debug, and the conversion is exactly where a run tends to fail.
 *
 * The badge shows what the runtime will do, taken from the plan validation produced — not
 * recomputed here, so the editor and the engine cannot describe the same edge differently.
 */

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { useEditor } from '../store';

const OP_LABELS: Record<string, string> = {
  'to-text': 'as text',
  'int-to-float': 'as decimal',
  'bool-to-int': 'as number',
  'int-to-bool': 'as yes/no',
  round: 'rounded',
  'parse-int': 'parse number',
  'parse-float': 'parse decimal',
  'parse-bool': 'parse yes/no',
  'parse-json': 'parse JSON',
  'stringify-json': 'as text',
  'encode-json': 'to JSON',
  'decode-json': 'from JSON',
  'read-bytes': 'read',
  'write-temp': 'to file',
  'unwrap-option': 'may be absent',
  map: 'each',
};

export function Wire({
  id,
  source,
  target,
  sourceHandleId,
  targetHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const conversions = useEditor((s) => s.validation?.conversions);

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const plan = conversions?.find(
    (c) =>
      c.from.node === source &&
      c.from.port === sourceHandleId &&
      c.to.node === target &&
      c.to.port === targetHandleId,
  );

  const label = plan?.ops.map((op) => OP_LABELS[op] ?? op).join(' · ');

  return (
    <>
      <BaseEdge id={id} path={path} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="wire__badge"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            // Selection is the moment somebody is asking "what does this do?".
            data-selected={selected ? 'true' : undefined}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
