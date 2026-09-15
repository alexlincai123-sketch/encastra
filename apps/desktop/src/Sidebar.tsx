/**
 * Where you are in the application.
 *
 * Six places, not ten. Marketplace and Community are not here because they do not exist, and a
 * navigation item that opens an empty "coming soon" page teaches people that half the
 * application is decoration. Library is here because it does: it lists files on this machine,
 * and it is empty until there is something on this machine to list.
 */

import { useTranslation } from './i18n';
import { useEditor, type View } from './store';

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
  // Blocks on a shelf: the same rectangles the mark is built from, stood on a line, because
  // what this holds is things that were assembled rather than a category of them.
  library: (
    <>
      <rect x="2.5" y="4" width="4.5" height="12" rx="1.5" />
      <rect x="8.75" y="6.5" width="4.5" height="9.5" rx="1.5" />
      <rect x="15" y="2.5" width="4.5" height="13.5" rx="1.5" />
      <rect x="2" y="17.8" width="18" height="2.2" rx="1.1" />
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

/** Sidebar order. Labels come from `sidebar.items.*`, translated at render time so a locale
 * switch updates the labels without touching this order. */
const ITEM_IDS: readonly View[] = [
  'home',
  'builder',
  'library',
  'components',
  'security',
  'settings',
];

export function Sidebar() {
  const view = useEditor((s) => s.view);
  const setView = useEditor((s) => s.setView);
  const running = useEditor((s) => s.running);
  const { t } = useTranslation();

  return (
    <nav className="sidebar" aria-label={t('sidebar.ariaLabel')}>
      {ITEM_IDS.map((id) => {
        const label = t(`sidebar.items.${id}`);
        return (
          <button
            type="button"
            key={id}
            className="sidebar__item"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id)}
            title={label}
          >
            <svg viewBox="0 0 22 22" fill="currentColor" stroke="none" aria-hidden="true">
              {ICONS[id]}
            </svg>
            <span className="sidebar__label">{label}</span>
            {id === 'builder' && running ? (
              <span className="visually-hidden">{t('sidebar.running')}</span>
            ) : null}
            {id === 'builder' && running ? (
              <span className="sidebar__running" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
