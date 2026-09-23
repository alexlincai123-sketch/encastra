import { describe, expect, it, vi } from 'vitest';
import { ipc } from '../src/ipc';
import { useEditor } from '../src/store';

/**
 * A workflow of one step finishes before the command that started it has been answered.
 *
 * `start_workflow` returns `{running: true}` and the runtime announces `{running: false}` from
 * the thread doing the work. Those two race, and on a runner the announcement won: the store
 * applied the command's answer afterwards and the status bar read "En ejecución" over a run
 * that had written its file and ended. Sixty seconds later it still did - the Run button never
 * came back, so nothing could be run again without restarting the application.
 *
 * The store counts status events and drops an answer that has been overtaken by one.
 */
describe('the answer to Start does not outlive the run it started', () => {
  it('keeps the finished state when the run reports before the command returns', async () => {
    useEditor.setState({ running: false, statusSeq: 0 });

    const spy = vi.spyOn(ipc, 'startWorkflow').mockImplementation(async () => {
      // What the runtime does while the command is still in flight: the one step runs, and the
      // thread that ran it announces that the workflow is over. That announcement arrives as a
      // status event, which is applied exactly like this (see `subscribe`'s status handler).
      useEditor.setState((s) => ({ statusSeq: s.statusSeq + 1, running: false, watching: false }));
      return { running: true, watching: false, runs: 0, pending: 0, dropped: 0 };
    });

    await useEditor.getState().startWorkflow();

    expect(useEditor.getState().running, 'the run is over and the interface says so').toBe(false);
    expect(useEditor.getState().view, 'and the builder is still what is on screen').toBe('builder');
    spy.mockRestore();
  });

  it('applies the answer when nothing has reported in the meantime', async () => {
    const spy = vi.spyOn(ipc, 'startWorkflow').mockResolvedValue({
      running: true,
      watching: false,
      runs: 0,
      pending: 0,
      dropped: 0,
    });

    await useEditor.getState().startWorkflow();

    expect(useEditor.getState().running).toBe(true);
    spy.mockRestore();
  });
});
