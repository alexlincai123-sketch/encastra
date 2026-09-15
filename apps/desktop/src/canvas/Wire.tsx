/**
 * A connection between two ports.
 *
 * Its job beyond drawing a line: when the type system inserted a conversion on this edge, say
 * so. A graph where `json` quietly becomes `string` somewhere invisible is a graph nobody can
 * debug, and the conversion is exactly where a run tends to fail.
 *
 * The badge shows what the runtime will do, taken from the plan validation produced — not
 * recomputed here, so the editor and the engine cannot describe the same edge differently.
 *
 * It also has to be able to look held. A connection is not part of the selection — React Flow's
 * own edge focus is switched off in `Canvas.tsx`, and for the reason given there — so when `E`
 * walks somebody onto this wire, `is-focused` is the only thing that says which one they are on.
 */

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { useTranslation } from '../i18n';
import { useEditor } from '../store';
import { useCanvasFocus } from './connect-mode';

/** The `canvas.wire.ops.*` key for a conversion op id, so a locale can phrase the operation
 * however it reads best rather than being tied to the runtime's own kebab-case identifier. */
const OP_LABEL_KEYS: Record<string, string> = {
  'to-text': 'canvas.wire.ops.toText',
  'int-to-float': 'canvas.wire.ops.intToFloat',
  'bool-to-int': 'canvas.wire.ops.boolToInt',
  'int-to-bool': 'canvas.wire.ops.intToBool',
  round: 'canvas.wire.ops.round',
  'parse-int': 'canvas.wire.ops.parseInt',
  'parse-float': 'canvas.wire.ops.parseFloat',
  'parse-bool': 'canvas.wire.ops.parseBool',
  'parse-json': 'canvas.wire.ops.parseJson',
  'stringify-json': 'canvas.wire.ops.stringifyJson',
  'encode-json': 'canvas.wire.ops.encodeJson',
  'decode-json': 'canvas.wire.ops.decodeJson',
  'read-bytes': 'canvas.wire.ops.readBytes',
  'write-temp': 'canvas.wire.ops.writeTemp',
  'unwrap-option': 'canvas.wire.ops.unwrapOption',
  map: 'canvas.wire.ops.map',
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
  const focused = useCanvasFocus().edgeId === id;
  const { t } = useTranslation();

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

  const label = plan?.ops
    .map((op) => {
      const key = OP_LABEL_KEYS[op];
      return key ? t(key) : op;
    })
    .join(' · ');

  return (
    <>
      <BaseEdge id={id} path={path} className={focused ? 'is-focused' : undefined} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="wire__badge"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            // Selection — or the keyboard landing on this wire — is the moment somebody is
            // asking "what does this do?".
            data-selected={selected || focused ? 'true' : undefined}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
