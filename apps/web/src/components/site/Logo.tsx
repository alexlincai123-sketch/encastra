import type { ReactNode } from 'react';

/**
 * The mark, inlined from `packages/ui/brand/mark-current.svg`.
 *
 * Inlined rather than linked so it inherits `currentColor` and needs no network request on
 * first paint. The paths are byte-identical to the brand file; if that file changes, this one
 * is updated from it rather than redrawn.
 *
 * It is two interlocking forms — a tongue and the slot it seats into. Not a brick, not a stud,
 * not an interlocking-brick silhouette: `docs/BRANDING.md` fixes that constraint, and it is a
 * legal one.
 */
export function Logo({ size = 24, title }: { size?: number; title?: string }): ReactNode {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: a <title> is rendered below whenever one is given; otherwise the svg is aria-hidden.
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title === undefined ? 'presentation' : 'img'}
      {...(title === undefined ? { 'aria-hidden': true } : {})}
    >
      {title !== undefined ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M20 3h7a1.5 1.5 0 0 1 1.5 1.5v16A1.5 1.5 0 0 1 27 22h-7a1.5 1.5 0 0 1-1.5-1.5v-1.4h4.7a1.2 1.2 0 0 0 1.2-1.2v-3.8a1.2 1.2 0 0 0-1.2-1.2h-4.7V4.5A1.5 1.5 0 0 1 20 3Z"
      />
      <path
        fill="currentColor"
        d="M5 10h7a1.5 1.5 0 0 1 1.5 1.5v3.3h8.3a1.2 1.2 0 0 1 1.2 1.2v1a1.2 1.2 0 0 1-1.2 1.2H13.5v9.3A1.5 1.5 0 0 1 12 29H5a1.5 1.5 0 0 1-1.5-1.5v-16A1.5 1.5 0 0 1 5 10Z"
      />
    </svg>
  );
}
