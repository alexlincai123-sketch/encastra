import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS, load, PREFERENCE_KEYS } from '../src/preferences';

/**
 * Preferences have to survive being wrong.
 *
 * Stored settings are the one piece of state a build inherits from an older build, from a
 * different machine, or from a browser profile that has since been locked down. Every case
 * below is a way that inheritance goes wrong, and in none of them is failing to start an
 * acceptable answer.
 */

function withStorage(store: Partial<Storage> & { getItem: (k: string) => string | null }) {
  vi.stubGlobal('localStorage', store as Storage);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('load', () => {
  it('returns the defaults when nothing has been stored', () => {
    withStorage({ getItem: () => null });
    expect(load()).toEqual(DEFAULTS);
  });

  it('returns the defaults when storage itself throws', () => {
    // A browser set to block site data throws on access rather than returning null. Starting
    // with defaults is a worse session; refusing to start is a broken one.
    withStorage({
      getItem: () => {
        throw new Error('access denied');
      },
    });
    expect(load()).toEqual(DEFAULTS);
  });

  it('returns the defaults when the stored value is not JSON', () => {
    withStorage({ getItem: () => 'not json at all' });
    expect(load()).toEqual(DEFAULTS);
  });

  it('keeps what it recognises', () => {
    withStorage({ getItem: () => JSON.stringify({ theme: 'dark', showMinimap: false }) });
    const loaded = load();
    expect(loaded.theme).toBe('dark');
    expect(loaded.showMinimap).toBe(false);
  });

  it('fills in keys an older build never wrote', () => {
    // Upgrading must not leave a preference undefined, because a control with no value has no
    // state to render.
    withStorage({ getItem: () => JSON.stringify({ theme: 'light' }) });
    const loaded = load();
    expect(loaded.theme).toBe('light');
    expect(loaded.snapToGrid).toBe(DEFAULTS.snapToGrid);
    expect(loaded.developerMode).toBe(DEFAULTS.developerMode);
  });

  it('discards a value of the wrong shape rather than the whole file', () => {
    // One hand-edited or stale key should cost that key, not every other setting.
    withStorage({
      getItem: () => JSON.stringify({ showMinimap: 'yes please', theme: 'dark' }),
    });
    const loaded = load();
    expect(loaded.showMinimap).toBe(DEFAULTS.showMinimap);
    expect(loaded.theme).toBe('dark');
  });

  it('ignores keys it does not know about', () => {
    withStorage({ getItem: () => JSON.stringify({ nonsense: true, theme: 'dark' }) });
    expect(Object.keys(load()).sort()).toEqual(Object.keys(DEFAULTS).sort());
  });

  it('starts with the welcome unseen, so a first run is a first run', () => {
    withStorage({ getItem: () => null });
    expect(load().welcomeSeen).toBe(false);
  });
});

describe('PREFERENCE_KEYS', () => {
  it('lists exactly the keys DEFAULTS has, in either direction', () => {
    // The Developer category's raw dump (and anything else that enumerates preferences without
    // wanting a second hand-typed list) reads this instead of `Object.keys(DEFAULTS)` directly —
    // this is what would catch the two falling out of step.
    expect(new Set(PREFERENCE_KEYS)).toEqual(new Set(Object.keys(DEFAULTS)));
  });

  it('has no duplicate keys', () => {
    expect(new Set(PREFERENCE_KEYS).size).toBe(PREFERENCE_KEYS.length);
  });

  it('indexes every key into a loaded Preferences object without a wrong type', () => {
    const loaded = load();
    for (const key of PREFERENCE_KEYS) {
      expect(loaded[key]).not.toBeUndefined();
    }
  });
});
