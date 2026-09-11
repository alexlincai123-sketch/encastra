/**
 * Reading a web address well enough to ask permission for it.
 *
 * A `net.http` grant names hosts, so the editor has to turn the address typed on a node into
 * the host the person is being asked about. That makes this the second parser for the same
 * string — the runtime has its own, in the component that makes the request.
 *
 * Two parsers for one string is normally a smell, and here it is a deliberate one: the editor
 * cannot call into the runtime to ask, and the alternative (a free-text "which host?" field the
 * person keeps in step by hand) is worse. What makes it safe is the direction the duplication
 * fails in. The grant stores exactly the string this returns; the runtime compares its own
 * reading against that string for equality. If the two ever disagree, the request is refused.
 * A disagreement costs a run, never a host nobody allowed.
 */

/** The host an address points at, or an empty string when there is nothing to ask about. */
export function hostOf(url: string): string {
  const [rawScheme, rest] = url.trim().split('://');
  const scheme = (rawScheme ?? '').toLowerCase();
  if (!rest || (scheme !== 'https' && scheme !== 'http')) return '';

  const authority = rest.split(/[/?#]/)[0] ?? '';
  if (!authority) return '';

  // An address carrying a user name and password is refused by the runtime, because it would
  // put a password in the journal and in the permission prompt. Not offered here either.
  if (authority.includes('@')) return '';

  const withoutPort = authority.includes(':')
    ? authority.slice(0, authority.lastIndexOf(':'))
    : authority;
  return withoutPort.replace(/^\[|\]$/g, '').toLowerCase();
}
