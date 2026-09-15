import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_IDLE, isImportDialogOpen } from '../src/import-machine';
import { ipc } from '../src/ipc';
import { useEditor } from '../src/store';
import type { Inspected, LibraryEntry } from '../src/types';

/**
 * What the import dialog will and will not let somebody do, driven through the store.
 *
 * The guards are in the store and in the machine behind it rather than on the buttons, for the
 * reason `discard.test.ts` gives about the unsaved-work prompt: that is the whole claim being
 * made. A second entry point, a keyboard shortcut or a context menu cannot get past them, because
 * there is nothing to get past except the store method itself. The panel's Escape handler calls
 * `closeImport()` and its Close button is disabled by `canCloseImport(state)`; both are the same
 * decision, taken here.
 *
 * `store.ts` imports `ipc`, and in node that is the browser preview, which refuses anything only
 * the real runtime can answer. That is not a limitation here — it is the cheapest way to produce
 * a folder that was refused.
 */

const INSPECTED = { projectName: 'Thumbnails', steps: 2 } as unknown as Inspected;
const ENTRY = { id: 'abcd', name: 'Thumbnails' } as unknown as LibraryEntry;

beforeEach(() => {
  useEditor.setState({ importState: IMPORT_IDLE, busy: false, message: null, view: 'library' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('while an import is being written', () => {
  beforeEach(() => {
    // The one phase that must not be interrupted: bytes are going into the library.
    useEditor.setState({ importState: { phase: 'busy', stage: 'importing' }, busy: true });
  });

  it('Close and Escape do nothing, and say so by answering false', () => {
    const before = useEditor.getState().importState;
    expect(useEditor.getState().closeImport()).toBe(false);
    // Not merely equal: the same state object, untouched.
    expect(useEditor.getState().importState).toBe(before);
    // And the dialog is still on screen, still trapping focus, still saying what is happening.
    expect(isImportDialogOpen(useEditor.getState().importState)).toBe(true);
  });

  it('a second Import is refused without reaching the chooser', async () => {
    const chooser = vi.spyOn(ipc, 'pickFolder');
    const before = useEditor.getState().importState;

    expect(await useEditor.getState().beginImport()).toBe(false);

    expect(chooser).not.toHaveBeenCalled();
    expect(useEditor.getState().importState).toBe(before);
  });

  it('the dialog’s own Import is refused too, so the copy cannot be started twice', async () => {
    const importing = vi.spyOn(ipc, 'importPublication');
    expect(await useEditor.getState().confirmImport()).toBe(false);
    expect(importing).not.toHaveBeenCalled();
  });

  it('the window cannot be closed, and the reason is on screen rather than implied', () => {
    expect(useEditor.getState().importBlocksClose()).toBe(true);
    expect(useEditor.getState().message?.text).toBeTruthy();
    // Not an error: nothing has gone wrong, it is a short wait.
    expect(useEditor.getState().message?.tone).toBe('info');
  });
});

describe('once it has settled', () => {
  it('lets the dialog go, and leaves the machine ready for the next one', () => {
    useEditor.setState({ importState: { phase: 'error', error: { kind: 'no-document' } } });
    expect(useEditor.getState().closeImport()).toBe(true);
    expect(useEditor.getState().importState).toEqual(IMPORT_IDLE);
    expect(isImportDialogOpen(useEditor.getState().importState)).toBe(false);
  });

  it('does not block the window close', () => {
    useEditor.setState({ importState: { phase: 'cancelled' } });
    expect(useEditor.getState().importBlocksClose()).toBe(false);
    expect(useEditor.getState().message).toBeNull();
  });
});

describe('asking for a folder', () => {
  it('shows the refusal in the dialog and stops being busy', async () => {
    // The preview has no chooser, so this is a folder that was refused — which is the state the
    // panel has to be able to show and then be closed out of.
    expect(await useEditor.getState().beginImport()).toBe(false);

    const state = useEditor.getState();
    expect(state.importState.phase).toBe('error');
    expect(isImportDialogOpen(state.importState)).toBe(true);
    expect(state.busy).toBe(false);
    // Nothing is in flight any more, so the window may close and Import may be pressed again.
    expect(state.importBlocksClose()).toBe(false);
  });

  it('treats a chooser somebody backed out of as cancelled, not as a failure', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue(null);
    const reading = vi.spyOn(ipc, 'inspectPublication');

    expect(await useEditor.getState().beginImport()).toBe(false);

    const state = useEditor.getState();
    expect(state.importState.phase).toBe('cancelled');
    // Nothing was read, so there is nothing to show and no dialog to close.
    expect(reading).not.toHaveBeenCalled();
    expect(isImportDialogOpen(state.importState)).toBe(false);
    expect(state.busy).toBe(false);
  });

  it('reads the folder it was given and holds the report without writing anything', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue('C:/publications/thumbnails');
    vi.spyOn(ipc, 'inspectPublication').mockResolvedValue(INSPECTED);
    const importing = vi.spyOn(ipc, 'importPublication');

    expect(await useEditor.getState().beginImport()).toBe(true);

    const state = useEditor.getState();
    expect(state.importState).toEqual({
      phase: 'success',
      outcome: { kind: 'inspected', folder: 'C:/publications/thumbnails', inspected: INSPECTED },
    });
    // Inspecting is a read. Nothing has been taken in, and it takes a second press to do it.
    expect(importing).not.toHaveBeenCalled();
    expect(state.busy).toBe(false);
  });
});

describe('taking it in', () => {
  beforeEach(() => {
    useEditor.setState({
      importState: {
        phase: 'success',
        outcome: { kind: 'inspected', folder: 'C:/publications/thumbnails', inspected: INSPECTED },
      },
    });
  });

  it('lands, closes the dialog, and leaves the machine idle rather than half-settled', async () => {
    vi.spyOn(ipc, 'importPublication').mockResolvedValue(ENTRY);

    expect(await useEditor.getState().confirmImport()).toBe(true);

    const state = useEditor.getState();
    expect(state.importState).toEqual(IMPORT_IDLE);
    expect(state.view).toBe('library');
    expect(state.message?.tone).toBe('info');
    expect(state.busy).toBe(false);
  });

  it('shows a refusal in the dialog, which can then be closed', async () => {
    vi.spyOn(ipc, 'importPublication').mockRejectedValue({
      kind: 'library-full',
      max: 4_294_967_296,
      used: 4_294_966_272,
      needed: 2_097_152,
    });

    expect(await useEditor.getState().confirmImport()).toBe(false);

    const state = useEditor.getState();
    expect(state.importState).toEqual({
      phase: 'error',
      error: { kind: 'library-full', max: 4_294_967_296, used: 4_294_966_272, needed: 2_097_152 },
    });
    expect(isImportDialogOpen(state.importState)).toBe(true);
    expect(state.busy).toBe(false);
    expect(useEditor.getState().closeImport()).toBe(true);
  });

  it('does nothing at all when there is nothing read to take in', async () => {
    useEditor.setState({ importState: IMPORT_IDLE });
    const importing = vi.spyOn(ipc, 'importPublication');
    expect(await useEditor.getState().confirmImport()).toBe(false);
    expect(importing).not.toHaveBeenCalled();
    expect(useEditor.getState().importState).toEqual(IMPORT_IDLE);
  });
});

// The privileged side is not told that an import is in flight: `import_publication` marks
// itself in flight for as long as it runs (see lib.rs, `InFlight`). A close guard that rested on
// this side's word was a guard this side could leave set.
