/**
 * Deciding whether a submitted path is somewhere on this site.
 *
 * Its own module rather than a helper inside `actions.ts` because that file is `'use server'`,
 * and every export of a server-action module has to be an async action — which would make this
 * rule the one piece of the redirect that no test could reach directly.
 */

/**
 * Whether a submitted value is a path on this site, rather than a way off it.
 *
 * "Starts with a slash" is not enough, and the gap is not obvious. A URL beginning with *two*
 * slashes is protocol-relative: `//example.invalid/page` is a perfectly ordinary same-origin URL
 * whose pathname is that exact string, so it arrives looking like a relative path and leaves as a
 * `Location` header the browser resolves against another origin entirely. A backslash after the
 * first slash does the same on browsers that fold `\` into `/`.
 *
 * That matters more here than an open redirect usually does. The visitor follows a genuine link
 * to this origin, clicks the language switcher themselves, and lands somewhere else — which is a
 * good place to be offered an installer, for a product whose installers are not signed yet.
 */
export function isPathOnThisSite(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
}
