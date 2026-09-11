import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  type CategoryId,
  capabilityLabel,
  countGrants,
  DEFAULT_CATEGORY,
  findCategory,
  isCategoryId,
  isNavKey,
  moveIndex,
  reachOf,
  summarizeComponents,
} from '../src/settings/categories';
import {
  assembleDiagnostics,
  detectArchitecture,
  detectGpuRenderer,
  detectPlatform,
  diagnosticsToText,
} from '../src/settings/diagnostics';
import type { Capability, ComponentManifest } from '../src/types';

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

  it('covers exactly the architecture the product asked for', () => {
    // Order-independent on purpose — the sidebar order is a design decision (About last,
    // General first) asserted separately above; this only guards against a category being
    // silently dropped or duplicated under a different id while the screen is reorganised.
    const expected: CategoryId[] = [
      'general',
      'appearance',
      'language',
      'workspace',
      'projects',
      'editor',
      'canvas',
      'runtime',
      'components',
      'security',
      'privacy',
      'notifications',
      'files',
      'updates',
      'account',
      'developer',
      'diagnostics',
      'about',
    ];
    expect(new Set(CATEGORIES.map((c) => c.id))).toEqual(new Set(expected));
    expect(CATEGORIES.length).toBe(expected.length);
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

describe('capabilityLabel', () => {
  it('gives a plain-language name to a known capability kind', () => {
    expect(capabilityLabel('fs.read')).toBe('Read files');
    expect(capabilityLabel('net.http')).toBe('Use the network');
  });

  it('falls back to the raw kind for one it does not recognise, rather than hiding it', () => {
    expect(capabilityLabel('gpu.compute')).toBe('gpu.compute');
  });
});

describe('reachOf', () => {
  function capability(overrides: Partial<Capability> & { kind: string }): Capability {
    return { scope: 'workflow', reason: 'because the workflow asked for it', ...overrides };
  }

  it('reports nothing for a component with no capabilities', () => {
    expect(reachOf(manifest({ id: 'a', capabilities: [] }))).toEqual([]);
  });

  it('passes through a real capability untouched', () => {
    const read = capability({ kind: 'fs.read' });
    expect(reachOf(manifest({ id: 'a', capabilities: [read] }))).toEqual([read]);
  });

  it('filters out input-handles bookkeeping, the same way the Security screen does', () => {
    const read = capability({ kind: 'fs.read' });
    const handles = capability({ kind: 'fs.read', scope: 'input-handles' });
    const reach = reachOf(manifest({ id: 'a', capabilities: [read, handles] }));
    expect(reach).toEqual([read]);
  });
});

describe('diagnostics detection', () => {
  describe('detectPlatform', () => {
    it('recognises Windows', () => {
      expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    });

    it('recognises macOS', () => {
      expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macOS');
    });

    it('recognises Linux', () => {
      expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux');
    });

    it('says Unknown rather than guessing', () => {
      expect(detectPlatform('something nobody has seen before')).toBe('Unknown');
    });
  });

  describe('detectArchitecture', () => {
    it('recognises 64-bit Windows', () => {
      expect(detectArchitecture('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('x64');
    });

    it('recognises Apple Silicon', () => {
      expect(detectArchitecture('Mozilla/5.0 (Macintosh; ARM64 Mac OS X 14_0)')).toBe('ARM64');
    });

    it('says so rather than guessing when the WebView does not report it', () => {
      expect(detectArchitecture('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(
        'Not reported by the WebView',
      );
    });
  });

  describe('detectGpuRenderer', () => {
    it('comes back empty rather than throwing when there is no DOM', () => {
      // vitest runs this suite with `environment: 'node'` — there is no `document` here, which
      // is exactly the case a locked-down or headless machine looks like too.
      expect(detectGpuRenderer()).toBeNull();
    });
  });
});

describe('assembleDiagnostics', () => {
  const about = { version: '0.3.0', runtime: '1.2.0', protocolSchema: 3, projectSchema: 2 };

  function rowValue(
    rows: ReturnType<typeof assembleDiagnostics>,
    label: string,
  ): string | undefined {
    return rows.find((row) => row.label === label)?.value;
  }

  it('reports unknown rather than throwing when About has not loaded yet', () => {
    const rows = assembleDiagnostics({
      about: null,
      manifests: {},
      runtimeAttached: false,
      userAgent: 'ua',
      platform: 'Windows',
      architecture: 'x64',
      gpu: null,
    });
    expect(rowValue(rows, 'Encastra version')).toBe('unknown');
    expect(rowValue(rows, 'Component protocol schema')).toBe('unknown');
  });

  it('says browser preview rather than the runtime string when nothing is attached', () => {
    const rows = assembleDiagnostics({
      about,
      manifests: {},
      runtimeAttached: false,
      userAgent: 'ua',
      platform: 'Windows',
      architecture: 'x64',
      gpu: null,
    });
    expect(rowValue(rows, 'Runtime')).toBe('not attached — browser preview');
  });

  it('reports the real build values once About has loaded and a runtime is attached', () => {
    const rows = assembleDiagnostics({
      about,
      manifests: { a: manifest({ id: 'a' }), b: manifest({ id: 'b' }) },
      runtimeAttached: true,
      userAgent: 'ua',
      platform: 'Windows',
      architecture: 'x64',
      gpu: 'Example Renderer',
    });
    expect(rowValue(rows, 'Encastra version')).toBe('0.3.0');
    expect(rowValue(rows, 'Runtime')).toBe('1.2.0');
    expect(rowValue(rows, 'Component protocol schema')).toBe('3');
    expect(rowValue(rows, 'Project format schema')).toBe('2');
    expect(rowValue(rows, 'Installed components')).toBe('2');
    expect(rowValue(rows, 'GPU')).toBe('Example Renderer');
  });

  it('says GPU is not discoverable rather than leaving it blank', () => {
    const rows = assembleDiagnostics({
      about: null,
      manifests: {},
      runtimeAttached: false,
      userAgent: 'ua',
      platform: 'Windows',
      architecture: 'x64',
      gpu: null,
    });
    expect(rowValue(rows, 'GPU')).toBe('Not discoverable');
  });

  it('never includes a project path, a preference key or anything that looks like a secret', () => {
    const rows = assembleDiagnostics({
      about,
      manifests: {},
      runtimeAttached: true,
      userAgent: 'ua',
      platform: 'Windows',
      architecture: 'x64',
      gpu: null,
    });
    const text = diagnosticsToText(rows).toLowerCase();
    expect(text).not.toContain('c:\\');
    expect(text).not.toContain('token');
    expect(text).not.toContain('key');
  });
});

describe('diagnosticsToText', () => {
  it('renders nothing as an empty string', () => {
    expect(diagnosticsToText([])).toBe('');
  });

  it('renders one label: value pair per line, in order', () => {
    const text = diagnosticsToText([
      { label: 'A', value: '1' },
      { label: 'B', value: '2' },
    ]);
    expect(text).toBe('A: 1\nB: 2');
  });
});
