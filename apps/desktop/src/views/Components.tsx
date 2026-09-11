/**
 * The component library.
 *
 * Every component states what it can reach, in the same words the permission dialog will use.
 * Learning that after a workflow is built is how people end up clicking through dialogs.
 */

import { namedTypesIn, tryParseType, typeDef } from '@encastra/protocol';
import { useMemo, useState } from 'react';
import { useEditor } from '../store';
import type { ComponentManifest } from '../types';

const REACH: Record<string, string> = {
  'fs.read': 'Reads files',
  'fs.write': 'Writes files',
  'net.http': 'Uses the network',
  'system.notify': 'Shows notifications',
  'system.clipboard': 'Uses the clipboard',
};

function tint(type: string): string {
  const parsed = tryParseType(type);
  const named = parsed ? namedTypesIn(parsed)[0] : undefined;
  const colour = named ? typeDef(named)?.color : undefined;
  return colour ? `var(--type-${colour})` : 'var(--type-slate)';
}

function Ports({ manifest }: { manifest: ComponentManifest }) {
  const inputs = Object.entries(manifest.ports.inputs);
  const outputs = Object.entries(manifest.ports.outputs);

  return (
    <div className="library__ports">
      {inputs.length > 0 ? (
        <div>
          <span className="library__ports-label">Takes</span>
          {inputs.map(([name, port]) => (
            <span className="chip" key={name} style={{ borderColor: tint(port.type) }}>
              {port.label ?? name}
              <span className="chip__type">{port.type}</span>
            </span>
          ))}
        </div>
      ) : null}
      {outputs.length > 0 ? (
        <div>
          <span className="library__ports-label">Gives</span>
          {outputs.map(([name, port]) => (
            <span className="chip" key={name} style={{ borderColor: tint(port.type) }}>
              {port.label ?? name}
              <span className="chip__type">{port.type}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Components() {
  const manifests = useEditor((s) => s.manifests);
  const addNode = useEditor((s) => s.addNode);
  const setView = useEditor((s) => s.setView);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const all = useMemo(() => Object.values(manifests), [manifests]);
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
          {all.length} installed. Everything here ships with the application; installing others
          needs the sandbox for third-party code, which is not built yet.
        </p>
      </header>

      <div className="library__filters">
        <input
          className="input"
          type="search"
          placeholder="Search"
          value={query}
          aria-label="Search components"
          onChange={(e) => setQuery(e.target.value)}
        />
        <fieldset className="library__categories">
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
        <div className="library__grid">
          {shown.map((manifest) => {
            const reference = `${manifest.id}@${manifest.version}`;
            const reach = manifest.capabilities.filter((c) => c.scope !== 'input-handles');
            return (
              <article className="library__item" key={reference}>
                <header>
                  <h2>{manifest.name}</h2>
                  {manifest.trigger ? <span className="badge">starts a workflow</span> : null}
                  <span className="library__version">{manifest.version}</span>
                </header>
                {manifest.description ? <p>{manifest.description}</p> : null}

                <Ports manifest={manifest} />

                <div className="library__reach">
                  {reach.length === 0 ? (
                    <span className="library__safe">Reaches nothing outside this workflow</span>
                  ) : (
                    reach.map((capability) => (
                      <span
                        className="library__asks"
                        key={capability.kind}
                        title={capability.reason}
                      >
                        {REACH[capability.kind] ?? capability.kind}
                      </span>
                    ))
                  )}
                </div>

                <footer>
                  <code className="library__id">{manifest.id}</code>
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
          })}
        </div>
      )}
    </main>
  );
}
