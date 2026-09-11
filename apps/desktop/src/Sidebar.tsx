/**
 * Where you are in the application.
 *
 * Five places, not ten. Marketplace and Community are not here because they do not exist, and a
 * navigation item that opens an empty "coming soon" page teaches people that half the
 * application is decoration.
 */

import { useEditor, type View } from './store';

interface Item {
  readonly id: View;
  readonly label: string;
  readonly icon: React.ReactNode;
}

/** Simple geometric glyphs, drawn from the same vocabulary as the mark: blocks and joints. */
const ICONS: Record<View, React.ReactNode> = {
  home: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="12" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="12" width="7" height="7" rx="1.5" />
      <rect x="12" y="12" width="7" height="7" rx="1.5" />
    </>
  ),
  builder: (
    <>
      <rect x="2" y="7" width="6" height="8" rx="1.5" />
      <rect x="14" y="3" width="6" height="8" rx="1.5" />
      <rect x="7" y="9.6" width="8" height="2.8" rx="1.2" />
    </>
  ),
  components: (
    <>
      <rect x="3" y="3" width="16" height="4.5" rx="1.5" />
      <rect x="3" y="9.5" width="16" height="4.5" rx="1.5" />
      <rect x="3" y="16" width="16" height="4.5" rx="1.5" />
    </>
  ),
  security: (
    <path d="M11 2 3.5 5.2v5.3c0 4.6 3.1 8.8 7.5 10 4.4-1.2 7.5-5.4 7.5-10V5.2L11 2Zm0 3 4.5 1.9v3.6c0 3.2-1.9 6.1-4.5 7.1-2.6-1-4.5-3.9-4.5-7.1V6.9L11 5Z" />
  ),
  // Drawn with filled shapes, not strokes: the sidebar renders these with `fill`, and a
  // stroke-based glyph disappears into a dot.
  settings: (
    <>
      <path d="M9.4 2h3.2l.35 2.3a7 7 0 0 1 1.55.9l2.15-.9 1.6 2.77-1.8 1.45a7 7 0 0 1 0 1.16l1.8 1.45-1.6 2.77-2.15-.9a7 7 0 0 1-1.55.9L12.6 20H9.4l-.35-2.3a7 7 0 0 1-1.55-.9l-2.15.9-1.6-2.77 1.8-1.45a7 7 0 0 1 0-1.16L3.75 7.07l1.6-2.77 2.15.9a7 7 0 0 1 1.55-.9L9.4 2Zm1.6 6.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" />
    </>
  ),
};

const ITEMS: Item[] = (
  [
    ['home', 'Home'],
    ['builder', 'Builder'],
    ['components', 'Components'],
    ['security', 'Security'],
    ['settings', 'Settings'],
  ] as const
).map(([id, label]) => ({ id, label, icon: ICONS[id] }));

export function Sidebar() {
  const view = useEditor((s) => s.view);
  const setView = useEditor((s) => s.setView);
  const running = useEditor((s) => s.running);

  return (
    <nav className="sidebar" aria-label="Sections">
      {ITEMS.map((item) => (
        <button
          type="button"
          key={item.id}
          className="sidebar__item"
          aria-current={view === item.id ? 'page' : undefined}
          onClick={() => setView(item.id)}
          title={item.label}
        >
          <svg viewBox="0 0 22 22" fill="currentColor" stroke="none" aria-hidden="true">
            {item.icon}
          </svg>
          <span className="sidebar__label">{item.label}</span>
          {item.id === 'builder' && running ? (
            <span className="visually-hidden">, running</span>
          ) : null}
          {item.id === 'builder' && running ? (
            <span className="sidebar__running" aria-hidden="true" />
          ) : null}
        </button>
      ))}
    </nav>
  );
}
