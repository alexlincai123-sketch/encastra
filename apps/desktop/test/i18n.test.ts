import { afterEach, describe, expect, it } from 'vitest';
import {
  detectLocale,
  formatDate,
  formatNumber,
  formatRelative,
  formatTime,
  interpolate,
  LOCALES,
  loadLocale,
  lookup,
  type Messages,
  selectPlural,
  splitOnPlaceholder,
  translate,
  useI18n,
} from '../src/i18n';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import fr from '../src/i18n/locales/fr';
// Imported under its own name: `it` is already the test-case function from vitest, and shadowing
// it here would mean every assertion below silently runs against the wrong `it`.
import italian from '../src/i18n/locales/it';
import pt from '../src/i18n/locales/pt';

/**
 * The contract this module promises: a missing key falls back to English, a key nobody has
 * written yet falls back to itself, and a translation can never drift ahead of the English file
 * it is checked against. Each of those is a way the interface would otherwise show a person
 * either the wrong language or nothing at all — and, in the subset check at the bottom, a way a
 * translated file could rot without anyone noticing, since a stray key in Spanish that is not
 * also in English can never be reached by `translate` in the first place.
 */

/** Every dotted path to a leaf string in a `Messages` tree, for comparing two trees' shapes. */
function flattenKeys(messages: Messages, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      keys.push(path);
    } else {
      keys.push(...flattenKeys(value, path));
    }
  }
  return keys;
}

describe('detectLocale', () => {
  it('matches an exact supported tag', () => {
    expect(detectLocale(['es'])).toBe('es');
  });

  it('matches on the base language, ignoring the region', () => {
    expect(detectLocale(['es-ES'])).toBe('es');
    expect(detectLocale(['es-419'])).toBe('es');
    expect(detectLocale(['pt-BR'])).toBe('pt');
  });

  it('is not case-sensitive', () => {
    expect(detectLocale(['ES-es'])).toBe('es');
    expect(detectLocale(['FR'])).toBe('fr');
  });

  it('falls back to English for a language nobody has translated', () => {
    expect(detectLocale(['xx'])).toBe('en');
    // A real BCP-47 tag (Klingon) that simply is not one of the six shipped here.
    expect(detectLocale(['tlh'])).toBe('en');
  });

  it('falls back to English for an empty candidate list', () => {
    expect(detectLocale([])).toBe('en');
  });

  it('skips unsupported candidates to find a supported one further down the list', () => {
    expect(detectLocale(['xx-XX', 'zz', 'fr-CA'])).toBe('fr');
  });
});

describe('lookup', () => {
  const messages: Messages = {
    a: { b: { c: 'deep' } },
    top: 'shallow',
  };

  it('walks a dotted path to a leaf string', () => {
    expect(lookup(messages, 'a.b.c')).toBe('deep');
    expect(lookup(messages, 'top')).toBe('shallow');
  });

  it('returns undefined for a path that does not exist', () => {
    expect(lookup(messages, 'a.b.nope')).toBeUndefined();
    expect(lookup(messages, 'nowhere')).toBeUndefined();
  });

  it('returns undefined when the path tries to continue past a leaf string', () => {
    expect(lookup(messages, 'top.tooDeep')).toBeUndefined();
  });

  it('returns undefined when a path resolves to a branch rather than a leaf', () => {
    expect(lookup(messages, 'a.b')).toBeUndefined();
  });
});

describe('interpolate', () => {
  it('substitutes a known placeholder', () => {
    expect(interpolate('Hello, {name}.', { name: 'Ada' })).toBe('Hello, Ada.');
  });

  it('substitutes a numeric value as a string', () => {
    expect(interpolate('{count} steps', { count: 3 })).toBe('3 steps');
  });

  it('leaves an unmatched placeholder exactly as written', () => {
    // A translator's typo should stay visible and searchable, not vanish into a blank.
    expect(interpolate('Hello, {name}.', { cont: 'Ada' })).toBe('Hello, {name}.');
  });

  it('returns the template unchanged when no vars are given at all', () => {
    expect(interpolate('A step producing {bridge} in between.')).toBe(
      'A step producing {bridge} in between.',
    );
  });
});

describe('splitOnPlaceholder', () => {
  it('splits a template around the placeholder, keeping neither half', () => {
    expect(splitOnPlaceholder('A step producing {bridge} in between.', 'bridge')).toEqual([
      'A step producing ',
      ' in between.',
    ]);
  });

  it('handles the placeholder sitting at the very start or the very end', () => {
    expect(splitOnPlaceholder('{bridge} joins them.', 'bridge')).toEqual(['', ' joins them.']);
    expect(splitOnPlaceholder('Produces {bridge}', 'bridge')).toEqual(['Produces ', '']);
  });

  it('returns the whole template as the first half when the placeholder is absent', () => {
    expect(splitOnPlaceholder('No placeholder here.', 'bridge')).toEqual([
      'No placeholder here.',
      '',
    ]);
  });
});

describe('translate', () => {
  // Captured once, before any test in this file has had a chance to mutate the real store —
  // `useI18n` is a module-level singleton, so every test that changes it must put it back.
  const original = useI18n.getState();

  afterEach(() => {
    useI18n.setState(original, true);
  });

  it('uses the active locale when it has the key', () => {
    useI18n.setState({
      locale: 'es',
      messages: { en: { greeting: 'Hello, {name}.' }, es: { greeting: 'Hola, {name}.' } },
    });
    expect(translate('greeting', { name: 'Ada' })).toBe('Hola, Ada.');
  });

  it('falls back to English when the active locale is missing the key', () => {
    useI18n.setState({
      locale: 'es',
      messages: { en: { onlyEnglish: 'English only' }, es: {} },
    });
    expect(translate('onlyEnglish')).toBe('English only');
  });

  it('falls back to the key itself when no locale has it', () => {
    useI18n.setState({ locale: 'es', messages: { en: {}, es: {} } });
    expect(translate('nowhere.at.all')).toBe('nowhere.at.all');
  });

  it('interpolates whichever string it lands on, direct hit or fallback', () => {
    useI18n.setState({
      locale: 'es',
      messages: { en: { greeting: 'Hello, {name}.' }, es: {} },
    });
    // 'es' has no 'greeting', so this exercises the English-fallback path with vars — the
    // direct-hit path is already covered above.
    expect(translate('greeting', { name: 'Grace' })).toBe('Hello, Grace.');
  });
});

describe('selectPlural', () => {
  it('categorises English the way an "-s" ending would, but via Intl', () => {
    expect(selectPlural('en', 1)).toBe('one');
    expect(selectPlural('en', 0)).toBe('other');
    expect(selectPlural('en', 2)).toBe('other');
  });

  it('categorises French zero and one together, unlike English', () => {
    // CLDR counts zero and one as 'one' for French — a hand-written `n === 1` check would get
    // this wrong, which is exactly why this goes through Intl instead.
    expect(selectPlural('fr', 0)).toBe('one');
    expect(selectPlural('fr', 1)).toBe('one');
    expect(selectPlural('fr', 2)).toBe('other');
  });
});

describe('regional formatting', () => {
  it('formats numbers through Intl.NumberFormat rather than by hand', () => {
    expect(formatNumber('en', 1234.5)).toBe(new Intl.NumberFormat('en').format(1234.5));
    expect(formatNumber('de', 1234.5)).toBe(new Intl.NumberFormat('de').format(1234.5));
  });

  it('formats dates through Intl.DateTimeFormat', () => {
    const date = new Date(Date.UTC(2026, 0, 15));
    expect(formatDate('en', date)).toBe(
      new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date),
    );
  });

  it('formats times through Intl.DateTimeFormat', () => {
    const date = new Date(Date.UTC(2026, 0, 15, 9, 30));
    expect(formatTime('en', date)).toBe(
      new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(date),
    );
  });

  it('formats a relative time through Intl.RelativeTimeFormat', () => {
    expect(formatRelative('en', -3, 'day')).toBe(
      new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-3, 'day'),
    );
  });
});

describe('loadLocale', () => {
  const original = useI18n.getState();

  afterEach(() => {
    useI18n.setState(original, true);
  });

  it('registers a locale on first load, and is a safe no-op after that', async () => {
    await loadLocale('es');
    expect(useI18n.getState().messages.es).toEqual(es);

    await loadLocale('es');
    expect(useI18n.getState().messages.es).toEqual(es);
  });
});

describe('locale completeness', () => {
  const englishKeys = new Set(flattenKeys(en));
  const locales: ReadonlyArray<[string, Messages]> = [
    ['es', es],
    ['fr', fr],
    ['de', de],
    ['it', italian],
    ['pt', pt],
  ];

  it('has a translation file for every locale LOCALES promises', () => {
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      expect(locales.some(([id]) => id === locale)).toBe(true);
    }
  });

  it.each(locales)('every key in %s exists in English too', (_id, messages) => {
    // A key that exists only in a translation and not in English can never be reached — `t()`
    // only ever looks a key up by its English shape — so it is either a typo or a stale rename
    // that this test catches before it ships silently dead.
    const stray = flattenKeys(messages).filter((key) => !englishKeys.has(key));
    expect(stray).toEqual([]);
  });
});
