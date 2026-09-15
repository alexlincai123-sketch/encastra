/**
 * Taking a publication in, as a state machine rather than a flag.
 *
 * It used to be one boolean called `busy`, set before the native chooser opened and cleared in a
 * `finally`. A boolean can say "something is happening"; it cannot say *what*, and three things
 * that mattered fell through the gap: the dialog could be closed with Escape while the import was
 * being written, a second Import could be pressed in the moment between the chooser closing and
 * the read finishing, and the difference between "you cancelled" and "it failed" was a null.
 *
 * So the phases are named, the transitions between them are the only way to move, and everything
 * the interface needs to decide — whether the dialog may be closed, whether Import may be pressed,
 * what is on screen — is a function of the state rather than a second flag kept in step by hand.
 *
 *     idle ──begin──▶ busy(choosing) ──chose──▶ busy(inspecting) ──inspected──▶ success(inspected)
 *       ▲                   │                          │                              │
 *       │               dismissed                    failed                        confirm
 *       │                   ▼                          ▼                              ▼
 *       └──acknowledge── cancelled                   error ◀────failed──── busy(importing)
 *       └──acknowledge─────────────────────────────────┘                              │
 *       └──acknowledge── success(imported) ◀──────────imported──────────────────────── ┘
 *
 * **An event that is not a legal transition is ignored, and returns the state unchanged — the
 * same object, so a caller can tell.** It does not throw. Two of these events arrive from a
 * promise that was already in flight when something else settled the machine (a refusal landing
 * after the window was closed, an inspection finishing after a second Import replaced it), and
 * turning a race the interface cannot prevent into a thrown error would turn a cosmetic ordering
 * problem into a crash. `beginImport` reports its own refusal to the caller instead, which is the
 * one an actual person can cause.
 */

import type { ImportError, Inspected, LibraryEntry } from './types';

/** Where an import has got to. */
export type ImportPhase = 'idle' | 'busy' | 'success' | 'error' | 'cancelled';

/**
 * Which part of the work is in flight. The distinction is not cosmetic: while the chooser is up
 * nothing has been read, while inspecting nothing has been written, and while importing bytes are
 * being copied into the library — which is the one of the three that must not be interrupted.
 */
export type ImportStage = 'choosing' | 'inspecting' | 'importing';

/** What an import produced. Inspecting produces something to read; importing produces an entry. */
export type ImportOutcome =
  | { kind: 'inspected'; folder: string; inspected: Inspected }
  | { kind: 'imported'; entry: LibraryEntry };

export type ImportState =
  | { phase: 'idle' }
  | { phase: 'busy'; stage: ImportStage }
  | { phase: 'success'; outcome: ImportOutcome }
  | { phase: 'error'; error: ImportError | string }
  /** The native chooser was closed without a folder. Nothing was read and nothing refused it. */
  | { phase: 'cancelled' };

export type ImportEvent =
  /** Import was pressed. */
  | { type: 'begin' }
  /** The chooser came back with a folder. */
  | { type: 'chose' }
  /** The chooser came back with nothing. */
  | { type: 'dismissed' }
  | { type: 'inspected'; folder: string; inspected: Inspected }
  /** Import was pressed in the dialog, on something already read. */
  | { type: 'confirm' }
  | { type: 'imported'; entry: LibraryEntry }
  | { type: 'failed'; error: ImportError | string }
  /** Close, Escape, or the confirmation that replaces the dialog: whatever was settled is read. */
  | { type: 'acknowledge' };

/** Nothing is happening. The one state the machine starts and finishes in. */
export const IMPORT_IDLE: ImportState = { phase: 'idle' };

/**
 * The next state, or the one handed in when the event is not a legal move from here.
 *
 * Pure: no store, no ipc, no clock. Every transition in the diagram above has a test, and so does
 * every event from every phase it is not legal in — the illegal ones are the half that decides
 * whether this is a state machine or a shape with a switch in it.
 */
export function transition(state: ImportState, event: ImportEvent): ImportState {
  switch (event.type) {
    // Pressing Import again after a refusal or a cancellation starts a fresh attempt and drops
    // whatever was on screen; pressing it while one is running does nothing at all.
    case 'begin':
      return state.phase === 'busy' ? state : { phase: 'busy', stage: 'choosing' };

    case 'chose':
      return busyAt(state, 'choosing') ? { phase: 'busy', stage: 'inspecting' } : state;

    // Only the chooser can be dismissed. Nothing further along is allowed to fall back into
    // "you cancelled", which would say a read that failed was a read nobody asked for.
    case 'dismissed':
      return busyAt(state, 'choosing') ? { phase: 'cancelled' } : state;

    case 'inspected':
      return busyAt(state, 'inspecting')
        ? {
            phase: 'success',
            outcome: { kind: 'inspected', folder: event.folder, inspected: event.inspected },
          }
        : state;

    // Confirming is only ever possible on something that has actually been read. In particular
    // it is not possible while importing, so the primary button cannot start a second copy.
    case 'confirm':
      return state.phase === 'success' && state.outcome.kind === 'inspected'
        ? { phase: 'busy', stage: 'importing' }
        : state;

    case 'imported':
      return busyAt(state, 'importing')
        ? { phase: 'success', outcome: { kind: 'imported', entry: event.entry } }
        : state;

    // A failure is only meaningful for work that was in flight. One arriving in any other phase
    // belongs to an attempt that has already been settled or replaced.
    case 'failed':
      return state.phase === 'busy' ? { phase: 'error', error: event.error } : state;

    // The rule the dialog rests on: while something is being done, there is nothing to
    // acknowledge and Close does not work. Idle has nothing to acknowledge either.
    case 'acknowledge':
      return state.phase === 'busy' || state.phase === 'idle' ? state : IMPORT_IDLE;
  }
}

function busyAt(state: ImportState, stage: ImportStage): boolean {
  return state.phase === 'busy' && state.stage === stage;
}

// -- what the interface reads -------------------------------------------------------------------
//
// Derived rather than stored. A second flag saying "the dialog is open" is a second thing to keep
// in step with this one, and the first time they disagree is a dialog nobody can close.

/** Whether something is in flight. Every control that could disturb it is disabled while it is. */
export function isImportBusy(state: ImportState): boolean {
  return state.phase === 'busy';
}

/**
 * Whether Import may be pressed — in the Library toolbar, in its empty state, anywhere.
 *
 * A settled machine may begin again: a refusal is read and then somebody tries another folder.
 */
export function canBeginImport(state: ImportState): boolean {
  return state.phase !== 'busy';
}

/**
 * Whether the dialog is on screen.
 *
 * Not while the chooser is up — the operating system's own window is the thing to look at, and a
 * panel appearing behind it was a flash of empty dialog every time. Not when the chooser was
 * dismissed, because nothing happened. Not after an import landed, because the library replaces
 * it.
 */
export function isImportDialogOpen(state: ImportState): boolean {
  switch (state.phase) {
    case 'busy':
      return state.stage !== 'choosing';
    case 'success':
      return state.outcome.kind === 'inspected';
    case 'error':
      return true;
    default:
      return false;
  }
}

/** Whether Close and Escape do anything. They do not while bytes are being written. */
export function canCloseImport(state: ImportState): boolean {
  return !isImportBusy(state);
}

/** Whether the dialog's own Import button does anything: only on something already read. */
export function canConfirmImport(state: ImportState): boolean {
  return state.phase === 'success' && state.outcome.kind === 'inspected';
}

/** What was read out of the chosen folder, while that is what is on screen. */
export function inspectedNow(state: ImportState): { folder: string; inspected: Inspected } | null {
  if (state.phase === 'success' && state.outcome.kind === 'inspected') {
    return { folder: state.outcome.folder, inspected: state.outcome.inspected };
  }
  return null;
}

/** Why the folder was refused, while that is what is on screen. */
export function importErrorNow(state: ImportState): ImportError | string | null {
  return state.phase === 'error' ? state.error : null;
}

/**
 * Whether the window may not be closed yet.
 *
 * The runtime refuses such a close on its own — it is told by `report_busy`, because a close
 * arrives from the operating system and has to be answered before anything can be asked of the
 * webview. This is the same answer on this side, so that somebody sees a sentence rather than an
 * X that appears to do nothing.
 */
export function importBlocksWindowClose(state: ImportState): boolean {
  return isImportBusy(state);
}
