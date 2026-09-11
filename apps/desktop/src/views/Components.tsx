/**
 * The component library.
 *
 * A catalogue that explains itself: what a component is for, what data it takes and gives back,
 * and what it can reach outside the graph — in the same words the permission dialog uses when
 * you actually wire it up, so nothing you learn here contradicts what you are asked to allow
 * later. The other half of a permission statement is what it does *not* reach; for most
 * components in this build, that is everything, and saying so plainly is the more trustworthy
 * half of the sentence.
 */

import { namedTypesIn, tryParseType, typeDef } from '@encastra/protocol';
import { useMemo, useState } from 'react';
import '../components-view.css';
import { useEditor } from '../store';
import type { Capability, ComponentManifest } from '../types';

/** Plain-language verb for a capability this component actually declares. */
const REACH_VERB: Record<string, string> = {
  'fs.read': 'Reads files',
  'fs.write': 'Writes files',
  'net.http': 'Uses the network',
  'system.clipboard': 'Uses the clipboard',
  'system.notify': 'Shows notifications',
};

/**
 * Every kind of authority the broker knows about, in the order worth reading them.
 *
 * Fixed rather than derived from the manifests present, for the same reason the inspector's
 * permission panel fixes it: the point of the list is to say what a component *cannot* do, and
 * a list built only from what components happen to ask for could never contain the one thing
 * none of them asked for.
 */
const REACH_ORDER = ['fs.read', 'fs.write', 'net.http', 'system.clipboard', 'system.notify'];

/** The same wording the inspector's permission dialog uses for "it cannot" — see Inspector.tsx. */
const REACH_CANNOT: Record<string, string> = {
  'fs.read': 'read your files',
  'fs.write': 'write files',
  'net.http': 'use the network',
  'system.clipboard': 'use the clipboard',
  'system.notify': 'show notifications',
};

/** A type's colour always comes from the shared type table, never from a palette of its own. */
function tint(type: string): string {
  const parsed = tryParseType(type);
  const named = parsed ? namedTypesIn(parsed)[0] : undefined;
  const colour = named ? typeDef(named)?.color : undefined;
  return colour ? `var(--type-${colour})` : 'var(--type-slate)';
}

function PortList({
  title,
  ports,
}: {
  title: string;
  ports: [string, { type: string; label?: string }][];
}) {
  if (ports.length === 0) return null;
  return (
    <div className="catalogue__port-group">
      <span className="catalogue__port-label">{title}</span>
      <ul className="catalogue__port-list">
        {ports.map(([name, port]) => (
          <li className="chip" key={name} style={{ borderColor: tint(port.type) }}>
            {port.label ?? name}
            <span className="chip__type">{port.type}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What this component can reach, and — the more trustworthy half — what it cannot. */
function Reach({ capabilities }: { capabilities: Capability[] }) {
  const reach = capabilities.filter((c) => c.scope !== 'input-handles');

  if (reach.length === 0) {
    return (
      <p className="catalogue__safe">
        <span className="catalogue__safe-mark" aria-hidden="true" />
        Reaches nothing outside this workflow
      </p>
    );
  }

  const declared = new Set(reach.map((c) => c.kind));
  const cannot = REACH_ORDER.filter((kind) => !declared.has(kind));

  return (
    <div className="catalogue__reach">
      <span className="catalogue__reach-label">Can reach</span>
      <ul className="catalogue__reach-list">
        {reach.map((capability) => (
          <li key={capability.kind}>
            <span className="catalogue__reach-kind">
              {REACH_VERB[capability.kind] ?? capability.kind}
            </span>
            <span className="catalogue__reach-reason">{capability.reason}</span>
          </li>
        ))}
      </ul>

      {cannot.length > 0 ? (
        <div className="cannot">
          <span className="cannot__label">It cannot</span>
          <ul className="cannot__list">
            {cannot.map((kind) => (
              <li key={kind}>{REACH_CANNOT[kind] ?? kind}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Card({ manifest }: { manifest: ComponentManifest }) {
  const addNode = useEditor((s) => s.addNode);
  const setView = useEditor((s) => s.setView);
  const reference = `${manifest.id}@${manifest.version}`;
  const inputs = Object.entries(manifest.ports.inputs);
  const outputs = Object.entries(manifest.ports.outputs);

  return (
    <article className="catalogue__card">
      <header className="catalogue__card-header">
        <h2 className="catalogue__name">{manifest.name}</h2>
        <span className="catalogue__version">{manifest.version}</span>
      </header>

      {manifest.trigger ? (
        <p className="catalogue__trigger-note">
          <span className="badge">starts a workflow</span> A source of events, not a step — this
          begins a run instead of running inside one.
        </p>
      ) : null}

      <p className="catalogue__description">
        {manifest.description ?? 'This component has not documented what it does.'}
      </p>

      {inputs.length > 0 || outputs.length > 0 ? (
        <div className="catalogue__ports">
          <PortList title="Takes" ports={inputs} />
          <PortList title="Gives" ports={outputs} />
        </div>
      ) : null}

      <Reach capabilities={manifest.capabilities} />

      <footer className="catalogue__footer">
        <code className="catalogue__id">{manifest.id}</code>
        <button
          type="button"
          className="btn"
          onClick={() => {
            addNode(reference, { x: 220, y: 160 });
            setView('builder');
          }}
        >
          Add to canvas
        </button>
      </footer>
    </article>
  );
}

export function Components() {
  const manifests = useEditor((s) => s.manifests);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const all = useMemo(() => Object.values(manifests), [manifests]);
  // Derived from what is actually installed, never stated as a fixed number: the count is a
  // fact about this build, and a build that adds a component should not need this file edited
  // to keep saying the truth.
  const triggerCount = useMemo(() => all.filter((m) => m.trigger).length, [all]);
  const categories = useMemo(
    () => ['all', ...new Set(all.map((m) => m.category ?? 'other'))].sort(),
    [all],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((m) => category === 'all' || (m.category ?? 'other') === category)
      .filter(
        (m) =>
          !needle ||
          m.name.toLowerCase().includes(needle) ||
          m.id.toLowerCase().includes(needle) ||
          (m.description ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [all, category, query]);

  return (
    <main className="view view--library">
      <header className="view__header">
        <h1>Components</h1>
        <p>
          {all.length} installed
          {triggerCount > 0
            ? ` — ${triggerCount} of them start a workflow on their own; the rest run as a step inside one.`
            : '.'}{' '}
          Everything here ships with the application; installing others needs the sandbox for
          third-party code, which is not built yet.
        </p>
      </header>

      <div className="catalogue__filters">
        <input
          className="input"
          type="search"
          placeholder="Search"
          value={query}
          aria-label="Search components"
          onChange={(e) => setQuery(e.target.value)}
        />
        <fieldset className="catalogue__categories">
          <legend className="visually-hidden">Category</legend>
          {categories.map((name) => (
            <button
              type="button"
              key={name}
              className="pill"
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </fieldset>
      </div>

      {shown.length === 0 ? (
        <p className="empty">Nothing matches that.</p>
      ) : (
        <div className="catalogue__grid">
          {shown.map((manifest) => (
            <Card manifest={manifest} key={`${manifest.id}@${manifest.version}`} />
          ))}
        </div>
      )}
    </main>
  );
}
