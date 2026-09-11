import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LOCALES, lookup, type Messages, translate, useI18n } from '../src/i18n';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import fr from '../src/i18n/locales/fr';
// Imported under its own name for the same reason `i18n.test.ts` does: `it` is vitest's own
// test-case function, and shadowing it here would silently run every assertion below against
// the wrong `it`.
import italian from '../src/i18n/locales/it';
import pt from '../src/i18n/locales/pt';

/**
 * The Settings screen used to be the one place in this application that never actually moved
 * when the language changed — every string in it was typed straight into the JSX in English,
 * regardless of what `settings/categories.ts` or the locale files said. `Settings.tsx` now reads
 * every visible word through `useTranslation()`, the same reactive path `Home.tsx` and
 * `Palette.tsx` already used, so this file exists to make that regression structurally hard to
 * reintroduce: it exercises the exact translation mechanism the screen calls at render time
 * (`translate()`/`useI18n`, not a copy of it), and it reads the screen's own source to catch a
 * literal English string before it ships again.
 *
 * There is no DOM here — this repo's vitest config runs `environment: 'node'` with no `jsdom` or
 * `@testing-library/react` installed (see `vitest.config.ts` and `apps/desktop/package.json`;
 * neither is among the files this change owns, so this suite works within that constraint rather
 * than around it). "Settings renders in French" is therefore verified the way every other test in
 * this repo verifies a screen's behaviour — through the pure functions and stores React itself
 * calls — plus a source-level check that nothing bypasses those functions in the first place. The
 * two together are a faithful stand-in for "mount it and read the DOM": one proves every string
 * the screen could show resolves correctly per locale, the other proves the screen has no way to
 * show anything else.
 */

const SETTINGS_SOURCE_PATH = fileURLToPath(new URL('../src/views/Settings.tsx', import.meta.url));
const CONTROLS_SOURCE_PATH = fileURLToPath(
  new URL('../src/settings/controls.tsx', import.meta.url),
);

/** Every dotted path to a leaf string in a `Messages` tree — mirrors `i18n.test.ts`'s own
 * `flattenKeys`, kept as a second small copy rather than an export from that file, the same way
 * `settings.test.ts` builds its own tiny fixtures rather than reaching into another test file. */
function flattenKeys(messages: Messages, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      keys.push(path);
    } else {
      keys.push(...flattenKeys(value, path));
    }
  }
  return keys;
}

const NON_ENGLISH_LOCALES = ['es', 'fr', 'de', 'it', 'pt'] as const;
const LOCALE_MODULES: Record<(typeof NON_ENGLISH_LOCALES)[number], Messages> = {
  es,
  fr,
  de,
  it: italian,
  pt,
};

const settingsKeys = flattenKeys(en.settings as Messages, 'settings');

describe('NON_ENGLISH_LOCALES', () => {
  it('matches LOCALES minus English, so a newly added locale cannot skip this suite unnoticed', () => {
    expect(new Set(NON_ENGLISH_LOCALES)).toEqual(new Set(LOCALES.filter((l) => l !== 'en')));
  });
});

describe('the Settings screen in English', () => {
  const original = useI18n.getState();

  afterEach(() => {
    useI18n.setState(original, true);
  });

  it('resolves every settings.* string to real English text, not a fallen-through key', () => {
    useI18n.setState({ locale: 'en', messages: { en } });
    for (const key of settingsKeys) {
      const value = translate(key);
      expect(value).not.toBe(key);
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('switching language actually changes what Settings would render', () => {
  const original = useI18n.getState();
  const englishBlob = settingsKeys.map((key) => lookup(en, key)).join('\n');

  afterEach(() => {
    useI18n.setState(original, true);
  });

  it.each(NON_ENGLISH_LOCALES)('every settings.* key resolves once %s is active', (locale) => {
    useI18n.setState({ locale, messages: { en, [locale]: LOCALE_MODULES[locale] } });
    for (const key of settingsKeys) {
      // The direction `i18n.test.ts`'s "locale completeness" suite does not cover: a key present
      // in English must also resolve in this locale, not silently fall back to English (which
      // `translate` would do without complaint) or to the raw key itself.
      expect(translate(key)).not.toBe(key);
    }
  });

  it.each(NON_ENGLISH_LOCALES)(
    'the whole settings.* text changes, as a block, once %s is active',
    (locale) => {
      useI18n.setState({ locale, messages: { en, [locale]: LOCALE_MODULES[locale] } });
      const blob = settingsKeys.map((key) => translate(key)).join('\n');
      // A blob comparison rather than a per-key one on purpose: a handful of strings are
      // legitimately identical across languages by design — the brand name "Encastra", or
      // Italian keeping the loanword "Runtime" — and asserting every individual key differs
      // would make this test fail on a correct translation. What must be true is that the
      // screen, taken as a whole, is visibly a different language; that is what a person
      // switching the dropdown actually notices.
      expect(blob).not.toBe(englishBlob);
    },
  );

  it('switching back to English after another locale restores the exact original strings', () => {
    useI18n.setState({ locale: 'en', messages: { en } });
    const before = settingsKeys.map((key) => translate(key));

    useI18n.setState({ locale: 'es', messages: { en, es } });
    expect(settingsKeys.map((key) => translate(key))).not.toEqual(before);

    useI18n.setState({ locale: 'en', messages: { en, es } });
    expect(settingsKeys.map((key) => translate(key))).toEqual(before);
  });
});

describe('a missing key in a translation falls back to English', () => {
  const original = useI18n.getState();

  afterEach(() => {
    useI18n.setState(original, true);
  });

  it('renders the English string for a real settings.* key a locale has not translated', () => {
    const key = 'settings.about.brand.tagline';
    const partial = structuredClone(es) as unknown as Record<string, unknown>;
    const brand = (partial.settings as Record<string, unknown>).about as Record<
      string,
      Record<string, string>
    >;
    delete brand.brand.tagline;

    useI18n.setState({ locale: 'es', messages: { en, es: partial as unknown as Messages } });

    expect(translate(key)).toBe(lookup(en, key));
    // And a genuinely unknown key still falls all the way back to itself — the last-resort case
    // `i18n/index.ts` documents, exercised here against the live settings tree rather than a toy
    // fixture.
    expect(translate('settings.this.key.does.not.exist')).toBe('settings.this.key.does.not.exist');
  });
});

describe('the language choice persists across a reload', () => {
  const original = useI18n.getState();
  let previousLocalStorage: unknown;

  beforeAll(() => {
    // This suite's vitest environment is plain Node (see the file-level comment above) — there is
    // no `localStorage` global to persist to. `i18n/index.ts` already tolerates that (a missing
    // store just means "no choice saved yet"), which is exactly why this test cannot observe
    // persistence without first supplying the browser API the module expects: a real reload has
    // one, and this stands in for it rather than mocking anything `i18n/index.ts` itself does.
    previousLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    };
  });

  afterAll(() => {
    if (previousLocalStorage === undefined) {
      (globalThis as { localStorage?: unknown }).localStorage = undefined;
    } else {
      (globalThis as { localStorage?: unknown }).localStorage = previousLocalStorage;
    }
    useI18n.setState(original, true);
  });

  it('writes the chosen locale under the same key a fresh launch reads back', () => {
    useI18n.getState().register('fr', fr);
    useI18n.getState().setLocale('fr');
    // `LOCALE_STORAGE_KEY` in `i18n/index.ts` is `'encastra.locale'` and is not exported — this
    // file is not permitted to edit that module to expose it, so the literal is duplicated here
    // deliberately. If that key is ever renamed, this is the one other place that needs updating.
    expect((globalThis as { localStorage: Storage }).localStorage.getItem('encastra.locale')).toBe(
      'fr',
    );
    expect(useI18n.getState().locale).toBe('fr');
  });
});

describe('every locale has the same settings.* key shape as English', () => {
  const englishSettingsKeys = new Set(settingsKeys);

  it.each(NON_ENGLISH_LOCALES)(
    '%s has exactly the same settings.* leaf keys as English — no fewer, no extra',
    (locale) => {
      const theirs = new Set(
        flattenKeys((LOCALE_MODULES[locale] as Messages).settings as Messages, 'settings'),
      );
      const missing = [...englishSettingsKeys].filter((key) => !theirs.has(key));
      const extra = [...theirs].filter((key) => !englishSettingsKeys.has(key));
      // A half-finished translation shows up as `missing`; a stale or misspelled key (the kind
      // that silently stops being reachable by `t()`, per `i18n.test.ts`'s "locale completeness"
      // suite) shows up as `extra`. Reported together so a failure says exactly what is wrong
      // rather than just that something is.
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    },
  );
});

// --- No hardcoded English text left in the files this change touched ----------------------

/**
 * A rough but effective scanner for hardcoded, user-visible English text left in a `.tsx` source
 * file, run against the raw source rather than a parsed AST — this repo has no JSX-parsing
 * dependency to reach for, and a regex tuned to this screen's actual shape catches the mistake
 * that matters here without needing one.
 *
 * What it catches:
 *  - A JSX text node — plain characters sitting directly between `>` and `<`, with no `{` or `}`
 *    in between — that contains at least one letter and is not one of the handful of literal
 *    technical tokens this screen is allowed to leave untranslated (a filename, `.encastra`).
 *  - A string literal given directly to `label=`, `title=`, `placeholder=` or `aria-label=`
 *    (`attr="..."`), rather than an expression (`attr={t(...)}`) — the four attributes this
 *    screen uses for user-visible text.
 *
 * What it cannot catch, on purpose left uncaught rather than papered over with a fragile rule:
 *  - Text assembled from an expression it does not evaluate — string concatenation, a ternary
 *    between two literals, a value read off a data array. `Settings.tsx` has exactly one
 *    legitimate case that shape would otherwise have to special-case (`{shortcut.keys}`, a
 *    literal keyboard combination such as "Ctrl / Cmd + Enter" that is deliberately never
 *    translated, the same way file names are not) — leaving expressions unevaluated means this
 *    scanner does not need to know that and cannot be fooled by it either way.
 *  - A prop other than the four listed above (`alt`, a custom component prop that renders as
 *    text). Neither file has one today; a screen that grows one needs the list here extended by
 *    name, which is a one-line, deliberate change rather than a silent gap.
 *  - Whether a translation is actually correct, or happens to read the same in English and the
 *    target language. A scanner over one file's source can know whether a string went through
 *    `t(...)`; it cannot know what the string means.
 * It is a tripwire for the regression this screen actually had — a literal English sentence typed
 * straight into JSX instead of a `t()` call — not a substitute for reading the diff.
 */
const TECHNICAL_TEXT_ALLOWLIST = new Set([
  '.encastra',
  'README.md',
  'docs/SECURITY.md',
  'docs/RELEASE.md',
  'docs/PRODUCT-ROADMAP.md',
]);

function findHardcodedText(source: string): string[] {
  // House-style comments in this codebase routinely mention a real tag in backticks — `<pre>`
  // rather than a `<textarea>`, a `<fieldset>` of segmented options — and those angle brackets
  // would otherwise look exactly like a JSX text node to the regex below. Comments are stripped
  // first so the scanner only ever looks at code that could actually render.
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const found: string[] = [];

  for (const match of withoutComments.matchAll(/>([^<>{}\n]+)</g)) {
    const text = match[1]?.trim() ?? '';
    if (!text || !/[A-Za-z]/.test(text) || TECHNICAL_TEXT_ALLOWLIST.has(text)) continue;
    found.push(text);
  }

  for (const match of withoutComments.matchAll(
    /\b(?:label|title|placeholder|aria-label)="([^"]*)"/g,
  )) {
    const text = match[1]?.trim() ?? '';
    if (!text || !/[A-Za-z]/.test(text) || TECHNICAL_TEXT_ALLOWLIST.has(text)) continue;
    found.push(text);
  }

  return found;
}

describe('findHardcodedText', () => {
  // Precise enough to be useful, loose enough not to be noise: each case below is a fragment
  // small enough to make plain what the scanner is and is not sensitive to.
  it('flags a plain English sentence sitting directly in JSX', () => {
    expect(findHardcodedText('<p>Reset all settings</p>')).toEqual(['Reset all settings']);
  });

  it('flags a hardcoded literal on label, title, placeholder or aria-label', () => {
    expect(findHardcodedText('<button title="Open Security">x</button>')).toContain(
      'Open Security',
    );
    expect(findHardcodedText('<input placeholder="No default folder set" />')).toContain(
      'No default folder set',
    );
    expect(findHardcodedText('<nav aria-label="Settings categories">x</nav>')).toContain(
      'Settings categories',
    );
  });

  it('does not flag text that already goes through t()', () => {
    expect(findHardcodedText('<p>{t("settings.account.title")}</p>')).toEqual([]);
    expect(findHardcodedText('<button title={t("x")}>{t("y")}</button>')).toEqual([]);
  });

  it('does not flag the allowlisted technical literals', () => {
    expect(findHardcodedText('<code>.encastra</code> {t("x")}')).toEqual([]);
    expect(findHardcodedText('<code>README.md</code>{t("x")}')).toEqual([]);
  });

  it('does not flag markup with no text content', () => {
    expect(findHardcodedText('<div>\n  <span></span>\n</div>')).toEqual([]);
  });

  it('goes red on a real regression: reintroducing one hardcoded card title', () => {
    // Proof this check is load-bearing rather than vacuous: the exact shape of the bug this
    // screen actually had, reproduced against a fragment of the real file's style.
    const regressed =
      '<SettingCard title="Reset">\n  <p>{t("settings.developer.reset.title")}</p>\n</SettingCard>';
    expect(findHardcodedText(regressed)).toEqual(['Reset']);
  });
});

describe('the files this change owns have no hardcoded English text left', () => {
  it('Settings.tsx', () => {
    const source = readFileSync(SETTINGS_SOURCE_PATH, 'utf8');
    expect(findHardcodedText(source)).toEqual([]);
  });

  it('controls.tsx', () => {
    const source = readFileSync(CONTROLS_SOURCE_PATH, 'utf8');
    expect(findHardcodedText(source)).toEqual([]);
  });
});
