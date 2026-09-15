import { describe, expect, it } from 'vitest';
import { lookup, type Messages } from '../src/i18n';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import fr from '../src/i18n/locales/fr';
import italian from '../src/i18n/locales/it';
import pt from '../src/i18n/locales/pt';
import {
  type DraftFields,
  draftProblems,
  listingId,
  namespaceLooksOwned,
  slug,
  versionLooksNumbered,
} from '../src/publish';

const GOOD: DraftFields = {
  namespace: 'dev.alice',
  title: 'Thumbnails',
  summary: 'Makes a small copy of every picture dropped in a folder.',
  version: '1.0.0',
};

describe('the name a publication would be known by', () => {
  it('is built from the namespace and the title', () => {
    expect(listingId('dev.alice', 'Thumbnails')).toBe('dev.alice.thumbnails');
    expect(listingId('dev.alice', 'Watch and resize')).toBe('dev.alice.watch-and-resize');
  });

  it('folds accents rather than dropping them', () => {
    // An id lives for the life of the listing. `miniaturas-r-pidas` would be that life.
    expect(slug('Miniaturas rápidas')).toBe('miniaturas-rapidas');
    expect(slug('Größe ändern')).toBe('grosse-andern');
  });

  it('never ends on a dash, whatever it was cut from', () => {
    expect(slug('Thumbnails — ')).toBe('thumbnails');
    expect(slug('A'.repeat(60))).toHaveLength(40);
    expect(slug(`${'word '.repeat(9)}tail`).endsWith('-')).toBe(false);
  });

  it('is nothing at all when there is nothing to build it from', () => {
    expect(slug('!!!')).toBe('');
    expect(listingId('dev.alice', '!!!')).toBe('');
    expect(listingId('', 'Thumbnails')).toBe('');
  });
});

describe('what a namespace and a version have to look like', () => {
  it('accepts a reverse domain name and refuses a bare word', () => {
    expect(namespaceLooksOwned('dev.alice')).toBe(true);
    expect(namespaceLooksOwned('com.alice-studio.tools')).toBe(true);
    expect(namespaceLooksOwned('alice')).toBe(false);
    expect(namespaceLooksOwned('Dev.Alice')).toBe(false);
    expect(namespaceLooksOwned('dev..alice')).toBe(false);
    expect(namespaceLooksOwned('')).toBe(false);
  });

  it('accepts semver and refuses a word that means the newest one', () => {
    expect(versionLooksNumbered('1.0.0')).toBe(true);
    expect(versionLooksNumbered('0.4.0-beta.1')).toBe(true);
    expect(versionLooksNumbered('latest')).toBe(false);
    expect(versionLooksNumbered('1.0')).toBe(false);
    expect(versionLooksNumbered('v1.0.0')).toBe(false);
  });
});

describe('what is wrong with a draft', () => {
  it('finds nothing wrong with a complete one', () => {
    expect(draftProblems(GOOD)).toEqual([]);
  });

  it('names the field, so the message can go next to the box', () => {
    const problems = draftProblems({ ...GOOD, namespace: 'alice' });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.field).toBe('namespace');
  });

  it('refuses a summary too short to decide from', () => {
    const problems = draftProblems({ ...GOOD, summary: 'Images.' });
    expect(problems.map((p) => p.field)).toEqual(['summary']);
  });

  it('reports every problem at once rather than one per attempt', () => {
    const problems = draftProblems({
      namespace: '',
      title: '',
      summary: '',
      version: 'latest',
    });
    expect(problems.map((p) => p.field)).toEqual(['namespace', 'title', 'summary', 'version']);
  });
});

describe('every problem has a sentence in every language', () => {
  const locales: Record<string, Messages> = { en, es, fr, de, it: italian, pt };
  const keys = [
    ...new Set(
      draftProblems({ namespace: '', title: '!!!', summary: 'x', version: 'latest' }).map(
        (p) => p.key,
      ),
    ),
    'publish.problems.namespaceShape',
    'publish.problems.titleMissing',
    'publish.problems.summaryMissing',
    'publish.heading',
    'publish.freeOnly',
    'publish.notAnAudit',
    'toolbar.publish',
  ];

  for (const [name, messages] of Object.entries(locales)) {
    it(`${name} has all of them`, () => {
      for (const key of keys) {
        const word = lookup(messages, key);
        expect(word, `${name} is missing ${key}`).toBeTypeOf('string');
        expect(word).not.toBe('');
      }
    });
  }

  it('says the thing that must not be left unsaid', () => {
    // The panel exists inside a product with no registry and no payment provider. Both
    // sentences are load-bearing: without them the panel implies an ecosystem that is not
    // there, which is the one thing `docs/UX.md` principle 6 forbids outright.
    expect(lookup(en, 'publish.freeOnly')).toContain('no payment provider');
    expect(lookup(en, 'publish.nowhereToSend')).toContain('nowhere to send');
    expect(lookup(en, 'publish.notAnAudit')).toContain('not a security audit');
  });
});
