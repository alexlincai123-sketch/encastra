// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookup, translate, useI18n } from '../src/i18n';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import { ipc } from '../src/ipc';
import { Publish } from '../src/panels/Publish';
import { useEditor } from '../src/store';
import type { PublicationReview } from '../src/types';

/**
 * What the Publish panel says when the runtime refuses.
 *
 * Tauri rejects a command with the `AppError` the Rust side serialised — a plain object, not an
 * `Error`. The panel used to turn that into text with `String(cause)`, which is "[object Object]":
 * a refusal that had a perfectly good sentence waiting for it in every locale, shown as noise.
 * Both places the panel reports a failure are covered — the review and the prepare step — because
 * both had the same line.
 */

const FOLDER = 'C:\\publications\\thumbnails';
const REFUSAL = { kind: 'publication-already-there', folder: FOLDER };

const INITIAL_EDITOR = useEditor.getState();
const INITIAL_I18N = useI18n.getState();

function english(key: string): string {
  const found = lookup(en, key);
  if (!found) throw new Error(`missing English key ${key}`);
  return found;
}

beforeEach(() => {
  useEditor.setState(INITIAL_EDITOR, true);
  useEditor.setState({
    publishOpen: true,
    projectPath: 'C:\\projects\\thumbnails.encastra',
    projectName: 'Thumbnails',
    dirty: false,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useI18n.setState(INITIAL_I18N, true);
});

describe('the Publish panel, when the runtime refuses', () => {
  it('shows the localized sentence for a refused review, not "[object Object]"', async () => {
    vi.spyOn(ipc, 'reviewPublication').mockRejectedValue(REFUSAL);
    render(<Publish />);

    const expected = translate('errors.publicationAlreadyThere', { folder: FOLDER });
    expect(expected).toContain(FOLDER);
    expect(await screen.findByText(expected)).toBeDefined();
    expect(screen.queryByText('[object Object]')).toBeNull();
  });

  it('speaks the reader’s language when it does', async () => {
    useI18n.setState({ locale: 'es', messages: { en, es } });
    vi.spyOn(ipc, 'reviewPublication').mockRejectedValue(REFUSAL);
    render(<Publish />);

    const expected = translate('errors.publicationAlreadyThere', { folder: FOLDER });
    expect(expected).not.toBe(
      english('errors.publicationAlreadyThere').replace('{folder}', FOLDER),
    );
    expect(await screen.findByText(expected)).toBeDefined();
  });

  it('shows the localized sentence for a refused prepare, too', async () => {
    const user = userEvent.setup();
    const clean: PublicationReview = { outcome: 'may-publish', findings: [], capabilities: [] };
    vi.spyOn(ipc, 'reviewPublication').mockResolvedValue(clean);
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue(FOLDER);
    vi.spyOn(ipc, 'preparePublication').mockRejectedValue(REFUSAL);
    render(<Publish />);

    await user.type(screen.getByLabelText(english('publish.fields.namespace.label')), 'dev.alice');
    await user.type(
      screen.getByLabelText(english('publish.fields.summary.label')),
      'Makes a small copy of every picture dropped in a folder.',
    );
    const prepare = screen.getByRole('button', { name: english('publish.prepare') });
    await waitFor(() => expect(prepare.hasAttribute('disabled')).toBe(false));
    await user.click(prepare);

    const expected = translate('errors.publicationAlreadyThere', { folder: FOLDER });
    expect(await screen.findByText(expected)).toBeDefined();
    expect(screen.queryByText('[object Object]')).toBeNull();
  });
});
