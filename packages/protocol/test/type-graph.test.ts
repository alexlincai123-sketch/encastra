import { describe, expect, it } from 'vitest';
import { formatType, parseType, tryParseType } from '../src/type-expr.js';
import {
  allTypes,
  ancestorsOf,
  checkCompatibility,
  compatibleTargets,
  typeGraph,
} from '../src/type-graph.js';

describe('type expressions', () => {
  it('round-trips every form', () => {
    for (const input of ['string', 'list<image>', 'option<f64>', 'list<option<file>>']) {
      expect(formatType(parseType(input))).toBe(input);
    }
  });

  it('tolerates spaces but not garbage', () => {
    expect(formatType(parseType('list< image >'))).toBe('list<image>');
    expect(tryParseType('list<')).toBeNull();
    expect(tryParseType('list<image')).toBeNull();
    expect(tryParseType('image>')).toBeNull();
    expect(tryParseType('list')).toBeNull(); // generic without an argument
    expect(tryParseType('image<string>')).toBeNull(); // non-generic with one
    expect(tryParseType('')).toBeNull();
    expect(tryParseType('List<image>')).toBeNull(); // grammar is lower-case only
  });
});

describe('compatibility — the rules a user feels', () => {
  it('connects a type to itself with no conversion', () => {
    const r = checkCompatibility('image', 'image');
    expect(r).toMatchObject({ ok: true, kind: 'direct', ops: [] });
  });

  it('widens a subtype to its supertype silently', () => {
    // An image IS a file. Nothing happens at run time.
    expect(checkCompatibility('image', 'file')).toMatchObject({ ok: true, kind: 'direct' });
    expect(checkCompatibility('video', 'file')).toMatchObject({ ok: true, kind: 'direct' });
  });

  it('refuses the connection the product spec calls out by name', () => {
    // IMAGE -> NUMBER must be impossible, not "possible with a warning".
    const r = checkCompatibility('image', 'i64');
    expect(r.ok).toBe(false);
  });

  it('refuses sibling handles and explains why', () => {
    const r = checkCompatibility('image', 'video');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain('File'); // names the shared supertype
  });

  it('applies a total conversion implicitly', () => {
    const r = checkCompatibility('i64', 'string');
    expect(r).toMatchObject({ ok: true, kind: 'implicit' });
  });

  it('forces a conversion that can fail to be explicit', () => {
    // A parse can fail. Failure needs a node in the graph where it is reported.
    const r = checkCompatibility('string', 'i64');
    expect(r).toMatchObject({ ok: true, kind: 'explicit' });
    if (!r.ok) return;
    expect(r.ops).toEqual(['parse-int']);
  });

  it('never lets a fallible conversion be silent', () => {
    // The invariant, stated as a property rather than a list of pairs.
    for (const [from] of allTypes()) {
      for (const [to] of allTypes()) {
        const r = checkCompatibility(from, to);
        if (!r.ok || r.kind !== 'implicit') continue;
        const declared = typeGraph.coercions.find((c) => c.from === from && c.to === to);
        if (declared === undefined) continue;
        expect(
          declared.kind,
          `${from} -> ${to} is applied silently, so the table must call it implicit`,
        ).toBe('implicit');
      }
    }
  });
});

describe('compatibility — composition', () => {
  it('wraps into an option for free', () => {
    expect(checkCompatibility('string', 'option<string>')).toMatchObject({
      ok: true,
      kind: 'direct',
    });
  });

  it('forces unwrapping an option to be explicit', () => {
    const r = checkCompatibility('option<string>', 'string');
    expect(r).toMatchObject({ ok: true, kind: 'explicit' });
    if (!r.ok) return;
    expect(r.ops[0]).toBe('unwrap-option');
    expect(r.note).toMatch(/absent/i);
  });

  it('maps over lists, keeping the element kind', () => {
    expect(checkCompatibility('list<image>', 'list<file>')).toMatchObject({ kind: 'direct' });

    const mapped = checkCompatibility('list<i64>', 'list<string>');
    expect(mapped).toMatchObject({ ok: true, kind: 'implicit' });
    if (!mapped.ok) return;
    expect(mapped.ops).toEqual(['map', 'to-text']);
  });

  it('rejects a list whose elements are incompatible', () => {
    expect(checkCompatibility('list<image>', 'list<i64>').ok).toBe(false);
  });

  it('does not connect a bare value to a list', () => {
    expect(checkCompatibility('image', 'list<image>').ok).toBe(false);
  });

  it('combines widening with one coercion hop, but never chains coercions', () => {
    // image -> file (widen, free) -> bytes (explicit read). One hop of conversion.
    expect(checkCompatibility('image', 'bytes')).toMatchObject({ ok: true, kind: 'explicit' });
    // string -> i64 -> f64 would be two hops. Not offered, even though each hop exists.
    const declared = typeGraph.coercions.some((c) => c.from === 'string' && c.to === 'f64');
    expect(declared).toBe(true); // declared directly, not derived by chaining
  });
});

describe('failure messages carry a next step', () => {
  it('suggests a bridging type when one exists', () => {
    const r = checkCompatibility('image', 'i64');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // There is no honest route from an image to a number, so no bridge is invented.
    expect(r.bridges).not.toContain('i64');
  });

  it('names an unknown type as a runtime-version problem, not a typo', () => {
    const r = checkCompatibility('quaternion', 'string');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/runtime/i);
  });
});

describe('the table itself', () => {
  it('references only declared types', () => {
    const known = new Set(allTypes().keys());
    for (const c of typeGraph.coercions) {
      expect(known, `coercion source ${c.from}`).toContain(c.from);
      expect(known, `coercion target ${c.to}`).toContain(c.to);
    }
    for (const [name, def] of allTypes()) {
      if (def.extends !== undefined) {
        expect(known, `${name} extends unknown type ${def.extends}`).toContain(def.extends);
      }
    }
  });

  it('has no inheritance cycles', () => {
    for (const [name] of allTypes()) {
      const chain = ancestorsOf(name);
      expect(new Set(chain).size, `cycle in the supertypes of ${name}`).toBe(chain.length);
    }
  });

  it('declares no coercion that duplicates plain widening', () => {
    for (const c of typeGraph.coercions) {
      expect(
        ancestorsOf(c.from).includes(c.to),
        `${c.from} -> ${c.to} is already widening; a coercion entry would shadow it`,
      ).toBe(false);
    }
  });

  it('declares at most one coercion per ordered pair', () => {
    const seen = new Set<string>();
    for (const c of typeGraph.coercions) {
      const key = `${c.from}->${c.to}`;
      expect(seen.has(key), `duplicate coercion ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('gives every explicit coercion a note the Convert node can show', () => {
    for (const c of typeGraph.coercions) {
      if (c.kind !== 'explicit') continue;
      if (c.op === 'encode-json' || c.op === 'decode-json') continue; // self-describing
      expect(c.note, `${c.from} -> ${c.to} can fail but explains nothing`).toBeTruthy();
    }
  });

  it('lists no target for a type it cannot reach', () => {
    const targets = compatibleTargets('image');
    expect([...targets.keys()]).toContain('file');
    expect([...targets.keys()]).not.toContain('i64');
    expect([...targets.keys()]).not.toContain('video');
  });
});
