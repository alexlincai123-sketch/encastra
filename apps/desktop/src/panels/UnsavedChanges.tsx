/**
 * The one question this application asks before work disappears.
 *
 * Five things replace the canvas — a new project, opening one, loading a sample, restoring an
 * earlier version, opening something from the library — and the window can be closed out from
 * under all five. Each of them used to do it silently: a canvas somebody had spent an hour on
 * was gone, with no message, no undo across the boundary, and nothing on screen to suggest that
 * anything had been lost.
 *
 * One dialog rather than five prompts, and the decision that puts it on screen lives in the
 * store (`requestDiscard`), not here: this file renders a question the store is already asking
 * and calls back with the answer. That is what keeps a sixth way of replacing the canvas from
 * arriving without a prompt — it would have to go through the same store method as the other
 * five, and the store is where the check is.
 *
 * Deliberately not `window.confirm`. A native confirm cannot be translated, cannot say which of
 * the five things is about to happen, offers two answers where the useful one is a third
 * ("save it first"), and blocks the whole webview while it is up.
 */

import { useEffect, useId, useRef } from 'react';
import { useFocusTrap } from '../a11y/focus';
import { useTranslation } from '../i18n';
import { useEditor } from '../store';

export function UnsavedChanges() {
  const pending = useEditor((s) => s.pendingDiscard);
  const busy = useEditor((s) => s.busy);
  const message = useEditor((s) => s.message);
  const cancelDiscard = useEditor((s) => s.cancelDiscard);
  const confirmDiscard = useEditor((s) => s.confirmDiscard);
  const saveThenProceed = useEditor((s) => s.saveThenProceed);
  const { t } = useTranslation();

  const ids = useId();
  const panel = useRef<HTMLDivElement | null>(null);
  const open = pending !== null;

  // Focus lands on the dialog itself rather than on a button, so a screen reader reads the
  // question before it reads an answer — and so no answer is one stray Enter away.
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);
  // `aria-modal="true"` below claims everything behind this is unreachable; this is what makes
  // that true, and hands focus back to whatever opened it on the way out.
  useFocusTrap(panel, open);

  if (!pending) return null;

  // A failed or cancelled save leaves the prompt up, so the reason belongs inside it: the status
  // bar is behind the shade, and "nothing happened" with no explanation is how somebody presses
  // Discard by accident.
  const failure = message?.tone === 'error' ? message.text : null;

  return (
    <div className="unsaved">
      {/* `alertdialog`, not `dialog`: this interrupts something the person asked for, and the
          answer decides whether their work survives. The dialog is the panel rather than the
          shade behind it, so the element that owns Escape is the element a screen reader
          announces. */}
      <div
        className="unsaved__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${ids}-heading`}
        aria-describedby={`${ids}-body`}
        ref={panel}
        tabIndex={-1}
        onKeyDown={(event) => {
          // Escape is Cancel, never Discard. The way out of a question about losing work must
          // be the answer that loses none of it.
          if (event.key === 'Escape') cancelDiscard();
        }}
      >
        <h2 id={`${ids}-heading`}>{t('unsaved.title')}</h2>
        <p id={`${ids}-body`}>{t(`unsaved.reasons.${pending.reason}`)}</p>
        {failure ? <p className="unsaved__error">{failure}</p> : null}

        <footer className="unsaved__actions">
          <button type="button" className="btn" onClick={cancelDiscard} disabled={busy}>
            {t('unsaved.cancel')}
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={confirmDiscard}
            disabled={busy}
          >
            {t('unsaved.discard')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void saveThenProceed()}
            disabled={busy}
          >
            {t('unsaved.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}
