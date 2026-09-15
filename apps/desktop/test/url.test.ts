import { describe, expect, it } from 'vitest';
import { hostOf } from '../src/url';

/**
 * What the permission prompt is allowed to say.
 *
 * Each case here is a thing that must not happen: offering to allow a host the person did not
 * type, or offering nothing when the address is perfectly good and leaving them unable to grant
 * anything at all. The first is a security question; the second is why this code was written.
 */
describe('hostOf', () => {
  it('reads the host from an ordinary address', () => {
    expect(hostOf('https://api.example.com/v1/things?x=1')).toBe('api.example.com');
  });

  it('keeps a port that is not the default, because a grant has to name it', () => {
    // A grant for "internal.example" that also admitted :22 and :5432 would not be permission to
    // talk to a web service — it would be permission to reach every service on that machine, and
    // the prompt would be describing neither. The runtime's parser draws the same line.
    expect(hostOf('https://api.example.com:8443/v1')).toBe('api.example.com:8443');
    expect(hostOf('https://internal.example:22/')).toBe('internal.example:22');
  });

  it('drops the port when it is the default, so one address is one grant', () => {
    expect(hostOf('https://example.com:443/x')).toBe('example.com');
    expect(hostOf('http://example.com:80/x')).toBe('example.com');
  });

  it('reads an IPv6 literal as a host rather than as a colon', () => {
    // Cutting at the last colon regardless turned "[::1]" into ":", so an IPv6 address could
    // never be granted and never matched.
    expect(hostOf('http://[::1]/')).toBe('::1');
    expect(hostOf('http://[::1]:8080/')).toBe('::1:8080');
    expect(hostOf('https://[2001:db8::1]/x')).toBe('2001:db8::1');
    expect(hostOf('http://[::1/')).toBe('');
  });

  it('offers nothing for a port that is not one', () => {
    expect(hostOf('https://example.com:eighty/')).toBe('');
    expect(hostOf('https://example.com:99999/')).toBe('');
  });

  it('treats a trailing dot as the same host, so both parsers spell it one way', () => {
    expect(hostOf('https://example.com./x')).toBe('example.com');
  });

  it('accepts a scheme in any case, because the runtime does', () => {
    // The runtime lowercases the scheme before checking it. A stricter reading here would
    // leave the Allow button dead for an address that runs perfectly well.
    expect(hostOf('HTTPS://Example.COM/path')).toBe('example.com');
  });

  it('offers nothing for an address carrying credentials', () => {
    // The runtime refuses these outright, so there is nothing to be granted.
    expect(hostOf('https://user:secret@example.com/')).toBe('');
  });

  it('offers nothing for a scheme that cannot be requested', () => {
    expect(hostOf('ftp://example.com/')).toBe('');
    expect(hostOf('file:///C:/Windows/System32')).toBe('');
    expect(hostOf('javascript:alert(1)')).toBe('');
  });

  it('offers nothing for an address that is not one yet', () => {
    expect(hostOf('')).toBe('');
    expect(hostOf('   ')).toBe('');
    expect(hostOf('example.com')).toBe('');
    expect(hostOf('https://')).toBe('');
    expect(hostOf('https:///path')).toBe('');
  });

  it('stops at the authority, so a path cannot smuggle in a second host', () => {
    expect(hostOf('https://allowed.example.com/redirect?to=https://evil.example.net')).toBe(
      'allowed.example.com',
    );
    expect(hostOf('https://allowed.example.com#https://evil.example.net')).toBe(
      'allowed.example.com',
    );
  });

  it('lowercases the host, so two spellings cannot become two grants', () => {
    expect(hostOf('https://API.Example.COM/')).toBe('api.example.com');
  });
});
