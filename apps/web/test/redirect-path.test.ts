import { describe, expect, it } from 'vitest';
import { isPathOnThisSite } from '../src/lib/i18n/redirect-path';

/**
 * Where the language switcher is allowed to send somebody.
 *
 * The switcher posts the current pathname back to a server action, which redirects to it. The
 * visitor is on the real site and clicks a real control, so wherever they land afterwards carries
 * this site's credibility with it — and this site offers installer downloads that are not signed.
 */
describe('isPathOnThisSite', () => {
  it('accepts the paths the switcher actually submits', () => {
    expect(isPathOnThisSite('/')).toBe(true);
    expect(isPathOnThisSite('/download')).toBe(true);
    expect(isPathOnThisSite('/legal/privacy')).toBe(true);
    expect(isPathOnThisSite('/docs?section=install')).toBe(true);
  });

  it('refuses a protocol-relative URL, which is the whole trick', () => {
    // `//example.invalid/x` is a same-origin URL whose pathname is that exact string, so it
    // arrives looking relative and leaves as a Location the browser resolves somewhere else.
    expect(isPathOnThisSite('//example.invalid/download')).toBe(false);
    expect(isPathOnThisSite('///example.invalid')).toBe(false);
    expect(isPathOnThisSite('//example.invalid')).toBe(false);
  });

  it('refuses the backslash spelling of the same trick', () => {
    expect(isPathOnThisSite('/\\example.invalid/download')).toBe(false);
  });

  it('refuses anything that is not a path at all', () => {
    expect(isPathOnThisSite('https://example.invalid/')).toBe(false);
    expect(isPathOnThisSite('javascript:alert(1)')).toBe(false);
    expect(isPathOnThisSite('download')).toBe(false);
    expect(isPathOnThisSite('')).toBe(false);
  });
});
