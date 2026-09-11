/**
 * Human explanations for a refused connection.
 *
 * React Flow's `isValidConnection` only returns a boolean: dragging an illegal wire just snaps
 * back, and nothing is said about why. That silence is the most common moment of confusion in
 * this editor, because the editor knows exactly why — `checkCompatibility` in
 * `@encastra/protocol` already computed the answer to refuse the connection in the first place.
 *
 * This module never re-derives legality. It is a pure translation layer: it asks the protocol
 * package what it already decided, and turns that decision into something a person who has
 * never heard the word "type" can read. If a rule about which types connect ever needs to
 * change, it changes in `packages/protocol/src/type-graph.ts` (docs/adr/0003) — this file would
 * not need to know.
 */

import {
  checkCompatibility,
  type Incompatible,
  type TypeExpr,
  tryParseType,
  typeDef,
} from '@encastra/protocol';

/** A connection the runtime accepts. There is nothing to explain — the wire just draws. */
export interface RefusalOk {
  readonly ok: true;
}

/**
 * A connection the runtime refuses, explained for someone who does not know what a "type" is.
 *
 * Structured rather than a single string so the panel can render it — a headline, a longer
 * reason underneath, and, when one exists, a chip naming the type that would bridge the two —
 * instead of the caller having to parse sentences back apart to build a UI from them.
 */
export interface RefusalNo {
  readonly ok: false;
  /** One short sentence: what just failed to connect, in plain words. Never "A → B". */
  readonly headline: string;
  /** A second sentence with the reason a person can dig into if the headline is not enough. */
  readonly detail: string;
  /** The label of a type that legally bridges `from` to `to` in two hops, when one exists. */
  readonly bridge?: string;
}

export type Refusal = RefusalOk | RefusalNo;

/**
 * Why a value of type `from` cannot flow into a port of type `to` — or that it can.
 *
 * Same two arguments, same order, as `checkCompatibility(from, to)`: the source port's type
 * first, the target port's type second. A caller already holding those two strings for the
 * legality check can call this one the same way to get the explanation.
 */
export function explainConnection(from: string, to: string): Refusal {
  const result = checkCompatibility(from, to);
  if (result.ok) return { ok: true };

  const bridgeName = result.bridges[0];
  return {
    ok: false,
    headline: headlineFor(from, to),
    detail: result.reason,
    ...(bridgeName ? { bridge: labelFor(bridgeName) } : {}),
  };
}

/** `"A picture cannot be fed into a step that expects a video."` — never `"IMAGE → VIDEO"`. */
function headlineFor(from: string, to: string): string {
  return `${capitalize(phraseFor(from))} cannot be fed into a step that expects ${phraseFor(to)}.`;
}

/** A plain-language noun phrase for a type expression, with its article: `"an image"`. */
function phraseFor(typeString: string): string {
  const expr = tryParseType(typeString);
  // A manifest with a type string the grammar cannot even parse is a bug somewhere upstream,
  // not something this module can explain in plain language. Showing the raw text verbatim
  // beats guessing at a phrase for it.
  if (!expr) return `"${typeString}"`;
  return phraseForExpr(expr);
}

function phraseForExpr(expr: TypeExpr): string {
  switch (expr.kind) {
    case 'named': {
      const word = labelFor(expr.name).toLowerCase();
      return `${article(word)} ${word}`;
    }
    case 'list':
      // "values", not the article-bearing phrase for the element, so this does not read as
      // "a list of an image values" — the list already supplies the article.
      return `a list of ${nounFor(expr.item)} values`;
    case 'option':
      // The absent case is exactly what makes an option worth naming as its own thing here,
      // rather than silently describing it as the type it wraps.
      return `an optional ${phraseForExpr(expr.item)}`;
  }
}

/** The bare noun for a type expression, for use inside a phrase that already has an article. */
function nounFor(expr: TypeExpr): string {
  return expr.kind === 'named' ? labelFor(expr.name).toLowerCase() : phraseForExpr(expr);
}

/** The type's declared label, or the raw name if this runtime does not know the type. */
function labelFor(name: string): string {
  return typeDef(name)?.label ?? name;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Exported only so a test can assert against the protocol's own wording without duplicating it. */
export type { Incompatible };
