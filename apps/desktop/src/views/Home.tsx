/**
 * The first screen.
 *
 * It answers one question — what do I do now — and nothing else. No statistics nobody has
 * earned yet, no activity feed with one entry in it, no cards for features that do not exist.
 */

import { DEMOS } from '../demos';
import { ipc } from '../ipc';
import { useEditor } from '../store';

function Mark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="home__mark">
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

export function Home() {
  const newProject = useEditor((s) => s.newProject);
  const openProject = useEditor((s) => s.openProject);
  const loadDemo = useEditor((s) => s.loadDemo);
  const setView = useEditor((s) => s.setView);
  const manifests = useEditor((s) => s.manifests);
  const projectName = useEditor((s) => s.projectName);
  const projectPath = useEditor((s) => s.projectPath);
  const nodeCount = useEditor((s) => s.nodes.length);

  const installed = Object.keys(manifests).length;

  return (
    <main className="view view--home">
      <header className="home__intro">
        <Mark />
        <div>
          <h1>Build software from parts that fit.</h1>
          <p>
            Put components on a canvas, connect them, and press start. Everything runs on this
            machine, and nothing reaches your files without being asked.
          </p>
        </div>
      </header>

      <section className="home__actions">
        <button
          type="button"
          className="action action--primary"
          onClick={() => {
            newProject();
            setView('builder');
          }}
        >
          <span className="action__title">New workflow</span>
          <span className="action__detail">Start from an empty canvas</span>
        </button>

        <button
          type="button"
          className="action"
          disabled={!ipc.live}
          onClick={() => void openProject()}
        >
          <span className="action__title">Open</span>
          <span className="action__detail">
            {ipc.live ? 'A .encastra file you saved earlier' : 'Needs the desktop application'}
          </span>
        </button>

        <button type="button" className="action" onClick={() => setView('components')}>
          <span className="action__title">Browse components</span>
          <span className="action__detail">{installed} installed, and what each one can reach</span>
        </button>
      </section>

      {nodeCount > 0 ? (
        <section className="home__section">
          <h2>Where you left off</h2>
          <button type="button" className="card" onClick={() => setView('builder')}>
            <span className="card__title">{projectName}</span>
            <span className="card__detail">
              {nodeCount} step{nodeCount === 1 ? '' : 's'}
              {projectPath ? '' : ' · not saved yet'}
            </span>
          </button>
        </section>
      ) : null}

      <section className="home__section">
        <h2>Samples</h2>
        <p className="home__note">
          Real workflows on the real runtime. Each one needs you to choose its folders before it can
          start — a sample that wrote somewhere you had not picked would be the opposite of the
          point.
        </p>
        <div className="home__grid">
          {DEMOS.map((demo) => (
            <button type="button" className="card" key={demo.id} onClick={() => loadDemo(demo)}>
              <span className="card__title">{demo.name}</span>
              <span className="card__detail">{demo.summary}</span>
              <span className="card__needs">Needs: {demo.needs.join(' · ')}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
