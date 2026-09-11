/**
 * Making a run visible.
 *
 * Pressing Run today changes node colour on the canvas and not much else. This panel is the
 * missing half: the run in progress, or the last one, as a sequence of steps in the order the
 * runtime executed them, each with what happened and how long it took — and for a step that
 * failed, why, right where the rest of the run is, not only after clicking into it.
 *
 * It reads exactly two kinds of state from the store, and never blends invented data with real
 * data to paper over the gap between them:
 *
 * - While something is running, `liveNodes` is all the runtime has told the application: a
 *   status per step, nothing else. No duration is shown for a live step, because none has been
 *   reported yet — inventing one, even as a placeholder, would be exactly the kind of thing this
 *   panel exists not to do.
 * - Once a run has finished, `journal` is the authoritative record: real durations, real
 *   outputs, and — for a failure — the real error and hint the component raised.
 *
 * The ordering and formatting logic is exported as plain functions so it can be tested without
 * touching React or the DOM; see `../../test/run-panel.test.ts`.
 */

// Plain functions rather than `useTranslation()`: everything below `dotModifier` is exported and
// exercised directly by `../../test/run-panel.test.ts` with no React tree to render, and
// `store.ts`'s own `summarise` calls `outcomeSummary`'s `runPanel.outcome.*` keys the same way —
// see that file's note on why the status bar and this panel must never describe a run
// differently. `translate()` reads the active locale itself at call time, the same pattern
// `canvas/Canvas.tsx` uses inside `isConnectionLegal`.
import { selectPlural, splitOnPlaceholder, translate, useI18n, useTranslation } from '../i18n';
import { usePreferences } from '../preferences';
import { useEditor } from '../store';
import type { NodeRecord, NodeStatus, RunJournal } from '../types';
import './run-panel.css';

// --- Pure logic ---------------------------------------------------------------------------

/** One step, ready to render — never more than the run actually reported. */
export interface StepView {
  readonly id: string;
  readonly status: NodeStatus;
  /** Present only once the journal has it; a step still running has none. */
  readonly durationMs?: number;
  /** Present only once the journal has it; carries the error, hint, and logs, if any. */
  readonly record?: NodeRecord;
}

/**
 * Steps from `liveNodes`, in the order the runtime is executing them.
 *
 * `liveNodes` is built by `store.ts` from the `order` array the runtime sends when a run
 * starts, one assignment per id in sequence (see the `runStarted` handler). A plain object's
 * string keys iterate in insertion order, so that order survives here — this is the real
 * execution order the runtime reported, not a guess dressed up as one.
 */
export function liveSteps(liveNodes: Readonly<Record<string, NodeStatus>>): StepView[] {
  return Object.keys(liveNodes).map((id) => ({ id, status: liveNodes[id] as NodeStatus }));
}

/** Steps from a finished run's journal, in the order the journal itself records. */
export function journalSteps(journal: RunJournal): StepView[] {
  const steps: StepView[] = [];
  for (const id of journal.order) {
    const record = journal.nodes[id];
    // Not expected in practice — every id the journal orders should have a record — but a
    // step this panel cannot describe truthfully is better left out than shown with a status
    // nobody reported.
    if (!record) continue;
    // `exactOptionalPropertyTypes` means `durationMs` must be omitted, not set to `undefined`,
    // for a step the journal has no duration for (still running when the journal was written,
    // or skipped).
    steps.push({
      id,
      status: record.status,
      record,
      ...(record.duration_ms !== undefined ? { durationMs: record.duration_ms } : {}),
    });
  }
  return steps;
}

/**
 * Which of the two sources above describes the run worth showing right now.
 *
 * While a run is in progress, that run — not whatever journal is left over from the previous
 * one — is what a person watching this panel wants to see. `store.ts` clears `journal` the
 * moment a new run starts, but `liveNodes` is *not* cleared when a run finishes, so `running`
 * is the one flag that actually distinguishes "happening now" from "already over".
 */
export function selectSteps(params: {
  readonly journal: RunJournal | null;
  readonly liveNodes: Readonly<Record<string, NodeStatus>>;
  readonly running: boolean;
}): StepView[] {
  if (params.running) return liveSteps(params.liveNodes);
  if (params.journal) return journalSteps(params.journal);
  return liveSteps(params.liveNodes);
}

const STATUS_KEY: Record<NodeStatus, string> = {
  pending: 'runPanel.status.pending',
  running: 'runPanel.status.running',
  ok: 'runPanel.status.ok',
  failed: 'runPanel.status.failed',
  skipped: 'runPanel.status.skipped',
  cancelled: 'runPanel.status.cancelled',
  disabled: 'runPanel.status.disabled',
};

/** A status a person can read, in place of the runtime's identifier for it. Reused by
 * `panels/Inspector.tsx`'s own run record, so a step's status reads the same in both places. */
export function stepStatusLabel(status: NodeStatus): string {
  return translate(STATUS_KEY[status]);
}

/** `128ms`, or `1.2s` once it is long enough that milliseconds stop being the useful unit. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
}

export interface Outcome {
  readonly text: string;
  readonly tone: 'info' | 'error';
}

/**
 * One line for the run as a whole.
 *
 * Deliberately close in wording to the message the status bar and toolbar already show for the
 * same event (`store.ts`'s own `summarise`) — a run should not be described one way at the top
 * of the window and another way here.
 */
export function outcomeSummary(params: {
  readonly journal: RunJournal | null;
  readonly running: boolean;
  readonly watching: boolean;
}): Outcome | null {
  if (params.running) {
    return {
      text: translate(params.watching ? 'runPanel.outcome.watching' : 'runPanel.outcome.running'),
      tone: 'info',
    };
  }

  const { journal } = params;
  if (!journal) return null;

  const failed = Object.values(journal.nodes).filter((n) => n.status === 'failed').length;
  const took =
    journal.finished_at_ms !== undefined
      ? formatDuration(journal.finished_at_ms - journal.started_at_ms)
      : undefined;
  const locale = useI18n.getState().locale;

  switch (journal.status) {
    case 'ok':
      return {
        text: took
          ? translate('runPanel.outcome.finishedIn', { took })
          : translate('runPanel.outcome.finished'),
        tone: 'info',
      };
    case 'partial':
      return {
        text: translate(`runPanel.outcome.partial.${selectPlural(locale, failed)}`, {
          count: failed,
        }),
        tone: 'error',
      };
    case 'failed':
      return { text: translate('runPanel.outcome.failed'), tone: 'error' };
    case 'cancelled':
      return { text: translate('runPanel.outcome.cancelled'), tone: 'info' };
    default:
      return { text: translate('runPanel.outcome.running'), tone: 'info' };
  }
}

/** `"3 runs so far · 1 waiting"` for a watching workflow, or nothing for a one-off run. */
export function watchSummary(params: {
  readonly watching: boolean;
  readonly runs: number;
  readonly pending: number;
}): string | null {
  if (!params.watching) return null;
  const locale = useI18n.getState().locale;
  const parts = [
    translate(`runPanel.watch.runsSoFar.${selectPlural(locale, params.runs)}`, {
      count: params.runs,
    }),
  ];
  if (params.pending > 0) {
    parts.push(translate('runPanel.watch.pendingWaiting', { count: params.pending }));
  }
  return parts.join(' · ');
}

/** Which state dot a step's status paints — the four the app already has colours for. */
function dotModifier(status: NodeStatus): string {
  return status === 'ok' || status === 'failed' || status === 'skipped' || status === 'running'
    ? ` dot--${status}`
    : '';
}

// --- Component -----------------------------------------------------------------------------

/** The step whose name a `skipped_because` id refers to, resolved the same way steps are. */
function useStepName(): (id: string) => string {
  const nodes = useEditor((s) => s.nodes);
  const manifests = useEditor((s) => s.manifests);
  return (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return id; // The node may since have been deleted from the canvas.
    return node.data.label ?? manifests[node.data.componentRef]?.name ?? id;
  };
}

export function RunPanel() {
  const journal = useEditor((s) => s.journal);
  const liveNodes = useEditor((s) => s.liveNodes);
  const running = useEditor((s) => s.running);
  const watching = useEditor((s) => s.watching);
  const runs = useEditor((s) => s.runs);
  const pending = useEditor((s) => s.pending);
  const journalIsRecording = useEditor((s) => s.journalIsRecording);
  const selectedNodeId = useEditor((s) => s.selectedNodeId);
  const select = useEditor((s) => s.select);
  const nameOf = useStepName();
  const { t } = useTranslation();

  // Split around `{name}` once, the same way `canvas/Canvas.tsx` splits its own refusal
  // sentence — see `i18n/index.ts` — so the skipped step's name can sit in its own `<strong>`.
  const [neverRanBefore, neverRanAfter] = splitOnPlaceholder(t('runPanel.step.neverRan'), 'name');

  /**
   * Whether the panel is present before there is anything to report.
   *
   * The preference existed and nothing read it, which made it precisely the decorative control
   * the settings screen is built to have none of. Turned off, the panel stays out of the way
   * until there is something to show — a run that has happened, or one being watched for —
   * rather than taking a strip off the canvas from the moment the editor opens.
   */
  const openOnRun = usePreferences((p) => p.openRunPanelOnRun);
  const somethingToShow = journal !== null || watching || running;
  if (!openOnRun && !somethingToShow) return null;

  const steps = selectSteps({ journal, liveNodes, running });
  const outcome = outcomeSummary({ journal, running, watching });
  const watchText = watchSummary({ watching, runs, pending });

  return (
    <section className="run-panel" aria-label={t('runPanel.ariaLabel')}>
      <header className="run-panel__header">
        <h2 className="run-panel__title">{t('runPanel.title')}</h2>
        {outcome ? (
          <span className={`run-panel__outcome run-panel__outcome--${outcome.tone}`}>
            {outcome.text}
          </span>
        ) : null}
        {journalIsRecording ? (
          <span className="preview-badge" title={t('runPanel.recordingTitle')}>
            {t('common.recordingBadge')}
          </span>
        ) : null}
        {watchText ? <span className="run-panel__watch">{watchText}</span> : null}
      </header>

      {steps.length === 0 ? (
        <p className="empty">{t('runPanel.empty')}</p>
      ) : (
        <ol className="run-panel__steps">
          {steps.map((step, index) => {
            const failed = step.record?.status === 'failed' && step.record.error;
            const skipped = step.record?.status === 'skipped' && step.record.skipped_because;
            return (
              <li className="run-panel__step" key={step.id}>
                <button
                  type="button"
                  className="run-panel__step-button"
                  aria-current={selectedNodeId === step.id ? 'step' : undefined}
                  onClick={() => select(step.id)}
                >
                  <span className={`dot${dotModifier(step.status)}`} aria-hidden="true" />
                  <span className="run-panel__step-index">{index + 1}</span>
                  <span className="run-panel__step-name">{nameOf(step.id)}</span>
                  <span className="run-panel__step-status">{stepStatusLabel(step.status)}</span>
                  {step.durationMs !== undefined ? (
                    <span className="run-panel__step-duration">
                      {formatDuration(step.durationMs)}
                    </span>
                  ) : null}
                </button>

                {failed ? (
                  <div className="note note--error run-panel__step-note">
                    <strong>{step.record?.error?.message}</strong>
                    {step.record?.error?.hint ? (
                      <span className="note__hint">{step.record.error.hint}</span>
                    ) : null}
                  </div>
                ) : null}

                {skipped ? (
                  <div className="note note--warn run-panel__step-note">
                    {neverRanBefore}
                    <strong>{nameOf(step.record?.skipped_because ?? '')}</strong>
                    {neverRanAfter}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
