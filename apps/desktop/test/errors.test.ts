/**
 * The contract between the runtime's refusals and the six languages the interface speaks.
 *
 * Three questions, and each of them is a way the application would otherwise show somebody
 * English — or nothing — at the moment it says no:
 *
 * 1. **Does every tag the runtime can send have a key here?** The list is written by a Rust test
 *    (`apps/desktop/src-tauri/src/error.rs`) into `fixtures/error-kinds.json`, the same way
 *    `packages/protocol/data/compat-matrix.json` pins the type graph. A variant added on the Rust
 *    side and not mapped here fails this file rather than reaching a person as a raw tag.
 * 2. **Does every key exist in every locale?** `translate()` falls back to English for a missing
 *    key, which is the right behaviour at runtime and a silent failure in a test — so the locale
 *    files are read directly rather than through the store.
 * 3. **Is the translation actually a translation?** A key copied into `es.ts` with the English
 *    sentence still in it passes every check above. So each refusal is described in all six
 *    languages and the five non-English ones are required to differ.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APP_ERROR_KEYS,
  BUNDLE_ERROR_KEYS,
  describeAppError,
  describeStatusMessage,
  GRANT_REFUSAL_KEYS,
  importErrorIn,
  isAppError,
  LIBRARY_ERROR_KEYS,
  PROJECT_ERROR_KEYS,
  STATUS_MESSAGE_KEYS,
  statusMessageKey,
  UNKNOWN_ERROR_KEY,
} from '../src/errors';
import { LOCALES, type Locale, lookup, type Messages, translate, useI18n } from '../src/i18n';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import fr from '../src/i18n/locales/fr';
import italian from '../src/i18n/locales/it';
import pt from '../src/i18n/locales/pt';
import { IMPORT_ERROR_KEYS } from '../src/library';
import type { AppError, StatusMessage } from '../src/types';

const KINDS: {
  app: string[];
  grant: string[];
  project: string[];
  library: string[];
  bundle: string[];
  import: string[];
  status: string[];
} = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/error-kinds.json', import.meta.url)), 'utf8'),
);

const MESSAGES: Record<Locale, Messages> = {
  en,
  es,
  fr,
  de,
  it: italian,
  pt,
};

/** Translates in a named locale without touching the real store's active language. */
function inLocale(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) =>
    translate(key, vars, {
      ...useI18n.getState(),
      locale,
      messages: MESSAGES,
    });
}

/**
 * One example of every `AppError`, in the order the runtime declares them.
 *
 * Built by hand rather than generated, because the point is to exercise the values a sentence
 * interpolates as well as the tag: a key whose placeholders do not match what the runtime sends
 * renders a sentence with `{reason}` still in it, and only a real payload shows that.
 */
const SAMPLES: AppError[] = [
  { kind: 'runtime-busy' },
  { kind: 'library-busy' },
  { kind: 'chooser-did-not-return' },
  { kind: 'not-a-folder-on-this-machine' },
  { kind: 'folder-unusable', reason: 'that is not a folder' },
  { kind: 'not-a-project' },
  { kind: 'project', error: { kind: 'archive', reason: 'not a zip' } },
  { kind: 'version-not-in-project' },
  { kind: 'versions-not-in-project' },
  {
    kind: 'grants-refused',
    refusals: [
      { kind: 'folder-unusable', node: 'save', reason: 'that is not a folder' },
      { kind: 'folder-not-chosen', node: 'save' },
      { kind: 'not-declared', node: 'save', capability: 'system.clipboard' },
    ],
  },
  { kind: 'working-folder', reason: 'permission denied' },
  { kind: 'input-unreadable', path: 'a.png', reason: 'entity not found' },
  { kind: 'workflow-already-running' },
  { kind: 'workflow-invalid', problems: 2 },
  { kind: 'workflow-not-started', reason: 'too many threads' },
  { kind: 'destination-missing' },
  { kind: 'destination-is-a-link' },
  { kind: 'destination-is-a-file' },
  { kind: 'destination-not-chosen' },
  { kind: 'bundle', error: { kind: 'not-installable', publicationKind: 'component' } },
  { kind: 'publication-path-escapes' },
  { kind: 'publication-already-there', folder: 'somewhere' },
  { kind: 'library', error: { kind: 'not-ours' } },
  { kind: 'not-ours-to-delete' },
  { kind: 'copy-not-deleted', reason: 'permission denied' },
  { kind: 'import', error: { kind: 'no-document' } },
  { kind: 'no-window' },
  { kind: 'window-would-not-close' },
  { kind: 'io', reason: 'permission denied' },
];

/**
 * Sentences that are the same in a language as in English, on purpose.
 *
 * Empty, and meant to stay that way. Anything added here needs a reason a reader would accept —
 * a technical token that is the same word everywhere, not a translation nobody got round to.
 */
const IDENTICAL_BY_DESIGN: ReadonlySet<string> = new Set<string>();

/**
 * One example of every `StatusMessage`, in the order the runtime declares them.
 *
 * The counts are deliberately not 1: three of these resolve to a plural tree, and a sample of one
 * would only ever exercise a single leaf. The other leaf is reached through `singular` below.
 */
const STATUS_SAMPLES: StatusMessage[] = [
  {
    kind: 'trigger-error',
    node: 'watch',
    error: { code: 'missing-config', message: 'no folder is set', retryable: false },
  },
  { kind: 'events-dropped', count: 3 },
  { kind: 'nothing-ran', problems: 2 },
  { kind: 'workflow-stopped' },
  { kind: 'running-for', seconds: 12 },
];

/** The same status message with every count set to one, to reach the singular leaf. */
function singular(message: StatusMessage): StatusMessage {
  switch (message.kind) {
    case 'events-dropped':
      return { ...message, count: 1 };
    case 'nothing-ran':
      return { ...message, problems: 1 };
    case 'running-for':
      return { ...message, seconds: 1 };
    default:
      return message;
  }
}

describe('the error contract', () => {
  it('maps every kind the runtime can send', () => {
    expect(Object.keys(APP_ERROR_KEYS).sort()).toEqual([...KINDS.app].sort());
    expect(Object.keys(GRANT_REFUSAL_KEYS).sort()).toEqual([...KINDS.grant].sort());
    expect(Object.keys(PROJECT_ERROR_KEYS).sort()).toEqual([...KINDS.project].sort());
    expect(Object.keys(LIBRARY_ERROR_KEYS).sort()).toEqual([...KINDS.library].sort());
    expect(Object.keys(BUNDLE_ERROR_KEYS).sort()).toEqual([...KINDS.bundle].sort());
    // The oldest of the vocabularies, mapped in `library.ts` since before this file existed.
    expect(Object.keys(IMPORT_ERROR_KEYS).sort()).toEqual([...KINDS.import].sort());
    // Not an error vocabulary, but pinned the same way: the status bar is the one line somebody
    // watches while a workflow runs, and it used to be the one line nobody translated.
    expect(Object.keys(STATUS_MESSAGE_KEYS).sort()).toEqual([...KINDS.status].sort());
  });

  it('has a sample for every kind, so the checks below cover all of them', () => {
    expect(SAMPLES.map((sample) => sample.kind)).toEqual(KINDS.app);
    expect(STATUS_SAMPLES.map((sample) => sample.kind)).toEqual(KINDS.status);
  });
});

describe('every key exists in every language', () => {
  const everyKey = [
    ...Object.values(APP_ERROR_KEYS),
    ...Object.values(GRANT_REFUSAL_KEYS),
    ...Object.values(PROJECT_ERROR_KEYS),
    ...Object.values(LIBRARY_ERROR_KEYS),
    ...Object.values(BUNDLE_ERROR_KEYS),
    UNKNOWN_ERROR_KEY,
  ];

  it.each(LOCALES)('%s has a sentence for every refusal', (locale) => {
    // Read out of the locale file rather than through `translate()`, which falls back to English
    // and would report a missing Spanish sentence as a passing test.
    const missing = everyKey.filter((key) => lookup(MESSAGES[locale], key) === undefined);
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('%s has a sentence for every status message, in both plural forms', (locale) => {
    // Resolved through `statusMessageKey`, because three of these name a plural tree rather than a
    // leaf and the category depends on the language: a lookup of the branch would find nothing,
    // and a lookup of the English leaf would miss a language that categorises differently.
    const keys = STATUS_SAMPLES.flatMap((sample) => [
      statusMessageKey(sample, locale),
      statusMessageKey(singular(sample), locale),
    ]);
    const missing = keys.filter((key) => lookup(MESSAGES[locale], key) === undefined);
    expect(missing).toEqual([]);
  });
});

describe('no accidental English', () => {
  const english = inLocale('en');

  it.each(LOCALES.filter((locale) => locale !== 'en'))(
    '%s describes every refusal in its own words',
    (locale) => {
      const t = inLocale(locale);
      const copied = SAMPLES.filter((sample) => {
        const theirs = describeAppError(sample, t);
        const ours = describeAppError(sample, english);
        return theirs === ours && !IDENTICAL_BY_DESIGN.has(String(theirs));
      }).map((sample) => sample.kind);
      expect(copied).toEqual([]);
    },
  );

  it.each(LOCALES.filter((locale) => locale !== 'en'))(
    '%s describes a refused grant in its own words',
    (locale) => {
      const t = inLocale(locale);
      const refused: AppError = {
        kind: 'grants-refused',
        refusals: [{ kind: 'folder-not-chosen', node: 'save' }],
      };
      expect(describeAppError(refused, t)).not.toEqual(describeAppError(refused, english));
    },
  );

  it.each(LOCALES.filter((locale) => locale !== 'en'))(
    '%s describes every status message in its own words',
    (locale) => {
      const t = inLocale(locale);
      const copied = STATUS_SAMPLES.filter((sample) => {
        const theirs = describeStatusMessage(sample, t, locale);
        const ours = describeStatusMessage(sample, english, 'en');
        return theirs === ours && !IDENTICAL_BY_DESIGN.has(theirs);
      }).map((sample) => sample.kind);
      expect(copied).toEqual([]);
    },
  );
});

/** A `{name}` the runtime never sent. `interpolate` leaves it visible; this is where it is caught. */
const PLACEHOLDER = /\{[a-z]+\}/i;

/** The key itself, which is `translate`'s last resort and means nobody wrote the sentence. */
const BARE_KEY = /^(errors|messages)[.]/;

describe('describeStatusMessage', () => {
  const t = inLocale('en');

  it('says something readable for every kind, with no placeholder left in it', () => {
    for (const sample of [...STATUS_SAMPLES, ...STATUS_SAMPLES.map(singular)]) {
      const described = describeStatusMessage(sample, t, 'en');
      expect(described, sample.kind).toBeTruthy();
      expect(described, sample.kind).not.toMatch(PLACEHOLDER);
      expect(described, sample.kind).not.toMatch(BARE_KEY);
    }
  });

  it('agrees with the count rather than gluing an "s" on', () => {
    expect(describeStatusMessage({ kind: 'events-dropped', count: 1 }, t, 'en')).toContain(
      'event was dropped',
    );
    expect(describeStatusMessage({ kind: 'events-dropped', count: 4 }, t, 'en')).toContain(
      'events were dropped',
    );
    // CLDR counts zero and one together in French, which `Intl.PluralRules` knows and a
    // hand-written `n === 1` check does not.
    expect(statusMessageKey({ kind: 'events-dropped', count: 0 }, 'fr')).toMatch(/[.]one$/);
    expect(statusMessageKey({ kind: 'events-dropped', count: 0 }, 'en')).toMatch(/[.]other$/);
  });

  it('reuses the sentence the store already had for a graph that could not run', () => {
    expect(describeStatusMessage({ kind: 'nothing-ran', problems: 2 }, t, 'en')).toBe(
      t('messages.nothingRanProblems.other', { count: 2 }),
    );
  });

  it('quotes a stopped watcher reason inside a sentence the reader can read', () => {
    const described = describeStatusMessage(
      {
        kind: 'trigger-error',
        node: 'watch',
        error: { code: 'missing-config', message: 'no folder is set', retryable: false },
      },
      t,
      'en',
    );
    expect(described).toContain('watch');
    expect(described).toContain('no folder is set');
    // The code travels so a later build can translate the reason itself; it is not shown as a
    // tag today, because a person reading the status bar has no use for one.
    expect(described).not.toContain('missing-config');
  });

  it('gives an unknown status tag a readable sentence, and marks it as one', () => {
    const described = describeStatusMessage(
      { kind: 'from-the-future' } as unknown as StatusMessage,
      t,
      'en',
    );
    expect(described).toBe(t(UNKNOWN_ERROR_KEY, { kind: 'from-the-future' }));
  });
});

describe('describeAppError', () => {
  const t = inLocale('en');

  it('says something readable for every kind, with no placeholder left in it', () => {
    for (const sample of SAMPLES) {
      const described = describeAppError(sample, t);
      expect(described, sample.kind).toBeTruthy();
      // A key with a placeholder the runtime does not send renders `{reason}` to the person.
      // `interpolate` leaves it visible on purpose; this is where it gets caught.
      expect(described, sample.kind).not.toMatch(/\{[a-z]+\}/i);
      // The key itself is `translate`'s last resort, and would mean nobody wrote the sentence.
      expect(described, sample.kind).not.toMatch(/^errors\./);
    }
  });

  it('keeps every refused grant on its own line, rather than one blurred sentence', () => {
    const described = describeAppError(
      {
        kind: 'grants-refused',
        refusals: [
          { kind: 'folder-not-chosen', node: 'save' },
          { kind: 'not-declared', node: 'notify', capability: 'system.clipboard' },
        ],
      },
      t,
    );
    const lines = (described ?? '').split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('save');
    expect(lines[2]).toContain('notify');
    expect(lines[2]).toContain('system.clipboard');
  });

  it('is as specific as the crate that refused, rather than flattening it', () => {
    const described = describeAppError(
      { kind: 'project', error: { kind: 'unsupported-schema', ours: 1, theirs: 9 } },
      t,
    );
    expect(described).toContain('1');
    expect(described).toContain('9');
    expect(described).not.toEqual(t('errors.project.generic'));
  });

  it('gives an unknown tag a readable sentence, and marks it as one', () => {
    const described = describeAppError({ kind: 'from-the-future' } as unknown as AppError, t);
    expect(described).toBe(t(UNKNOWN_ERROR_KEY, { kind: 'from-the-future' }));
    expect(described).toContain('from-the-future');
  });

  it('leaves anything that is not a structured refusal alone', () => {
    // A string, an `Error`, and a plain object are what an older command, a plugin or a bug
    // rejects with. `store.ts` still has its own handling for those, and would lose it if this
    // returned a sentence for them.
    expect(describeAppError('a plain string', t)).toBeNull();
    expect(describeAppError(new Error('boom'), t)).toBeNull();
    expect(describeAppError({ message: 'boom' }, t)).toBeNull();
    expect(describeAppError(null, t)).toBeNull();
    expect(describeAppError(undefined, t)).toBeNull();
  });

  it('describes a nested import refusal with the sentence the Import panel would use', () => {
    const nested = describeAppError({ kind: 'import', error: { kind: 'no-document' } }, t);
    expect(nested).toBe(t('import.errors.noDocument'));
    expect(nested).not.toBe(t('errors.import.generic'));
  });

  it('turns byte counts into kilobytes rather than asking six languages to', () => {
    const described = describeAppError(
      {
        kind: 'bundle',
        error: { kind: 'too-large', size: 70 * 1024 * 1024, max: 64 * 1024 * 1024 },
      },
      t,
    );
    expect(described).toContain('71680');
    expect(described).not.toContain('73400320');
  });
});

describe('importErrorIn', () => {
  it('unwraps the nested shape the import commands now refuse with', () => {
    expect(importErrorIn({ kind: 'import', error: { kind: 'checksum-mismatch' } })).toEqual({
      kind: 'checksum-mismatch',
    });
  });

  it('still recognises a bare ImportError, for anything that predates the nesting', () => {
    expect(importErrorIn({ kind: 'checksum-mismatch' })).toEqual({ kind: 'checksum-mismatch' });
  });

  it('does not mistake an application refusal for an import one', () => {
    // `io` is the one tag both vocabularies use, and it has to resolve to the application's.
    expect(importErrorIn({ kind: 'io', reason: 'permission denied' })).toBeNull();
    expect(importErrorIn({ kind: 'not-a-project' })).toBeNull();
    expect(importErrorIn({ kind: 'from-the-future' })).toBeNull();
    expect(importErrorIn('a string')).toBeNull();
  });

  it('refuses a nested payload with nothing readable inside it', () => {
    expect(importErrorIn({ kind: 'import' })).toBeNull();
    expect(importErrorIn({ kind: 'import', error: 'not an object' })).toBeNull();
  });
});

describe('isAppError', () => {
  it('recognises anything tagged with a string kind, and nothing else', () => {
    expect(isAppError({ kind: 'runtime-busy' })).toBe(true);
    expect(isAppError({ kind: 7 })).toBe(false);
    expect(isAppError({})).toBe(false);
    expect(isAppError('runtime-busy')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});
