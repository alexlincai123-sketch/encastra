/**
 * Preparing a publication.
 *
 * There is no registry, no account and nowhere to upload to, and this panel does not pretend
 * otherwise. What it does is the part that is real today: it asks the runtime to read the saved
 * project the way somebody receiving it would, shows what that found, and — only if nothing
 * blocking was found — writes the project and the document that would travel with it into a
 * folder of their choosing.
 *
 * The refusal shown here is not the refusal that counts. `prepare_publication` reviews the
 * project again on the other side of the bridge, and its answer is the one that decides; this
 * panel exists so that somebody sees the findings while they can still act on them, not so
 * that a button can be enabled.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from '../a11y/focus';
import { chooseFolderOrExplain } from '../chooser';
import { useTranslation } from '../i18n';
import { ipc } from '../ipc';
import { type DraftFields, draftProblems, listingId } from '../publish';
import { useEditor } from '../store';
import type { Prepared, PublicationDraft, PublicationFinding, PublicationReview } from '../types';

/** The licences the runtime can name. Anything else is somebody's own terms. */
const LICENCES = ['mit', 'apache-2.0', 'gpl-3.0-only', 'proprietary'] as const;
type LicenceId = (typeof LICENCES)[number];

const SEVERITY_ORDER: PublicationFinding['severity'][] = ['blocking', 'warning', 'note'];

export function Publish() {
  const open = useEditor((s) => s.publishOpen);
  const setOpen = useEditor((s) => s.setPublishOpen);
  const projectPath = useEditor((s) => s.projectPath);
  const projectName = useEditor((s) => s.projectName);
  const dirty = useEditor((s) => s.dirty);
  const { t } = useTranslation();

  const ids = useId();
  const panel = useRef<HTMLDivElement | null>(null);
  const [fields, setFields] = useState<DraftFields>({
    namespace: '',
    title: '',
    summary: '',
    version: '1.0.0',
  });
  const [kind, setKind] = useState<PublicationDraft['kind']>('project');
  const [licence, setLicence] = useState<LicenceId>('mit');
  const [review, setReview] = useState<PublicationReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);

  // Focus moves into the panel rather than into its first box: a dialog that lands on a text
  // field reads its label to a screen reader and never reads the two sentences above it saying
  // what this does and what it will not do.
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);
  // And stays there: `aria-modal="true"` below says Tab cannot leave, and this is what makes that
  // true. Closing hands focus back to the button that opened the panel.
  useFocusTrap(panel, open);

  // The title starts as the project's own name, because it almost always is.
  useEffect(() => {
    if (open) {
      setFields((f) => (f.title ? f : { ...f, title: projectName }));
      setPrepared(null);
      setError(null);
    }
  }, [open, projectName]);

  const check = useCallback(async () => {
    if (!projectPath) return;
    setBusy(true);
    setError(null);
    try {
      setReview(await ipc.reviewPublication(projectPath, { id: licence }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setReview(null);
    } finally {
      setBusy(false);
    }
  }, [projectPath, licence]);

  // The licence changes which parts may be carried, so the answer changes with it.
  useEffect(() => {
    if (open && projectPath && !dirty) void check();
  }, [open, projectPath, dirty, check]);

  if (!open) return null;

  const problems = draftProblems(fields);
  const id = listingId(fields.namespace.trim(), fields.title);
  const blocking = review?.findings.filter((f) => f.severity === 'blocking') ?? [];
  const ready =
    Boolean(projectPath) &&
    !dirty &&
    problems.length === 0 &&
    review !== null &&
    blocking.length === 0;

  const prepare = async () => {
    if (!projectPath) return;
    // Chosen to publish *into*. `prepare_publication` checks that exact pair before it writes
    // anything, so a folder picked elsewhere in the session — to import from, or browsed for in
    // Settings — is not somewhere this can land.
    //
    // The chooser can refuse, and that refusal used to reject here — outside the `try` below, so
    // nothing caught it and the panel showed nothing at all. It goes to the same error line every
    // other failure in this panel uses. Busy stays off while the chooser is up, as it always was:
    // there is nothing in flight to report until a folder exists.
    const into = await chooseFolderOrExplain('publish-into', setError);
    if (!into) return;
    setBusy(true);
    setError(null);
    try {
      const draft: PublicationDraft = {
        listing_id: id,
        kind,
        version: fields.version.trim(),
        title: fields.title.trim(),
        summary: fields.summary.trim(),
        categories: [],
        tags: [],
        license: { id: licence },
        // Free, and only free. There is no payment provider, so a price is a number nothing
        // could ever charge — and a price field that cannot take money is a promise.
        pricing: { kind: 'free' },
      };
      const publisher = {
        id: fields.namespace.trim(),
        display_name: fields.namespace.trim(),
        // Nobody checked this. There are no accounts to check it against.
        verified: false,
      };
      setPrepared(await ipc.preparePublication(projectPath, draft, publisher, into));
      // The runtime has just recorded the folder in the library. Re-listing is how this side
      // finds out, rather than editing its own copy and hoping the two agree.
      await useEditor.getState().loadLibrary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const problemFor = (field: keyof DraftFields) =>
    problems.find((p) => p.field === field)?.key ?? null;

  const field = (name: keyof DraftFields, type: 'text' | 'textarea') => {
    const problem = problemFor(name);
    const inputId = `${ids}-${name}`;
    const common = {
      id: inputId,
      value: fields[name],
      'aria-describedby': problem ? `${inputId}-problem` : undefined,
      'aria-invalid': problem ? true : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setFields((f) => ({ ...f, [name]: event.target.value })),
    };
    return (
      <div className="publish__field">
        <label htmlFor={inputId}>{t(`publish.fields.${name}.label`)}</label>
        {type === 'textarea' ? (
          <textarea {...common} rows={3} />
        ) : (
          <input {...common} type="text" spellCheck={false} />
        )}
        <p className="publish__hint">{t(`publish.fields.${name}.hint`)}</p>
        {problem ? (
          <p className="publish__problem" id={`${inputId}-problem`}>
            {t(problem)}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="publish">
      {/* The dialog is the panel, not the shade behind it: the thing that owns Escape and the
          thing a screen reader announces should be one element, not two. */}
      <div
        className="publish__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-heading`}
        ref={panel}
        tabIndex={-1}
        onKeyDown={(event) => {
          // Escape closes it. Nothing here is written until Prepare is pressed, so leaving
          // costs nothing and having no way out of a dialog costs a great deal.
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <header className="publish__header">
          <h2 id={`${ids}-heading`}>{t('publish.heading')}</h2>
          <p>{t('publish.intro')}</p>
        </header>

        {!projectPath || dirty ? (
          <p className="publish__blocked">
            {!projectPath ? t('publish.saveFirst') : t('publish.saveChangesFirst')}
          </p>
        ) : null}

        <div className="publish__body">
          <section className="publish__section">
            <h3>{t('publish.sections.about')}</h3>
            {field('title', 'text')}
            {field('summary', 'textarea')}
            {field('namespace', 'text')}
            {field('version', 'text')}
            {id ? (
              <p className="publish__derived">
                {t('publish.derivedName')} <code>{id}</code>
              </p>
            ) : null}

            <div className="publish__field">
              <label htmlFor={`${ids}-kind`}>{t('publish.fields.kind.label')}</label>
              <select
                id={`${ids}-kind`}
                value={kind}
                onChange={(event) => setKind(event.target.value as PublicationDraft['kind'])}
              >
                <option value="project">{t('publish.kinds.project')}</option>
                <option value="template">{t('publish.kinds.template')}</option>
              </select>
              <p className="publish__hint">{t('publish.fields.kind.hint')}</p>
            </div>

            <div className="publish__field">
              <label htmlFor={`${ids}-licence`}>{t('publish.fields.licence.label')}</label>
              <select
                id={`${ids}-licence`}
                value={licence}
                onChange={(event) => setLicence(event.target.value as LicenceId)}
              >
                {LICENCES.map((value) => (
                  <option key={value} value={value}>
                    {t(`publish.licences.${value}`)}
                  </option>
                ))}
              </select>
              <p className="publish__hint">{t('publish.fields.licence.hint')}</p>
            </div>

            <p className="publish__note">{t('publish.freeOnly')}</p>
          </section>

          <section className="publish__section">
            <h3>{t('publish.sections.check')}</h3>
            {busy ? <p className="publish__hint">{t('publish.checking')}</p> : null}
            {review ? (
              <>
                <p className="publish__capabilities">
                  {review.capabilities.length === 0
                    ? t('publish.capabilities.none')
                    : `${t('publish.capabilities.some')} ${review.capabilities.join(', ')}`}
                </p>
                {review.findings.length === 0 ? (
                  <p className="publish__clean">{t('publish.nothingFound')}</p>
                ) : (
                  <ul className="publish__findings">
                    {SEVERITY_ORDER.flatMap((severity) =>
                      review.findings
                        .filter((finding) => finding.severity === severity)
                        .map((finding) => (
                          <li
                            key={`${finding.code}-${finding.at ?? ''}`}
                            className={`publish__finding publish__finding--${severity}`}
                          >
                            <strong>{finding.title}</strong>
                            <span>{finding.detail}</span>
                            <span className="publish__remedy">{finding.remedy}</span>
                            {finding.at ? <code>{finding.at}</code> : null}
                          </li>
                        )),
                    )}
                  </ul>
                )}
              </>
            ) : null}
            <p className="publish__note">{t('publish.notAnAudit')}</p>
          </section>

          {prepared ? (
            <section className="publish__section publish__section--done">
              <h3>{t('publish.sections.done')}</h3>
              <p>{t('publish.preparedInto')}</p>
              <code className="publish__folder">{prepared.folder}</code>
              <p className="publish__hint">{t('publish.nowhereToSend')}</p>
            </section>
          ) : null}

          {error ? <p className="publish__error">{error}</p> : null}
        </div>

        <footer className="publish__actions">
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            {t('common.close')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void check()}
            disabled={busy || !projectPath || dirty}
          >
            {t('publish.checkAgain')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void prepare()}
            disabled={busy || !ready}
          >
            {t('publish.prepare')}
          </button>
        </footer>
      </div>
    </div>
  );
}
