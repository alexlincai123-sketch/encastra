/**
 * The application shell.
 *
 * A sidebar, one view at a time, a toolbar that changes with the view, and a status bar that is
 * the same everywhere. The Builder owns its own three-panel layout; nothing else needs one.
 */

import { useEffect } from 'react';
import { ipc, recordedRuns } from './ipc';
import { Welcome } from './onboarding/Welcome';
import { applyToDocument, usePreferences } from './preferences';
import { Sidebar } from './Sidebar';
import { useEditor } from './store';
import { Builder } from './views/Builder';
import { Components } from './views/Components';
import { Home } from './views/Home';
import { Security } from './views/Security';
import { Settings } from './views/Settings';

function Mark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M20 3h7a1.5 1.5 0 0 1 1.5 1.5v16A1.5 1.5 0 0 1 27 22h-7a1.5 1.5 0 0 1-1.5-1.5v-1.4h4.7a1.2 1.2 0 0 0 1.2-1.2v-3.8a1.2 1.2 0 0 0-1.2-1.2h-4.7V4.5A1.5 1.5 0 0 1 20 3Z"
      />
      <path
        fill="currentColor"
        d="M5 10h7a1.5 1.5 0 0 1 1.5 1.5v3.3h8.3a1.2 1.2 0 0 1 1.2 1.2v1a1.2 1.2 0 0 1-1.2 1.2H13.5v9.3A1.5 1.5 0 0 1 12 29H5a1.5 1.5 0 0 1-1.5-1.5v-16A1.5 1.5 0 0 1 5 10Z"
      />
    </svg>
  );
}

function Toolbar() {
  const view = useEditor((s) => s.view);
  const busy = useEditor((s) => s.busy);
  const running = useEditor((s) => s.running);
  const watching = useEditor((s) => s.watching);
  const nodeCount = useEditor((s) => s.nodes.length);
  const projectName = useEditor((s) => s.projectName);
  const dirty = useEditor((s) => s.dirty);
  const nodes = useEditor((s) => s.nodes);
  const manifests = useEditor((s) => s.manifests);

  const newProject = useEditor((s) => s.newProject);
  const openProject = useEditor((s) => s.openProject);
  const saveProject = useEditor((s) => s.saveProject);
  const check = useEditor((s) => s.check);
  const startWorkflow = useEditor((s) => s.startWorkflow);
  const stopWorkflow = useEditor((s) => s.stopWorkflow);
  const showRecording = useEditor((s) => s.showRecording);

  const triggered = nodes.some((node) => manifests[node.data.componentRef]?.trigger === true);

  return (
    <header className="topbar">
      <span className="brand">
        <Mark />
        Encastra
      </span>

      {!ipc.live ? (
        <span className="preview-badge" title="No runtime is attached to this window.">
          preview
        </span>
      ) : null}

      {view === 'builder' && ipc.live ? (
        <>
          <span className="topbar__divider" />
          <button type="button" className="btn" onClick={newProject}>
            New
          </button>
          <button type="button" className="btn" onClick={() => void openProject()} title="Ctrl+O">
            Open
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void saveProject()}
            disabled={busy}
            title="Ctrl+S"
          >
            Save
          </button>
          <span className="project-name">
            {projectName}
            {dirty ? (
              <span className="project-name__dirty" title="Unsaved changes">
                {' '}
                •
              </span>
            ) : null}
          </span>
        </>
      ) : null}

      <span className="topbar__spacer" />

      {view === 'builder' ? (
        !ipc.live ? (
          recordedRuns.map((recorded) => (
            <button
              type="button"
              className="btn"
              key={recorded.label}
              onClick={() => showRecording(recorded.journal, recorded.label)}
            >
              {recorded.label}
            </button>
          ))
        ) : (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => void check()}
              disabled={busy || running}
            >
              Check
            </button>
            {running ? (
              <button type="button" className="btn btn--stop" onClick={() => void stopWorkflow()}>
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void startWorkflow()}
                disabled={busy || nodeCount === 0}
                title="Ctrl+Enter"
              >
                {triggered ? 'Start watching' : 'Run'}
              </button>
            )}
            {watching && running ? (
              <>
                <span className="pulse" aria-hidden="true" />
                <span className="visually-hidden">Watching</span>
              </>
            ) : null}
          </>
        )
      ) : null}
    </header>
  );
}

function StatusBar() {
  const message = useEditor((s) => s.message);
  const journal = useEditor((s) => s.journal);
  const isRecording = useEditor((s) => s.journalIsRecording);
  const nodeCount = useEditor((s) => s.nodes.length);
  const running = useEditor((s) => s.running);
  const runs = useEditor((s) => s.runs);
  const pending = useEditor((s) => s.pending);
  const liveNodes = useEditor((s) => s.liveNodes);

  const counts: Record<string, number> = {};
  const source = Object.keys(liveNodes).length > 0 ? liveNodes : undefined;
  if (source) {
    for (const status of Object.values(source)) counts[status] = (counts[status] ?? 0) + 1;
  } else if (journal) {
    for (const record of Object.values(journal.nodes)) {
      counts[record.status] = (counts[record.status] ?? 0) + 1;
    }
  }

  return (
    <footer className="statusbar">
      <span>
        {nodeCount} step{nodeCount === 1 ? '' : 's'}
      </span>

      {running ? (
        <span className="row">
          <span className="dot dot--running" /> running
          {runs > 0 ? ` · ${runs} run${runs === 1 ? '' : 's'}` : ''}
          {pending > 0 ? ` · ${pending} waiting` : ''}
        </span>
      ) : null}

      {Object.keys(counts).length > 0 ? (
        <span className="row">
          {isRecording ? <span className="preview-badge">recording</span> : null}
          {(['ok', 'failed', 'skipped'] as const).map((status) =>
            counts[status] ? (
              <span className="row" key={status}>
                <span className={`dot dot--${status}`} /> {counts[status]} {status}
              </span>
            ) : null,
          )}
        </span>
      ) : null}

      <span className="topbar__spacer" />
      {message ? (
        <span className={`statusbar__message--${message.tone}`}>{message.text}</span>
      ) : null}
    </footer>
  );
}

/** Notifications a workflow asked for, shown by the part of the application that has a screen. */
function Notifications() {
  const notifications = useEditor((s) => s.notifications);
  const dismiss = useEditor((s) => s.dismissNotifications);

  if (notifications.length === 0) return null;

  return (
    <aside className="toasts" aria-live="polite">
      {notifications.slice(0, 4).map((item) => (
        <button type="button" className="toast" key={item.at} onClick={dismiss}>
          {item.text}
        </button>
      ))}
      {notifications.length > 4 ? (
        <button type="button" className="toast toast--more" onClick={dismiss}>
          {notifications.length - 4} more
        </button>
      ) : null}
    </aside>
  );
}

export function App() {
  const view = useEditor((s) => s.view);
  const loadComponents = useEditor((s) => s.loadComponents);
  const attachRuntime = useEditor((s) => s.attachRuntime);
  const startWorkflow = useEditor((s) => s.startWorkflow);
  const saveProject = useEditor((s) => s.saveProject);
  const openProject = useEditor((s) => s.openProject);

  // Theme and motion live on the document element, where the token file reads them, so they
  // are pushed there whenever the choice changes rather than only at start-up. Subscribing to
  // the two values rather than to the whole store keeps an unrelated preference from
  // re-rendering the shell.
  const theme = usePreferences((p) => p.theme);
  const motion = usePreferences((p) => p.motion);
  useEffect(() => {
    applyToDocument({ theme, motion });
  }, [theme, motion]);

  useEffect(() => {
    void loadComponents();
  }, [loadComponents]);

  useEffect(() => {
    // Subscribing returns a teardown. Keeping it means a hot reload in development does not
    // leave a second set of listeners writing into the same state.
    let off: (() => void) | undefined;
    void attachRuntime().then((teardown) => {
      off = teardown;
    });
    return () => off?.();
  }, [attachRuntime]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key === 'Enter') {
        event.preventDefault();
        void startWorkflow();
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveProject({ as: event.shiftKey });
      }
      if (meta && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void openProject();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startWorkflow, saveProject, openProject]);

  return (
    <div className={`shell shell--${view}`}>
      <Sidebar />
      <Toolbar />

      {/* Before the content, so the tour can outline the panel its current step is about
          without needing the highlight state lifted up here. */}
      <Welcome />

      <div className="content">
        {view === 'home' ? <Home /> : null}
        {view === 'builder' ? <Builder /> : null}
        {view === 'components' ? <Components /> : null}
        {view === 'security' ? <Security /> : null}
        {view === 'settings' ? <Settings /> : null}
      </div>

      <StatusBar />
      <Notifications />
    </div>
  );
}
