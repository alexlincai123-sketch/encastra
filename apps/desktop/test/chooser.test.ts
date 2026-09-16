import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { chooseFile, chooseFolder, chooseFolderOrExplain } from '../src/chooser';
import { loadLocale, useI18n } from '../src/i18n';
import { IMPORT_IDLE } from '../src/import-machine';
import { ipc } from '../src/ipc';
import { useEditor } from '../src/store';
import type { AppError } from '../src/types';

/**
 * Whether a refused chooser reaches the person, and whether a cancelled one still does not.
 *
 * `choose_folder` and `choose_file` can answer three ways — a path, nothing, or a refusal — and
 * for four of the five places that opened one, the third answer went nowhere: the promise
 * rejected with nobody holding it, so somebody who picked a folder the runtime will not allow
 * (a sensitive root, a startup folder, a path that will not canonicalise) saw the application do
 * *nothing*. Correct and invisible, which reads as broken.
 *
 * Every test below is a pair, and the pair is the point. A refusal has to produce a sentence;
 * backing out of the chooser has to produce silence. Making the first true by treating every
 * `null` as a failure would be the easy way to break the second, so both are pinned everywhere.
 *
 * The two Inspector call sites are driven through the store, because that is where they now live
 * — the same arrangement `restoreVersion` has, and the reason the panel needs no error surface of
 * its own. The two that keep a local error line (Publish, Settings) are driven through
 * `chooseFolderOrExplain` with a spy standing in for `setError`, which is the single line each of
 * those panels now runs. This repo has no DOM environment, so that the spy's string then reaches
 * `publish__error` / `s-note` is not covered here; the branch that decides whether it is called
 * at all is.
 */

/** A folder the broker will not hand over. The shape `AppError` serialises to across the bridge. */
const REFUSED_FOLDER = {
  kind: 'folder-unusable',
  reason: 'it is a startup folder',
} as unknown as AppError;

/** What the chooser gave back was not a folder at all. */
const NOT_A_FOLDER = { kind: 'not-a-folder-on-this-machine' } as unknown as AppError;

/** A file `resolve_input_file` refuses. */
const REFUSED_FILE = {
  kind: 'file-unusable',
  reason: 'it is a device',
} as unknown as AppError;

beforeAll(() => {
  // Pinned for the same reason `refusal.test.ts` pins it: `initI18n()` picks the machine's
  // language on import, so which sentences these assertions run against would otherwise depend
  // on which import resolved first.
  useI18n.setState({ locale: 'en' });
});

afterEach(() => {
  vi.restoreAllMocks();
  useEditor.setState({
    message: null,
    inputs: [],
    nodes: [],
    busy: false,
    importState: IMPORT_IDLE,
  });
});

describe('the three answers a chooser can give', () => {
  it('hands back the path it was given', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue('/home/alice/projects');
    expect(await chooseFolder('projects-location')).toEqual({
      outcome: 'chosen',
      path: '/home/alice/projects',
    });
  });

  it('calls nothing a cancel, not a refusal', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue(null);
    expect(await chooseFolder('projects-location')).toEqual({ outcome: 'cancelled' });
  });

  it('turns a typed refusal into the sentence written for it, not into JSON', async () => {
    vi.spyOn(ipc, 'pickFolder').mockRejectedValue(REFUSED_FOLDER);
    const choice = await chooseFolder('grant-to-component');
    expect(choice).toEqual({
      outcome: 'refused',
      text: 'That folder cannot be used (it is a startup folder).',
    });
  });

  it('says so readably even for a tag this build has never heard of', async () => {
    vi.spyOn(ipc, 'pickFolder').mockRejectedValue({ kind: 'refused-for-a-newer-reason' });
    const choice = await chooseFolder('publish-into');
    expect(choice.outcome).toBe('refused');
    if (choice.outcome !== 'refused') throw new Error('unreachable');
    expect(choice.text).not.toContain('{');
    expect(choice.text.length).toBeGreaterThan(0);
  });

  it('describes a refused file too', async () => {
    vi.spyOn(ipc, 'pickFile').mockRejectedValue(REFUSED_FILE);
    expect(await chooseFile()).toEqual({
      outcome: 'refused',
      text: 'That file cannot be used: it is a device.',
    });
  });

  it('describes the refusal in the language being read, not in English', async () => {
    await loadLocale('es');
    useI18n.setState({ locale: 'es' });
    try {
      vi.spyOn(ipc, 'pickFolder').mockRejectedValue(REFUSED_FOLDER);
      const choice = await chooseFolder('grant-to-component');
      expect(choice).toEqual({
        outcome: 'refused',
        text: 'Esa carpeta no se puede usar (it is a startup folder).',
      });
    } finally {
      useI18n.setState({ locale: 'en' });
    }
  });
});

describe('the Publish panel asking where to publish into', () => {
  it('shows the refusal on its own error line and chooses nothing', async () => {
    const pick = vi.spyOn(ipc, 'pickFolder').mockRejectedValue(REFUSED_FOLDER);
    const show = vi.fn();

    expect(await chooseFolderOrExplain('publish-into', show)).toBeNull();

    // The purpose matters as much as the refusal: a folder recorded to publish into answers no
    // other question, so a panel asking the wrong one gets a chooser that satisfies nothing.
    expect(pick).toHaveBeenCalledWith('publish-into');
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith('That folder cannot be used (it is a startup folder).');
  });

  it('shows nothing when the chooser was backed out of', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue(null);
    const show = vi.fn();

    expect(await chooseFolderOrExplain('publish-into', show)).toBeNull();

    // Nobody said no to a folder, because there was no folder. An error here would be a lie,
    // and the easiest thing to get wrong while fixing the case above.
    expect(show).not.toHaveBeenCalled();
  });
});

describe('Settings asking where this person keeps their projects', () => {
  it('shows the refusal rather than appearing to do nothing at all', async () => {
    const pick = vi.spyOn(ipc, 'pickFolder').mockRejectedValue(NOT_A_FOLDER);
    const show = vi.fn();

    expect(await chooseFolderOrExplain('projects-location', show)).toBeNull();

    expect(pick).toHaveBeenCalledWith('projects-location');
    expect(show).toHaveBeenCalledWith(
      'What the chooser gave back is not a folder on this machine.',
    );
  });

  it('shows nothing when the chooser was backed out of', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue(null);
    const show = vi.fn();

    expect(await chooseFolderOrExplain('projects-location', show)).toBeNull();
    expect(show).not.toHaveBeenCalled();
  });

  it('records the folder when one was actually chosen', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue('/home/alice/projects');
    const show = vi.fn();

    expect(await chooseFolderOrExplain('projects-location', show)).toBe('/home/alice/projects');
    expect(show).not.toHaveBeenCalled();
  });
});

describe('the Inspector asking for the folder a step names', () => {
  it('puts the refusal in the status bar and leaves the setting alone', async () => {
    const pick = vi.spyOn(ipc, 'pickFolder').mockRejectedValue(REFUSED_FOLDER);
    const setConfig = vi.spyOn(useEditor.getState(), 'setConfig');

    await useEditor.getState().chooseConfigFolder('watch-1', 'folder');

    expect(pick).toHaveBeenCalledWith('grant-to-component');
    expect(setConfig).not.toHaveBeenCalled();
    expect(useEditor.getState().message).toEqual({
      tone: 'error',
      text: 'That folder cannot be used (it is a startup folder).',
    });
  });

  it('says nothing when the chooser was backed out of', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue(null);
    const setConfig = vi.spyOn(useEditor.getState(), 'setConfig');

    await useEditor.getState().chooseConfigFolder('watch-1', 'folder');

    expect(setConfig).not.toHaveBeenCalled();
    expect(useEditor.getState().message).toBeNull();
  });

  it('writes the folder into the setting when one was chosen', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue('/home/alice/inbox');
    const setConfig = vi.spyOn(useEditor.getState(), 'setConfig');

    await useEditor.getState().chooseConfigFolder('watch-1', 'folder');

    expect(setConfig).toHaveBeenCalledWith('watch-1', 'folder', '/home/alice/inbox');
    expect(useEditor.getState().message).toBeNull();
  });
});

describe('the Inspector asking for the file an input needs', () => {
  it('puts the refusal in the status bar and seeds no input', async () => {
    vi.spyOn(ipc, 'pickFile').mockRejectedValue(REFUSED_FILE);

    await useEditor.getState().chooseEntryInput('resize-1', 'image');

    expect(useEditor.getState().inputs).toEqual([]);
    expect(useEditor.getState().message).toEqual({
      tone: 'error',
      text: 'That file cannot be used: it is a device.',
    });
  });

  it('says nothing when the chooser was backed out of', async () => {
    vi.spyOn(ipc, 'pickFile').mockResolvedValue(null);

    await useEditor.getState().chooseEntryInput('resize-1', 'image');

    expect(useEditor.getState().inputs).toEqual([]);
    expect(useEditor.getState().message).toBeNull();
  });

  it('seeds the input when a file was chosen', async () => {
    vi.spyOn(ipc, 'pickFile').mockResolvedValue('/home/alice/cat.png');

    await useEditor.getState().chooseEntryInput('resize-1', 'image');

    expect(useEditor.getState().inputs).toEqual([
      { node: 'resize-1', port: 'image', path: '/home/alice/cat.png' },
    ]);
    expect(useEditor.getState().message).toBeNull();
  });
});

describe('the import flow, which already handled this and must keep handling it', () => {
  it('settles the import with the refusal rather than leaving the dialog empty', async () => {
    vi.spyOn(ipc, 'pickFolder').mockRejectedValue(REFUSED_FOLDER);

    expect(await useEditor.getState().beginImport()).toBe(false);

    const state = useEditor.getState();
    expect(state.importState.phase).toBe('error');
    expect(state.busy).toBe(false);
  });

  it('still treats a chooser somebody backed out of as cancelled', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue(null);
    const reading = vi.spyOn(ipc, 'inspectPublication');

    expect(await useEditor.getState().beginImport()).toBe(false);

    expect(useEditor.getState().importState.phase).toBe('cancelled');
    expect(reading).not.toHaveBeenCalled();
  });
});
