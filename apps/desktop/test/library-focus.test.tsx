// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookup, useI18n } from '../src/i18n';
import en from '../src/i18n/locales/en';
import { useEditor } from '../src/store';
import type { EntryWithStatus } from '../src/types';
import { Library } from '../src/views/Library';

/**
 * Where focus goes while a library row asks "remove this?".
 *
 * Every button in that exchange removes itself when pressed — Remove is replaced by the question,
 * Cancel and Forget are replaced by Remove again, and a removal that goes through takes the whole
 * row away. Focus left on a removed element falls to `<body>`, which for somebody on a keyboard or
 * a screen reader is being thrown back to the top of the page with nothing said. Each step below
 * asserts `document.activeElement` is somewhere real, and somewhere that makes sense.
 */

const INITIAL_EDITOR = useEditor.getState();
const INITIAL_I18N = useI18n.getState();

const ROW: EntryWithStatus = {
  entry: {
    id: 'lib-1',
    origin: 'created',
    name: 'Thumbnails',
    description: null,
    path: 'C:\\projects\\thumbnails.encastra',
    addedAtMs: Date.UTC(2026, 0, 1),
    lastOpenedMs: null,
    modifiedAtMs: Date.UTC(2026, 0, 1),
    checksum: null,
    sizeBytes: null,
    steps: 3,
    runtime: '0.5.0',
    listingId: null,
    version: null,
    publisher: null,
    capabilities: [],
  },
  status: 'present',
};

function english(key: string): string {
  const found = lookup(en, key);
  if (!found) throw new Error(`missing English key ${key}`);
  return found;
}

beforeEach(() => {
  useEditor.setState(INITIAL_EDITOR, true);
  useI18n.setState({ locale: 'en', messages: { en } });
  useEditor.setState({
    library: [ROW],
    libraryLoaded: true,
    // The listing on arrival would ask the (absent) runtime; the row is seeded instead.
    loadLibrary: async () => {},
  });
});

afterEach(() => {
  cleanup();
  useI18n.setState(INITIAL_I18N, true);
});

function pressRemove(): HTMLElement {
  const remove = screen.getByRole('button', { name: english('library.actions.remove') });
  remove.focus();
  fireEvent.click(remove);
  return remove;
}

describe('the remove confirmation keeps focus on the page', () => {
  it('moves to the question when it opens, and back to Remove on Cancel', () => {
    render(<Library />);
    pressRemove();

    expect(document.activeElement).toBe(screen.getByText(english('library.remove.keepsFile')));

    fireEvent.click(screen.getByRole('button', { name: english('library.remove.cancel') }));
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: english('library.actions.remove') }),
    );
  });

  it('moves to the screen’s heading once the row it was on has been removed', async () => {
    const removeFromLibrary = vi.fn(async (_row: EntryWithStatus, _deleteCopy: boolean) => {
      useEditor.setState({ library: [] });
    });
    useEditor.setState({ removeFromLibrary });
    render(<Library />);
    pressRemove();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: english('library.remove.forget') }));
    });

    expect(removeFromLibrary).toHaveBeenCalledWith(ROW, false);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: english('library.heading') }),
    );
  });

  it('returns to Remove when the removal did not go through', async () => {
    const removeFromLibrary = vi.fn(async (_row: EntryWithStatus, _deleteCopy: boolean) => {});
    useEditor.setState({ removeFromLibrary });
    render(<Library />);
    pressRemove();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: english('library.remove.forget') }));
    });

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: english('library.actions.remove') }),
    );
  });
});
