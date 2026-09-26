/**
 * What somebody has.
 *
 * Three kinds of thing, told apart on the row rather than hidden behind a filter: the projects
 * they made, the ones they took in from somebody else, and the folders they prepared to hand
 * on. All of it is on this machine and none of it is anywhere else — there is no account, no
 * registry and nothing that syncs, and the heading says so rather than leaving somebody to
 * wonder what a "library" is doing in a product with no server behind it.
 *
 * Two things this screen is careful about.
 *
 * **A publisher is never shown as verified.** An imported row says who it *claims* to be and
 * says plainly that nobody checked, because nobody could: there are no accounts to check
 * against. A tick beside a name would be the single most misleading pixel in the product.
 *
 * **Remove is two different acts and asks which one is meant.** For something made here, it is
 * forgetting: the file stays exactly where its author put it, and the row says so. For
 * something imported, Encastra made the copy and may delete it, so it offers both and neither
 * is the default. The confirmation is a second row of buttons in place of the first, not a
 * `window.confirm` — a modal from the browser is not this application speaking.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfirmFocus } from '../a11y/focus';
import { formatDate, selectPlural, useTranslation } from '../i18n';
import { canBeginImport } from '../import-machine';
import { ipc } from '../ipc';
import { arrange, LIBRARY_SORTS, type LibrarySort, mayDeleteCopy } from '../library';
import { useEditor } from '../store';
import type { EntryWithStatus } from '../types';

function Row({ row, onGone }: { row: EntryWithStatus; onGone: () => void }) {
  const openFromLibrary = useEditor((s) => s.openFromLibrary);
  const removeFromLibrary = useEditor((s) => s.removeFromLibrary);
  const busy = useEditor((s) => s.busy);
  const { t, locale } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const focus = useConfirmFocus(confirming);

  // Answering the question closes it (focus goes back to Remove), and a removal that went through
  // then takes the whole row away — Remove included — so the list hands focus on from there.
  const remove = async (deleteCopy: boolean) => {
    setConfirming(false);
    await removeFromLibrary(row, deleteCopy);
    if (!useEditor.getState().library.some((r) => r.entry.id === row.entry.id)) onGone();
  };

  const { entry, status } = row;
  const imported = entry.origin === 'imported';
  const when = entry.lastOpenedMs
    ? t('library.row.opened', { when: formatDate(locale, entry.lastOpenedMs) })
    : t('library.row.added', { when: formatDate(locale, entry.addedAtMs) });

  return (
    <li className={`library__row library__row--${status}`}>
      <div className="library__identity">
        <h2 className="library__name">{entry.name}</h2>
        <span className={`badge library__origin library__origin--${entry.origin}`}>
          {t(`library.origin.${entry.origin}`)}
        </span>
        {status !== 'present' ? (
          <span className={`badge library__status library__status--${status}`}>
            {t(`library.status.${status}.label`)}
          </span>
        ) : null}
      </div>

      {entry.description ? <p className="library__description">{entry.description}</p> : null}

      {status !== 'present' ? (
        <p className="library__explain">{t(`library.status.${status}.detail`)}</p>
      ) : null}

      <dl className="library__facts">
        {entry.version ? (
          <div className="library__fact">
            <dt>{t('library.facts.version')}</dt>
            <dd>{entry.version}</dd>
          </div>
        ) : null}
        {imported && entry.publisher ? (
          <div className="library__fact">
            <dt>{t('library.facts.publisher')}</dt>
            <dd>{t('library.row.publisherClaim', { publisher: entry.publisher })}</dd>
          </div>
        ) : null}
        <div className="library__fact">
          <dt>{t('library.facts.steps')}</dt>
          <dd>
            {t(`library.row.steps.${selectPlural(locale, entry.steps)}`, { count: entry.steps })}
          </dd>
        </div>
        <div className="library__fact">
          <dt>{t('library.facts.when')}</dt>
          <dd>{when}</dd>
        </div>
      </dl>

      {imported ? (
        <div className="library__reach">
          <span className="library__reach-label">
            {entry.capabilities.length === 0
              ? t('library.reach.none')
              : t('library.reach.someLabel')}
          </span>
          {entry.capabilities.length > 0 ? (
            <ul className="library__reach-list">
              {entry.capabilities.map((capability) => (
                <li className="chip" key={capability}>
                  {capability}
                </li>
              ))}
            </ul>
          ) : null}
          <span className="library__reach-note">{t('library.reach.asksEveryRun')}</span>
        </div>
      ) : null}

      {confirming ? (
        <div className="library__confirm">
          <p className="library__confirm-question" tabIndex={-1} ref={focus.question}>
            {imported ? t('library.remove.importedNote') : t('library.remove.keepsFile')}
          </p>
          <div className="library__actions">
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              {t('library.remove.cancel')}
            </button>
            {imported && mayDeleteCopy(entry.origin) ? (
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy}
                onClick={() => void remove(true)}
              >
                {t('library.remove.andDeleteCopy')}
              </button>
            ) : null}
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void remove(false)}
            >
              {imported ? t('library.remove.keepCopy') : t('library.remove.forget')}
            </button>
          </div>
        </div>
      ) : (
        <div className="library__actions">
          <button
            type="button"
            className="btn"
            disabled={busy || status === 'missing' || !ipc.live || entry.origin === 'prepared'}
            title={
              entry.origin === 'prepared'
                ? t('library.preparedNotOpenable')
                : status === 'missing'
                  ? t('library.status.missing.detail')
                  : undefined
            }
            onClick={() => void openFromLibrary(row)}
          >
            {t('library.actions.open')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setConfirming(true)}
            ref={focus.opener}
          >
            {t('library.actions.remove')}
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * The screen with nothing on it, which is the one worth writing.
 *
 * Somebody arriving here for the first time does not need to be told the list is empty — they
 * can see that. What they need is the three ways something gets onto it, and a way to start
 * doing one of them.
 */
function Empty() {
  const setView = useEditor((s) => s.setView);
  const beginImport = useEditor((s) => s.beginImport);
  // The same guard as the toolbar's: this button is on screen at the same time as that one, and
  // a second chooser opening on top of the first is exactly what it prevents.
  const mayImport = useEditor((s) => canBeginImport(s.importState));
  const { t } = useTranslation();

  return (
    <section className="library__empty">
      <h2>{t('library.empty.heading')}</h2>
      <p>{t('library.empty.body')}</p>
      <ul className="library__ways">
        <li>{t('library.empty.ways.created')}</li>
        <li>{t('library.empty.ways.imported')}</li>
        <li>{t('library.empty.ways.prepared')}</li>
      </ul>
      <div className="library__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setView('builder')}
          title={t('library.empty.buildTitle')}
        >
          {t('library.empty.build')}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!ipc.live || !mayImport}
          onClick={() => void beginImport()}
        >
          {t('library.import')}
        </button>
      </div>
    </section>
  );
}

export function Library() {
  const rows = useEditor((s) => s.library);
  const loaded = useEditor((s) => s.libraryLoaded);
  const quarantined = useEditor((s) => s.libraryQuarantined);
  const dismissLibraryNote = useEditor((s) => s.dismissLibraryNote);
  const loadLibrary = useEditor((s) => s.loadLibrary);
  const beginImport = useEditor((s) => s.beginImport);
  // The toolbar's Import button is disabled while an import is already in flight, so a second
  // press cannot open a second native chooser on top of the first. Read from the machine rather
  // than from the general `busy` flag: that one is also true while a graph is being validated,
  // and an import is refused by the store for its own reason, which this mirrors exactly.
  const mayImport = useEditor((s) => canBeginImport(s.importState));
  const busy = useEditor((s) => s.busy);
  const { t, locale } = useTranslation();
  // Where focus goes when the row that held it has been removed: the top of the screen, rather
  // than `<body>`, which a screen reader announces as nothing at all.
  const heading = useRef<HTMLHeadingElement | null>(null);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('recent');

  // Asked for on arrival, every time. Whether a file is still where it was is a question about
  // the filesystem, and somebody who moved a project in Explorer between visits did not tell
  // this application about it.
  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const shown = useMemo(() => arrange(rows, query, sort, locale), [rows, query, sort, locale]);

  return (
    <main className="view view--library">
      <header className="view__header">
        <h1 tabIndex={-1} ref={heading}>
          {t('library.heading')}
        </h1>
        <p>{t('library.intro')}</p>
      </header>

      {quarantined ? (
        <aside className="library__note">
          <p>{t('library.quarantined', { name: quarantined })}</p>
          <button type="button" className="btn" onClick={dismissLibraryNote}>
            {t('common.dismiss')}
          </button>
        </aside>
      ) : null}

      <div className="library__toolbar">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!ipc.live || busy || !mayImport}
          title={ipc.live ? t('library.importTitle') : t('library.importUnavailable')}
          onClick={() => void beginImport()}
        >
          {t('library.import')}
        </button>

        <input
          className="input"
          type="search"
          value={query}
          placeholder={t('library.search.placeholder')}
          aria-label={t('library.search.ariaLabel')}
          onChange={(event) => setQuery(event.target.value)}
        />

        <label className="library__sort">
          <span>{t('library.sort.label')}</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)}>
            {LIBRARY_SORTS.map((value) => (
              <option key={value} value={value}>
                {t(`library.sort.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        // Before the first listing comes back there is nothing to say yet — an empty state
        // shown for a frame and then replaced would read as a flicker, not as teaching.
        loaded ? (
          <Empty />
        ) : null
      ) : (
        <>
          <ul className="library__list">
            {shown.map((row) => (
              <Row row={row} key={row.entry.id} onGone={() => heading.current?.focus()} />
            ))}
          </ul>
          {shown.length === 0 ? <p className="library__none">{t('library.noMatches')}</p> : null}
        </>
      )}
    </main>
  );
}
