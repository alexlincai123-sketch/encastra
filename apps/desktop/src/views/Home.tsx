/**
 * The first screen.
 *
 * It answers one question — what do I do now — and nothing else. No statistics nobody has
 * earned yet, no activity feed with one entry in it, no cards for features that do not exist.
 */

import { DEMOS } from '../demos';
import { selectPlural, useTranslation } from '../i18n';
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
  const { t, locale } = useTranslation();

  const installed = Object.keys(manifests).length;

  return (
    <main className="view view--home">
      <header className="home__intro">
        <Mark />
        <div>
          <h1>{t('home.intro.heading')}</h1>
          <p>{t('home.intro.body')}</p>
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
          <span className="action__title">{t('home.actions.new.title')}</span>
          <span className="action__detail">{t('home.actions.new.detail')}</span>
        </button>

        <button
          type="button"
          className="action"
          disabled={!ipc.live}
          onClick={() => void openProject()}
        >
          <span className="action__title">{t('home.actions.open.title')}</span>
          <span className="action__detail">
            {ipc.live
              ? t('home.actions.open.detailReady')
              : t('home.actions.open.detailUnavailable')}
          </span>
        </button>

        <button type="button" className="action" onClick={() => setView('components')}>
          <span className="action__title">{t('home.actions.browse.title')}</span>
          <span className="action__detail">
            {t(`home.actions.browse.detail.${selectPlural(locale, installed)}`, {
              count: installed,
            })}
          </span>
        </button>
      </section>

      {nodeCount > 0 ? (
        <section className="home__section">
          <h2>{t('home.continue.heading')}</h2>
          <button type="button" className="card" onClick={() => setView('builder')}>
            <span className="card__title">{projectName || t('messages.untitledProject')}</span>
            <span className="card__detail">
              {t(`home.continue.steps.${selectPlural(locale, nodeCount)}`, { count: nodeCount })}
              {projectPath ? '' : t('home.continue.unsaved')}
            </span>
          </button>
        </section>
      ) : null}

      <section className="home__section">
        <h2>{t('home.samples.heading')}</h2>
        <p className="home__note">{t('home.samples.note')}</p>
        <div className="home__grid">
          {DEMOS.map((demo) => (
            <button type="button" className="card" key={demo.id} onClick={() => loadDemo(demo)}>
              <span className="card__title">{t(demo.nameKey)}</span>
              <span className="card__detail">{t(demo.summaryKey)}</span>
              <span className="card__needs">
                {t('home.samples.needs', {
                  list: demo.needsKeys.map((key) => t(key)).join(' · '),
                })}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
