/**
 * The parts of preparing a publication that are decisions rather than drawing.
 *
 * Everything here is advisory. The runtime refuses a publication that should not exist, and it
 * refuses it again inside the command that writes the files, so nothing in this file is what
 * authorises anything — a front end is not a trust boundary (`docs/THREAT-MODEL.md` T2). What
 * it buys is the difference between finding out a name is wrong while typing it and finding out
 * after pressing a button.
 */

/** The pieces of a draft a person types. */
export type DraftFields = {
  namespace: string;
  title: string;
  summary: string;
  version: string;
};

/** A problem with one field, named so the interface can put it next to the right box. */
export type Problem = {
  field: keyof DraftFields;
  /** An i18n key. The text belongs in the dictionaries, not here. */
  key: string;
};

/** Letters that are not a plain letter with a mark, so decomposition leaves them behind. */
const FOLDED: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  đ: 'd',
  ł: 'l',
};

/** The longest a generated name may be, so an id stays something a person can read aloud. */
export const SLUG_LIMIT = 40;

/**
 * Turns a title into the part of an id that comes after the namespace.
 *
 * Accents are folded rather than dropped: "Miniaturas rápidas" becomes `miniaturas-rapidas`,
 * not `miniaturas-r-pidas`. An id is written once and lives for the life of the listing, so it
 * is worth the extra line.
 *
 * Six letters need a table of their own, because decomposition does not reach them: ß is not an
 * s with a mark on it, and neither are æ, œ, ø, đ or ł. Without this, a German title produced
 * `gro-e`, which is the kind of name somebody has to live with afterwards.
 */
export function slug(title: string): string {
  return title
    .replace(/[ßæœøđł]/g, (letter) => FOLDED[letter] ?? letter)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_LIMIT)
    .replace(/-+$/g, '');
}

/**
 * The full name a publication would be known by.
 *
 * Derived rather than typed. Two fields that have to agree — a namespace and an id inside it —
 * is two chances to get it wrong, and the runtime refuses the pair that disagree.
 */
export function listingId(namespace: string, title: string): string {
  const name = slug(title);
  if (!namespace || !name) return '';
  return `${namespace}.${name}`;
}

/** Whether a namespace is shaped like something somebody could own. */
export function namespaceLooksOwned(namespace: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/.test(namespace);
}

/** Whether a version is one. Matches what the runtime will accept, which is semver. */
export function versionLooksNumbered(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/i.test(version);
}

/** The shortest summary worth showing on a page somebody is deciding from. */
export const SUMMARY_MINIMUM = 20;

/**
 * Everything wrong with a draft, in the order the fields appear.
 *
 * Empty means nothing here objects — not that the publication will be accepted. The review of
 * the project itself is a separate question, and the one that refuses most often.
 */
export function draftProblems(fields: DraftFields): Problem[] {
  const problems: Problem[] = [];

  if (!fields.namespace.trim()) {
    problems.push({ field: 'namespace', key: 'publish.problems.namespaceMissing' });
  } else if (!namespaceLooksOwned(fields.namespace.trim())) {
    problems.push({ field: 'namespace', key: 'publish.problems.namespaceShape' });
  }

  if (!fields.title.trim()) {
    problems.push({ field: 'title', key: 'publish.problems.titleMissing' });
  } else if (!slug(fields.title)) {
    // A title of nothing but punctuation leaves no name behind it.
    problems.push({ field: 'title', key: 'publish.problems.titleUnusable' });
  }

  if (!fields.summary.trim()) {
    problems.push({ field: 'summary', key: 'publish.problems.summaryMissing' });
  } else if (fields.summary.trim().length < SUMMARY_MINIMUM) {
    problems.push({ field: 'summary', key: 'publish.problems.summaryShort' });
  }

  if (!versionLooksNumbered(fields.version.trim())) {
    problems.push({ field: 'version', key: 'publish.problems.versionShape' });
  }

  return problems;
}
