import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Canvas } from './canvas/Canvas';
import { ipc, recordedRuns } from './ipc';
import { Inspector } from './panels/Inspector';
import { Palette } from './panels/Palette';
import { useEditor } from './store';

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

function StatusBar() {
  const message = useEditor((s) => s.message);
  const journal = useEditor((s) => s.journal);
  const isRecording = useEditor((s) => s.journalIsRecording);
  const nodeCount = useEditor((s) => s.nodes.length);

  const counts = journal
    ? Object.values(journal.nodes).reduce<Record<string, number>>((acc, record) => {
        acc[record.status] = (acc[record.status] ?? 0) + 1;
        return acc;
      }, {})
    : null;

  return (
    <footer className="statusbar">
      <span>
        {nodeCount} step{nodeCount === 1 ? '' : 's'}
      </span>
      {counts ? (
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

export function App() {
  const loadComponents = useEditor((s) => s.loadComponents);
  const check = useEditor((s) => s.check);
  const run = useEditor((s) => s.run);
  const busy = useEditor((s) => s.busy);
  const nodeCount = useEditor((s) => s.nodes.length);
  const showRecording = useEditor((s) => s.showRecording);
  const newProject = useEditor((s) => s.newProject);
  const openProject = useEditor((s) => s.openProject);
  const saveProject = useEditor((s) => s.saveProject);
  const projectName = useEditor((s) => s.projectName);
  const dirty = useEditor((s) => s.dirty);

  useEffect(() => {
    void loadComponents();
  }, [loadComponents]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        void run();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveProject({ as: event.shiftKey });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        void openProject();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, saveProject, openProject]);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">
          <Mark />
          Encastra
        </span>

        {!ipc.live ? (
          <span className="preview-badge" title="No runtime is attached to this window.">
            preview
          </span>
        ) : (
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
        )}

        <span className="topbar__spacer" />

        {!ipc.live ? (
          // Without a runtime there is nothing to run, so the honest offer is to look at a
          // real journal the engine produced earlier — clearly labelled as a recording.
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
            <button type="button" className="btn" onClick={() => void check()} disabled={busy}>
              Check
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void run()}
              disabled={busy || nodeCount === 0}
              title="Ctrl+Enter"
            >
              {busy ? 'Running…' : 'Run'}
            </button>
          </>
        )}
      </header>

      <Palette />

      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>

      <Inspector />
      <StatusBar />
    </div>
  );
}
