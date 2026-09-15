import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { displayMatchesValue, forDisplay } from '../src/safe-text';

/**
 * The editor's half of the hostile-text conformance table.
 *
 * `packages/protocol/data/hostile-text-cases.json` lists the code points that make text lie
 * about itself. The runtime refuses them in a publication document; the editor strips them from
 * a permission prompt. The two lists were maintained by hand on each side and had drifted — a
 * character one side strips and the other accepts is a name that reads one way in the prompt and
 * another in the file. `crates/encastra-publish/src/bundle.rs` replays the same table.
 */
const TABLE = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../packages/protocol/data/hostile-text-cases.json', import.meta.url),
    ),
    'utf8',
  ),
) as {
  refused: { codepoint: string; sample: string; why: string }[];
  allowed: { sample: string; why: string }[];
};

describe('the editor strips every code point the shared table says it must', () => {
  it('has a table worth replaying', () => {
    expect(TABLE.refused.length).toBeGreaterThanOrEqual(15);
    expect(TABLE.allowed.length).toBeGreaterThanOrEqual(5);
  });

  for (const { codepoint, sample, why } of TABLE.refused) {
    it(`${codepoint} is removed — ${why}`, () => {
      expect(displayMatchesValue(sample)).toBe(false);
      expect(forDisplay(sample)).not.toBe(sample);
      // And the cleaned string carries nothing else from the list.
      expect(displayMatchesValue(forDisplay(sample))).toBe(true);
    });
  }

  // The allowed list describes text in a document, where a changelog has paragraphs. A
  // permission prompt is a different context: a folder path with a line break in it is a path
  // that reads as two things, so the editor removes newline, carriage return and tab there and
  // the runtime keeps them in a document. That is the one deliberate difference between the two
  // implementations, and this is where it is written down — a change to either side that widens
  // it fails here.
  const PROMPT_ONLY_WHITESPACE = /[\n\r\t]/g;

  for (const { sample, why } of TABLE.allowed) {
    it(`${JSON.stringify(sample)} loses nothing but prompt whitespace — ${why}`, () => {
      expect(forDisplay(sample)).toBe(sample.replace(PROMPT_ONLY_WHITESPACE, ''));
      if (!PROMPT_ONLY_WHITESPACE.test(sample)) {
        expect(displayMatchesValue(sample)).toBe(true);
      }
    });
  }
});
