import { describe, expect, it } from 'vitest';
import { displayMatchesValue, forDisplay } from '../src/safe-text';

/**
 * What the permission prompt is allowed to show.
 *
 * The folder and address on a node arrive verbatim from a `.encastra` file somebody else may have
 * written, and both are rendered back to the person as the thing they are agreeing to. React
 * escapes markup, so none of this is about injection. It is about a prompt describing a different
 * folder from the one it grants, which is the one property a prompt has to have.
 */
describe('forDisplay', () => {
  it('leaves an ordinary path exactly as it is', () => {
    expect(forDisplay('C:\\Users\\me\\Invoices')).toBe('C:\\Users\\me\\Invoices');
    expect(forDisplay('/home/me/invoices')).toBe('/home/me/invoices');
    expect(forDisplay('api.example.com:8443')).toBe('api.example.com:8443');
  });

  it('removes a right-to-left override, which can rewrite what a path looks like', () => {
    const spoofed = `C:\\\u202Esecivnl\\eM\\sresU`;
    expect(forDisplay(spoofed)).toBe('C:\\secivnl\\eM\\sresU');
    expect(displayMatchesValue(spoofed)).toBe(false);
  });

  it('removes zero-width characters, which can hide a segment entirely', () => {
    expect(forDisplay('C:\\\u200BWindows\u200B\\System32')).toBe('C:\\Windows\\System32');
    expect(forDisplay('exam\u200Bple.com')).toBe('example.com');
    expect(forDisplay('\uFEFFexample.com')).toBe('example.com');
  });

  it('removes bidirectional isolates and control characters', () => {
    expect(forDisplay('a\u2066b\u2069c')).toBe('abc');
    expect(forDisplay('a\u0000b\u001Fc\u007Fd')).toBe('abcd');
    expect(forDisplay('one\nline')).toBe('oneline');
  });

  it('says so when a value cannot be shown as it is', () => {
    expect(displayMatchesValue('C:\\Users\\me\\Invoices')).toBe(true);
    expect(displayMatchesValue('example.com')).toBe(true);
    expect(displayMatchesValue('C:\\\u202EInvoices')).toBe(false);
  });

  it('is idempotent, so cleaning twice is cleaning once', () => {
    const nasty = 'C:\\\u202E\u200Bsomewhere\u2069';
    expect(forDisplay(forDisplay(nasty))).toBe(forDisplay(nasty));
    expect(displayMatchesValue(forDisplay(nasty))).toBe(true);
  });
});
