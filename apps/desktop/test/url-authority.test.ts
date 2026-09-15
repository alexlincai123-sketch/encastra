import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hostOf } from '../src/url';

/**
 * The editor's half of the permission-parser conformance table.
 *
 * The editor reads an address to build the prompt a person answers; the runtime reads the same
 * address to decide whether the request is allowed. Two parsers for one string is a deliberate
 * duplication — this one runs in a webview and cannot call into the runtime — and the whole
 * safety argument for it is that they agree.
 *
 * Nothing was checking that. This replays `packages/protocol/data/url-authority-cases.json`
 * through the editor's parser; `crates/encastra-builtins/tests/url_authority.rs` replays the same
 * file through the runtime's. A change to either that the other does not follow fails here
 * or there.
 *
 * Same shape as the type-coercion conformance gate the protocol already has, for the same reason:
 * two implementations drifting apart is a silent failure.
 */
const TABLE_URL = new URL(
  '../../../packages/protocol/data/url-authority-cases.json',
  import.meta.url,
);

const TABLE = JSON.parse(readFileSync(fileURLToPath(TABLE_URL), 'utf8')) as {
  cases: { url: string; authority: string | null; why: string }[];
};

describe('the permission parser agrees with the runtime', () => {
  it('has a table worth replaying', () => {
    expect(TABLE.cases.length).toBeGreaterThanOrEqual(20);
    // A table that had drifted to all-refusals would pass every case below.
    expect(TABLE.cases.filter((c) => c.authority !== null).length).toBeGreaterThanOrEqual(10);
    expect(TABLE.cases.filter((c) => c.authority === null).length).toBeGreaterThanOrEqual(10);
  });

  for (const { url, authority, why } of TABLE.cases) {
    const expectation = authority === null ? 'is refused' : `reads as ${authority}`;
    it(`${JSON.stringify(url)} ${expectation} — ${why}`, () => {
      // The editor says "nothing to ask about" with an empty string; the table says null.
      expect(hostOf(url)).toBe(authority ?? '');
    });
  }
});
