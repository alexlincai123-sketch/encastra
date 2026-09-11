import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { NodeRecord, NodeStatus, RunJournal } from '../src/types';

/**
 * Only the pure formatting/ordering exports of `RunPanel.tsx` are under test here — never the
 * component, and this file never touches the DOM (vitest runs these in a plain node
 * environment; there is no `@testing-library/react` in this project).
 *
 * `RunPanel.tsx` imports `../store` for the `useEditor` hook the component itself needs, and
 * `store.ts` has one line that only runs in dev builds — `if (import.meta.env.DEV) window...` —
 * to expose the store to the browser console. Vitest sets `import.meta.env.DEV` to `true` (its
 * default mode is "test", not "production"), and a plain node environment has no `window`, so
 * that line throws the moment the module loads. A dynamic import, after stubbing `window` as an
 * empty object, sidesteps it without touching `store.ts` — which nothing here is allowed to
 * edit anyway — and without adding another source file outside the three this task owns.
 */

vi.stubGlobal('window', {});

let RunPanel: typeof import('../src/panels/RunPanel');

beforeAll(async () => {
  RunPanel = await import('../src/panels/RunPanel');
});

function record(status: NodeStatus, extra: Partial<NodeRecord> = {}): NodeRecord {
  return {
    component: 'encastra.test@1.0.0',
    status,
    inputs: {},
    outputs: {},
    capability_calls: [],
    logs: [],
    ...extra,
  };
}

describe('liveSteps', () => {
  it('keeps the order the runtime reported them in, with no duration', () => {
    const steps = () => RunPanel.liveSteps({ parse: 'ok', notify: 'pending', read: 'running' });
    expect(steps().map((s) => s.id)).toEqual(['parse', 'notify', 'read']);
    expect(steps().every((s) => s.durationMs === undefined && s.record === undefined)).toBe(true);
  });

  it('is empty when nothing is live', () => {
    expect(RunPanel.liveSteps({})).toEqual([]);
  });
});

describe('journalSteps', () => {
  it("orders by the journal's own order, not by key order in `nodes`", () => {
    const journal: RunJournal = {
      run_id: 'r1',
      started_at_ms: 0,
      finished_at_ms: 10,
      status: 'ok',
      order: ['read', 'parse', 'write'],
      nodes: {
        write: record('ok', { duration_ms: 4 }),
        read: record('ok', { duration_ms: 1 }),
        parse: record('ok', { duration_ms: 2 }),
      },
    };
    const steps = RunPanel.journalSteps(journal);
    expect(steps.map((s) => s.id)).toEqual(['read', 'parse', 'write']);
    expect(steps.map((s) => s.durationMs)).toEqual([1, 2, 4]);
    expect(steps[0]?.record?.component).toBe('encastra.test@1.0.0');
  });

  it('skips an ordered id with no matching record rather than inventing one', () => {
    const journal: RunJournal = {
      run_id: 'r2',
      started_at_ms: 0,
      status: 'partial',
      order: ['read', 'ghost'],
      nodes: { read: record('ok') },
    };
    expect(RunPanel.journalSteps(journal).map((s) => s.id)).toEqual(['read']);
  });
});

describe('selectSteps', () => {
  const journal: RunJournal = {
    run_id: 'r3',
    started_at_ms: 0,
    finished_at_ms: 5,
    status: 'ok',
    order: ['read'],
    nodes: { read: record('ok', { duration_ms: 5 }) },
  };

  it('shows the live run while one is in progress, even if a stale journal is still around', () => {
    const steps = RunPanel.selectSteps({ journal, liveNodes: { write: 'running' }, running: true });
    expect(steps).toEqual([{ id: 'write', status: 'running' }]);
  });

  it('shows the finished journal once nothing is running', () => {
    const steps = RunPanel.selectSteps({ journal, liveNodes: { read: 'ok' }, running: false });
    expect(steps[0]?.durationMs).toBe(5);
  });

  it('falls back to live data if a run produced no journal at all', () => {
    const steps = RunPanel.selectSteps({
      journal: null,
      liveNodes: { read: 'ok' },
      running: false,
    });
    expect(steps).toEqual([{ id: 'read', status: 'ok' }]);
  });

  it('is empty before anything has ever run', () => {
    expect(RunPanel.selectSteps({ journal: null, liveNodes: {}, running: false })).toEqual([]);
  });
});

describe('stepStatusLabel', () => {
  it('has a plain-language label for every status the runtime can report', () => {
    const statuses: NodeStatus[] = [
      'pending',
      'running',
      'ok',
      'failed',
      'skipped',
      'cancelled',
      'disabled',
    ];
    for (const status of statuses) {
      const label = RunPanel.stepStatusLabel(status);
      expect(label.length).toBeGreaterThan(0);
      // The label is prose, not the runtime's own identifier repeated back.
      expect(label).not.toBe(status);
    }
  });
});

describe('formatDuration', () => {
  it('shows milliseconds under a second', () => {
    expect(RunPanel.formatDuration(0)).toBe('0ms');
    expect(RunPanel.formatDuration(999)).toBe('999ms');
  });

  it('switches to seconds at the one-second boundary', () => {
    expect(RunPanel.formatDuration(1000)).toBe('1s');
    expect(RunPanel.formatDuration(1500)).toBe('1.5s');
    expect(RunPanel.formatDuration(12_340)).toBe('12.3s');
  });
});

describe('outcomeSummary', () => {
  it('says nothing has run yet as no summary rather than an empty sentence', () => {
    expect(RunPanel.outcomeSummary({ journal: null, running: false, watching: false })).toBeNull();
  });

  it('reports a live run as running, and a watching one as watching', () => {
    expect(RunPanel.outcomeSummary({ journal: null, running: true, watching: false })).toEqual({
      text: 'Running…',
      tone: 'info',
    });
    expect(RunPanel.outcomeSummary({ journal: null, running: true, watching: true })).toEqual({
      text: 'Watching for changes…',
      tone: 'info',
    });
  });

  it('reports a clean finish with real elapsed time, never a fabricated one', () => {
    const journal: RunJournal = {
      run_id: 'r',
      started_at_ms: 1000,
      finished_at_ms: 1128,
      status: 'ok',
      order: [],
      nodes: {},
    };
    expect(RunPanel.outcomeSummary({ journal, running: false, watching: false })).toEqual({
      text: 'Finished in 128ms.',
      tone: 'info',
    });
  });

  it('counts the failures in a partial run', () => {
    const journal: RunJournal = {
      run_id: 'r',
      started_at_ms: 0,
      finished_at_ms: 10,
      status: 'partial',
      order: ['a', 'b', 'c'],
      nodes: { a: record('ok'), b: record('failed'), c: record('failed') },
    };
    expect(RunPanel.outcomeSummary({ journal, running: false, watching: false })).toEqual({
      text: '2 steps failed. The rest of the graph still ran.',
      tone: 'error',
    });
  });

  it('reports total failure and cancellation in plain words', () => {
    const base = { run_id: 'r', started_at_ms: 0, order: [], nodes: {} };
    expect(
      RunPanel.outcomeSummary({
        journal: { ...base, status: 'failed' },
        running: false,
        watching: false,
      }),
    ).toEqual({ text: 'Nothing completed.', tone: 'error' });
    expect(
      RunPanel.outcomeSummary({
        journal: { ...base, status: 'cancelled' },
        running: false,
        watching: false,
      }),
    ).toEqual({ text: 'Stopped.', tone: 'info' });
  });
});

describe('watchSummary', () => {
  it('says nothing for a one-off run', () => {
    expect(RunPanel.watchSummary({ watching: false, runs: 3, pending: 1 })).toBeNull();
  });

  it('counts runs, singular and plural, for a watching workflow', () => {
    expect(RunPanel.watchSummary({ watching: true, runs: 1, pending: 0 })).toBe('1 run so far');
    expect(RunPanel.watchSummary({ watching: true, runs: 3, pending: 0 })).toBe('3 runs so far');
  });

  it('adds how many are still waiting, only when there are any', () => {
    expect(RunPanel.watchSummary({ watching: true, runs: 2, pending: 1 })).toBe(
      '2 runs so far · 1 waiting',
    );
  });
});
