import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMOS } from '../src/demos';
import { useEditor } from '../src/store';
import type { EntryWithStatus } from '../src/types';

/**
 * Whether unsaved work can still disappear without a word.
 *
 * Five things replace the canvas and each of them used to do it in silence. The guard is in the
 * store rather than on the buttons, so these tests drive the store directly: that is the whole
 * claim being made — that a sixth caller, or a keyboard shortcut, or a context menu cannot get
 * past it, because there is nothing to get past except the store method itself.
 *
 * `store.ts` imports `ipc`, and in node that is the browser preview, which refuses anything
 * only the real runtime can answer. That is not a limitation here, it is the interesting case:
 * a save that does not write must leave the question exactly where it was, and the preview's
 * refusal is the cheapest way to produce a save that does not write.
 */

/** A canvas with something on it. Enough of a node for the store; nothing renders in this file. */
function dirtyCanvas() {
  useEditor.setState({
    nodes: [
      {
        id: 'read-1',
        type: 'component',
        position: { x: 0, y: 0 },
        data: { componentRef: 'core.read@1.0.0', config: {}, disabled: false },
      },
    ],
    edges: [],
    dirty: true,
    pendingDiscard: null,
    message: null,
    projectPath: null,
    busy: false,
  });
}

beforeEach(() => {
  useEditor.setState({
    nodes: [],
    edges: [],
    dirty: false,
    pendingDiscard: null,
    message: null,
    projectPath: null,
    busy: false,
  });
});

describe('asking before the canvas is replaced', () => {
  it('holds the work back and remembers why it was going to be replaced', () => {
    const proceed = vi.fn();
    useEditor.getState().requestDiscard('open', proceed);

    const pending = useEditor.getState().pendingDiscard;
    expect(pending?.reason).toBe('open');
    // Asking is not doing. Nothing has run yet, which is the entire point of holding it.
    expect(proceed).not.toHaveBeenCalled();
  });

  it('runs what was waiting, exactly once, when the work may go', () => {
    const proceed = vi.fn();
    useEditor.getState().requestDiscard('new', proceed);
    useEditor.getState().confirmDiscard();

    expect(proceed).toHaveBeenCalledTimes(1);
    // Cleared, or the prompt would still be on screen over whatever just happened.
    expect(useEditor.getState().pendingDiscard).toBeNull();
  });

  it('does nothing at all when the question is cancelled', () => {
    const proceed = vi.fn();
    useEditor.getState().requestDiscard('close', proceed);
    useEditor.getState().cancelDiscard();

    expect(proceed).not.toHaveBeenCalled();
    expect(useEditor.getState().pendingDiscard).toBeNull();
  });

  it('cannot be confirmed twice — a second press has nothing left to run', () => {
    const proceed = vi.fn();
    useEditor.getState().requestDiscard('demo', proceed);
    useEditor.getState().confirmDiscard();
    useEditor.getState().confirmDiscard();

    expect(proceed).toHaveBeenCalledTimes(1);
  });
});

describe('the entry points that replace the canvas', () => {
  it('asks rather than clearing a canvas with unsaved work on it', () => {
    dirtyCanvas();
    useEditor.getState().newProject();

    expect(useEditor.getState().pendingDiscard?.reason).toBe('new');
    // Still there. Asking a question and doing the thing anyway is worse than not asking.
    expect(useEditor.getState().nodes).toHaveLength(1);
    expect(useEditor.getState().dirty).toBe(true);
  });

  it('clears immediately when there is nothing to lose', () => {
    useEditor.setState({
      nodes: [
        {
          id: 'read-1',
          type: 'component',
          position: { x: 0, y: 0 },
          data: { componentRef: 'core.read@1.0.0', config: {}, disabled: false },
        },
      ],
      dirty: false,
    });
    useEditor.getState().newProject();

    expect(useEditor.getState().pendingDiscard).toBeNull();
    expect(useEditor.getState().nodes).toEqual([]);
  });

  it('does the very same thing after Discard as it would have done straight away', () => {
    dirtyCanvas();
    useEditor.getState().newProject();
    useEditor.getState().confirmDiscard();

    expect(useEditor.getState().nodes).toEqual([]);
    expect(useEditor.getState().dirty).toBe(false);
    expect(useEditor.getState().pendingDiscard).toBeNull();
  });

  it('asks before a sample takes the canvas over', () => {
    dirtyCanvas();
    const demo = DEMOS[0];
    if (!demo) throw new Error('there is at least one sample, or this suite means nothing');
    useEditor.getState().loadDemo(demo);

    expect(useEditor.getState().pendingDiscard?.reason).toBe('demo');
    expect(useEditor.getState().nodes).toHaveLength(1);

    useEditor.getState().confirmDiscard();
    expect(useEditor.getState().nodes.length).toBeGreaterThan(0);
    expect(useEditor.getState().view).toBe('builder');
  });

  it('asks before restoring an earlier version over unsaved work', async () => {
    dirtyCanvas();
    useEditor.setState({ projectPath: 'C:/work/thumbnails.encastra' });
    await useEditor.getState().restoreVersion('snapshot-1');

    expect(useEditor.getState().pendingDiscard?.reason).toBe('restore');
  });

  it('asks before opening something from the library over unsaved work', async () => {
    dirtyCanvas();
    await useEditor.getState().openFromLibrary(presentRow());

    expect(useEditor.getState().pendingDiscard?.reason).toBe('library-open');
  });

  it('does not ask about a library row whose file has gone — nothing would replace anything', async () => {
    dirtyCanvas();
    await useEditor.getState().openFromLibrary({ ...presentRow(), status: 'missing' });

    expect(useEditor.getState().pendingDiscard).toBeNull();
    expect(useEditor.getState().message?.tone).toBe('error');
  });
});

describe('saving first', () => {
  it('keeps the question up, and says why, when the save does not write', async () => {
    dirtyCanvas();
    useEditor.getState().newProject();
    await useEditor.getState().saveThenProceed();

    // The preview has no runtime to save through, so this save refused — exactly like a file
    // chooser somebody backed out of. Either way the work is still there, so the question is
    // still worth asking and the canvas must not have been replaced behind it.
    expect(useEditor.getState().pendingDiscard?.reason).toBe('new');
    expect(useEditor.getState().nodes).toHaveLength(1);
    expect(useEditor.getState().dirty).toBe(true);
    expect(useEditor.getState().message?.tone).toBe('error');
    expect(useEditor.getState().message?.text).toBeTruthy();
  });

  it('continues once the save has actually written something', async () => {
    dirtyCanvas();
    const proceed = vi.fn();
    useEditor.getState().requestDiscard('close', proceed);
    // What a successful save leaves behind, without a runtime to produce it: the file is on
    // disk, so the canvas no longer differs from it. `saveThenProceed` reads exactly that, and
    // nothing else, to tell a save that wrote from one that did not.
    useEditor.setState({ dirty: false });
    await useEditor.getState().saveThenProceed();

    expect(proceed).toHaveBeenCalledTimes(1);
    expect(useEditor.getState().pendingDiscard).toBeNull();
  });

  it('does nothing when there is no question on screen', async () => {
    await useEditor.getState().saveThenProceed();
    expect(useEditor.getState().pendingDiscard).toBeNull();
  });
});

function presentRow(): EntryWithStatus {
  return {
    status: 'present',
    entry: {
      id: '0123456789abcdef',
      origin: 'created',
      name: 'Thumbnails',
      description: null,
      path: 'C:/work/thumbnails.encastra',
      addedAtMs: 0,
      lastOpenedMs: null,
      modifiedAtMs: 0,
      checksum: null,
      sizeBytes: null,
      steps: 2,
      runtime: '0.4.0',
      listingId: null,
      version: null,
      publisher: null,
      capabilities: [],
    },
  };
}
