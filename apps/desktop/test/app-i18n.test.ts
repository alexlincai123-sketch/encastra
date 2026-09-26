import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCALES, type Messages } from '../src/i18n';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import fr from '../src/i18n/locales/fr';
// Imported under its own name for the same reason `i18n.test.ts` and `settings-i18n.test.ts` do:
// `it` is vitest's own test-case function, and shadowing it here would silently run every
// assertion below against the wrong `it`.
import italian from '../src/i18n/locales/it';
import pt from '../src/i18n/locales/pt';

/**
 * The rest of the application, outside Settings.
 *
 * `settings-i18n.test.ts` made the Settings screen structurally hard to regress back to
 * hardcoded English. This file does the same job for every other screen that reads user-visible
 * text: `App.tsx` (the toolbar, status bar and toast list), the canvas, both side panels, and
 * the three top-level views Settings does not cover. It is a sibling rather than an extension of
 * that file on purpose — `settings-i18n.test.ts` is scoped to Settings by name and by its own
 * file-level comment, and growing it to cover the rest of the interface would make a file about
 * one screen's history describe a dozen others instead.
 *
 * Two checks, same as the Settings suite:
 *  - A source-level scanner over every `.tsx` file in this change that renders user-visible
 *    text, proving none of them has a hardcoded English string left in JSX.
 *  - A key-shape parity check between English and every other locale, but over the *whole*
 *    message tree rather than one subtree — `i18n.test.ts`'s own "locale completeness" suite
 *    only ever checks one direction (a locale key must exist in English), so a key present in
 *    English and silently missing from a translation would pass that suite and still fall back
 *    to English at render time without anyone noticing. This file checks both directions, for
 *    every tree, the same guarantee `settings-i18n.test.ts` already gives `settings.*` alone.
 */

const SRC = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

/** Every `.tsx` file outside `views/Settings.tsx` and `settings/controls.tsx` that renders
 * user-visible text — see `settings-i18n.test.ts` for those two. `Palette.tsx`, `Home.tsx` and
 * `Canvas.tsx` were already translated before this change touched anything; they are included
 * anyway, so a regression in an already-finished screen is caught exactly as fast as a regression
 * in one this change just fixed. Files with no user-visible strings at all (`Builder.tsx`, which
 * only wires up the three panels below it) are included too, for the same reason — an empty
 * result is still a result, and a file that later grows a hardcoded string should not have to be
 * remembered and added to this list by hand. */
const SOURCE_FILES = [
  'App.tsx',
  'Sidebar.tsx',
  'canvas/Canvas.tsx',
  'canvas/ComponentNode.tsx',
  'canvas/RefusalToast.tsx',
  'canvas/Wire.tsx',
  'canvas/ContextMenu.tsx',
  'panels/Import.tsx',
  'panels/Inspector.tsx',
  'panels/Palette.tsx',
  'panels/Publish.tsx',
  'panels/RunPanel.tsx',
  'panels/UnsavedChanges.tsx',
  'onboarding/Welcome.tsx',
  'views/Builder.tsx',
  'views/Components.tsx',
  'views/Home.tsx',
  'views/Library.tsx',
  'views/Security.tsx',
].map((path) => ({ path, absolute: SRC(path) }));

/**
 * The same scanner `settings-i18n.test.ts` defines, over the same two shapes of literal (a JSX
 * text node; `label`/`title`/`placeholder`/`aria-label` given a string directly rather than an
 * expression) — duplicated here rather than imported from that file, the same way
 * `settings-i18n.test.ts` duplicates `i18n.test.ts`'s own `flattenKeys` instead of exporting one
 * copy from a test file for another to import. See that file's own comment for exactly what this
 * catches and what it does not; nothing about the shape of the check changes for these files.
 */
const TECHNICAL_TEXT_ALLOWLIST = new Set([
  '.encastra',
  // The brand mark's own wordmark, next to the logo in `App.tsx`'s toolbar — the same
  // legitimately-identical-across-every-locale exception `settings-i18n.test.ts` notes for this
  // exact word ("a handful of strings are legitimately identical across languages by design —
  // the brand name 'Encastra'"). Sentences that happen to contain it — `onboarding.welcome.title`
  // is "Welcome to Encastra" — are unaffected; this only matters for the standalone wordmark.
  'Encastra',
  // Keyboard shortcuts shown as a `title` on the toolbar's New/Open/Save/Run buttons
  // (`App.tsx`) and inside the guided tour's last card (`onboarding/Welcome.tsx`, by way of
  // `onboarding.tour.run.body`). Fixed rather than remappable — see `settings.editor.shortcuts`
  // — and, like a filename, a chord such as "Ctrl+S" is a literal keystroke, not a sentence to
  // translate: it is the same key combination on a German keyboard as on an English one.
  'Ctrl+O',
  'Ctrl+S',
  'Ctrl+Enter',
]);

function findHardcodedText(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const found: string[] = [];

  // `settings-i18n.test.ts`'s own version of this pattern excludes `\n` entirely, which is
  // exactly right for a one-line regression (`<p>Reset all settings</p>`) but was found, while
  // this file was being written, to let a real one through: biome wraps anything but the
  // shortest tag and puts its text on a line of its own — `<button ...>\n  New\n</button>` — and
  // the single-line-only pattern cannot see across that break at all.
  //
  // Simply dropping `\n` from the exclusion is not the fix: a `.tsx` file is full of `>` and `<`
  // that are not JSX (`Array<string>`, `a > b`, a multi-line generic), and once newlines are
  // allowed through, a match started at one of those can run for dozens of lines before meeting
  // the next `<`/`>`, capturing whole functions as "text" (confirmed against this codebase's own
  // files before landing on the version below). The fix bridges only the *one* specific newline
  // shape the formatter actually produces — open-tag-`>`, a line break, one line of text, a line
  // break, close-tag-`<` — rather than newlines in general, so it still cannot run past the next
  // real tag boundary the way the broader version could.
  //
  // One more shape has to be excluded at the regex rather than by character class, because
  // no rule about the text itself can see it: an arrow function whose body compares with
  // `<`. `setActive((index) => (index <= 0 ? last : index - 1))` (`canvas/ContextMenu.tsx`)
  // has a `>` from the arrow and a `<` from the comparison, and everything between them is
  // ordinary English-looking code. Requiring that the opening `>` is not the tail of an `=>`
  // costs nothing — JSX never writes one — and removes the whole class rather than
  // allowlisting the one occurrence, which would come back the next time somebody writes a
  // comparison inside an arrow.
  const textNode = /(^|[^=])>([^<>{}\n]+)</g;
  const wrappedTextNode = /(^|[^=])>[ \t]*\n[ \t]*([^<>{}\n]+)\n[ \t]*</g;
  for (const match of [
    ...withoutComments.matchAll(textNode),
    ...withoutComments.matchAll(wrappedTextNode),
  ]) {
    const text = match[2]?.trim() ?? '';
    if (!text || !/[A-Za-z]/.test(text) || TECHNICAL_TEXT_ALLOWLIST.has(text)) continue;
    // One shape the wrapped-node pattern above still cannot tell from real JSX prose by
    // character class alone: a ternary chaining one conditionally-rendered element to the
    // next — `</div>\n) : wantsHost ? (\n<div ...` (`panels/Inspector.tsx`) — where the `>` and
    // `<` bracketing the "text" belong to two different elements, not one, and the line between
    // them is JS, not a JSX child. No line of actual interface copy in this codebase starts
    // with a bare `)` or ends with a bare `(`; both are otherwise unambiguous tells of this
    // shape, so they are excluded rather than requiring a per-occurrence allowlist entry for
    // every ternary a screen happens to render its JSX with.
    if (/^[)\]]/.test(text) || /[([]$/.test(text)) continue;
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
  it('flags a plain English sentence sitting directly in JSX, on one line', () => {
    expect(findHardcodedText('<p>Reset all settings</p>')).toEqual(['Reset all settings']);
  });

  it('flags the same text when biome has wrapped the tag and put it on its own line', () => {
    // The shape `settings-i18n.test.ts`'s own scanner cannot see — see the comment on the main
    // regex above — and the one this suite actually caught a real regression with while it was
    // being written: `App.tsx`'s "New" button, reintroduced deliberately to prove this file
    // fails before it passes, exactly this way.
    const wrapped = '<button type="button" className="btn" onClick={newProject}>\n  New\n</button>';
    expect(findHardcodedText(wrapped)).toEqual(['New']);
  });

  it('flags a hardcoded literal on label, title, placeholder or aria-label', () => {
    expect(findHardcodedText('<span aria-label="Search components">x</span>')).toContain(
      'Search components',
    );
  });

  it('does not flag text that already goes through t()', () => {
    expect(findHardcodedText('<p>{t("toolbar.new")}</p>')).toEqual([]);
    expect(findHardcodedText('<button title={t("x")}>{t("y")}</button>')).toEqual([]);
  });

  it('does not flag the body of an arrow function that compares with a less-than', () => {
    // The `>` is the arrow's, the `<` is the comparison's, and between them lies code.
    expect(findHardcodedText('setActive((i) => (i <= 0 ? last : i - 1));')).toEqual([]);
  });

  it('does not flag the allowlisted keyboard shortcuts', () => {
    expect(findHardcodedText('<button title="Ctrl+O">{t("x")}</button>')).toEqual([]);
  });

  it('does not flag markup with no text content', () => {
    expect(findHardcodedText('<div>\n  <span></span>\n</div>')).toEqual([]);
  });
});

describe('the files this change touched have no hardcoded English text left', () => {
  it.each(SOURCE_FILES)('$path', ({ absolute }) => {
    const source = readFileSync(absolute, 'utf8');
    expect(findHardcodedText(source)).toEqual([]);
  });
});

// --- Key-shape parity, over the whole tree ------------------------------------------------

/** Mirrors `i18n.test.ts`'s own `flattenKeys` — see that file and `settings-i18n.test.ts` for
 * why each of the three keeps its own small copy rather than importing one. */
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

describe('NON_ENGLISH_LOCALES', () => {
  it('matches LOCALES minus English, so a newly added locale cannot skip this suite unnoticed', () => {
    expect(new Set(NON_ENGLISH_LOCALES)).toEqual(new Set(LOCALES.filter((l) => l !== 'en')));
  });
});

describe('every locale has exactly the same leaf keys as English, over the whole tree', () => {
  const englishKeys = new Set(flattenKeys(en));

  it.each(NON_ENGLISH_LOCALES)('%s — no fewer, no extra', (locale) => {
    // The direction `i18n.test.ts`'s own "locale completeness" suite does not cover: a key
    // present in English must also be present in this locale, not merely absent-and-therefore
    // silently falling back to English. `settings-i18n.test.ts` already proves this for
    // `settings.*` alone; this is the same guarantee for every tree a translation might touch,
    // including ones added after this change.
    const theirs = new Set(flattenKeys(LOCALE_MODULES[locale]));
    const missing = [...englishKeys].filter((key) => !theirs.has(key));
    const extra = [...theirs].filter((key) => !englishKeys.has(key));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });
});
