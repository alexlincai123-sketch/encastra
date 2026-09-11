/**
 * The category model behind the Settings screen, and the small amount of derived data it needs
 * that JSX has no business owning.
 *
 * Kept pure and framework-free on purpose: a list of categories that does not depend on React
 * can be asserted on directly (every id unique, every id findable, a count that is never
 * hardcoded) instead of only ever being exercised by clicking through the sidebar by hand.
 */

import type { Capability, ComponentManifest, GrantSpec } from '../types';

export type CategoryId =
  | 'general'
  | 'appearance'
  | 'language'
  | 'workspace'
  | 'projects'
  | 'editor'
  | 'canvas'
  | 'runtime'
  | 'components'
  | 'security'
  | 'privacy'
  | 'notifications'
  | 'files'
  | 'updates'
  | 'account'
  | 'developer'
  | 'diagnostics'
  | 'about';

/**
 * A category is just its id here. The label and description a person actually reads live in
 * `i18n/locales/en.ts` under `settings.categories.<id>`, and every other locale translates them
 * from there — this file owning a second, English-only copy is exactly how the label in
 * `categories.ts` and the one in the locale files drifted apart before. A caller wanting the text
 * for a category calls `t(\`settings.categories.${id}.label\`)` (and `.description`) itself.
 */
export interface Category {
  readonly id: CategoryId;
}

/** Sidebar order. `about` last is deliberate — it is where people look once they are oriented. */
const CATEGORY_IDS: readonly CategoryId[] = [
  'general',
  'appearance',
  'language',
  'workspace',
  'projects',
  'editor',
  'canvas',
  'runtime',
  'components',
  'security',
  'privacy',
  'notifications',
  'files',
  'updates',
  'account',
  'developer',
  'diagnostics',
  'about',
];

export const CATEGORIES: readonly Category[] = CATEGORY_IDS.map((id) => ({ id }));

export const DEFAULT_CATEGORY: CategoryId = CATEGORY_IDS[0] ?? 'general';

export function isCategoryId(value: string): value is CategoryId {
  return CATEGORIES.some((category) => category.id === value);
}

/** Falls back to General for an id that does not (or no longer) match anything — never throws. */
export function findCategory(id: CategoryId): Category {
  return CATEGORIES.find((category) => category.id === id) ?? { id: DEFAULT_CATEGORY };
}

export type NavKey = 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

export function isNavKey(key: string): key is NavKey {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'Home' || key === 'End';
}

/**
 * Where roving focus in the category sidebar lands next.
 *
 * Pulled out of the component so the wrap-around arithmetic — the part most likely to be off by
 * one — can be checked without a DOM.
 */
export function moveIndex(current: number, key: NavKey, length: number): number {
  if (length <= 0) return current;
  if (key === 'ArrowUp') return (current - 1 + length) % length;
  if (key === 'ArrowDown') return (current + 1) % length;
  if (key === 'Home') return 0;
  return length - 1; // 'End'
}

export interface ComponentSummary {
  readonly total: number;
  readonly core: number;
  readonly thirdParty: number;
}

/** Mirrors the split the Security screen makes, so the two never disagree about what counts. */
export function summarizeComponents(
  manifests: Record<string, ComponentManifest>,
): ComponentSummary {
  const all = Object.values(manifests);
  const core = all.filter((manifest) => manifest.kind === 'core').length;
  return { total: all.length, core, thirdParty: all.length - core };
}

export function countGrants(grants: readonly GrantSpec[]): number {
  return grants.length;
}

/**
 * The `settings.components.capabilityLabels.*` key for a capability kind, for anywhere that shows
 * what a component can reach. Mirrors the map `views/Security.tsx` keeps for the same purpose —
 * duplicated rather than imported, since that file sits outside this feature's edit boundary, but
 * small enough that the two are easy to keep in step by hand.
 */
const CAPABILITY_LABEL_KEYS: Record<string, string> = {
  'fs.read': 'settings.components.capabilityLabels.fsRead',
  'fs.write': 'settings.components.capabilityLabels.fsWrite',
  'net.http': 'settings.components.capabilityLabels.netHttp',
  'system.notify': 'settings.components.capabilityLabels.systemNotify',
  'system.clipboard': 'settings.components.capabilityLabels.systemClipboard',
};

/**
 * A plain-language, translated name for a capability kind.
 *
 * Takes the translator rather than importing `useTranslation` itself, so this file — and the test
 * that exercises it — stay free of React: the caller already has a `t`, from its own render or
 * from the English locale directly in a test.
 */
export function capabilityLabel(kind: string, t: (key: string) => string): string {
  const key = CAPABILITY_LABEL_KEYS[kind];
  return key ? t(key) : kind;
}

/**
 * What a component actually reaches, for display.
 *
 * `input-handles` is bookkeeping the runtime uses to resolve which port an input came from, not
 * a real capability anyone granted — the Security screen filters it out for the same reason, and
 * Settings has to agree with it or the two screens would describe the same component differently.
 */
export function reachOf(manifest: ComponentManifest): readonly Capability[] {
  return manifest.capabilities.filter((capability) => capability.scope !== 'input-handles');
}
