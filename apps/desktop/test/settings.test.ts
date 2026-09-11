import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  countGrants,
  DEFAULT_CATEGORY,
  findCategory,
  isCategoryId,
  isNavKey,
  moveIndex,
  summarizeComponents,
} from '../src/settings/categories';
import type { ComponentManifest } from '../src/types';

/**
 * The pure logic behind the Settings screen: the category list, roving-focus arithmetic in the
 * sidebar, and the counts shown in the Components category. Nothing here touches React, because
 * none of it needs to — a wrong wrap-around or a hardcoded count is a bug whether or not anyone
 * ever clicks through the sidebar to see it.
 */

function manifest(overrides: Partial<ComponentManifest> & { id: string }): ComponentManifest {
  return {
    schema: 1,
    version: '0.0.1',
    name: overrides.id,
    runtime: 'native',
    kind: 'core',
    ports: { inputs: {}, outputs: {} },
    config: {},
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    retryable: false,
    ...overrides,
  };
}

describe('CATEGORIES', () => {
  it('has no duplicate ids', () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every category a non-empty label and description', () => {
    for (const category of CATEGORIES) {
      expect(category.label.trim()).not.toBe('');
      expect(category.description.trim()).not.toBe('');
      // The description is meant to say more than the label repeats.
      expect(category.description.toLowerCase()).not.toBe(category.label.toLowerCase());
    }
  });

  it('puts About last, where people look once they are oriented', () => {
    const last = CATEGORIES.at(-1);
    expect(last?.id).toBe('about');
  });

  it('defaults to the first category in the list', () => {
    expect(DEFAULT_CATEGORY).toBe(CATEGORIES[0]?.id);
  });
});

describe('isCategoryId', () => {
  it('accepts every id actually in the list', () => {
    for (const category of CATEGORIES) {
      expect(isCategoryId(category.id)).toBe(true);
    }
  });

  it('rejects a string that is not one of them', () => {
    expect(isCategoryId('preferences')).toBe(false);
    expect(isCategoryId('')).toBe(false);
  });
});

describe('findCategory', () => {
  it('finds the category for a valid id', () => {
    expect(findCategory('editor').label).toBe('Editor');
  });

  it('falls back to General rather than throwing for a stale id', () => {
    // A category id could, in principle, arrive from somewhere other than the sidebar (a saved
    // tab, say) and no longer match anything after a rename. This must degrade, not crash.
    const stale = 'no-longer-exists' as unknown as Parameters<typeof findCategory>[0];
    expect(findCategory(stale).id).toBe('general');
  });
});

describe('isNavKey', () => {
  it('recognises the four keys the sidebar moves on', () => {
    expect(isNavKey('ArrowUp')).toBe(true);
    expect(isNavKey('ArrowDown')).toBe(true);
    expect(isNavKey('Home')).toBe(true);
    expect(isNavKey('End')).toBe(true);
  });

  it('leaves every other key alone', () => {
    expect(isNavKey('Enter')).toBe(false);
    expect(isNavKey('a')).toBe(false);
    expect(isNavKey('Tab')).toBe(false);
  });
});

describe('moveIndex', () => {
  const length = 5;

  it('moves down by one', () => {
    expect(moveIndex(0, 'ArrowDown', length)).toBe(1);
    expect(moveIndex(2, 'ArrowDown', length)).toBe(3);
  });

  it('moves up by one', () => {
    expect(moveIndex(2, 'ArrowUp', length)).toBe(1);
  });

  it('wraps from the last item down to the first', () => {
    expect(moveIndex(length - 1, 'ArrowDown', length)).toBe(0);
  });

  it('wraps from the first item up to the last', () => {
    expect(moveIndex(0, 'ArrowUp', length)).toBe(length - 1);
  });

  it('jumps to the ends on Home and End regardless of where focus was', () => {
    expect(moveIndex(3, 'Home', length)).toBe(0);
    expect(moveIndex(1, 'End', length)).toBe(length - 1);
  });

  it('leaves the index alone for a list with nothing in it', () => {
    expect(moveIndex(0, 'ArrowDown', 0)).toBe(0);
  });

  it('agrees with the real category count, so a future category never breaks the wrap', () => {
    expect(moveIndex(CATEGORIES.length - 1, 'ArrowDown', CATEGORIES.length)).toBe(0);
    expect(moveIndex(0, 'ArrowUp', CATEGORIES.length)).toBe(CATEGORIES.length - 1);
  });
});

describe('summarizeComponents', () => {
  it('counts nothing installed as nothing installed', () => {
    expect(summarizeComponents({})).toEqual({ total: 0, core: 0, thirdParty: 0 });
  });

  it('splits core from third-party the same way the Security screen does', () => {
    const manifests = {
      a: manifest({ id: 'a', kind: 'core' }),
      b: manifest({ id: 'b', kind: 'core' }),
      c: manifest({ id: 'c', kind: 'wasm' }),
    };
    expect(summarizeComponents(manifests)).toEqual({ total: 3, core: 2, thirdParty: 1 });
  });

  it('never reports more third-party components than the total', () => {
    const manifests = {
      a: manifest({ id: 'a', kind: 'core' }),
      b: manifest({ id: 'b', kind: 'core' }),
    };
    const summary = summarizeComponents(manifests);
    expect(summary.thirdParty).toBeGreaterThanOrEqual(0);
    expect(summary.core + summary.thirdParty).toBe(summary.total);
  });
});

describe('countGrants', () => {
  it('counts nothing allowed as zero', () => {
    expect(countGrants([])).toBe(0);
  });

  it('counts one grant per entry, duplicates included', () => {
    expect(
      countGrants([
        { node: 'n1', kind: 'fs.read' },
        { node: 'n1', kind: 'fs.write' },
      ]),
    ).toBe(2);
  });
});
