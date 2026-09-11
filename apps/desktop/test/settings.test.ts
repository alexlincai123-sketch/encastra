import { describe, expect, it } from 'vitest';
import { lookup, type Messages } from '../src/i18n';
import en from '../src/i18n/locales/en';
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
  renderDiagnostics,
} from '../src/settings/diagnostics';
import type { Capability, ComponentManifest } from '../src/types';

/**
 * The pure logic behind the Settings screen: the category list, roving-focus arithmetic in the
 * sidebar, and the counts shown in the Components category. Nothing here touches React, because
 * none of it needs to — a wrong wrap-around or a hardcoded count is a bug whether or not anyone
 * ever clicks through the sidebar to see it.
 *
 * `categories.ts` itself no longer carries English label/description text — that lives once, in
 * `i18n/locales/en.ts`, under `settings.categories.<id>` — so every assertion below that used to
 * read `category.label` reads the English locale directly instead. `en` doubles as a translation
 * fixture and as a plain object every `t()` call can be checked against without mounting React.
 */

/** The English text for a category, the same way `Settings.tsx` would fetch it via `t()` — just
 * against the English tree directly, since none of this file touches the store or React. */
function categoryText(id: CategoryId): { label: string; description: string } {
  return {
    label: lookup(en, `settings.categories.${id}.label`) ?? '',
    description: lookup(en, `settings.categories.${id}.description`) ?? '',
  };
}

/** A minimal stand-in for `useTranslation().t`, backed by the English locale — enough to exercise
 * `capabilityLabel`'s lookup without mounting a component. */
function englishT(key: string): string {
  return lookup(en as Messages, key) ?? key;
}

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

  it('gives every category a non-empty label and description in English', () => {
    for (const category of CATEGORIES) {
      const { label, description } = categoryText(category.id);
      expect(label.trim()).not.toBe('');
      expect(description.trim()).not.toBe('');
      // The description is meant to say more than the label repeats.
      expect(description.toLowerCase()).not.toBe(label.toLowerCase());
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
    expect(findCategory('editor').id).toBe('editor');
    expect(categoryText('editor').label).toBe('Editor');
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
    expect(capabilityLabel('fs.read', englishT)).toBe('Read files');
    expect(capabilityLabel('net.http', englishT)).toBe('Use the network');
  });

  it('falls back to the raw kind for one it does not recognise, rather than hiding it', () => {
    expect(capabilityLabel('gpu.compute', englishT)).toBe('gpu.compute');
  });

  it('goes through the translator it is given, not a hardcoded string', () => {
    // `capabilityLabel` must not carry its own English text — if it did, this would still say
    // "Read files" no matter what `t` returned.
    expect(capabilityLabel('fs.read', () => 'Leer archivos')).toBe('Leer archivos');
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

  const input = {
    about: null as typeof about | null,
    manifests: {} as Record<string, ReturnType<typeof manifest>>,
    runtimeAttached: false,
    userAgent: 'ua',
    platform: 'Windows',
    architecture: 'x64',
    gpu: null as string | null,
  };

  /**
   * What a row resolves to, without a language.
   *
   * A row is now either a datum (the same characters in every language) or a key pointing at a
   * sentence. Asserting on whichever one it carries keeps these tests about the *logic* —
   * which branch a given input takes — and leaves the wording to the locale files, where it
   * belongs and where a separate suite already checks all six agree.
   */
  function resolve(rows: ReturnType<typeof assembleDiagnostics>, key: string): string | undefined {
    const row = rows.find((candidate) => candidate.key === `settings.diagnostics.rows.${key}`);
    return row?.literal ?? row?.valueKey ?? undefined;
  }

  it('reports unknown rather than throwing when About has not loaded yet', () => {
    const rows = assembleDiagnostics({ ...input });
    expect(resolve(rows, 'version')).toBe('settings.shared.version.unknown');
    expect(resolve(rows, 'protocolSchema')).toBe('settings.shared.version.unknown');
  });

  it('says browser preview rather than the runtime string when nothing is attached', () => {
    const rows = assembleDiagnostics({ ...input, about });
    expect(resolve(rows, 'runtime')).toBe('settings.shared.runtimeStatus.notAttached');
  });

  it('reports the real build values once About has loaded and a runtime is attached', () => {
    const rows = assembleDiagnostics({
      ...input,
      about,
      manifests: { a: manifest({ id: 'a' }), b: manifest({ id: 'b' }) },
      runtimeAttached: true,
      gpu: 'Example Renderer',
    });
    expect(resolve(rows, 'version')).toBe('0.3.0');
    expect(resolve(rows, 'runtime')).toBe('1.2.0');
    expect(resolve(rows, 'protocolSchema')).toBe('3');
    expect(resolve(rows, 'projectSchema')).toBe('2');
    expect(resolve(rows, 'components')).toBe('2');
    expect(resolve(rows, 'gpu')).toBe('Example Renderer');
  });

  it('says GPU is not discoverable rather than leaving it blank', () => {
    const rows = assembleDiagnostics({ ...input });
    expect(resolve(rows, 'gpu')).toBe('settings.diagnostics.rows.gpuUnknown');
  });

  it('marks a platform the WebView did not disclose as a sentence, not as the word itself', () => {
    const rows = assembleDiagnostics({
      ...input,
      platform: detectPlatform('nothing recognisable'),
      architecture: detectArchitecture('nothing recognisable'),
    });
    expect(resolve(rows, 'platform')).toBe('settings.diagnostics.rows.platformUnknown');
    expect(resolve(rows, 'architecture')).toBe('settings.diagnostics.rows.architectureUnknown');
  });

  it('never includes a project path, a preference key or anything that looks like a secret', () => {
    const rows = assembleDiagnostics({ ...input, about, runtimeAttached: true });
    const text = diagnosticsToText(renderDiagnostics(rows, (key) => key)).toLowerCase();
    expect(text).not.toContain('c:\\');
    expect(text).not.toContain('token');
  });
});

describe('renderDiagnostics', () => {
  it('translates the label and a prose value, and leaves a datum alone', () => {
    const rendered = renderDiagnostics(
      [
        { key: 'label.key', literal: '0.3.0', valueKey: null },
        { key: 'other.key', literal: null, valueKey: 'value.key' },
      ],
      (key) => `[${key}]`,
    );
    expect(rendered).toEqual([
      { label: '[label.key]', value: '0.3.0' },
      { label: '[other.key]', value: '[value.key]' },
    ]);
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
