/**
 * The translation engine: a nested dictionary, a dotted-path lookup, and `{placeholder}`
 * interpolation. Nothing else.
 *
 * Shaped after `apps/desktop/src/i18n/index.ts` on purpose — same nested-object-of-strings,
 * same dotted key, same English fallback — so a person who already knows one knows the other.
 * What is different is everything the desktop app needs that a server-rendered site does not:
 * there is no `zustand` store here, because there is no client-side "current locale" to hold —
 * a server component already knows its locale before it renders a single string, and the two
 * languages are few enough and small enough that neither needs the desktop's dynamic `import()`
 * per locale. Two plain objects and a lookup is the whole job.
 */

export type Messages = { [key: string]: string | Messages };

/** Walks a dotted path. Returns `undefined` rather than throwing: a missing key is not a crash. */
export function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Substitutes `{name}` placeholders.
 *
 * An unmatched placeholder is left exactly as written rather than blanked, so a translation that
 * mistypes one shows `{cont}` in the page and can be found, instead of a sentence with a silent
 * hole in it.
 */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
