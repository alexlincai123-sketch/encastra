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

  it('ignores the port, which a grant does not name', () => {
    expect(hostOf('https://api.example.com:8443/v1')).toBe('api.example.com');
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
