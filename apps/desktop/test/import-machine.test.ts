import { describe, expect, it } from 'vitest';
import {
  canBeginImport,
  canCloseImport,
  canConfirmImport,
  IMPORT_IDLE,
  type ImportEvent,
  type ImportState,
  importBlocksWindowClose,
  importErrorNow,
  inspectedNow,
  isImportBusy,
  isImportDialogOpen,
  transition,
} from '../src/import-machine';
import type { Inspected, LibraryEntry } from '../src/types';

/**
 * Every move the import machine can make, and every move it cannot.
 *
 * The legal transitions are the easy half and the half a diagram already shows. The half that
 * decides whether this is a state machine or a shape with a switch inside it is the other one:
 * what happens when an event arrives in a phase it does not belong to. Two of those are real —
 * a refusal landing after the dialog was closed, an inspection finishing after a second Import
 * replaced it — and the rest are what a future caller will do by accident.
 *
 * So the table below is total: eight states by eight events, all sixty-four, each either naming
 * the state it lands in or saying the event is ignored. "Ignored" is asserted by identity, not by
 * equality — the reducer hands back the very object it was given, which is how `beginImport` and
 * `closeImport` tell a refusal from a move without a second flag.
 */

// -- the eight states, and enough payload to tell them apart -------------------------------------

const INSPECTED = { projectName: 'Thumbnails' } as unknown as Inspected;
const ENTRY = { id: 'abc', name: 'Thumbnails' } as unknown as LibraryEntry;

const STATES = {
  idle: IMPORT_IDLE,
  choosing: { phase: 'busy', stage: 'choosing' },
  inspecting: { phase: 'busy', stage: 'inspecting' },
  importing: { phase: 'busy', stage: 'importing' },
  read: {
    phase: 'success',
    outcome: { kind: 'inspected', folder: 'C:/pub', inspected: INSPECTED },
  },
  landed: { phase: 'success', outcome: { kind: 'imported', entry: ENTRY } },
  refused: { phase: 'error', error: { kind: 'no-document' } },
  cancelled: { phase: 'cancelled' },
} as const satisfies Record<string, ImportState>;

type StateName = keyof typeof STATES;

const EVENTS = {
  begin: { type: 'begin' },
  chose: { type: 'chose' },
  dismissed: { type: 'dismissed' },
  inspected: { type: 'inspected', folder: 'C:/pub', inspected: INSPECTED },
  confirm: { type: 'confirm' },
  imported: { type: 'imported', entry: ENTRY },
  failed: { type: 'failed', error: 'the runtime did not answer' },
  acknowledge: { type: 'acknowledge' },
} as const satisfies Record<string, ImportEvent>;

type EventName = keyof typeof EVENTS;

/** `null` means the event is not a move from that state and the state comes back unchanged. */
const TABLE: Record<StateName, Record<EventName, StateName | null>> = {
  //          begin       chose         dismissed    inspected  confirm      imported  failed     acknowledge
  idle: {
    begin: 'choosing',
    chose: null,
    dismissed: null,
    inspected: null,
    confirm: null,
    imported: null,
    failed: null,
    acknowledge: null,
  },
  choosing: {
    begin: null,
    chose: 'inspecting',
    dismissed: 'cancelled',
    inspected: null,
    confirm: null,
    imported: null,
    failed: 'refused',
    acknowledge: null,
  },
  inspecting: {
    begin: null,
    chose: null,
    dismissed: null,
    inspected: 'read',
    confirm: null,
    imported: null,
    failed: 'refused',
    acknowledge: null,
  },
  importing: {
    begin: null,
    chose: null,
    dismissed: null,
    inspected: null,
    confirm: null,
    imported: 'landed',
    failed: 'refused',
    acknowledge: null,
  },
  read: {
    begin: 'choosing',
    chose: null,
    dismissed: null,
    inspected: null,
    confirm: 'importing',
    imported: null,
    failed: null,
    acknowledge: 'idle',
  },
  landed: {
    begin: 'choosing',
    chose: null,
    dismissed: null,
    inspected: null,
    confirm: null,
    imported: null,
    failed: null,
    acknowledge: 'idle',
  },
  refused: {
    begin: 'choosing',
    chose: null,
    dismissed: null,
    inspected: null,
    confirm: null,
    imported: null,
    failed: null,
    acknowledge: 'idle',
  },
  cancelled: {
    begin: 'choosing',
    chose: null,
    dismissed: null,
    inspected: null,
    confirm: null,
    imported: null,
    failed: null,
    acknowledge: 'idle',
  },
};

describe('every transition, legal and illegal', () => {
  const names = Object.keys(STATES) as StateName[];
  const events = Object.keys(EVENTS) as EventName[];

  it('covers all sixty-four combinations, so nothing is left untested by omission', () => {
    expect(names).toHaveLength(8);
    expect(events).toHaveLength(8);
    for (const name of names) {
      expect(Object.keys(TABLE[name]).sort()).toEqual([...events].sort());
    }
  });

  for (const from of names) {
    for (const event of events) {
      const to = TABLE[from][event];
      const what = to === null ? 'is ignored' : `lands in ${to}`;
      it(`${event} from ${from} ${what}`, () => {
        const state: ImportState = STATES[from];
        const next = transition(state, EVENTS[event]);
        if (to === null) {
          // The same object, not merely an equal one: that identity is the whole signal.
          expect(next).toBe(state);
          return;
        }
        expect(next.phase).toBe(STATES[to].phase);
        if (next.phase === 'busy' && STATES[to].phase === 'busy') {
          expect(next.stage).toBe(STATES[to].stage);
        }
      });
    }
  }
});

describe('what a transition carries with it', () => {
  it('keeps the folder and the report, so the dialog shows what was read', () => {
    const read = transition(
      { phase: 'busy', stage: 'inspecting' },
      { type: 'inspected', folder: 'C:/publications/thumbnails', inspected: INSPECTED },
    );
    expect(inspectedNow(read)).toEqual({
      folder: 'C:/publications/thumbnails',
      inspected: INSPECTED,
    });
    expect(importErrorNow(read)).toBeNull();
  });

  it('keeps a structured refusal in its shape rather than flattening it to a sentence', () => {
    const refused = transition(
      { phase: 'busy', stage: 'importing' },
      { type: 'failed', error: { kind: 'library-full', max: 4, used: 4, needed: 1 } },
    );
    expect(importErrorNow(refused)).toEqual({
      kind: 'library-full',
      max: 4,
      used: 4,
      needed: 1,
    });
    expect(inspectedNow(refused)).toBeNull();
  });

  it('runs the whole way round and comes back to idle', () => {
    let state: ImportState = IMPORT_IDLE;
    for (const event of [
      EVENTS.begin,
      EVENTS.chose,
      EVENTS.inspected,
      EVENTS.confirm,
      EVENTS.imported,
      EVENTS.acknowledge,
    ]) {
      state = transition(state, event);
    }
    expect(state).toEqual(IMPORT_IDLE);
  });

  it('starts a fresh attempt from a settled one, dropping what was on screen', () => {
    const again = transition(STATES.refused, { type: 'begin' });
    expect(again).toEqual({ phase: 'busy', stage: 'choosing' });
    expect(importErrorNow(again)).toBeNull();
    expect(inspectedNow(again)).toBeNull();
  });
});

describe('what the interface reads off the state', () => {
  it('shows the dialog for what has been read, for a refusal, and while writing — and not while the chooser is up', () => {
    expect(isImportDialogOpen(STATES.idle)).toBe(false);
    // The operating system's own chooser is the window to look at; a panel behind it was a flash
    // of empty dialog every time.
    expect(isImportDialogOpen(STATES.choosing)).toBe(false);
    expect(isImportDialogOpen(STATES.inspecting)).toBe(true);
    expect(isImportDialogOpen(STATES.importing)).toBe(true);
    expect(isImportDialogOpen(STATES.read)).toBe(true);
    expect(isImportDialogOpen(STATES.refused)).toBe(true);
    // Nothing happened, so there is nothing to show.
    expect(isImportDialogOpen(STATES.cancelled)).toBe(false);
    // The library, with the thing in it, is the confirmation.
    expect(isImportDialogOpen(STATES.landed)).toBe(false);
  });

  it('will not let the dialog be closed while bytes are being written, and will otherwise', () => {
    for (const busy of ['choosing', 'inspecting', 'importing'] as const) {
      expect(canCloseImport(STATES[busy])).toBe(false);
      expect(isImportBusy(STATES[busy])).toBe(true);
      expect(importBlocksWindowClose(STATES[busy])).toBe(true);
    }
    for (const settled of ['idle', 'read', 'landed', 'refused', 'cancelled'] as const) {
      expect(canCloseImport(STATES[settled])).toBe(true);
      expect(isImportBusy(STATES[settled])).toBe(false);
      expect(importBlocksWindowClose(STATES[settled])).toBe(false);
    }
  });

  it('will not let Import be pressed while one is running, anywhere it appears', () => {
    expect(canBeginImport(STATES.idle)).toBe(true);
    expect(canBeginImport(STATES.choosing)).toBe(false);
    expect(canBeginImport(STATES.inspecting)).toBe(false);
    expect(canBeginImport(STATES.importing)).toBe(false);
    expect(canBeginImport(STATES.read)).toBe(true);
    expect(canBeginImport(STATES.refused)).toBe(true);
    expect(canBeginImport(STATES.cancelled)).toBe(true);
  });

  it('offers the dialog’s own Import only for something that has actually been read', () => {
    expect(canConfirmImport(STATES.read)).toBe(true);
    for (const other of [
      'idle',
      'choosing',
      'inspecting',
      'importing',
      'landed',
      'refused',
      'cancelled',
    ] as const) {
      expect(canConfirmImport(STATES[other])).toBe(false);
    }
  });
});
