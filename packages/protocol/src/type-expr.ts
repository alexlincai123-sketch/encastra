/**
 * Port type expressions.
 *
 * The grammar is deliberately tiny — two generics and nothing else:
 *
 *     expr    := ident | 'list' '<' expr '>' | 'option' '<' expr '>'
 *     ident   := [a-z][a-z0-9_]*
 *
 * A richer type language (unions, records, generics with parameters) is the kind of thing
 * that looks powerful in a spec and becomes impossible to explain in a connection error
 * message. If a component needs structure, it uses `json` and says so.
 */

export type TypeExpr =
  | { readonly kind: 'named'; readonly name: string }
  | { readonly kind: 'list'; readonly item: TypeExpr }
  | { readonly kind: 'option'; readonly item: TypeExpr };

export class TypeSyntaxError extends Error {
  constructor(
    message: string,
    readonly input: string,
    readonly position: number,
  ) {
    super(`${message} (in "${input}" at ${position})`);
    this.name = 'TypeSyntaxError';
  }
}

const IDENT = /^[a-z][a-z0-9_]*/;
const GENERICS = new Set(['list', 'option']);

/** Parse a type expression. Throws {@link TypeSyntaxError} on malformed input. */
export function parseType(input: string): TypeExpr {
  const [expr, end] = parseAt(input, 0);
  const rest = input.slice(end).trim();
  if (rest.length > 0) {
    throw new TypeSyntaxError('unexpected trailing input', input, end);
  }
  return expr;
}

/** Parse a type expression, returning `null` instead of throwing. */
export function tryParseType(input: string): TypeExpr | null {
  try {
    return parseType(input);
  } catch {
    return null;
  }
}

function parseAt(input: string, start: number): [TypeExpr, number] {
  let i = skipSpace(input, start);
  const match = IDENT.exec(input.slice(i));
  if (match === null) {
    throw new TypeSyntaxError('expected a type name', input, i);
  }
  const name = match[0];
  i += name.length;

  const afterName = skipSpace(input, i);
  if (input[afterName] !== '<') {
    if (GENERICS.has(name)) {
      throw new TypeSyntaxError(
        `"${name}" requires a type argument, e.g. ${name}<string>`,
        input,
        i,
      );
    }
    return [{ kind: 'named', name }, i];
  }

  if (!GENERICS.has(name)) {
    throw new TypeSyntaxError(`"${name}" does not take a type argument`, input, afterName);
  }

  const [item, afterItem] = parseAt(input, afterName + 1);
  const close = skipSpace(input, afterItem);
  if (input[close] !== '>') {
    throw new TypeSyntaxError('expected ">"', input, close);
  }
  const expr: TypeExpr = name === 'list' ? { kind: 'list', item } : { kind: 'option', item };
  return [expr, close + 1];
}

function skipSpace(input: string, from: number): number {
  let i = from;
  while (i < input.length && input[i] === ' ') i += 1;
  return i;
}

/** Render a type expression back to its canonical string form. */
export function formatType(expr: TypeExpr): string {
  switch (expr.kind) {
    case 'named':
      return expr.name;
    case 'list':
      return `list<${formatType(expr.item)}>`;
    case 'option':
      return `option<${formatType(expr.item)}>`;
  }
}

/** Structural equality. */
export function typesEqual(a: TypeExpr, b: TypeExpr): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'named') return a.name === (b as { name: string }).name;
  return typesEqual(a.item, (b as { item: TypeExpr }).item);
}

/** Every named type mentioned anywhere in the expression. */
export function namedTypesIn(expr: TypeExpr): string[] {
  switch (expr.kind) {
    case 'named':
      return [expr.name];
    case 'list':
    case 'option':
      return namedTypesIn(expr.item);
  }
}
