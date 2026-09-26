/**
 * The inspector, which is also the debugger.
 *
 * When a run has happened, selecting a node shows what went in, what came out, how long it
 * took, which capabilities it used, what it logged, and — if it failed — why, with what to do
 * about it. That is the product's headline feature, and it works because the runtime writes a
 * journal as it goes rather than because anything here reconstructs a story afterwards.
 */

import { Fragment } from 'react';
import { componentDescription, componentName } from '../component-text';
import { describeNodeError, isKnownNodeError } from '../errors';
import { splitOnPlaceholder, useTranslation } from '../i18n';
import { ipc } from '../ipc';
import { forDisplay } from '../safe-text';
import { useEditor } from '../store';
import type { ComponentManifest, ConfigField, NodeRecord, Snapshot } from '../types';
import { hostOf } from '../url';
import { stepStatusLabel } from './RunPanel';

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
  const chooseConfigFolder = useEditor((s) => s.chooseConfigFolder);
  const { t } = useTranslation();
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
          <option value="">{t('common.choose')}</option>
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
            // Through the store, the way this panel already reports a failed restore: the
            // chooser can refuse — a sensitive root, a startup folder, a path that will not
            // canonicalise — and that refusal used to reject a promise nobody was holding, so
            // pressing Choose appeared to do nothing at all. The sentence lands in the status
            // bar. Backing out of the chooser still says nothing, because nothing was refused.
            onClick={() => void chooseConfigFolder(nodeId, name)}
          >
            {t('common.choose')}
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
  const chooseEntryInput = useEditor((s) => s.chooseEntryInput);
  const { t } = useTranslation();

  const unconnected = Object.entries(manifest.ports.inputs).filter(
    ([port]) => !edges.some((e) => e.target === nodeId && e.targetHandle === port),
  );
  const needingAFile = unconnected.filter(([, port]) =>
    ['file', 'image', 'video', 'audio', 'dir', 'bytes'].includes(port.type),
  );

  if (needingAFile.length === 0) return null;

  return (
    <section className="panel__section">
      <h3 className="panel__group-label">{t('inspector.entryInputs.title')}</h3>
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
                placeholder={t('inspector.nothingChosen')}
              />
              <button
                type="button"
                className="btn"
                disabled={!ipc.live}
                // Same as the folder above: `choose_file` can refuse the file it was handed
                // (`resolve_input_file`), and a rejection with nobody holding it is a button
                // that silently does nothing.
                onClick={() => void chooseEntryInput(nodeId, port)}
              >
                {t('common.choose')}
              </button>
            </div>
            <p className="field__doc">{t('inspector.entryInputs.doc')}</p>
          </div>
        );
      })}
    </section>
  );
}

/**
 * Every kind of authority the broker knows about, in the order they are worth reading.
 *
 * Deliberately a fixed list rather than something derived from the manifests present: the point
 * is to name what a component *cannot* do, and a list built from what components happen to ask
 * for could never contain the thing none of them asked for.
 */
const REACH_ORDER = ['fs.read', 'fs.write', 'net.http', 'system.clipboard', 'system.notify'];

/** The same `components.reach.cannot.*` keys the catalogue card reads for "it cannot" — see
 * `views/Components.tsx`. */
const REACH_LABEL_KEYS: Record<string, string> = {
  'fs.read': 'components.reach.cannot.fsRead',
  'fs.write': 'components.reach.cannot.fsWrite',
  'net.http': 'components.reach.cannot.netHttp',
  'system.clipboard': 'components.reach.cannot.systemClipboard',
  'system.notify': 'components.reach.cannot.systemNotify',
};

/**
 * Capabilities that need an answer before this node can run.
 *
 * Every kind of grant the broker understands has a control here. It used to have one — a
 * folder for `fs.write` — and everything else fell through to a bare "allow", which the broker
 * reads as *no* readable folders and *no* permitted hosts. Fail-closed, so nothing was exposed,
 * but Watch Folder and HTTP Request could not be used from the editor at all.
 */
function Permissions({ nodeId, manifest }: { nodeId: string; manifest: ComponentManifest }) {
  const grants = useEditor((s) => s.grants);
  const setGrant = useEditor((s) => s.setGrant);
  const config = useEditor((s) => s.nodes.find((n) => n.id === nodeId)?.data.config);
  const { t } = useTranslation();

  const needsAnswer = manifest.capabilities.filter((c) => c.scope !== 'input-handles');

  // What it cannot reach, stated rather than left to be inferred from an absence. This is the
  // more trustworthy half of a permission statement: "it needs to write files" is a request,
  // "and it can never touch the network" is the reassurance, and the second one is the reason
  // somebody presses Allow. Derived from the manifest, so a component that later asks for more
  // stops appearing on this list rather than quietly keeping its reputation.
  const declared = new Set(manifest.capabilities.map((c) => c.kind));
  const cannot = REACH_ORDER.filter((kind) => !declared.has(kind));

  if (needsAnswer.length === 0) {
    return (
      <section className="panel__section">
        <h3 className="panel__group-label">{t('inspector.permissions.title')}</h3>
        <p className="field__doc">{t('inspector.permissions.none')}</p>
      </section>
    );
  }

  // Both of these arrive verbatim from the project file, which somebody else may have written,
  // and both are rendered back to the person as the thing they are agreeing to. Cleaned before
  // either use — and cleaned once, so the string on the button and the string in the grant are
  // the same string. See `safe-text`.
  const folder = typeof config?.folder === 'string' ? forDisplay(config.folder.trim()) : '';
  // The host is taken from the address on the node, so allowing is about the place the person
  // actually typed rather than a second field they have to keep in step with it.
  const host = forDisplay(hostOf(typeof config?.url === 'string' ? config.url : ''));

  return (
    <section className="panel__section">
      <h3 className="panel__group-label">{t('inspector.permissions.title')}</h3>
      {needsAnswer.map((capability) => {
        const wantsFolder = capability.kind === 'fs.read' || capability.kind === 'fs.write';
        const wantsHost = capability.kind === 'net.http';
        const existing = grants.find((g) => g.node === nodeId && g.kind === capability.kind);
        // A grant is an answer about a value, not merely about a node and a capability. If the
        // folder or the address on the node has changed since it was given, the old answer is not
        // an answer to the question now on screen — so the button goes back to asking, rather
        // than reading "Allowed" while the scope it would send is one the node no longer names.
        const granted =
          existing &&
          (wantsFolder
            ? existing.folder === folder
            : wantsHost
              ? (existing.hosts ?? []).join(',') === host
              : true)
            ? existing
            : undefined;

        return (
          <div className="field" key={capability.kind}>
            <span className="field__label">{capability.kind}</span>
            <p className="field__doc">{capability.reason}</p>

            {wantsFolder ? (
              <div className="row" style={{ marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className={granted ? 'btn' : 'btn btn--primary'}
                  disabled={!folder}
                  onClick={() => {
                    // The button is disabled without a folder, but the type insists a grant
                    // names one: a grant with no scope is an unbounded grant.
                    if (folder) setGrant({ node: nodeId, kind: capability.kind, folder });
                  }}
                >
                  {granted
                    ? t('inspector.permissions.allowed')
                    : t('inspector.permissions.allowFolder')}
                </button>
                {folder ? (
                  <span className="field__doc">{granted?.folder ?? folder}</span>
                ) : (
                  <span className="field__doc">{t('inspector.permissions.chooseFolderFirst')}</span>
                )}
              </div>
            ) : wantsHost ? (
              <div className="row" style={{ marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className={granted ? 'btn' : 'btn btn--primary'}
                  disabled={!host}
                  onClick={() => {
                    if (host) setGrant({ node: nodeId, kind: capability.kind, hosts: [host] });
                  }}
                >
                  {granted
                    ? t('inspector.permissions.allowed')
                    : host
                      ? t('inspector.permissions.allowHost', { host })
                      : t('inspector.permissions.allowAddress')}
                </button>
                {host ? (
                  <span className="field__doc">{(granted?.hosts ?? [host]).join(', ')}</span>
                ) : (
                  <span className="field__doc">{t('inspector.permissions.enterAddressFirst')}</span>
                )}
              </div>
            ) : (
              <button
                type="button"
                className={granted ? 'btn' : 'btn btn--primary'}
                style={{ marginTop: 'var(--space-2)' }}
                onClick={() => setGrant({ node: nodeId, kind: capability.kind })}
              >
                {granted ? t('inspector.permissions.allowed') : t('inspector.permissions.allow')}
              </button>
            )}
          </div>
        );
      })}

      {/* How long an answer lasts, said once under the controls rather than on each of them.
          "Allow this folder" reads like a permanent decision and is not one: a grant is held
          for the project that is open, sent with every run of it, and dropped the moment a new
          project, another project or a sample replaces the canvas. Somebody deciding whether to
          press Allow is deciding about a scope, and the scope was the one thing the buttons
          never stated. */}
      <p className="field__doc">{t('inspector.permissions.scope')}</p>

      {cannot.length > 0 ? (
        <div className="cannot">
          <span className="cannot__label">{t('common.itCannot')}</span>
          <ul className="cannot__list">
            {cannot.map((kind) => {
              const key = REACH_LABEL_KEYS[kind];
              return <li key={kind}>{key ? t(key) : kind}</li>;
            })}
          </ul>
          <p className="field__doc">{t('inspector.permissions.notASetting')}</p>
        </div>
      ) : null}
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
  const { t } = useTranslation();

  if (!projectPath) {
    return (
      <section className="panel__section">
        <h3 className="panel__group-label">{t('inspector.versions.title')}</h3>
        <p className="field__doc">{t('inspector.versions.empty')}</p>
      </section>
    );
  }

  if (versions.length === 0) return null;

  return (
    <section className="panel__section">
      <h3 className="panel__group-label">
        {t('inspector.versions.titleWithCount', { count: versions.length })}
      </h3>
      {[...versions].reverse().map((snapshot, index) => (
        <button
          type="button"
          className="version"
          key={snapshot.id}
          onClick={() => void restoreVersion(snapshot.id)}
          title={
            index === 0
              ? t('inspector.versions.currentVersionTitle')
              : t('inspector.versions.restoreTitle')
          }
        >
          <span className="version__label">
            {snapshot.label ??
              (index === 0
                ? t('inspector.versions.current')
                : t('inspector.versions.versionNumber', { number: versions.length - index }))}
          </span>
          <span className="version__when">{new Date(snapshot.created_at_ms).toLocaleString()}</span>
          {index === 0 ? null : (
            <span className="version__action">{t('inspector.versions.restore')}</span>
          )}
        </button>
      ))}
    </section>
  );
}

/** What actually happened, from the run journal. */
function RunRecord({ record }: { record: NodeRecord }) {
  const denied = record.capability_calls.filter((c) => !c.allowed);
  const { t } = useTranslation();

  // Split around `{name}` once, the same way `canvas/Canvas.tsx` splits its own refusal sentence
  // — see `i18n/index.ts` — so the skipped step's name can sit in its own `<strong>`. Called
  // with no `vars`, `t()` leaves `{name}` untouched for `splitOnPlaceholder` to find.
  const [neverRanBefore, neverRanAfter] = splitOnPlaceholder(
    t('inspector.runRecord.neverRan'),
    'name',
  );

  return (
    <section className="panel__section">
      <h3 className="panel__group-label">{t('inspector.runRecord.title')}</h3>

      {record.error ? (
        // The sentence comes from the journal's `code`, in the reader's language. The runtime's
        // English `hint` is shown only for a code this build has no sentence for — a component
        // with a vocabulary of its own — because then its own words are the only ones anybody
        // has. For a code that is known, the advice the hint carried is inside the translated
        // sentence instead. The `code` itself stays on show underneath either way: it is what a
        // bug report is filed with, and it is the same word in every language.
        <div className="note note--error">
          <strong>{describeNodeError(record.error, t)}</strong>
          {!isKnownNodeError(record.error) && record.error.hint ? (
            <span className="note__hint">{record.error.hint}</span>
          ) : null}
          <span className="note__hint">
            {t('inspector.runRecord.code', { code: record.error.code })}
          </span>
        </div>
      ) : null}

      {record.status === 'skipped' && record.skipped_because ? (
        <div className="note note--warn">
          {neverRanBefore}
          <strong>{record.skipped_because}</strong>
          {neverRanAfter}
        </div>
      ) : null}

      <dl className="kv">
        <dt>{t('inspector.runRecord.status')}</dt>
        <dd>{stepStatusLabel(record.status)}</dd>
        {record.duration_ms !== undefined ? (
          <>
            <dt>{t('inspector.runRecord.took')}</dt>
            <dd>{record.duration_ms}ms</dd>
          </>
        ) : null}
        {Object.entries(record.inputs).map(([port, summary]) => (
          <Fragment key={`in-${port}`}>
            <dt>{t('inspector.runRecord.in', { port })}</dt>
            <dd>{summary}</dd>
          </Fragment>
        ))}
        {Object.entries(record.outputs).map(([port, summary]) => (
          <Fragment key={`out-${port}`}>
            <dt>{t('inspector.runRecord.out', { port })}</dt>
            <dd>{summary}</dd>
          </Fragment>
        ))}
      </dl>

      {record.capability_calls.length > 0 ? (
        <>
          <h3 className="panel__group-label">
            {t('inspector.runRecord.permissionsUsed')}
            {denied.length > 0 ? t('inspector.runRecord.refused', { count: denied.length }) : ''}
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
          <h3 className="panel__group-label">{t('inspector.runRecord.logs')}</h3>
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
  const { t } = useTranslation();

  if (!node || !manifest || !selectedNodeId) {
    const issues = validation?.issues ?? [];
    return (
      <aside className="panel panel--inspector">
        <h2 className="panel__title">
          {issues.length > 0 ? t('inspector.problemsTitle') : t('inspector.projectTitle')}
        </h2>
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
            <p className="empty">{t('inspector.selectStep')}</p>
          )}
        </div>
        <Versions versions={versions} />
      </aside>
    );
  }

  const configFields = Object.entries(manifest.config);

  return (
    <aside className="panel panel--inspector">
      <h2 className="panel__title">{componentName(manifest)}</h2>

      <div className="panel__section">
        <dl className="kv">
          <dt>{t('inspector.component')}</dt>
          <dd>{node.data.componentRef}</dd>
        </dl>
        {componentDescription(manifest) ? (
          <p className="field__doc">{componentDescription(manifest)}</p>
        ) : null}
        <button
          type="button"
          className="btn"
          style={{ marginTop: 'var(--space-3)' }}
          onClick={() => toggleDisabled(selectedNodeId)}
        >
          {node.data.disabled ? t('inspector.switchOn') : t('inspector.switchOff')}
        </button>
      </div>

      {record ? <RunRecord record={record} /> : null}

      {configFields.length > 0 ? (
        <section className="panel__section">
          <h3 className="panel__group-label">{t('inspector.settingsTitle')}</h3>
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
