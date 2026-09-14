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

/**
 * What an address will be asked permission for, or an empty string when there is nothing to ask
 * about.
 *
 * The host on its own when the address uses the scheme's own port, `host:port` otherwise. The
 * port belongs in the answer because it is part of what gets reached: a grant for
 * `internal.example` that also admitted `internal.example:22` and `internal.example:5432` would
 * not be a permission to talk to a web service, it would be a permission to reach every service
 * on that machine, and the dialog would be describing neither. The runtime's parser makes the
 * same distinction; these two must keep agreeing.
 */
export function hostOf(url: string): string {
  const [rawScheme, rest] = url.trim().split('://');
  const scheme = (rawScheme ?? '').toLowerCase();
  if (!rest || (scheme !== 'https' && scheme !== 'http')) return '';

  const authority = rest.split(/[/?#]/)[0] ?? '';
  if (!authority) return '';

  // An address carrying a user name and password is refused by the runtime, because it would
  // put a password in the journal and in the permission prompt. Not offered here either.
  if (authority.includes('@')) return '';

  // An IPv6 literal is bracketed and full of colons, so the port has to be looked for after the
  // closing bracket. Cutting at the last colon regardless turned `[::1]` into a host of `:`.
  let host: string;
  let portText: string | undefined;
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']');
    if (close === -1) return '';
    host = authority.slice(1, close);
    const after = authority.slice(close + 1);
    portText = after.startsWith(':') ? after.slice(1) : undefined;
  } else {
    const colon = authority.lastIndexOf(':');
    host = colon === -1 ? authority : authority.slice(0, colon);
    portText = colon === -1 ? undefined : authority.slice(colon + 1);
  }

  // A trailing dot is the same name to DNS. Dropped so both parsers spell it one way.
  host = host.replace(/\.+$/, '').toLowerCase();
  if (!host) return '';

  if (portText === undefined || portText === '') return host;
  if (!/^\d+$/.test(portText)) return '';
  const port = Number(portText);
  if (port > 65535) return '';

  const defaultPort = scheme === 'https' ? 443 : 80;
  return port === defaultPort ? host : `${host}:${port}`;
}
