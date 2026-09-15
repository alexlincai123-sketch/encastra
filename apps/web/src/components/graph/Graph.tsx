import type { ReactNode } from 'react';
import type { Locale } from '@/lib/i18n/locale';
import { t } from '@/lib/i18n/translate';

import styles from './Graph.module.css';

/**
 * The node-and-wire visual language, rebuilt as real elements.
 *
 * Nothing here is a screenshot. The geometry is taken from the application's own stylesheet
 * (`apps/desktop/src/styles.css`): a tight card with a hairline border, a header, and ports
 * drawn as rectangular tabs that break the card's edge — the joint from the mark, not a dot on
 * a wire. Port colour comes from the type's `color` name in
 * `packages/protocol/data/type-graph.json`, through the same `--type-*` tokens the editor uses.
 *
 * Building it rather than faking it means the page is responsive, selectable, translatable and
 * legible to a screen reader, and it cannot drift from the product by being an old picture.
 */

/** Colour names as declared in the type graph. */
const TYPE_COLOUR: Record<string, string> = {
  bool: 'var(--type-amber)',
  i64: 'var(--type-blue)',
  f64: 'var(--type-blue)',
  string: 'var(--type-green)',
  json: 'var(--type-violet)',
  file: 'var(--type-slate)',
  dir: 'var(--type-slate)',
  bytes: 'var(--type-slate)',
  image: 'var(--type-pink)',
  video: 'var(--type-orange)',
  audio: 'var(--type-orange)',
};

export function typeColour(type: string): string {
  return TYPE_COLOUR[type] ?? 'var(--type-slate)';
}

export type NodeState = 'idle' | 'running' | 'ok' | 'failed' | 'skipped';

export interface GraphPort {
  readonly label: string;
  readonly type: string;
  readonly required?: boolean;
}

export interface GraphNodeSpec {
  readonly id: string;
  readonly name: string;
  /** Shown under the name. The component reference, or what the step is for. */
  readonly note?: string;
  readonly inputs?: readonly GraphPort[];
  readonly outputs?: readonly GraphPort[];
  /** A capability the step needs, rendered as the editor's permission chip. */
  readonly permission?: string;
}

/* -------------------------------------------------------------------------------------------
 * A single node
 * ---------------------------------------------------------------------------------------- */

export function GraphNode({
  node,
  state = 'idle',
  highlighted = false,
  locale = 'en',
}: {
  node: GraphNodeSpec;
  state?: NodeState;
  highlighted?: boolean;
  locale?: Locale;
}): ReactNode {
  const inputs = node.inputs ?? [];
  const outputs = node.outputs ?? [];

  return (
    <figure
      className={styles.node}
      data-state={state}
      data-highlighted={highlighted ? 'true' : 'false'}
    >
      <span className={styles.nodeState} aria-hidden="true" />
      <figcaption className={styles.nodeHeader}>
        <span className={styles.nodeName}>{node.name}</span>
        {state !== 'idle' ? (
          <span className={styles.nodeStateLabel} data-state={state}>
            {t(locale, `graph.state.${state}`)}
          </span>
        ) : null}
      </figcaption>

      {node.note !== undefined ? <p className={styles.nodeNote}>{node.note}</p> : null}

      {inputs.length > 0 || outputs.length > 0 ? (
        <div className={styles.ports}>
          {inputs.map((port) => (
            <Port key={`in-${port.label}`} port={port} direction="in" locale={locale} />
          ))}
          {outputs.map((port) => (
            <Port key={`out-${port.label}`} port={port} direction="out" locale={locale} />
          ))}
        </div>
      ) : null}

      {node.permission !== undefined ? (
        <p className={styles.permission}>
          <span className={styles.permissionKey}>{node.permission}</span>
          <span className={styles.permissionNote}>{t(locale, 'graph.needsPermission')}</span>
        </p>
      ) : null}
    </figure>
  );
}

function Port({
  port,
  direction,
  locale,
}: {
  port: GraphPort;
  direction: 'in' | 'out';
  locale: Locale;
}): ReactNode {
  return (
    <span className={styles.port} data-direction={direction}>
      <span
        className={styles.portTab}
        style={{ background: typeColour(port.type) }}
        aria-hidden="true"
      />
      <span className={styles.portLabel}>
        {port.label}
        {port.required === true ? (
          <>
            <span className={styles.portRequired} aria-hidden="true">
              *
            </span>
            {/* The asterisk beside it is decorative; this is the same fact in words, for a
                reader who never sees it. Written as one interpolated string rather than text
                around a `{t(...)}` so the leading space survives whatever the formatter
                decides to do with the line. */}
            <span className="visually-hidden">{` (${t(locale, 'graph.required')})`}</span>
          </>
        ) : null}
      </span>
      <span className={styles.portType} style={{ color: typeColour(port.type) }}>
        {port.type}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------------------------
 * The wire between two nodes
 *
 * Horizontal on a wide screen, vertical once the flow stacks. Both are the same element: the
 * orientation is a CSS decision, so a narrow screen gets a real diagram rather than a
 * horizontally-scrolling one.
 * ---------------------------------------------------------------------------------------- */

export function Wire({
  type,
  label,
  active = false,
  refused = false,
  joined = true,
}: {
  type?: string;
  /** What travels along the wire, e.g. `IMAGE → IMAGE`. */
  label?: string;
  active?: boolean;
  /**
   * The editor refused this connection outright — no coercion exists between the two types, in
   * either direction. Distinct from `active`: a refused wire never carries a value, so it is
   * never "active" in the sense a completed edge is.
   */
  refused?: boolean;
  /**
   * Whether this connection has been made yet.
   *
   * Distinct from `active`, which is about a value travelling an existing wire. A wire that is
   * not `joined` has not been drawn at all — it is the state between placing two steps and
   * connecting them, which is what the terminal's transcript walks through one command at a
   * time. The retraction is a transform on the line, so an unjoined wire still occupies its
   * place in the layout and the diagram does not reflow as connections are made.
   */
  joined?: boolean;
}): ReactNode {
  const colour = refused ? 'var(--danger)' : type !== undefined ? typeColour(type) : 'var(--edge)';
  const lit = active || refused;
  return (
    <div
      className={styles.wire}
      data-active={active ? 'true' : 'false'}
      data-refused={refused ? 'true' : 'false'}
      data-joined={joined ? 'true' : 'false'}
      aria-hidden="true"
    >
      <span className={styles.wireLine} style={lit ? { background: colour } : undefined} />
      {label !== undefined ? (
        <span
          className={styles.wireBadge}
          style={lit ? { borderColor: colour, ...(refused ? { color: colour } : {}) } : undefined}
        >
          {label}
        </span>
      ) : null}
      <span className={styles.wireHead} style={lit ? { borderLeftColor: colour } : undefined} />
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
 * A flow
 * ---------------------------------------------------------------------------------------- */

export interface FlowStep {
  readonly node: GraphNodeSpec;
  /** The wire arriving at this step. Omitted on the first. */
  readonly wire?: { readonly type?: string; readonly label?: string };
}

/**
 * `activeIndex` lights the flow up to and including that step, which is how the terminal demo
 * keeps the diagram in step with the transcript. `-1` leaves the whole thing at rest.
 */
export function GraphFlow({
  steps,
  activeIndex = -1,
  states,
  caption,
  dense = false,
  presentCount,
  wiredCount,
  locale = 'en',
}: {
  steps: readonly FlowStep[];
  activeIndex?: number;
  states?: Readonly<Record<string, NodeState>>;
  caption?: string;
  dense?: boolean;
  /**
   * How many steps have been placed. Omit for a finished diagram, which is what every static
   * use of this component wants; the terminal passes a rising count so a step appears on the
   * command that adds it rather than being there before it was asked for.
   */
  presentCount?: number;
  /** How many connections have been made. A wire at index `i` is joined once this reaches `i`. */
  wiredCount?: number;
  locale?: Locale;
}): ReactNode {
  // Defaulting to "all of them" is what keeps every existing caller a finished diagram, and it
  // is also what makes the reduced-motion path correct for free: the terminal shows its whole
  // transcript at once for those visitors, so every add and every connect has already counted.
  const present = presentCount ?? steps.length;
  const wired = wiredCount ?? steps.length;
  return (
    <div className={styles.flowWrap}>
      <ol className={styles.flow} data-dense={dense ? 'true' : 'false'}>
        {steps.map((step, index) => (
          <li
            className={styles.flowItem}
            key={step.node.id}
            data-present={index < present ? 'true' : 'false'}
          >
            {step.wire !== undefined ? (
              <Wire
                {...(step.wire.type !== undefined ? { type: step.wire.type } : {})}
                {...(step.wire.label !== undefined ? { label: step.wire.label } : {})}
                active={activeIndex >= index}
                joined={wired >= index}
              />
            ) : null}
            <GraphNode
              node={step.node}
              state={states?.[step.node.id] ?? 'idle'}
              highlighted={activeIndex >= index}
              locale={locale}
            />
          </li>
        ))}
      </ol>
      {caption !== undefined ? <p className={styles.flowCaption}>{caption}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------
 * A flow that branches
 *
 * Only one shape is needed — a router with two destinations — and it is the File Organiser
 * template. Rather than build a general layout engine for one diagram, this renders the trunk
 * and then the two arms.
 * ---------------------------------------------------------------------------------------- */

export function GraphBranch({
  trunk,
  arms,
  caption,
  locale = 'en',
}: {
  trunk: readonly FlowStep[];
  arms: readonly FlowStep[];
  caption?: string;
  locale?: Locale;
}): ReactNode {
  return (
    <div className={styles.flowWrap}>
      <ol className={styles.flow}>
        {trunk.map((step) => (
          <li className={styles.flowItem} key={step.node.id}>
            {step.wire !== undefined ? (
              <Wire
                {...(step.wire.type !== undefined ? { type: step.wire.type } : {})}
                {...(step.wire.label !== undefined ? { label: step.wire.label } : {})}
              />
            ) : null}
            <GraphNode node={step.node} locale={locale} />
          </li>
        ))}
        <li className={styles.flowItem}>
          <Wire label={t(locale, 'graph.routesTo')} />
          <ul className={styles.arms}>
            {arms.map((arm) => (
              <li key={arm.node.id}>
                <GraphNode node={arm.node} locale={locale} />
              </li>
            ))}
          </ul>
        </li>
      </ol>
      {caption !== undefined ? <p className={styles.flowCaption}>{caption}</p> : null}
    </div>
  );
}
