/**
 * One sentence, in the reader's language, for every way the runtime can say no.
 *
 * Until this existed only the import flow had that. Everything else — a project that would not
 * open, a folder that could not be published into, a grant the person never chose, a workflow
 * already running — arrived as an English sentence the runtime had built, and `describe()` in
 * `store.ts` printed it. A Spanish reader got English at the exact moment the application most
 * needed to be understood, and a refusal nobody can read is a refusal nobody can act on.
 *
 * So the runtime sends a tag and the values a sentence needs (`AppError` in
 * `apps/desktop/src-tauri/src/error.rs`), and this file turns that into a key. Three things hold
 * the two halves together:
 *
 * - **Every map below is a total `Record` over its union.** Adding a variant on the Rust side and
 *   mirroring it in `types.ts` makes this file stop compiling until somebody writes the sentence.
 *   That is the same mechanism `IMPORT_ERROR_KEYS` has always used.
 * - **`test/fixtures/error-kinds.json` is written by a Rust test** and replayed by
 *   `test/errors.test.ts`, so a tag that exists in the runtime and nowhere here fails a build —
 *   the arrangement `packages/protocol/data/compat-matrix.json` uses for the type graph.
 * - **A tag this build has never heard of still gets a readable sentence**, marked as one this
 *   version has no words for. A future runtime refusing for a new reason should not produce a
 *   blank panel or a piece of raw JSON.
 *
 * Nothing here authorises anything, and nothing here decides anything. It is the wording of a
 * decision the runtime already made.
 */

import { type Locale, selectPlural, translate, useI18n } from './i18n';
import {
  IMPORT_ERROR_KINDS,
  importErrorKey,
  importErrorValues,
  TRANSLATED_TOKENS,
} from './library';
import type {
  AppError,
  BundleError,
  GrantRefusal,
  ImportError,
  LibraryError,
  ProjectError,
  StatusMessage,
} from './types';

/** How a translated string is produced. Injectable so a test can ask for a named locale. */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const APP_ERROR_KEYS: Record<AppError['kind'], string> = {
  'runtime-busy': 'errors.runtimeBusy',
  'library-busy': 'errors.libraryBusy',
  'chooser-did-not-return': 'errors.chooserDidNotReturn',
  'not-a-folder-on-this-machine': 'errors.notAFolderOnThisMachine',
  'folder-unusable': 'errors.folderUnusable',
  'not-a-project': 'errors.notAProject',
  project: 'errors.project.generic',
  'version-not-in-project': 'errors.versionNotInProject',
  'versions-not-in-project': 'errors.versionsNotInProject',
  'grants-refused': 'errors.grantsRefused',
  'working-folder': 'errors.workingFolder',
  'input-unreadable': 'errors.inputUnreadable',
  'workflow-already-running': 'errors.workflowAlreadyRunning',
  'workflow-invalid': 'errors.workflowInvalid',
  'workflow-not-started': 'errors.workflowNotStarted',
  'destination-missing': 'errors.destinationMissing',
  'destination-is-a-link': 'errors.destinationIsALink',
  'destination-is-a-file': 'errors.destinationIsAFile',
  'destination-not-chosen': 'errors.destinationNotChosen',
  bundle: 'errors.bundle.generic',
  'publication-path-escapes': 'errors.publicationPathEscapes',
  'publication-already-there': 'errors.publicationAlreadyThere',
  library: 'errors.library.generic',
  'not-ours-to-delete': 'errors.notOursToDelete',
  'copy-not-deleted': 'errors.copyNotDeleted',
  import: 'errors.import.generic',
  'no-window': 'errors.noWindow',
  'window-would-not-close': 'errors.windowWouldNotClose',
  io: 'errors.io',
};

export const PROJECT_ERROR_KEYS: Record<ProjectError['kind'], string> = {
  'unsupported-schema': 'errors.project.unsupportedSchema',
  'missing-entry': 'errors.project.missingEntry',
  invalid: 'errors.project.invalid',
  archive: 'errors.project.archive',
  'too-large': 'errors.project.tooLarge',
  'too-large-in-total': 'errors.project.tooLargeInTotal',
  'too-many-snapshots': 'errors.project.tooManySnapshots',
  'file-too-large': 'errors.project.fileTooLarge',
  'ambiguous-archive': 'errors.project.ambiguousArchive',
  io: 'errors.project.io',
};

export const LIBRARY_ERROR_KEYS: Record<LibraryError['kind'], string> = {
  corrupt: 'errors.library.corrupt',
  'written-by-another-version': 'errors.library.writtenByAnotherVersion',
  'too-many-entries': 'errors.library.tooManyEntries',
  'not-ours': 'errors.library.notOurs',
  io: 'errors.library.io',
};

export const BUNDLE_ERROR_KEYS: Record<BundleError['kind'], string> = {
  'review-refused': 'errors.bundle.reviewRefused',
  'not-a-version': 'errors.bundle.notAVersion',
  'not-your-namespace': 'errors.bundle.notYourNamespace',
  missing: 'errors.bundle.missing',
  'too-long': 'errors.bundle.tooLong',
  'control-characters': 'errors.bundle.controlCharacters',
  'too-large': 'errors.bundle.tooLarge',
  'not-installable': 'errors.bundle.notInstallable',
  'not-an-identifier': 'errors.bundle.notAnIdentifier',
};

export const GRANT_REFUSAL_KEYS: Record<GrantRefusal['kind'], string> = {
  'folder-unusable': 'errors.grant.folderUnusable',
  'folder-not-chosen': 'errors.grant.folderNotChosen',
  'not-declared': 'errors.grant.notDeclared',
};

/**
 * The status bar's own vocabulary, which is not about errors at all.
 *
 * A dropped event and a workflow that stopped are not failed commands, but they reached the
 * status bar the same way the refusals did: as English sentences the runtime had built. Three of
 * these name a plural tree rather than a leaf, because the count is part of the sentence and
 * "1 events were dropped" is a thing no interface should say in any language — the leaf is
 * chosen through `Intl.PluralRules` by `statusMessageKey`, never by an `n === 1` check.
 * `nothing-ran` reuses the key the store already had for exactly this sentence.
 */
export const STATUS_MESSAGE_KEYS: Record<StatusMessage['kind'], string> = {
  'trigger-error': 'errors.status.triggerError',
  'events-dropped': 'errors.status.eventsDropped',
  'nothing-ran': 'messages.nothingRanProblems',
  'workflow-stopped': 'errors.status.workflowStopped',
  'running-for': 'errors.status.runningFor',
};

/**
 * The sentence for a refusal this build has never heard of.
 *
 * Reachable only if a future runtime refuses for a reason this interface predates. Saying so
 * plainly beats rendering a raw tag, and beats an empty message even more.
 */
export const UNKNOWN_ERROR_KEY = 'errors.unknown';

export const APP_ERROR_KINDS = Object.keys(APP_ERROR_KEYS) as AppError['kind'][];

/**
 * Whether something a rejected promise handed back is one of the runtime's structured refusals.
 *
 * A command returning `Result<_, AppError>` rejects with the serialised object; an older build,
 * a plugin, or a bug rejects with an `Error` or a string. Telling them apart is the difference
 * between showing somebody a sentence and showing them a piece of JSON.
 */
export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string'
  );
}

/**
 * The `ImportError` inside a refusal, if there is one.
 *
 * `inspect_publication` and `import_publication` now refuse in the same vocabulary as every other
 * command, which means their own refusal arrives nested: `{kind: 'import', error: {...}}`. The
 * Import panel was built around the inner shape and still wants it, so it is handed back rather
 * than flattened. A bare `ImportError` is recognised too — anything whose tag this file knows as
 * an import refusal and not as an application one — so a panel or a build that predates the
 * nesting keeps working.
 */
export function importErrorIn(value: unknown): ImportError | null {
  if (!isAppError(value)) return null;
  if (value.kind === 'import') {
    const inner = (value as { error?: unknown }).error;
    return isAppError(inner) ? (inner as ImportError) : null;
  }
  if (value.kind in APP_ERROR_KEYS) return null;
  return IMPORT_ERROR_KINDS.includes(value.kind as ImportError['kind'])
    ? (value as unknown as ImportError)
    : null;
}

/**
 * Whole kilobytes, rounded up.
 *
 * The same rounding the Import panel does, and through the same key: a byte count of 268435456
 * tells nobody anything, and six translation files should not each have to format one.
 */
function kilobytes(t: Translate, bytes: number): string {
  return t('import.facts.kilobytes', { size: Math.ceil(bytes / 1024) });
}

/** A field name the runtime quotes, in the reader's language where there is a word for it. */
function token(t: Translate, name: string): string {
  return TRANSLATED_TOKENS.has(name) ? t(`import.tokens.${name}`) : name;
}

function describeProject(error: ProjectError, t: Translate): string {
  const key = PROJECT_ERROR_KEYS[error.kind] ?? APP_ERROR_KEYS.project;
  return t(key, { ...(error as Record<string, string | number>) });
}

function describeLibrary(error: LibraryError, t: Translate): string {
  const key = LIBRARY_ERROR_KEYS[error.kind] ?? APP_ERROR_KEYS.library;
  return t(key, { ...(error as Record<string, string | number>) });
}

function describeBundle(error: BundleError, t: Translate): string {
  const key = BUNDLE_ERROR_KEYS[error.kind] ?? APP_ERROR_KEYS.bundle;
  const values: Record<string, string | number> = { ...(error as Record<string, string | number>) };
  if (error.kind === 'too-large') {
    values.size = kilobytes(t, error.size);
    values.max = kilobytes(t, error.max);
  }
  if (
    error.kind === 'missing' ||
    error.kind === 'too-long' ||
    error.kind === 'control-characters'
  ) {
    values.field = token(t, error.field);
  }
  return t(key, values);
}

/** One line per refused grant, each naming the step it is about. */
export function describeGrantRefusal(refusal: GrantRefusal, t: Translate): string {
  const key = GRANT_REFUSAL_KEYS[refusal.kind] ?? UNKNOWN_ERROR_KEY;
  return t(key, { ...(refusal as Record<string, string | number>) });
}

/**
 * The exact leaf key a status message resolves to, plural category included.
 *
 * Separate from `describeStatusMessage` so a test can assert the key exists in every locale file
 * rather than going through `translate()`, which falls back to English and would report a missing
 * Spanish sentence as a pass.
 */
export function statusMessageKey(message: StatusMessage, locale: Locale): string {
  const base = STATUS_MESSAGE_KEYS[message.kind];
  if (!base) return UNKNOWN_ERROR_KEY;
  switch (message.kind) {
    case 'events-dropped':
      return `${base}.${selectPlural(locale, message.count)}`;
    case 'nothing-ran':
      return `${base}.${selectPlural(locale, message.problems)}`;
    case 'running-for':
      return `${base}.${selectPlural(locale, message.seconds)}`;
    default:
      return base;
  }
}

/**
 * The sentence for what the status bar is being told, in the reader's language.
 *
 * The locale is a separate argument rather than read from the store, because three of these are
 * plural trees and the category depends on the language — French counts zero and one together,
 * which `Intl.PluralRules` knows and a hand-written check does not.
 */
export function describeStatusMessage(
  message: StatusMessage,
  t: Translate = translate,
  locale: Locale = useI18n.getState().locale,
): string {
  const key = statusMessageKey(message, locale);
  if (key === UNKNOWN_ERROR_KEY) return t(key, { kind: message.kind });

  switch (message.kind) {
    case 'trigger-error':
      // The `code` is the part a later build can translate; until then the reason is quoted
      // verbatim inside a sentence the reader can read, which is what the rest of this file does
      // with free text from an operating system.
      return t(key, { node: message.node, reason: message.error.message });
    case 'events-dropped':
      return t(key, { count: message.count });
    case 'nothing-ran':
      return t(key, { count: message.problems });
    case 'running-for':
      return t(key, { seconds: message.seconds });
    default:
      return t(key);
  }
}

function describeImport(error: ImportError, t: Translate): string {
  return t(
    importErrorKey(error.kind),
    importErrorValues(
      error,
      (bytes) => kilobytes(t, bytes),
      (name) => token(t, name),
    ),
  );
}

/**
 * The sentence for a structured refusal, in the reader's language.
 *
 * Returns `null` for anything that is not one — a string, an `Error`, a rejected promise carrying
 * something else entirely — so the caller can keep whatever handling it already had for those.
 */
export function describeAppError(error: unknown, t: Translate = translate): string | null {
  if (!isAppError(error)) return null;

  // Nested inside `{kind: 'import'}`, or arriving bare from something that predates the nesting:
  // either way it gets the sentence the Import panel would have given it.
  const nested = importErrorIn(error);
  if (nested) return describeImport(nested, t);

  const app = error as AppError;
  const key = APP_ERROR_KEYS[app.kind];
  // A tag from a runtime newer than this interface. Said plainly, and marked, rather than left
  // as a blank message or rendered as the raw tag.
  if (!key) return t(UNKNOWN_ERROR_KEY, { kind: app.kind });

  switch (app.kind) {
    case 'project':
      return describeProject(app.error, t);
    case 'library':
      return describeLibrary(app.error, t);
    case 'bundle':
      return describeBundle(app.error, t);
    case 'grants-refused':
      // The heading, then one line per grant. A run refused over three grants is three things to
      // fix, and joining them into one sentence would hide two of them.
      return [
        t(key, { count: app.refusals.length }),
        ...app.refusals.map((refusal) => describeGrantRefusal(refusal, t)),
      ].join('\n');
    case 'import':
      // Reached only when the payload has no readable inner error; `importErrorIn` handles the
      // ordinary case above.
      return t(key);
    default:
      return t(key, { ...(app as Record<string, string | number>) });
  }
}
