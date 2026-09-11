/**
 * Settings and About.
 *
 * Short on purpose. Every setting here does something; there is no section for a feature that
 * is not built, and no toggle that writes a preference nothing reads.
 */

import { useEffect, useState } from 'react';
import { ipc } from '../ipc';
import { useEditor } from '../store';

type Theme = 'dark' | 'light';

const THEME_KEY = 'encastra.theme';

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // A browser with storage disabled still gets the theme for this session.
  }
}

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function Settings() {
  const about = useEditor((s) => s.about);
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <main className="view view--settings">
      <header className="view__header">
        <h1>Settings</h1>
      </header>

      <section className="panel-block">
        <h2>Appearance</h2>
        <div className="field">
          <span className="field__label">Theme</span>
          <fieldset className="library__categories">
            <legend className="visually-hidden">Theme</legend>
            {(['dark', 'light'] as const).map((option) => (
              <button
                type="button"
                key={option}
                className="pill"
                aria-pressed={theme === option}
                onClick={() => setTheme(option)}
              >
                {option}
              </button>
            ))}
          </fieldset>
          <p className="field__doc">
            Motion follows your system setting. With reduced motion on, transitions here are
            switched off entirely rather than merely shortened.
          </p>
        </div>
      </section>

      <section className="panel-block">
        <h2>Data</h2>
        <dl className="kv kv--wide">
          <dt>Projects</dt>
          <dd>
            Kept as <code>.encastra</code> files wherever you save them. The application keeps no
            separate copy and no hidden library.
          </dd>
          <dt>Permissions</dt>
          <dd>Held for this session only, and forgotten when the application closes.</dd>
          <dt>Working files</dt>
          <dd>
            A run writes into a temporary folder that is deleted when it finishes. Results are only
            somewhere you can see them if a component saved them into a folder you allowed.
          </dd>
        </dl>
      </section>

      <section className="panel-block">
        <h2>About</h2>
        <dl className="kv kv--wide">
          <dt>Version</dt>
          <dd>
            <strong>{about?.version ?? 'unknown'}</strong>
          </dd>
          <dt>Runtime</dt>
          <dd>{about?.runtime ?? 'unknown'}</dd>
          <dt>Component protocol</dt>
          <dd>schema {about?.protocolSchema ?? '?'}</dd>
          <dt>Project format</dt>
          <dd>schema {about?.projectSchema ?? '?'}</dd>
          <dt>Attached runtime</dt>
          <dd>{ipc.live ? 'yes' : 'no — this is a browser preview'}</dd>
        </dl>

        <p className="home__note">
          This is a beta. The component protocol, the project format and the permission model are
          the parts meant to last; the sandbox for third-party components, the registry and the
          update channel are not built yet, and nothing in this application pretends otherwise.
        </p>
      </section>
    </main>
  );
}
