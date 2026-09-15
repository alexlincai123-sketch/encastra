/**
 * Showing a string that came out of a project file, without letting it choose how it reads.
 *
 * React escapes markup, so nothing here is about HTML injection — there is none. It is about a
 * narrower and quieter problem: the permission dialog asks a person to approve a *string*. The
 * folder on a node and the address on a node both arrive verbatim from a `.encastra` file that
 * somebody else may have written, and both are rendered back to the person as the thing they are
 * agreeing to.
 *
 * Unicode has characters whose only job is to change the order or visibility of the text around
 * them. A right-to-left override in the middle of a path can make `C:\` display as something
 * reassuring; a zero-width space can hide a segment entirely. The bytes that get granted are the
 * real ones. So the consent prompt would be describing a different folder from the one it grants,
 * which is the one property a consent prompt has to have.
 *
 * The answer is not to escape these characters but to remove them: a folder name has no
 * legitimate use for a bidirectional override, and a person who cannot see a character cannot
 * consent to it.
 */

/**
 * Characters that change how neighbouring text is laid out or whether it appears at all.
 *
 * Bidirectional embedding, override and isolate controls (U+202A–U+202E, U+2066–U+2069), the
 * zero-width and word-joiner family (U+200B–U+200F, U+FEFF), and the interlinear annotation
 * marks (U+FFF9–U+FFFB), which some renderers treat as invisible structure.
 */
const INVISIBLE_OR_REORDERING = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\uFFF9-\uFFFB]/g;

/** Every C0 and C1 control character, none of which belongs in a path or a host. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the entire purpose
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * A version of `value` that reads the way it will be used.
 *
 * Only for display. The value actually sent to the runtime is never this one — if they differ,
 * what the person saw was not what would have been granted, and
 * {@link displayMatchesValue} is how a caller can tell.
 */
export function forDisplay(value: string): string {
  return value.replace(INVISIBLE_OR_REORDERING, '').replace(CONTROL, '');
}

/** Whether a string can be shown as it is, meaning consent to it means consent to it. */
export function displayMatchesValue(value: string): boolean {
  return forDisplay(value) === value;
}
