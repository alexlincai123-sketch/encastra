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
 *
 * **Every sentence here comes out of the message tree, never out of English grammar.**
 *
 * It used to build them by hand: an article chosen by looking for a vowel, a headline glued
 * together from a capitalised phrase and a fixed clause, "a list of {noun} values" formed by
 * concatenation. All six languages therefore got English word order with, at best, translated
 * words in it — and the one place this application speaks to somebody at the exact moment they
 * are confused was the one place it did not speak their language.
 *
 * Two things worth knowing before adding to this file:
 *
 * - **A construction is one key, never two joined.** `canvas.refusal.cannotFeed`, `listOf` and
 *   `optional` are whole sentences or whole phrases with a placeholder in them, because word
 *   order and agreement belong to the translator, not to this file. German writes its type
 *   phrases with no article and leans on a fixed "Wert vom Typ …" scaffold so that case never
 *   has to vary; Spanish writes "una imagen" and carries the article inside the phrase. Both
 *   are right, and neither can be reached by gluing words together here.
 * - **The protocol's own `reason` is not shown.** It is English prose assembled inside a package
 *   shared with Rust and with tests, and translating it would mean parsing English back apart.
 *   The detail sentence is derived here instead, from the same public facts the protocol already
 *   exposes (`isKnownType`, `ancestorsOf`, `typeDef`) — an explanation of a verdict, never a
 *   second verdict. `checkCompatibility` alone still decides whether a wire may exist.
 */

import {
  ancestorsOf,
  checkCompatibility,
  type Incompatible,
  isKnownType,
  type TypeExpr,
  tryParseType,
  typeDef,
} from '@encastra/protocol';
// A plain function rather than the `useTranslation()` hook, for the reason `store.ts` gives for
// its own import of it: this runs inside a React Flow drag callback, not inside a render, and
// `translate()` reads the active locale itself at call time.
import { translate } from '../i18n';

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
    detail: detailFor(from, to),
    ...(bridgeName ? { bridge: labelFor(bridgeName) } : {}),
  };
}

/** `"A picture cannot be fed into a step that expects a video."` — never `"IMAGE → VIDEO"`. */
function headlineFor(from: string, to: string): string {
  return sentence(
    translate('canvas.refusal.cannotFeed', { from: phraseFor(from), to: phraseFor(to) }),
  );
}

/**
 * The longer reason, in the reader's language.
 *
 * Unwraps a pair in the same order `check()` in the protocol package does, so the sentence names
 * the two things that actually failed to meet rather than the outermost wrappers: a refused
 * `option<image>` against `option<video>` is an image-against-video problem, and saying
 * "optional" twice would bury that.
 */
function detailFor(from: string, to: string): string {
  const a = tryParseType(from);
  if (!a) return translate('canvas.refusal.detail.notAType', { name: from });
  const b = tryParseType(to);
  if (!b) return translate('canvas.refusal.detail.notAType', { name: to });
  return sentence(detailForExpr(a, b));
}

function detailForExpr(a: TypeExpr, b: TypeExpr): string {
  if (a.kind === 'option' || b.kind === 'option') {
    // Wrapping is free and unwrapping is explicit-but-legal, so an option on either side is
    // never itself the refusal; whatever it holds is.
    return detailForExpr(a.kind === 'option' ? a.item : a, b.kind === 'option' ? b.item : b);
  }
  if (a.kind === 'list' && b.kind === 'list') {
    return translate('canvas.refusal.detail.listsDoNotMatch', {
      inner: detailForExpr(a.item, b.item),
    });
  }
  if (a.kind !== 'named' || b.kind !== 'named') {
    return translate('canvas.refusal.detail.cannotConnect', {
      from: phraseForExpr(a),
      to: phraseForExpr(b),
    });
  }
  return detailForNamed(a.name, b.name);
}

function detailForNamed(from: string, to: string): string {
  if (!isKnownType(from)) return translate('canvas.refusal.detail.unknownType', { name: from });
  if (!isKnownType(to)) return translate('canvas.refusal.detail.unknownType', { name: to });

  // Narrowing to a sibling is the mistake people actually make (image -> video), and naming the
  // parent both share is the only part of the answer that says what to do instead.
  const toAncestors = ancestorsOf(to);
  const shared = ancestorsOf(from).find((type) => toAncestors.includes(type));
  if (shared !== undefined && shared !== from && shared !== to) {
    return translate('canvas.refusal.detail.siblings', {
      from: labelFor(from),
      to: labelFor(to),
      shared: labelFor(shared),
    });
  }
  return translate('canvas.refusal.detail.noConversion', {
    from: labelFor(from),
    to: labelFor(to),
  });
}

/** A plain-language noun phrase for a type expression, written the way that language writes one. */
function phraseFor(typeString: string): string {
  const expr = tryParseType(typeString);
  // A manifest with a type string the grammar cannot even parse is a bug somewhere upstream,
  // not something this module can explain in plain language. Showing the raw text verbatim
  // beats guessing at a phrase for it.
  if (!expr) return translate('canvas.refusal.rawType', { name: typeString });
  return phraseForExpr(expr);
}

function phraseForExpr(expr: TypeExpr): string {
  switch (expr.kind) {
    case 'named':
      return typeWording('types', expr.name);
    case 'list':
      // The bare noun, not the article-bearing phrase: the construction key already supplies
      // whatever its own language needs around it.
      return translate('canvas.refusal.listOf', { item: nounFor(expr.item) });
    case 'option':
      // The absent case is exactly what makes an option worth naming as its own thing here,
      // rather than silently describing it as the type it wraps.
      return translate('canvas.refusal.optional', { item: nounFor(expr.item) });
  }
}

/** The bare noun for a type expression, for use inside a construction that frames it. */
function nounFor(expr: TypeExpr): string {
  return expr.kind === 'named' ? typeWording('nouns', expr.name) : phraseForExpr(expr);
}

/** The type's name as a label: what the bridge chip shows and what the detail sentence names. */
function labelFor(name: string): string {
  return typeWording('labels', name);
}

/**
 * One of the three per-type wordings, falling back to the type's own name.
 *
 * A type the message tree does not name is one shipped by a component this build's dictionary
 * predates. Showing its declared label, or failing that its identifier, is honest where a
 * guessed phrase would not be; `translate()` handing the key straight back is precisely the
 * documented signal that nothing was found (see `i18n/index.ts`).
 */
function typeWording(tree: 'types' | 'nouns' | 'labels', name: string): string {
  const key = `canvas.refusal.${tree}.${name}`;
  const wording = translate(key);
  if (wording !== key) return wording;
  const declared = typeDef(name)?.label;
  return declared ?? translate('canvas.refusal.rawType', { name });
}

/**
 * Capitalises a finished sentence, rather than a phrase on its way into one.
 *
 * Capitalising the phrase — as this file used to — puts a capital wherever the translator chose
 * to place that placeholder, which in several of these languages is the middle of the sentence.
 * Capitalising the result is right in every language shipped here, and is a no-op where the
 * first word already carries a capital (German's nouns) or an opening mark.
 */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Exported only so a test can assert against the protocol's own wording without duplicating it. */
export type { Incompatible };
