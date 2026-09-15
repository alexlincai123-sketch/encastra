/**
 * Taking a publication in.
 *
 * What this shows is the answer to a read: the runtime opened a folder somebody chose, checked
 * the bytes against the document beside them, re-ran the publisher's own review on this machine,
 * and reported what it found. Nothing has been written when this panel appears, and nothing runs
 * when Import is pressed either — importing copies files into the library and stops there.
 *
 * Three sentences on this panel are load-bearing and must not be softened.
 *
 * - **The publisher is not verified.** There are no accounts, so there is nobody to have checked
 *   that a name belongs to whoever typed it. The panel says so beside the name, every time.
 * - **The checksum is integrity, not provenance.** It proves the file was not altered since it
 *   was prepared. It says nothing at all about who prepared it.
 * - **Importing is not running.** Capabilities are listed so somebody can see what this would
 *   ask for, and importing grants none of them: every run asks.
 *
 * A refusal gets its own sentence per kind rather than one apology for all of them. A folder
 * holding two projects and a document that names somebody else's namespace are different
 * problems with different things to do about them, and "the import failed" is what people are
 * used to being told and has never once been enough to act on.
 */

import { useEffect, useId, useRef } from 'react';
import { useFocusTrap } from '../a11y/focus';
import { formatNumber, selectPlural, useTranslation } from '../i18n';
import {
  canCloseImport,
  canConfirmImport,
  importErrorNow,
  inspectedNow,
  isImportBusy,
  isImportDialogOpen,
} from '../import-machine';
import { importErrorKey, importErrorValues, isImportError, TRANSLATED_TOKENS } from '../library';
import { useEditor } from '../store';
import type { ImportError, Inspected, PublicationFinding } from '../types';

const SEVERITY_ORDER: PublicationFinding['severity'][] = ['blocking', 'warning', 'note'];

/** Findings, in the order worth reading them. Shares its shape with the Publish panel's list. */
function Findings({ findings }: { findings: PublicationFinding[] }) {
  return (
    <ul className="publish__findings">
      {SEVERITY_ORDER.flatMap((severity) =>
        findings
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
  );
}

/** Why the folder was refused, in the words of the one thing that is actually wrong with it. */
function Refusal({ error }: { error: ImportError | string }) {
  const { t, locale } = useTranslation();

  if (!isImportError(error)) {
    return <p className="publish__error">{error}</p>;
  }

  const values = importErrorValues(
    error,
    (bytes) => formatNumber(locale, Math.ceil(bytes / 1024)),
    // A token this build has no word for is shown as it arrived. `t()` falls back to the key
    // itself, and `import.tokens.whatever` in the middle of a sentence is worse than the tag.
    (token) => (TRANSLATED_TOKENS.has(token) ? t(`import.tokens.${token}`) : token),
    // Whole megabytes, for the refusal whose numbers describe a library rather than a file.
    (bytes) => formatNumber(locale, Math.ceil(bytes / (1024 * 1024))),
  );

  return (
    <div className="import__refusal">
      <p className="publish__error">{t(importErrorKey(error.kind), values)}</p>

      {/* Two refusals carry a list rather than a sentence, because the list is the thing to act
          on: what would have to change, and what the two sides actually said. */}
      {error.kind === 'review-refused' ? <Findings findings={error.findings} /> : null}

      {error.kind === 'capabilities-disagree' ? (
        <dl className="import__facts">
          <div className="import__fact">
            <dt>{t('import.disagreement.declared')}</dt>
            <dd>{error.declared.length > 0 ? error.declared.join(', ') : t('import.nothing')}</dd>
          </div>
          <div className="import__fact">
            <dt>{t('import.disagreement.actual')}</dt>
            <dd>{error.actual.length > 0 ? error.actual.join(', ') : t('import.nothing')}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

/** Everything read out of the folder, and where each thing came from. */
function Report({ inspected }: { inspected: Inspected }) {
  const { t, locale } = useTranslation();
  const { bundle, review } = inspected;
  const kilobytes = formatNumber(locale, Math.ceil(bundle.size_bytes / 1024));

  return (
    <div className="publish__body">
      <section className="publish__section">
        <h3>{t('import.sections.what')}</h3>
        <h4 className="import__title">{bundle.draft.title}</h4>
        <p className="import__summary">{bundle.draft.summary}</p>

        <dl className="import__facts">
          <div className="import__fact">
            <dt>{t('import.facts.publisher')}</dt>
            <dd>
              <code>{bundle.publisher}</code>
            </dd>
          </div>
          <div className="import__fact">
            <dt>{t('import.facts.name')}</dt>
            <dd>
              <code>{bundle.draft.listing_id}</code>
            </dd>
          </div>
          <div className="import__fact">
            <dt>{t('import.facts.version')}</dt>
            <dd>{bundle.draft.version}</dd>
          </div>
          <div className="import__fact">
            <dt>{t('import.facts.kind')}</dt>
            <dd>{t(`import.kinds.${bundle.draft.kind}`)}</dd>
          </div>
          <div className="import__fact">
            <dt>{t('import.facts.licence')}</dt>
            <dd>{bundle.draft.license.name ?? bundle.draft.license.id}</dd>
          </div>
          <div className="import__fact">
            <dt>{t('import.facts.size')}</dt>
            <dd>{t('import.facts.kilobytes', { size: kilobytes })}</dd>
          </div>
          <div className="import__fact">
            <dt>{t('import.facts.runtime')}</dt>
            <dd>{bundle.runtime}</dd>
          </div>
        </dl>

        {/* Said beside the name, not in a footnote. A publisher id is a claim somebody typed. */}
        <p className="import__unverified">{t('import.notVerified')}</p>
      </section>

      <section className="publish__section">
        <h3>{t('import.sections.integrity')}</h3>
        <p className="publish__clean">{t('import.checksumMatches')}</p>
        <p className="publish__note">{t('import.checksumIsNotProvenance')}</p>
      </section>

      <section className="publish__section">
        <h3>{t('import.sections.inside')}</h3>
        <dl className="import__facts">
          <div className="import__fact">
            <dt>{t('import.facts.projectName')}</dt>
            <dd>{inspected.projectName}</dd>
          </div>
          <div className="import__fact">
            <dt>{t('import.facts.steps')}</dt>
            <dd>
              {t(`import.facts.stepCount.${selectPlural(locale, inspected.steps)}`, {
                count: inspected.steps,
              })}
              {inspected.stepsSwitchedOff > 0
                ? t('import.facts.switchedOff', { count: inspected.stepsSwitchedOff })
                : ''}
            </dd>
          </div>
          <div className="import__fact">
            <dt>{t('import.facts.versions')}</dt>
            <dd>
              {t(`import.facts.versionCount.${selectPlural(locale, inspected.versions)}`, {
                count: inspected.versions,
              })}
            </dd>
          </div>
        </dl>
        {inspected.projectDescription ? (
          <p className="import__summary">{inspected.projectDescription}</p>
        ) : null}
      </section>

      <section className="publish__section">
        <h3>{t('import.sections.asks')}</h3>
        <p className="publish__capabilities">
          {review.capabilities.length === 0
            ? t('import.capabilities.none')
            : `${t('import.capabilities.some')} ${review.capabilities.join(', ')}`}
        </p>
        <p className="publish__note">{t('import.capabilities.grantsNothing')}</p>
      </section>

      <section className="publish__section">
        <h3>{t('import.sections.check')}</h3>
        {review.findings.length === 0 ? (
          <p className="publish__clean">{t('import.nothingFound')}</p>
        ) : (
          <Findings findings={review.findings} />
        )}
        <p className="publish__note">{t('import.notAnAudit')}</p>
      </section>
    </div>
  );
}

export function Import() {
  // Everything this panel shows and everything it will let somebody do is read off one value.
  // There is no second flag for "the dialog is open" to fall out of step with the work in
  // flight — the first time those two disagreed would be a dialog nobody could close.
  const state = useEditor((s) => s.importState);
  const closeImport = useEditor((s) => s.closeImport);
  const confirmImport = useEditor((s) => s.confirmImport);
  const { t } = useTranslation();

  const open = isImportDialogOpen(state);
  const pending = inspectedNow(state);
  const error = importErrorNow(state);
  const busy = isImportBusy(state);
  const mayClose = canCloseImport(state);
  const mayConfirm = canConfirmImport(state);

  const ids = useId();
  const panel = useRef<HTMLDivElement | null>(null);

  // Focus moves into the panel rather than onto its first control: a dialog that lands on a
  // button reads that button to a screen reader and never reads the sentences above it saying
  // what this is and what it will not do.
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);
  useFocusTrap(panel, open);

  if (!open) return null;

  return (
    <div className="publish">
      <div
        className="publish__panel import__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-heading`}
        ref={panel}
        tabIndex={-1}
        onKeyDown={(event) => {
          // Until something is being written, nothing has been written — so leaving costs
          // nothing, and having no way out of a dialog costs a great deal. Once bytes are going
          // into the library, Escape does nothing: the store refuses it, the focus trap stays,
          // and the panel goes on saying what is happening. `closeImport` answers which it was.
          if (event.key === 'Escape') closeImport();
        }}
      >
        <header className="publish__header">
          <h2 id={`${ids}-heading`}>{t('import.heading')}</h2>
          <p>{t('import.intro')}</p>
        </header>

        {pending ? <Report inspected={pending.inspected} /> : null}

        {!pending && !error ? (
          <div className="publish__body">
            <p className="publish__hint">{t('import.reading')}</p>
          </div>
        ) : null}

        {/* Said while it is true, rather than leaving a disabled Close to be puzzled over. */}
        {busy && pending ? (
          <div className="publish__body">
            <p className="publish__hint">{t('import.writing')}</p>
          </div>
        ) : null}

        {error ? (
          <div className="publish__body">
            <Refusal error={error} />
            <p className="publish__note">{t('import.nothingWasTakenIn')}</p>
          </div>
        ) : null}

        <footer className="publish__actions">
          <p className="import__promise">{t('import.copiesNothingRuns')}</p>
          <button
            type="button"
            className="btn"
            disabled={!mayClose}
            title={mayClose ? undefined : t('import.writing')}
            onClick={() => closeImport()}
          >
            {t('common.close')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!mayConfirm}
            onClick={() => void confirmImport()}
          >
            {t('import.confirm')}
          </button>
        </footer>
      </div>
    </div>
  );
}
