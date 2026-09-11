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

export interface Category {
  readonly id: CategoryId;
  readonly label: string;
  /** One line, shown under the category title. Not a repeat of the label. */
  readonly description: string;
}

const GENERAL: Category = {
  id: 'general',
  label: 'General',
  description: 'Get started, and what this application shows you when it opens.',
};

const APPEARANCE: Category = {
  id: 'appearance',
  label: 'Appearance',
  description: 'Theme and motion.',
};

const LANGUAGE: Category = {
  id: 'language',
  label: 'Language & Region',
  description: 'The language this interface speaks, and how it shows dates and numbers.',
};

const WORKSPACE: Category = {
  id: 'workspace',
  label: 'Workspace',
  description: 'Where your projects live on disk.',
};

const PROJECTS: Category = {
  id: 'projects',
  label: 'Projects',
  description: 'How a project opens, and the format it is saved in.',
};

const EDITOR: Category = {
  id: 'editor',
  label: 'Editor',
  description: 'Shortcuts and behaviour while you build a graph.',
};

const CANVAS: Category = {
  id: 'canvas',
  label: 'Canvas',
  description: 'Aids drawn on the canvas itself: the grid, snapping, the minimap.',
};

const RUNTIME: Category = {
  id: 'runtime',
  label: 'Runtime',
  description: 'What happens on screen while a workflow runs.',
};

const COMPONENTS: Category = {
  id: 'components',
  label: 'Components',
  description: 'What is installed in this build, and exactly what each one can reach.',
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

const NOTIFICATIONS: Category = {
  id: 'notifications',
  label: 'Notifications',
  description: "Where a workflow's notifications appear, and where they do not.",
};

const FILES: Category = {
  id: 'files',
  label: 'Files',
  description: 'What Encastra writes to disk, and what it does not.',
};

const UPDATES: Category = {
  id: 'updates',
  label: 'Updates',
  description: 'How a newer version reaches this machine.',
};

const ACCOUNT: Category = {
  id: 'account',
  label: 'Account',
  description: 'Sign-in, subscriptions, and why there are none.',
};

const DEVELOPER: Category = {
  id: 'developer',
  label: 'Developer',
  description: 'Internals for people who want them, and a way back to the defaults.',
};

const DIAGNOSTICS: Category = {
  id: 'diagnostics',
  label: 'Diagnostics',
  description: 'What this build and this machine report, ready to paste into a bug report.',
};

const ABOUT: Category = {
  id: 'about',
  label: 'About',
  description: 'Build, versions, and where the fuller documentation lives.',
};

/** Sidebar order. `about` last is deliberate — it is where people look once they are oriented. */
export const CATEGORIES: readonly Category[] = [
  GENERAL,
  APPEARANCE,
  LANGUAGE,
  WORKSPACE,
  PROJECTS,
  EDITOR,
  CANVAS,
  RUNTIME,
  COMPONENTS,
  SECURITY,
  PRIVACY,
  NOTIFICATIONS,
  FILES,
  UPDATES,
  ACCOUNT,
  DEVELOPER,
  DIAGNOSTICS,
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

/**
 * A plain-language name for a capability kind, for anywhere that shows what a component can
 * reach. Mirrors the map `views/Security.tsx` keeps for the same purpose — duplicated rather
 * than imported, since that file sits outside this feature's edit boundary, but small enough
 * that the two are easy to keep in step by hand.
 */
export const CAPABILITY_LABELS: Record<string, string> = {
  'fs.read': 'Read files',
  'fs.write': 'Write files',
  'net.http': 'Use the network',
  'system.notify': 'Show notifications',
  'system.clipboard': 'Use the clipboard',
};

export function capabilityLabel(kind: string): string {
  return CAPABILITY_LABELS[kind] ?? kind;
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
