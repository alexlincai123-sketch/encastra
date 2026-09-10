/**
 * The component palette.
 *
 * Components are grouped by category and each one states, up front, what it will ask
 * permission for. Discovering that a component wants network access only when a dialog appears
 * mid-run is how people learn to click through dialogs.
 */

import { useEditor } from '../store';
import type { ComponentManifest } from '../types';

const CAPABILITY_LABELS: Record<string, string> = {
  'fs.read': 'reads files',
  'fs.write': 'writes files',
  'net.http': 'uses the network',
  'system.notify': 'shows notifications',
  'system.clipboard': 'uses the clipboard',
};

/** What this component will ask for beyond what the graph already grants it. */
function asks(manifest: ComponentManifest): string[] {
  return manifest.capabilities
    .filter((c) => c.scope !== 'input-handles')
    .map((c) => CAPABILITY_LABELS[c.kind] ?? c.kind);
}

function PaletteItem({ manifest }: { manifest: ComponentManifest }) {
  const addNode = useEditor((s) => s.addNode);
  const reference = `${manifest.id}@${manifest.version}`;
  const wants = asks(manifest);

  return (
    <button
      type="button"
      className="palette-item"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/encastra-component', reference);
        event.dataTransfer.effectAllowed = 'copy';
      }}
      // Dragging is the natural gesture, but everything on this canvas must also be reachable
      // from the keyboard, so activating the button places the node too.
      onClick={() => addNode(reference, { x: 220, y: 140 })}
      title={`${reference}\n${manifest.description ?? ''}`}
    >
      <span className="palette-item__name">{manifest.name}</span>
      {manifest.description ? (
        <span className="palette-item__desc">{manifest.description}</span>
      ) : null}
      {wants.length > 0 ? (
        <span className="palette-item__needs">Asks to: {wants.join(', ')}</span>
      ) : null}
    </button>
  );
}

export function Palette() {
  const manifests = useEditor((s) => s.manifests);
  const entries = Object.values(manifests);

  if (entries.length === 0) {
    return (
      <aside className="panel panel--palette">
        <h2 className="panel__title">Components</h2>
        <p className="empty">No components are installed.</p>
      </aside>
    );
  }

  const byCategory = new Map<string, ComponentManifest[]>();
  for (const manifest of entries) {
    const category = manifest.category ?? 'other';
    const group = byCategory.get(category) ?? [];
    group.push(manifest);
    byCategory.set(category, group);
  }

  return (
    <aside className="panel panel--palette">
      <h2 className="panel__title">Components</h2>
      <div className="panel__section">
        {[...byCategory.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, group]) => (
            <section key={category}>
              <h3 className="panel__group-label">{category}</h3>
              {group
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((manifest) => (
                  <PaletteItem key={`${manifest.id}@${manifest.version}`} manifest={manifest} />
                ))}
            </section>
          ))}
      </div>
    </aside>
  );
}
