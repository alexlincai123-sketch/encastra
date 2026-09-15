/**
 * The parts of the library that are decisions rather than drawing.
 *
 * Everything here is pure, so it can be tested without a window: which rows a search leaves,
 * what order they come in, which sentence a refusal gets, and — the one that matters — whether
 * a "Remove" is allowed to delete anything.
 *
 * Nothing here authorises anything. The runtime refuses to delete a file it did not put there,
 * and refuses it again inside the command that would do the deleting; what this file buys is
 * that the interface never offers a button whose answer is already no.
 */

import type { EntryWithStatus, ImportError, LibraryEntry, LibraryOrigin } from './types';

// -- searching and ordering -----------------------------------------------------------------

/** The orders worth offering. `recent` is "what I touched last", which is usually what is meant. */
export const LIBRARY_SORTS = ['name', 'recent', 'origin'] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

/**
 * Whether a row matches what somebody typed.
 *
 * Name, description, publisher and listing name — the four things a person could plausibly
 * remember. Not the path: a search that matched paths would let somebody find a project by
 * typing their own user name, which is a strange thing for a search box to teach.
 */
export function matchesSearch(row: EntryWithStatus, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { name, description, publisher, listingId } = row.entry;
  return [name, description, publisher, listingId].some((field) =>
    (field ?? '').toLowerCase().includes(needle),
  );
}

/** When something was last touched: opened if it ever was, otherwise when it arrived. */
export function lastTouched(entry: LibraryEntry): number {
  return entry.lastOpenedMs ?? entry.addedAtMs;
}

/** The order origins are grouped in: what you made, what you took in, what you prepared. */
const ORIGIN_ORDER: Record<LibraryOrigin, number> = { created: 0, imported: 1, prepared: 2 };

/**
 * The rows to draw, filtered and ordered.
 *
 * `localeCompare` with the active language rather than a byte comparison: a Spanish reader
 * expects "ñ" after "n", and a byte sort puts it after "z".
 */
export function arrange(
  rows: readonly EntryWithStatus[],
  query: string,
  sort: LibrarySort,
  locale: string,
): EntryWithStatus[] {
  const byName = (a: EntryWithStatus, b: EntryWithStatus) =>
    a.entry.name.localeCompare(b.entry.name, locale);

  return rows
    .filter((row) => matchesSearch(row, query))
    .slice()
    .sort((a, b) => {
      switch (sort) {
        case 'recent':
          return lastTouched(b.entry) - lastTouched(a.entry) || byName(a, b);
        case 'origin':
          return ORIGIN_ORDER[a.entry.origin] - ORIGIN_ORDER[b.entry.origin] || byName(a, b);
        default:
          return byName(a, b);
      }
    });
}

// -- removing -------------------------------------------------------------------------------

/**
 * What a "Remove" would actually do.
 *
 * Two different acts, and the caller has to say which one it means. Forgetting an entry takes it
 * off a list. Deleting the copy removes files — and only Encastra's own copies, because a
 * project somebody made is theirs and this software did not put that file there.
 */
export type RemovalDecision =
  | { allowed: true; id: string; deleteCopy: boolean }
  | { allowed: false; because: 'the-file-is-theirs' };

/** Whether there is a copy this software made, and may therefore delete. */
export function mayDeleteCopy(origin: LibraryOrigin): boolean {
  return origin === 'imported';
}

export function decideRemoval(entry: LibraryEntry, deleteCopy: boolean): RemovalDecision {
  if (deleteCopy && !mayDeleteCopy(entry.origin)) {
    return { allowed: false, because: 'the-file-is-theirs' };
  }
  return { allowed: true, id: entry.id, deleteCopy };
}

// -- explaining a refusal -------------------------------------------------------------------

/**
 * One sentence per refusal, and no sharing.
 *
 * Every variant of `ImportError` gets its own key rather than a handful of buckets, because a
 * folder holding two projects and a folder holding a document that names somebody else's
 * namespace are different problems with different things to do about them, and "the import
 * failed" is what people are used to being told and is never enough to act on.
 *
 * Typed as a total record over the union, so adding a variant on the Rust side and mirroring it
 * in `types.ts` makes this file stop compiling until somebody writes the sentence.
 */
export const IMPORT_ERROR_KEYS: Record<ImportError['kind'], string> = {
  'not-a-folder': 'import.errors.notAFolder',
  'folder-is-a-link': 'import.errors.folderIsALink',
  'folder-not-chosen': 'import.errors.folderNotChosen',
  'no-document': 'import.errors.noDocument',
  'document-is-a-link': 'import.errors.documentIsALink',
  'document-too-large': 'import.errors.documentTooLarge',
  'document-unreadable': 'import.errors.documentUnreadable',
  'no-project': 'import.errors.noProject',
  'more-than-one-project': 'import.errors.moreThanOneProject',
  'project-is-a-link': 'import.errors.projectIsALink',
  'unexpected-entries': 'import.errors.unexpectedEntries',
  'too-many-entries': 'import.errors.tooManyEntries',
  'project-too-large': 'import.errors.projectTooLarge',
  'checksum-mismatch': 'import.errors.checksumMismatch',
  'project-unreadable': 'import.errors.projectUnreadable',
  'not-installable': 'import.errors.notInstallable',
  'not-a-listing-id': 'import.errors.notAListingId',
  'not-a-version': 'import.errors.notAVersion',
  'not-publishers-namespace': 'import.errors.notPublishersNamespace',
  'text-too-long': 'import.errors.textTooLong',
  'text-has-control-characters': 'import.errors.textHasControlCharacters',
  'document-disagrees-with-project': 'import.errors.documentDisagreesWithProject',
  'runtime-incompatible': 'import.errors.runtimeIncompatible',
  'review-refused': 'import.errors.reviewRefused',
  'capabilities-disagree': 'import.errors.capabilitiesDisagree',
  'already-imported': 'import.errors.alreadyImported',
  io: 'import.errors.io',
};

/** Every refusal this build knows how to explain, in the order they are declared above. */
export const IMPORT_ERROR_KINDS = Object.keys(IMPORT_ERROR_KEYS) as ImportError['kind'][];

/**
 * The sentence for a refusal this build has never heard of.
 *
 * Reachable only if a future runtime refuses for a reason this interface predates. Saying so
 * plainly beats rendering a raw tag, and beats an empty panel even more.
 */
export const UNKNOWN_IMPORT_ERROR_KEY = 'import.errors.unknown';

/** Takes the tag rather than the whole error, so a value off the wire needs no cast first. */
export function importErrorKey(kind: string): string {
  return IMPORT_ERROR_KEYS[kind as ImportError['kind']] ?? UNKNOWN_IMPORT_ERROR_KEY;
}

/**
 * Whether something a rejected promise handed back is one of the runtime's structured refusals.
 *
 * A command returning `Result<_, ImportError>` rejects with the serialised object; everything
 * else in this application rejects with an `Error` or a string. Telling them apart is the
 * difference between showing somebody a sentence and showing them a piece of JSON.
 */
export function isImportError(value: unknown): value is ImportError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string'
  );
}

/**
 * The words the runtime names a field by, which have a translation of their own.
 *
 * A refusal saying "the title is too long" should not say "title" in the middle of a German
 * sentence. Anything outside this set is shown as it arrived: a token a future runtime invents
 * has no translation to find, and the raw word beats a missing-key path.
 */
export const TRANSLATED_TOKENS = new Set([
  'title',
  'summary',
  'changelog',
  'publisher',
  'categories',
  'tags',
  'runtime',
]);

/**
 * The values a refusal quotes, as things a sentence can hold.
 *
 * Sizes are turned into whole kilobytes here rather than in six translation files: a byte count
 * of 268435456 tells nobody anything, and every locale would otherwise have to format it itself.
 * `label` does the same job for the handful of field names the runtime quotes — see
 * `TRANSLATED_TOKENS`. It defaults to leaving them alone, so a caller with no dictionary to hand
 * still gets a whole sentence.
 */
export function importErrorValues(
  error: ImportError,
  format: (value: number) => string,
  label: (token: string) => string = (token) => token,
): Record<string, string | number> {
  switch (error.kind) {
    case 'document-too-large':
    case 'project-too-large':
      return { size: format(error.size), max: format(error.max) };
    case 'document-unreadable':
    case 'project-unreadable':
    case 'io':
      return { reason: error.reason };
    case 'more-than-one-project':
    case 'unexpected-entries':
      return { names: error.names.join(', '), count: error.names.length };
    case 'not-installable':
      return { publicationKind: error.publicationKind };
    case 'not-a-listing-id':
      return { id: error.id };
    case 'not-a-version':
      return { version: error.version };
    case 'not-publishers-namespace':
      return { listing: error.listing, publisher: error.publisher };
    case 'text-too-long':
      return { field: label(error.field), max: error.max };
    case 'text-has-control-characters':
      return { field: label(error.field) };
    case 'document-disagrees-with-project':
      return { about: label(error.about) };
    case 'runtime-incompatible':
      return { requires: error.requires, have: error.have };
    case 'review-refused':
      return { count: error.findings.length };
    case 'capabilities-disagree':
      return { declared: error.declared.join(', '), actual: error.actual.join(', ') };
    case 'already-imported':
      return { listing: error.listing, version: error.version };
    default:
      return {};
  }
}
