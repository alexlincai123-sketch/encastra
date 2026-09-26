// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookup, useI18n } from '../src/i18n';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import { usePreferences } from '../src/preferences';
import { Settings } from '../src/views/Settings';

/**
 * Two buttons in Settings that did their job too eagerly or too quietly.
 *
 * "Reset all settings" reset everything on the first click, with no way back. Export revoked the
 * download's object URL in the same turn it started the download, and swallowed any failure, so
 * a refused export was a button that did nothing.
 */

const INITIAL_PREFERENCES = usePreferences.getState();
const INITIAL_I18N = useI18n.getState();

function english(key: string): string {
  const found = lookup(en, key);
  if (!found) throw new Error(`missing English key ${key}`);
  return found;
}

function open(category: 'developer' | 'diagnostics'): void {
  fireEvent.click(
    screen.getByRole('button', { name: english(`settings.categories.${category}.label`) }),
  );
}

const urlApi = URL as unknown as {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
};
const savedUrlApi = { create: urlApi.createObjectURL, revoke: urlApi.revokeObjectURL };

beforeEach(() => {
  useI18n.setState({ locale: 'en', messages: { en } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  usePreferences.setState(INITIAL_PREFERENCES, true);
  useI18n.setState(INITIAL_I18N, true);
  urlApi.createObjectURL = savedUrlApi.create;
  urlApi.revokeObjectURL = savedUrlApi.revoke;
});

describe('Restore defaults', () => {
  it('asks before it resets, and resets only on the second press', () => {
    const resetAll = vi.fn();
    usePreferences.setState({ resetAll });
    render(<Settings />);
    open('developer');

    const opener = screen.getByRole('button', {
      name: english('settings.developer.reset.restoreDefaults.button'),
    });
    opener.focus();
    fireEvent.click(opener);
    expect(resetAll).not.toHaveBeenCalled();
    const question = screen.getByText(
      english('settings.developer.reset.restoreDefaults.confirm.question'),
    );
    // The button that had focus is gone; focus is on the question, not dropped on <body>.
    expect(document.activeElement).toBe(question);

    fireEvent.click(
      screen.getByRole('button', {
        name: english('settings.developer.reset.restoreDefaults.confirm.confirm'),
      }),
    );
    expect(resetAll).toHaveBeenCalledTimes(1);
    // And back on the button that opened it, which is on screen again.
    expect(document.activeElement).toBe(
      screen.getByRole('button', {
        name: english('settings.developer.reset.restoreDefaults.button'),
      }),
    );
  });

  it('changes nothing when the person thinks better of it, and gives focus back', () => {
    const resetAll = vi.fn();
    usePreferences.setState({ resetAll });
    render(<Settings />);
    open('developer');

    fireEvent.click(
      screen.getByRole('button', {
        name: english('settings.developer.reset.restoreDefaults.button'),
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: english('settings.developer.reset.restoreDefaults.confirm.cancel'),
      }),
    );
    expect(resetAll).not.toHaveBeenCalled();
    const again = screen.getByRole('button', {
      name: english('settings.developer.reset.restoreDefaults.button'),
    });
    expect(document.activeElement).toBe(again);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('asks in the reader’s language', () => {
    // Looked up first and required to exist: `lookup` returning undefined would make
    // `getByRole({ name: undefined })` match any button and pass for the wrong reason.
    const spanish = (key: string): string => {
      const found = lookup(es, key);
      expect(found, key).toBeTypeOf('string');
      return found as string;
    };
    const developer = spanish('settings.categories.developer.label');
    const button = spanish('settings.developer.reset.restoreDefaults.button');
    const question = spanish('settings.developer.reset.restoreDefaults.confirm.question');
    expect(question).not.toBe(english('settings.developer.reset.restoreDefaults.confirm.question'));

    useI18n.setState({ locale: 'es', messages: { en, es } });
    usePreferences.setState({ resetAll: vi.fn() });
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: developer }));
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(screen.getByText(question)).toBeDefined();
  });
});

describe('Export diagnostics', () => {
  it('keeps the object URL alive until the download has had a tick to read it', () => {
    const revoke = vi.fn();
    urlApi.createObjectURL = () => 'blob:encastra/report';
    urlApi.revokeObjectURL = revoke;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<Settings />);
    open('diagnostics');

    vi.useFakeTimers();
    fireEvent.click(
      screen.getByRole('button', { name: english('settings.diagnostics.share.export.button') }),
    );
    expect(revoke).not.toHaveBeenCalled();
    act(() => {
      vi.runAllTimers();
    });
    expect(revoke).toHaveBeenCalledWith('blob:encastra/report');
    expect(screen.queryByText(english('settings.diagnostics.share.export.failed'))).toBeNull();
  });

  it('says so when the export fails, instead of doing nothing', () => {
    urlApi.createObjectURL = () => {
      throw new Error('refused');
    };
    render(<Settings />);
    open('diagnostics');

    fireEvent.click(
      screen.getByRole('button', { name: english('settings.diagnostics.share.export.button') }),
    );
    expect(screen.getByText(english('settings.diagnostics.share.export.failed'))).toBeDefined();
  });
});
