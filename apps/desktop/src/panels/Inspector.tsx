/**
 * The inspector, which is also the debugger.
 *
 * When a run has happened, selecting a node shows what went in, what came out, how long it
 * took, which capabilities it used, what it logged, and — if it failed — why, with what to do
 * about it. That is the product's headline feature, and it works because the runtime writes a
 * journal as it goes rather than because anything here reconstructs a story afterwards.
 */

import { Fragment } from 'react';
import { ipc } from '../ipc';
import { useEditor } from '../store';
import type { ComponentManifest, ConfigField, NodeRecord, Snapshot } from '../types';

function ConfigControl({
  nodeId,
  name,
  field,
  value,
}: {
  nodeId: string;
  name: string;
  field: ConfigField;
  value: unknown;
}) {
  const setConfig = useEditor((s) => s.setConfig);
  const label = field.label ?? name;
  const id = `${nodeId}-${name}`;

  const control = () => {
    if (field.choices) {
      return (
        <select
          id={id}
          className="input"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setConfig(nodeId, name, e.target.value)}
        >
          <option value="">Choose…</option>
          {field.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'bool') {
      return (
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => setConfig(nodeId, name, e.target.checked)}
        />
      );
    }

    if (field.type === 'i64' || field.type === 'f64') {
      return (
        <input
          id={id}
          className="input"
          type="number"
          value={typeof value === 'number' ? value : ''}
          min={field.min}
          max={field.max}
          onChange={(e) =>
            setConfig(nodeId, name, e.target.value === '' ? undefined : Number(e.target.value))
          }
        />
      );
    }

    // A folder is still text, but typing a path is not how anybody wants to choose one.
    const looksLikeAPath = name === 'folder' || name === 'directory';
    return (
      <div className="row">
        <input
          id={id}
          className="input"
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setConfig(nodeId, name, e.target.value)}
        />
        {looksLikeAPath && ipc.live ? (
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const chosen = await ipc.pickFolder();
              if (chosen) setConfig(nodeId, name, chosen);
            }}
          >
            Choose…
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {field.required ? <span className="port__required"> *</span> : null}
      </label>
      {control()}
      {field.doc ? <p className="field__doc">{field.doc}</p> : null}
    </div>
  );
}

/** Inputs nothing in the graph produces, which the application has to supply. */
function EntryInputs({ nodeId, manifest }: { nodeId: string; manifest: ComponentManifest }) {
  const edges = useEditor((s) => s.edges);
  const inputs = useEditor((s) => s.inputs);
  const setInput = useEditor((s) => s.setInput);

  const unconnected = Object.entries(manifest.ports.inputs).filter(
    ([port]) => !edges.some((e) => e.target === nodeId && e.targetHandle === port),
  );
  const needingAFile = unconnected.filter(([, port]) =>
    ['file', 'image', 'video', 'audio', 'dir', 'bytes'].includes(port.type),
  );

  if (needingAFile.length === 0) return null;

  return (
    <section className="panel__section">
      <h3 className="panel__group-label">Starting material</h3>
      {needingAFile.map(([port, definition]) => {
        const current = inputs.find((i) => i.node === nodeId && i.port === port);
        return (
          <div className="field" key={port}>
            <span className="field__label">
              {definition.label ?? port} · {definition.type}
            </span>
            <div className="row">
              <input
                className="input"
                type="text"
                readOnly
                value={current?.path ?? ''}
                placeholder="Nothing chosen"
              />
              <button
                type="button"
                className="btn"
                disabled={!ipc.live}
                onClick={async () => {
                  const chosen = await ipc.pickFile();
                  if (chosen) setInput(nodeId, port, chosen);
                }}
              >
                Choose…
              </button>
            </div>
            <p className="field__doc">
              Nothing in the graph produces this, so the run needs it from you.
            </p>
          </div>
        );
      })}
    </section>
  );
}

/** Capabilities that need an answer before this node can run. */
function Permissions({ nodeId, manifest }: { nodeId: string; manifest: ComponentManifest }) {
  const grants = useEditor((s) => s.grants);
  const setGrant = useEditor((s) => s.setGrant);
  const config = useEditor((s) => s.nodes.find((n) => n.id === nodeId)?.data.config);

  const needsAnswer = manifest.capabilities.filter((c) => c.scope !== 'input-handles');
  if (needsAnswer.length === 0) return null;

  return (
    <section className="panel__section">
      <h3 className="panel__group-label">Permissions</h3>
      {needsAnswer.map((capability) => {
        const granted = grants.find((g) => g.node === nodeId && g.kind === capability.kind);
        const folder = typeof config?.folder === 'string' ? config.folder : undefined;

        return (
          <div className="field" key={capability.kind}>
            <span className="field__label">{capability.kind}</span>
            <p className="field__doc">{capability.reason}</p>
            {capability.kind === 'fs.write' ? (
              <div className="row" style={{ marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className={granted ? 'btn' : 'btn btn--primary'}
                  disabled={!folder}
                  onClick={() => {
                    // The button is disabled without a folder, but the type says the grant
                    // must name one — a grant with no scope is an unbounded grant.
                    if (folder) setGrant({ node: nodeId, kind: capability.kind, folder });
                  }}
                >
                  {granted ? 'Allowed' : 'Allow this folder'}
                </button>
                {!folder ? <span className="field__doc">Choose a folder first.</span> : null}
              </div>
            ) : (
              <button
                type="button"
                className={granted ? 'btn' : 'btn btn--primary'}
                style={{ marginTop: 'var(--space-2)' }}
                onClick={() => setGrant({ node: nodeId, kind: capability.kind })}
              >
                {granted ? 'Allowed' : 'Allow'}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

/**
 * Version history.
 *
 * Restoring appends a version equal to the old one rather than rewinding, so the label says
 * what will happen and the entry you came from stays in the list. That is the property that
 * makes people willing to press it.
 */
function Versions({ versions }: { versions: Snapshot[] }) {
  const restoreVersion = useEditor((s) => s.restoreVersion);
  const projectPath = useEditor((s) => s.projectPath);

  if (!projectPath) {
    return (
      <section className="panel__section">
        <h3 className="panel__group-label">Versions</h3>
        <p className="field__doc">
          Save this project to start keeping versions. Every save records one, and nothing is ever
          overwritten.
        </p>
      </section>
    );
  }

  if (versions.length === 0) return null;

  return (
    <section className="panel__section">
      <h3 className="panel__group-label">Versions · {versions.length}</h3>
      {[...versions].reverse().map((snapshot, index) => (
        <button
          type="button"
          className="version"
          key={snapshot.id}
          onClick={() => void restoreVersion(snapshot.id)}
          title={
            index === 0
              ? 'This is the current version.'
              : 'Restore this. It is added as a new version; nothing is lost.'
          }
        >
          <span className="version__label">
            {snapshot.label ?? (index === 0 ? 'Current' : `Version ${versions.length - index}`)}
          </span>
          <span className="version__when">{new Date(snapshot.created_at_ms).toLocaleString()}</span>
          {index === 0 ? null : <span className="version__action">Restore</span>}
        </button>
      ))}
    </section>
  );
}

/** What actually happened, from the run journal. */
function RunRecord({ record }: { record: NodeRecord }) {
  const denied = record.capability_calls.filter((c) => !c.allowed);

  return (
    <section className="panel__section">
      <h3 className="panel__group-label">Last run</h3>

      {record.error ? (
        <div className="note note--error">
          <strong>{record.error.message}</strong>
          {record.error.hint ? <span className="note__hint">{record.error.hint}</span> : null}
          <span className="note__hint">Code: {record.error.code}</span>
        </div>
      ) : null}

      {record.status === 'skipped' && record.skipped_because ? (
        <div className="note note--warn">
          This step never ran, because <strong>{record.skipped_because}</strong> did not finish.
        </div>
      ) : null}

      <dl className="kv">
        <dt>Status</dt>
        <dd>{record.status}</dd>
        {record.duration_ms !== undefined ? (
          <>
            <dt>Took</dt>
            <dd>{record.duration_ms}ms</dd>
          </>
        ) : null}
        {Object.entries(record.inputs).map(([port, summary]) => (
          <Fragment key={`in-${port}`}>
            <dt>in {port}</dt>
            <dd>{summary}</dd>
          </Fragment>
        ))}
        {Object.entries(record.outputs).map(([port, summary]) => (
          <Fragment key={`out-${port}`}>
            <dt>out {port}</dt>
            <dd>{summary}</dd>
          </Fragment>
        ))}
      </dl>

      {record.capability_calls.length > 0 ? (
        <>
          <h3 className="panel__group-label">
            Permissions used{denied.length > 0 ? ` · ${denied.length} refused` : ''}
          </h3>
          <div className="trace">
            {record.capability_calls.map((call) => (
              <div className="trace__line" key={`${call.at_ms}-${call.kind}-${call.detail}`}>
                <span className={call.allowed ? '' : 'trace__denied'}>
                  {call.allowed ? '✓' : '✕'}
                </span>
                <span>{call.kind}</span>
                <span style={{ color: 'var(--ink-faint)' }}>{call.detail}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {record.logs.length > 0 ? (
        <>
          <h3 className="panel__group-label">Logs</h3>
          <div className="trace">
            {record.logs.map((line) => (
              <div className="trace__line" key={`${line.at_ms}-${line.level}-${line.message}`}>
                <span style={{ color: 'var(--ink-faint)' }}>{line.level}</span>
                <span>{line.message}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function Inspector() {
  const selectedNodeId = useEditor((s) => s.selectedNodeId);
  const node = useEditor((s) => s.nodes.find((n) => n.id === s.selectedNodeId));
  const manifest = useEditor((s) => (node ? s.manifests[node.data.componentRef] : undefined));
  const record = useEditor((s) => (selectedNodeId ? s.journal?.nodes[selectedNodeId] : undefined));
  const validation = useEditor((s) => s.validation);
  const toggleDisabled = useEditor((s) => s.toggleDisabled);
  const versions = useEditor((s) => s.versions);

  if (!node || !manifest || !selectedNodeId) {
    const issues = validation?.issues ?? [];
    return (
      <aside className="panel panel--inspector">
        <h2 className="panel__title">{issues.length > 0 ? 'Problems' : 'Project'}</h2>
        <div className="panel__section">
          {issues.length > 0 ? (
            issues.map((issue) => (
              <div
                className={`note note--${issue.severity === 'error' ? 'error' : 'warn'}`}
                key={`${issue.severity}-${JSON.stringify(issue.location)}-${issue.message}`}
              >
                {issue.message}
                {issue.hint ? <span className="note__hint">{issue.hint}</span> : null}
              </div>
            ))
          ) : (
            <p className="empty">Select a step to configure it, or pick a component to begin.</p>
          )}
        </div>
        <Versions versions={versions} />
      </aside>
    );
  }

  const configFields = Object.entries(manifest.config);

  return (
    <aside className="panel panel--inspector">
      <h2 className="panel__title">{manifest.name}</h2>

      <div className="panel__section">
        <dl className="kv">
          <dt>Component</dt>
          <dd>{node.data.componentRef}</dd>
        </dl>
        {manifest.description ? <p className="field__doc">{manifest.description}</p> : null}
        <button
          type="button"
          className="btn"
          style={{ marginTop: 'var(--space-3)' }}
          onClick={() => toggleDisabled(selectedNodeId)}
        >
          {node.data.disabled ? 'Switch on' : 'Switch off'}
        </button>
      </div>

      {record ? <RunRecord record={record} /> : null}

      {configFields.length > 0 ? (
        <section className="panel__section">
          <h3 className="panel__group-label">Settings</h3>
          {configFields.map(([name, field]) => (
            <ConfigControl
              key={name}
              nodeId={selectedNodeId}
              name={name}
              field={field}
              value={node.data.config[name]}
            />
          ))}
        </section>
      ) : null}

      <EntryInputs nodeId={selectedNodeId} manifest={manifest} />
      <Permissions nodeId={selectedNodeId} manifest={manifest} />
    </aside>
  );
}
