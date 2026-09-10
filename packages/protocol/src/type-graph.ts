/**
 * Connection legality.
 *
 * All rules come from `data/type-graph.json`. The Rust runtime reads the same file. Neither
 * side hardcodes a pair — if you find yourself writing `if (from === 'image')` here, the rule
 * belongs in the data file instead (docs/adr/0003).
 */

import graphData from '../data/type-graph.json' with { type: 'json' };
import { formatType, parseType, type TypeExpr, typesEqual } from './type-expr.js';

export type CoercionKind = 'direct' | 'implicit' | 'explicit';

export interface TypeDef {
  readonly kind: 'scalar' | 'handle';
  readonly label: string;
  readonly color: string;
  readonly doc: string;
  readonly extends?: string;
}

export interface Coercion {
  readonly from: string;
  readonly to: string;
  readonly kind: CoercionKind;
  readonly op: string;
  readonly note?: string;
}

/** A legal connection, and what the runtime will do about it. */
export interface Compatible {
  readonly ok: true;
  readonly kind: CoercionKind;
  /** Conversion operations the runtime applies, outermost first. Empty for `direct`. */
  readonly ops: readonly string[];
  /** Present when the conversion can fail or lose information; shown on the Convert node. */
  readonly note?: string;
}

/** An illegal connection, with something the UI can actually say to a person. */
export interface Incompatible {
  readonly ok: false;
  readonly reason: string;
  /** Types that bridge `from` to `to` in two legal hops, for a "did you mean" hint. */
  readonly bridges: readonly string[];
}

export type Compatibility = Compatible | Incompatible;

const TYPES = graphData.types as unknown as Readonly<Record<string, TypeDef>>;
const COERCIONS = graphData.coercions as unknown as readonly Coercion[];

const COERCION_INDEX: ReadonlyMap<string, Coercion> = new Map(
  COERCIONS.map((c) => [`${c.from}->${c.to}`, c]),
);

const STRENGTH: Record<CoercionKind, number> = { direct: 0, implicit: 1, explicit: 2 };

/** All named types, for palettes and documentation. */
export function allTypes(): ReadonlyMap<string, TypeDef> {
  return new Map(Object.entries(TYPES));
}

export function typeDef(name: string): TypeDef | undefined {
  return TYPES[name];
}

export function isKnownType(name: string): boolean {
  return Object.hasOwn(TYPES, name);
}

/** `image` -> `['image', 'file']`. A type is its own first ancestor. */
export function ancestorsOf(name: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = name;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = TYPES[current]?.extends;
  }
  return chain;
}

/** True when `sub` is a strict descendant of `sup` — `image` is a strict descendant of `file`. */
function isStrictDescendant(sub: string, sup: string): boolean {
  return sub !== sup && ancestorsOf(sub).includes(sup);
}

/**
 * Can a value of type `from` flow into a port of type `to`?
 *
 * Accepts either parsed expressions or their string form.
 */
export function checkCompatibility(from: TypeExpr | string, to: TypeExpr | string): Compatibility {
  let a: TypeExpr;
  let b: TypeExpr;
  try {
    a = typeof from === 'string' ? parseType(from) : from;
    b = typeof to === 'string' ? parseType(to) : to;
  } catch (error) {
    return { ok: false, reason: (error as Error).message, bridges: [] };
  }
  return check(a, b);
}

function check(a: TypeExpr, b: TypeExpr): Compatibility {
  if (typesEqual(a, b)) return { ok: true, kind: 'direct', ops: [] };

  // T -> option<T> : wrapping a present value is free.
  if (b.kind === 'option' && a.kind !== 'option') {
    return check(a, b.item);
  }

  // option<T> -> U : the absent case has to be handled where a person can see it.
  if (a.kind === 'option' && b.kind !== 'option') {
    const inner = check(a.item, b);
    if (!inner.ok) return inner;
    return {
      ok: true,
      kind: 'explicit',
      ops: ['unwrap-option', ...inner.ops],
      note: 'This value may be absent. The Convert node decides what happens when it is.',
    };
  }

  if (a.kind === 'option' && b.kind === 'option') return check(a.item, b.item);
  if (a.kind === 'list' && b.kind === 'list') {
    const inner = check(a.item, b.item);
    if (!inner.ok) {
      return {
        ok: false,
        reason: `Lists do not match: ${inner.reason}`,
        bridges: inner.bridges,
      };
    }
    return inner.kind === 'direct' ? inner : { ...inner, ops: ['map', ...inner.ops] };
  }

  if (a.kind !== 'named' || b.kind !== 'named') {
    return {
      ok: false,
      reason: `${formatType(a)} cannot connect to ${formatType(b)}.`,
      bridges: [],
    };
  }
  return checkNamed(a.name, b.name);
}

/**
 * The decision alone, with no explanation attached — pure, and it never calls back into the
 * explaining layer. (It used to: `checkNamed` asked `findBridges` for a hint, and
 * `findBridges` asked `checkNamed` whether each hint was legal. That recursed forever.
 * Deciding and explaining are now separate functions, and only one of them recurses.)
 */
function resolveNamed(from: string, to: string): Compatible | null {
  let best: Compatible | null = null;

  // A value is also a value of each of its supertypes, so try the coercion table from every
  // ancestor. Widening itself is free. This is ONE coercion hop, never a chain of them:
  // chained conversions are how a graph ends up doing something nobody wrote down.
  for (const ancestor of ancestorsOf(from)) {
    if (ancestor === to) {
      best = pickBetter(best, { ok: true, kind: 'direct', ops: [] });
      continue;
    }

    const coercion = COERCION_INDEX.get(`${ancestor}->${to}`);
    if (coercion === undefined) continue;

    // Widening and then narrowing lands on a sibling: `image` -> `file` -> `video` would make
    // an Image connectable to a Video port and fail at run time, every time. If we already
    // widened, refuse a coercion that narrows back down the same tree. A statically-knowable
    // impossibility must be refused in the editor, not discovered during a run.
    if (ancestor !== from && isStrictDescendant(to, ancestor)) continue;

    best = pickBetter(best, {
      ok: true,
      kind: coercion.kind,
      ops: [coercion.op],
      ...(coercion.note !== undefined ? { note: coercion.note } : {}),
    });
  }

  return best;
}

function checkNamed(from: string, to: string): Compatibility {
  if (!isKnownType(from)) return unknownType(from);
  if (!isKnownType(to)) return unknownType(to);

  const resolved = resolveNamed(from, to);
  if (resolved !== null) return resolved;

  return {
    ok: false,
    reason: describeFailure(from, to),
    bridges: findBridges(from, to),
  };
}

function pickBetter(current: Compatible | null, candidate: Compatible): Compatible {
  if (current === null) return candidate;
  return STRENGTH[candidate.kind] < STRENGTH[current.kind] ? candidate : current;
}

function unknownType(name: string): Incompatible {
  return {
    ok: false,
    reason: `"${name}" is not a type this runtime knows. The component may need a newer runtime version.`,
    bridges: [],
  };
}

function describeFailure(from: string, to: string): string {
  const a = TYPES[from]?.label ?? from;
  const b = TYPES[to]?.label ?? to;
  // Narrowing to a sibling is the mistake people actually make (image -> video).
  const fromAncestors = ancestorsOf(from);
  const toAncestors = ancestorsOf(to);
  const shared = fromAncestors.find((t) => toAncestors.includes(t));
  if (shared !== undefined && shared !== from && shared !== to) {
    return `${a} and ${b} are both kinds of ${TYPES[shared]?.label ?? shared}, but one is not the other. Convert through ${TYPES[shared]?.label ?? shared} if that is what you mean.`;
  }
  return `${a} cannot become ${b}. There is no conversion between them.`;
}

/** Types X where from -> X and X -> to are both legal. Powers the "did you mean" hint. */
function findBridges(from: string, to: string): string[] {
  const bridges: string[] = [];
  for (const candidate of Object.keys(TYPES)) {
    if (candidate === from || candidate === to) continue;
    if (resolveNamed(from, candidate) === null) continue;
    if (resolveNamed(candidate, to) === null) continue;
    bridges.push(candidate);
  }
  return bridges;
}

/** Everything a port of type `from` may legally connect to. Used to highlight valid targets. */
export function compatibleTargets(from: TypeExpr | string): ReadonlyMap<string, Compatible> {
  const out = new Map<string, Compatible>();
  for (const name of Object.keys(TYPES)) {
    const result = checkCompatibility(from, { kind: 'named', name });
    if (result.ok) out.set(name, result);
  }
  return out;
}

/** The raw table, for tooling and for the cross-language conformance test. */
export const typeGraph = graphData;
