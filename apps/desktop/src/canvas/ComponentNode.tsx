/**
 * A node on the canvas.
 *
 * The ports are tabs, not dots: the same geometry as the mark, because a connection here is a
 * joint between two parts rather than a wire between two terminals. Colour comes from the
 * shared type table, so a new data type gets its colour in the same file that declares how it
 * converts — the palette cannot drift away from the type system.
 *
 * Nothing on a node is told by colour alone. The run state is a coloured bar *and* a glyph, for
 * the same reason a form error is never only red: about one man in twelve cannot tell the green
 * of a finished step from the red of a failed one, and "hover it and read the tooltip" is not an
 * answer for the one thing somebody scans a graph to find.
 */

import { namedTypesIn, tryParseType, typeDef } from '@encastra/protocol';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import type React from 'react';
import { useTranslation } from '../i18n';
import { type EditorNode, useEditor } from '../store';
import type { Port } from '../types';
import { useCanvasFocus } from './connect-mode';

/** The CSS custom property that paints a port of this type. */
function tabColour(type: string): string {
  const parsed = tryParseType(type);
  // A composite takes its element's colour: a list of images is still about images.
  const named = parsed ? namedTypesIn(parsed)[0] : undefined;
  const colour = named ? typeDef(named)?.color : undefined;
  return colour ? `var(--type-${colour})` : 'var(--type-slate)';
}

function PortRow({
  name,
  port,
  side,
  highlight,
}: {
  name: string;
  port: Port;
  side: 'in' | 'out';
  /** Set while a keyboard connection is being made from, or offered to, this exact port. */
  highlight?: 'source' | 'target' | undefined;
}) {
  const label = port.label ?? name;
  // The handle *is* the tab. React Flow's default dot is reset in styles.css so that the
  // thing the user drags and the thing they see are one element, not two that can misalign.
  const tab = { '--tab-colour': tabColour(port.type) } as React.CSSProperties;
  return (
    <div
      className={`port port--${side}`}
      title={`${label}: ${port.type}${port.required ? ' (required)' : ''}${port.doc ? ` — ${port.doc}` : ''}`}
    >
      <Handle
        type={side === 'in' ? 'target' : 'source'}
        position={side === 'in' ? Position.Left : Position.Right}
        id={name}
        className={highlight ? `port__tab is-connect-${highlight}` : 'port__tab'}
        style={tab}
      />
      <span>
        {label}
        {port.required ? (
          <span className="port__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      <span className="port__type">{port.type}</span>
    </div>
  );
}

/**
 * The glyph for a run state, keyed the same way `runPanel.status.*` is.
 *
 * In the message tree rather than written here, like every other character somebody reads: a
 * locale that would rather not use a tick has somewhere to say so. `idle` has no glyph — a
 * graph nobody has run yet should not be covered in punctuation saying so — and the name of the
 * state is what assistive technology gets, since a tick read aloud is not a status.
 */
function StateGlyph({ state }: { state: string }) {
  const { t } = useTranslation();
  if (state === 'idle') return null;
  return (
    <span className="node__glyph" role="img" aria-label={t(`runPanel.status.${state}`)}>
      {t(`canvas.node.glyphs.${state}`)}
    </span>
  );
}

export function ComponentNode({ id, data, selected }: NodeProps<EditorNode>) {
  const manifest = useEditor((s) => s.manifests[data.componentRef]);
  const record = useEditor((s) => s.journal?.nodes[id]);
  // While something is running, the live state is what matters; the journal is the record of
  // what already finished. Preferring the live value is what makes a node show as running.
  const live = useEditor((s) => s.liveNodes[id]);
  // What the keyboard is holding, so the port it is on can show it. See `connect-mode.ts` for
  // why this arrives as a context rather than a prop.
  const focus = useCanvasFocus();
  const { t } = useTranslation();

  if (!manifest) {
    // The graph references something this build does not have. Saying so on the canvas beats
    // rendering an empty box that looks like a bug in the editor.
    return (
      <div className="node is-selected" data-state="failed">
        <span className="node__state" />
        <div className="node__header">
          <StateGlyph state="failed" />
          <span className="node__name">{data.componentRef}</span>
        </div>
        <div className="empty">{t('canvas.node.notInstalled')}</div>
      </div>
    );
  }

  const inputs = Object.entries(manifest.ports.inputs);
  const outputs = Object.entries(manifest.ports.outputs);
  const state = live ?? record?.status ?? 'idle';

  return (
    <div
      // The id is what the canvas points `aria-activedescendant` at, so a screen reader follows
      // the arrow keys to the step they moved to.
      //
      // Deliberately no ARIA role. `option` is only valid inside a listbox and there is no
      // listbox here; `group` maps to `<fieldset>`, which a node is not. Inventing either would
      // be a worse lie to assistive technology than leaving the element unlabelled, and the
      // canvas's live region is what actually announces the selection — "Resize Image, step 2
      // of 3, selected" — which is the part that works.
      id={`node-${id}`}
      className={['node', selected ? 'is-selected' : '', data.disabled ? 'is-disabled' : '']
        .filter(Boolean)
        .join(' ')}
      data-state={state}
    >
      <span className="node__state" aria-hidden="true" />
      <div className="node__header">
        <StateGlyph state={state} />
        <span className="node__name">{data.label ?? manifest.name}</span>
        {record?.duration_ms !== undefined ? (
          <span className="port__type">{record.duration_ms}ms</span>
        ) : null}
      </div>
      <div className="node__ports">
        {inputs.map(([name, port]) => (
          <PortRow
            key={`in-${name}`}
            name={name}
            port={port}
            side="in"
            highlight={focus.to?.node === id && focus.to.port === name ? 'target' : undefined}
          />
        ))}
        {outputs.map(([name, port]) => (
          <PortRow
            key={`out-${name}`}
            name={name}
            port={port}
            side="out"
            highlight={focus.from?.node === id && focus.from.port === name ? 'source' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
