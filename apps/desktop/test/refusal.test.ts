import { describe, expect, it } from 'vitest';
import { explainConnection } from '../src/canvas/refusal';

/**
 * Whether the editor says something useful when a connection is refused.
 *
 * `explainConnection` never decides legality itself — `checkCompatibility` in
 * `@encastra/protocol` does that, and these tests lean on real pairs from
 * `packages/protocol/data/type-graph.json` rather than inventing types that could never appear
 * on a real port.
 */

describe('explainConnection', () => {
  it('says a compatible pair is fine, with nothing further to explain', () => {
    // image extends file: a value already IS a value of its supertype, so this needs no
    // conversion at all.
    expect(explainConnection('image', 'file')).toEqual({ ok: true });
  });

  it('is fine with an implicit coercion, not just a direct match', () => {
    // i64 -> f64 is a total, silent conversion (implicit) rather than the same type, and it
    // still must not be refused.
    expect(explainConnection('i64', 'f64')).toEqual({ ok: true });
  });

  it('explains an incompatible pair in plain words, not type notation', () => {
    const refusal = explainConnection('image', 'video');
    expect(refusal.ok).toBe(false);
    if (refusal.ok) throw new Error('unreachable');

    // The headline is prose about pictures and steps, never the raw type identifiers or an
    // arrow between them — that is the exact failure this module exists to fix.
    expect(refusal.headline).not.toMatch(/->|→/);
    expect(refusal.headline).not.toMatch(/\bIMAGE\b|\bVIDEO\b/);
    expect(refusal.headline.toLowerCase()).toContain('image');
    expect(refusal.headline.toLowerCase()).toContain('video');
    expect(refusal.headline).toMatch(/cannot be fed into a step that expects/);

    // image and video are siblings under file, so file is the two-hop bridge, and the protocol
    // package's own reason already names it — this module must not contradict it.
    expect(refusal.bridge).toBe('File');
    expect(refusal.detail.length).toBeGreaterThan(0);
  });

  it('offers no bridge when the type table truly has no path between the two', () => {
    // bool and file share no ancestor and no coercion connects them in either direction, so
    // there is nothing to suggest as a "did you mean".
    const refusal = explainConnection('bool', 'file');
    expect(refusal.ok).toBe(false);
    if (refusal.ok) throw new Error('unreachable');
    expect(refusal.bridge).toBeUndefined();
  });

  it('allows a pair that needs an explicit conversion — explicit is not the same as refused', () => {
    // file -> image is a real fact from the type table: a File is not yet known to be an
    // Image, so decoding it can fail, and the coercion is marked "explicit" for that reason.
    // It is still a legal connection; the runtime materialises a Convert node for it.
    expect(explainConnection('file', 'image')).toEqual({ ok: true });
  });

  it('lets bytes reach file even though bytes is deliberately not a subtype of file', () => {
    // The type table's own doc for "bytes" says this in so many words: modelling bytes as a
    // subtype of file would let image -> file -> bytes look like a narrowing. The coercion
    // table still allows bytes -> file directly, just as an explicit, fallible conversion
    // (write-temp) rather than a free widening.
    expect(explainConnection('bytes', 'file')).toEqual({ ok: true });
  });

  it('refuses bytes straight to image, but still names file as the two-hop bridge', () => {
    // bytes -> image has no single coercion table entry, and checking is only ever one hop
    // (never a chain), so this is genuinely refused even though bytes -> file -> image are
    // each legal on their own.
    const refusal = explainConnection('bytes', 'image');
    expect(refusal.ok).toBe(false);
    if (refusal.ok) throw new Error('unreachable');
    expect(refusal.bridge).toBe('File');
    expect(refusal.headline.toLowerCase()).toContain('bytes');
    expect(refusal.headline.toLowerCase()).toContain('image');
  });

  it('describes a list mismatch in terms of what is inside the list, not "list<image>"', () => {
    const refusal = explainConnection('list<image>', 'list<video>');
    expect(refusal.ok).toBe(false);
    if (refusal.ok) throw new Error('unreachable');
    expect(refusal.headline).not.toMatch(/</);
    expect(refusal.headline.toLowerCase()).toContain('list');
    expect(refusal.headline.toLowerCase()).toContain('image');
    expect(refusal.headline.toLowerCase()).toContain('video');
    // The inner mismatch is the same one as the scalar case, so it bridges the same way.
    expect(refusal.bridge).toBe('File');
  });

  it('allows wrapping a present value in an option for free', () => {
    // T -> option<T>: a present value is always a legal option<T>, per the generic rule.
    expect(explainConnection('image', 'option<image>')).toEqual({ ok: true });
  });

  it('allows unwrapping an option, but only as an explicit step', () => {
    // option<T> -> T is legal but explicit: the absent case has to be handled somewhere a
    // person can see it, not silently defaulted.
    expect(explainConnection('option<image>', 'image')).toEqual({ ok: true });
  });

  it('refuses two options whose contents do not match, and still finds the bridge', () => {
    const refusal = explainConnection('option<image>', 'option<video>');
    expect(refusal.ok).toBe(false);
    if (refusal.ok) throw new Error('unreachable');
    expect(refusal.headline.toLowerCase()).toContain('optional');
    expect(refusal.bridge).toBe('File');
  });
});
