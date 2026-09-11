/**
 * The category model behind the Settings screen, and the small amount of derived data it needs
 * that JSX has no business owning.
 *
 * Kept pure and framework-free on purpose: a list of categories that does not depend on React
 * can be asserted on directly (every id unique, every id findable, a count that is never
 * hardcoded) instead of only ever being exercised by clicking through the sidebar by hand.
 */

import type { ComponentManifest, GrantSpec } from '../types';

export type CategoryId =
  | 'general'
  | 'workspace'
  | 'editor'
  | 'runtime'
  | 'components'
  | 'security'
  | 'privacy'
  | 'advanced'
  | 'about';

export interface Category {
  readonly id: CategoryId;
  readonly label: string;
  /** One line, shown under the category title. Not a repeat of the label. */
  readonly description: string;
}

const GENERAL: Category = {
  id: 'general',
  label: 'General',
  description: 'Appearance, motion, and the first-run tour.',
};

const WORKSPACE: Category = {
  id: 'workspace',
  label: 'Workspace',
  description: 'Where projects live, and what this application opens to.',
};

const EDITOR: Category = {
  id: 'editor',
  label: 'Editor',
  description: 'Aids shown on the canvas while you build a graph.',
};

const RUNTIME: Category = {
  id: 'runtime',
  label: 'Runtime',
  description: 'What happens on screen while a workflow runs.',
};

const COMPONENTS: Category = {
  id: 'components',
  label: 'Components',
  description: 'What is installed in this build, and what each one can reach.',
};

const SECURITY: Category = {
  id: 'security',
  label: 'Security',
  description: 'The permission model, in short. The full detail lives on its own screen.',
};

const PRIVACY: Category = {
  id: 'privacy',
  label: 'Privacy',
  description: 'What this application collects and sends, stated as fact.',
};

const ADVANCED: Category = {
  id: 'advanced',
  label: 'Advanced',
  description: 'Internals for people who want them, and a way back to the defaults.',
};

const ABOUT: Category = {
  id: 'about',
  label: 'About',
  description: 'Build, versions, and where the fuller documentation lives.',
};

/** Sidebar order. `about` last is deliberate — it is where people look once they are oriented. */
export const CATEGORIES: readonly Category[] = [
  GENERAL,
  WORKSPACE,
  EDITOR,
  RUNTIME,
  COMPONENTS,
  SECURITY,
  PRIVACY,
  ADVANCED,
  ABOUT,
];

export const DEFAULT_CATEGORY: CategoryId = GENERAL.id;

export function isCategoryId(value: string): value is CategoryId {
  return CATEGORIES.some((category) => category.id === value);
}

/** Falls back to General for an id that does not (or no longer) match anything — never throws. */
export function findCategory(id: CategoryId): Category {
  return CATEGORIES.find((category) => category.id === id) ?? GENERAL;
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
