import { describe, expect, it } from 'vitest';
import { lookup, type Messages } from '../src/i18n';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import fr from '../src/i18n/locales/fr';
import italian from '../src/i18n/locales/it';
import pt from '../src/i18n/locales/pt';
import {
  arrange,
  decideRemoval,
  IMPORT_ERROR_KEYS,
  IMPORT_ERROR_KINDS,
  importErrorKey,
  importErrorValues,
  isImportError,
  LIBRARY_SORTS,
  lastTouched,
  matchesSearch,
  mayDeleteCopy,
  UNKNOWN_IMPORT_ERROR_KEY,
} from '../src/library';
import type { EntryWithStatus, ImportError, LibraryEntry, LibraryOrigin } from '../src/types';

function entry(over: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id: 'a1',
    origin: 'created',
    name: 'Thumbnails',
    description: 'Makes a small copy of every picture.',
    path: 'C:\\work\\thumbnails.encastra',
    addedAtMs: 1_000,
    lastOpenedMs: null,
    modifiedAtMs: 1_000,
    checksum: null,
    sizeBytes: null,
    steps: 3,
    runtime: '^0.4',
    listingId: null,
    version: null,
    publisher: null,
    capabilities: [],
    ...over,
  };
}

function row(over: Partial<LibraryEntry> = {}, status: EntryWithStatus['status'] = 'present') {
  return { entry: entry(over), status };
}

// --- searching -----------------------------------------------------------------------------

describe('what a search leaves', () => {
  it('keeps everything when nothing has been typed', () => {
    expect(matchesSearch(row(), '')).toBe(true);
    expect(matchesSearch(row(), '   ')).toBe(true);
  });

  it('matches the name, the description, the publisher and the listing name', () => {
    expect(matchesSearch(row(), 'thumb')).toBe(true);
    expect(matchesSearch(row(), 'picture')).toBe(true);
    expect(matchesSearch(row({ publisher: 'dev.alice' }), 'alice')).toBe(true);
    expect(matchesSearch(row({ listingId: 'dev.alice.thumbnails' }), 'dev.alice.')).toBe(true);
  });

  it('ignores case, because nobody types a search the way a title was written', () => {
    expect(matchesSearch(row(), 'THUMBNAILS')).toBe(true);
  });

  it('does not match the path', () => {
    // A search that matched paths would let somebody find a project by typing their own user
    // name, which is a strange thing for a search box to teach.
    expect(matchesSearch(row({ path: 'C:\\Users\\alice\\thing.encastra' }), 'Users')).toBe(false);
  });

  it('survives the fields that are allowed to be absent', () => {
    expect(matchesSearch(row({ description: null, publisher: null, listingId: null }), 'x')).toBe(
      false,
    );
  });
});

// --- ordering ------------------------------------------------------------------------------

describe('what order the rows come in', () => {
  const made = row({ id: 'a', name: 'Alpha', origin: 'created', addedAtMs: 10 });
  const taken = row({ id: 'b', name: 'Zeta', origin: 'imported', addedAtMs: 20 });
  const prepared = row({ id: 'c', name: 'Mid', origin: 'prepared', addedAtMs: 30 });

  it('offers exactly the orders the interface can render', () => {
    expect([...LIBRARY_SORTS]).toEqual(['name', 'recent', 'origin']);
  });

  it('by name, in the alphabet of whoever is reading', () => {
    const order = arrange([taken, prepared, made], '', 'name', 'en').map((r) => r.entry.name);
    expect(order).toEqual(['Alpha', 'Mid', 'Zeta']);
  });

  it('by most recent, newest first', () => {
    const order = arrange([made, taken, prepared], '', 'recent', 'en').map((r) => r.entry.id);
    expect(order).toEqual(['c', 'b', 'a']);
  });

  it('counts being opened as more recent than being added', () => {
    // What somebody means by "most recent" is what they touched last, not what arrived last.
    const old = row({ id: 'old', addedAtMs: 1, lastOpenedMs: 900 });
    const recent = row({ id: 'recent', addedAtMs: 100, lastOpenedMs: null });
    expect(lastTouched(old.entry)).toBe(900);
    expect(lastTouched(recent.entry)).toBe(100);
    expect(arrange([recent, old], '', 'recent', 'en').map((r) => r.entry.id)).toEqual([
      'old',
      'recent',
    ]);
  });

  it('by origin, grouping what you made before what you took in', () => {
    const order = arrange([prepared, taken, made], '', 'origin', 'en').map((r) => r.entry.origin);
    expect(order).toEqual(['created', 'imported', 'prepared']);
  });

  it('breaks a tie by name, so two runs over one library draw the same list', () => {
    const one = row({ id: '1', name: 'Beta', addedAtMs: 5 });
    const two = row({ id: '2', name: 'Alpha', addedAtMs: 5 });
    expect(arrange([one, two], '', 'recent', 'en').map((r) => r.entry.name)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('filters and orders in one pass, and never edits what it was given', () => {
    const rows = [taken, made, prepared];
    const shown = arrange(rows, 'alpha', 'name', 'en');
    expect(shown.map((r) => r.entry.name)).toEqual(['Alpha']);
    expect(rows.map((r) => r.entry.id)).toEqual(['b', 'a', 'c']);
  });
});

// --- removing ------------------------------------------------------------------------------

describe('what a Remove is allowed to delete', () => {
  it('only an imported copy, because that is the only one Encastra made', () => {
    const origins: LibraryOrigin[] = ['created', 'imported', 'prepared'];
    expect(origins.filter(mayDeleteCopy)).toEqual(['imported']);
  });

  it('refuses to delete the file of a project somebody made', () => {
    const decision = decideRemoval(entry({ origin: 'created' }), true);
    expect(decision).toEqual({ allowed: false, because: 'the-file-is-theirs' });
  });

  it('refuses to delete a folder somebody chose to prepare into', () => {
    expect(decideRemoval(entry({ origin: 'prepared' }), true).allowed).toBe(false);
  });

  it('allows forgetting any of them, which deletes nothing', () => {
    for (const origin of ['created', 'imported', 'prepared'] as LibraryOrigin[]) {
      expect(decideRemoval(entry({ origin }), false)).toEqual({
        allowed: true,
        id: 'a1',
        deleteCopy: false,
      });
    }
  });

  it('allows deleting an imported copy, and says so in the plan rather than assuming it', () => {
    expect(decideRemoval(entry({ origin: 'imported' }), true)).toEqual({
      allowed: true,
      id: 'a1',
      deleteCopy: true,
    });
  });
});

// --- explaining a refusal ------------------------------------------------------------------

/**
 * Every variant of `ImportError` in `crates/encastra-publish/src/import.rs`, as the tag it
 * serialises to. Written out by hand rather than derived from the table under test, because a
 * list derived from the thing it checks would pass whatever that thing happened to contain.
 */
const EVERY_KIND: ImportError['kind'][] = [
  'not-a-folder',
  'folder-is-a-link',
  'folder-not-chosen',
  'no-document',
  'document-is-a-link',
  'document-too-large',
  'document-unreadable',
  'no-project',
  'more-than-one-project',
  'project-is-a-link',
  'unexpected-entries',
  'too-many-entries',
  'project-too-large',
  'checksum-mismatch',
  'project-unreadable',
  'not-installable',
  'not-a-listing-id',
  'not-a-version',
  'not-publishers-namespace',
  'text-too-long',
  'text-has-control-characters',
  'document-disagrees-with-project',
  'runtime-incompatible',
  'review-refused',
  'capabilities-disagree',
  'already-imported',
  'io',
];

describe('every refusal has a sentence of its own', () => {
  it('covers the whole enum, in both directions', () => {
    expect(new Set(IMPORT_ERROR_KINDS)).toEqual(new Set(EVERY_KIND));
    expect(IMPORT_ERROR_KINDS).toHaveLength(EVERY_KIND.length);
  });

  it.each(EVERY_KIND)('%s has a key', (kind) => {
    const key = importErrorKey(kind);
    expect(key).not.toBe(UNKNOWN_IMPORT_ERROR_KEY);
    expect(key.startsWith('import.errors.')).toBe(true);
  });

  it('gives no two refusals the same sentence', () => {
    // Bucketing is the failure mode this exists to prevent: "the import failed" is what people
    // are used to being told, and it has never once been enough to act on.
    expect(new Set(Object.values(IMPORT_ERROR_KEYS)).size).toBe(EVERY_KIND.length);
  });

  it('falls back rather than rendering a raw tag from a runtime this build predates', () => {
    expect(importErrorKey('something-invented-later')).toBe(UNKNOWN_IMPORT_ERROR_KEY);
  });

  const locales: Record<string, Messages> = { en, es, fr, de, it: italian, pt };
  for (const [name, messages] of Object.entries(locales)) {
    it(`${name} says all of them`, () => {
      for (const kind of [...EVERY_KIND, 'something-invented-later']) {
        const key = importErrorKey(kind);
        const word = lookup(messages, key);
        expect(word, `${name} is missing ${key}`).toBeTypeOf('string');
        expect(word).not.toBe('');
      }
    });
  }
});

describe('the values a refusal quotes', () => {
  const kb = (bytes: number) => `${Math.ceil(bytes / 1024)}`;

  it('turns a byte count into something a sentence can hold', () => {
    const error: ImportError = { kind: 'document-too-large', size: 400_000, max: 262_144 };
    expect(importErrorValues(error, kb)).toEqual({ size: '391', max: '256' });
  });

  it('joins a list of names, and says how many there were', () => {
    const error: ImportError = {
      kind: 'more-than-one-project',
      names: ['a.encastra', 'b.encastra'],
    };
    expect(importErrorValues(error, kb)).toEqual({ names: 'a.encastra, b.encastra', count: 2 });
  });

  it('shows both sides of a disagreement about permissions', () => {
    const error: ImportError = {
      kind: 'capabilities-disagree',
      declared: ['fs.read'],
      actual: ['fs.read', 'net.http'],
    };
    expect(importErrorValues(error, kb)).toEqual({
      declared: 'fs.read',
      actual: 'fs.read, net.http',
    });
  });

  it('translates the field a refusal names, when it is one this build knows', () => {
    const error: ImportError = { kind: 'text-too-long', field: 'title', max: 120 };
    expect(importErrorValues(error, kb, (token) => `<${token}>`)).toEqual({
      field: '<title>',
      max: 120,
    });
  });

  it('has nothing to quote for a refusal that carries nothing', () => {
    expect(importErrorValues({ kind: 'checksum-mismatch' }, kb)).toEqual({});
  });
});

describe('telling a structured refusal from an ordinary failure', () => {
  it('recognises what a command returning Result<_, ImportError> rejects with', () => {
    expect(isImportError({ kind: 'no-document' })).toBe(true);
  });

  it('does not mistake an Error, a string or nothing for one', () => {
    expect(isImportError(new Error('the runtime did not answer'))).toBe(false);
    expect(isImportError('the runtime did not answer')).toBe(false);
    expect(isImportError(null)).toBe(false);
    expect(isImportError({ message: 'no kind here' })).toBe(false);
    expect(isImportError({ kind: 7 })).toBe(false);
  });
});

// --- the sentences that must not be left unsaid --------------------------------------------

describe('what the library and import screens must go on saying', () => {
  it('never offers a publisher as verified', () => {
    expect(lookup(en, 'import.notVerified')).toContain('There are no accounts');
    expect(lookup(en, 'library.row.publisherClaim')).toContain('not verified');
  });

  it('says a checksum is integrity and not provenance', () => {
    expect(lookup(en, 'import.checksumIsNotProvenance')).toContain('who prepared it');
  });

  it('says importing runs nothing', () => {
    expect(lookup(en, 'import.copiesNothingRuns')).toContain('Nothing runs');
    expect(lookup(en, 'import.capabilities.grantsNothing')).toContain('grants none of this');
  });

  it('says a file somebody made stays where they put it', () => {
    expect(lookup(en, 'library.remove.keepsFile')).toContain('stays exactly where you put it');
  });

  it('says nothing here is synced or uploaded', () => {
    expect(lookup(en, 'library.intro')).toContain('on this machine');
  });
});
