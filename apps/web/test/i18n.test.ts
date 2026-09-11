import { describe, expect, it } from 'vitest';

import en from '../src/lib/i18n/dictionaries/en';
import es from '../src/lib/i18n/dictionaries/es';
import { interpolate, lookup, type Messages } from '../src/lib/i18n/messages';
import { t } from '../src/lib/i18n/translate';
import { sceneCopy } from '../src/lib/scenes';

/**
 * All dotted key paths in a `Messages` tree, walked recursively. The same idea
 * `apps/desktop/src/i18n`'s own tests use to keep its six locales in lock-step with English: a
 * key present on one side and absent on the other is exactly the drift `t()`'s English fallback
 * is built to survive *silently* — which is precisely why nothing else would ever catch it
 * without a test that looks at both trees directly.
 */
function keyPaths(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return typeof value === 'string' ? [path] : keyPaths(value, path);
  });
}

/**
 * The shape of an arbitrary JSON-like value, as a sorted list of paths — objects walked key by
 * key, an array collapsed to its own length rather than its contents. Used below to compare
 * `lib/scenes.ts`'s English and Spanish scene copy: the two must offer the same fields (and, for
 * `reuse.steps`, the same number of items), never the same words.
 */
function shapeOf(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      shapeOf(child, prefix === '' ? key : `${prefix}.${key}`),
    );
  }
  return [prefix];
}

describe('dictionaries: en <-> es key parity', () => {
  it('every English key exists in the Spanish dictionary', () => {
    const missing = keyPaths(en).filter((key) => lookup(es, key) === undefined);
    expect(missing).toEqual([]);
  });

  it('every Spanish key exists in the English dictionary', () => {
    const missing = keyPaths(es).filter((key) => lookup(en, key) === undefined);
    expect(missing).toEqual([]);
  });
});

describe('lookup() + interpolate(): the fallback t() is built from', () => {
  // Fixtures, not the real dictionaries — `en.ts`/`es.ts` are deliberately kept in full parity
  // by the tests above, so there is no genuine missing key left in them to fall back *from*.
  // This exercises the same composition `translate.ts`'s `t()` performs
  // (`lookup(active, key) ?? lookup(english, key)`) against a dictionary that does have a gap.
  const partial: Messages = { greeting: 'Hola' };
  const english: Messages = { greeting: 'Hello', farewell: 'Goodbye' };

  it('prefers the active locale when the key exists there', () => {
    expect(lookup(partial, 'greeting') ?? lookup(english, 'greeting')).toBe('Hola');
  });

  it('falls back to English when the key is missing from the active locale', () => {
    expect(lookup(partial, 'farewell') ?? lookup(english, 'farewell')).toBe('Goodbye');
  });

  it('substitutes {placeholder} values', () => {
    expect(interpolate('Hello {name}', { name: 'Ada' })).toBe('Hello Ada');
  });

  it('leaves an unmatched placeholder exactly as written, rather than blanking it', () => {
    expect(interpolate('Hello {name}', { other: 'value' })).toBe('Hello {name}');
  });

  it('returns the template unchanged when no vars are given', () => {
    expect(interpolate('Beta {version}')).toBe('Beta {version}');
  });
});

describe('t()', () => {
  it('translates a real key in each locale', () => {
    expect(t('en', 'header.download')).toBe('Download');
    expect(t('es', 'header.download')).toBe('Descargar');
  });

  it('interpolates a real templated key', () => {
    expect(t('en', 'footer.versionLine', { version: '0.4.0-beta.1' })).toBe(
      'Beta 0.4.0-beta.1 · Windows only · builds are not code-signed',
    );
    expect(t('es', 'footer.versionLine', { version: '0.4.0-beta.1' })).toBe(
      'Beta 0.4.0-beta.1 · Solo Windows · las versiones no están firmadas',
    );
  });

  it('returns the key itself as a last resort when it exists in neither dictionary', () => {
    expect(t('es', 'this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });
});

describe('lib/scenes.ts: sceneCopy() en <-> es shape parity', () => {
  it('offers exactly the same scenes and fields in both locales', () => {
    expect(shapeOf(sceneCopy('es')).sort()).toEqual(shapeOf(sceneCopy('en')).sort());
  });

  it('keeps the "reuse" step pills the same length in both locales', () => {
    expect(sceneCopy('es').reuse.steps).toHaveLength(sceneCopy('en').reuse.steps.length);
  });
});
