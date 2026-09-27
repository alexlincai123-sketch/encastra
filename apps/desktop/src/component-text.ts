/**
 * The words a person reads about a component: its name, what it does, and the category it sits in.
 *
 * A manifest is written once, in English, by whoever wrote the component — and until this file,
 * that English went straight onto every screen in every locale, so a Spanish palette offered
 * "Resize Image" next to Spanish everything else. The built-in components are ours, so their
 * words are translated here: `components.core.<id>.name` and `.description` in each locale file.
 *
 * Two rules keep that honest:
 *
 * - **Only a built-in gets a translated name.** The lookup is keyed by id, and an id is only a
 *   claim; a third-party WebAssembly component that called itself `encastra.file.read` must not
 *   be shown to somebody under the name of the real one. `kind: 'core'` is the runtime's own word
 *   for "shipped with the application", and nothing else is looked up.
 * - **English is the manifest.** The English locale carries the same keys only so every locale has
 *   the same shape; the text shown in English is always the manifest's, so a component whose
 *   manifest changes cannot be described by a stale copy of itself. A translation that is missing
 *   falls back to the manifest too, never to a raw key.
 *
 * Port names are not translated: they are identifiers a project file refers to, not prose.
 */

import { useMemo } from 'react';
import { type Locale, lookup, type Messages, translate, useI18n } from './i18n';
import type { ComponentManifest } from './types';

type Described = Pick<ComponentManifest, 'id' | 'kind' | 'name' | 'description'>;

/** The part of the i18n store these read. Passed in so a caller can pin a locale. */
export interface TextState {
  locale: Locale;
  messages: Record<string, Messages>;
}

function builtIn(
  manifest: Pick<ComponentManifest, 'id' | 'kind'>,
  field: 'name' | 'description',
  state: TextState,
): string | undefined {
  if (manifest.kind !== 'core' || state.locale === 'en') return undefined;
  const active = state.messages[state.locale];
  return active ? lookup(active, `components.core.${manifest.id}.${field}`) : undefined;
}

/** A component's name in the reader's language, or its manifest name when there is none. */
export function componentName(
  manifest: Pick<ComponentManifest, 'id' | 'kind' | 'name'>,
  state: TextState = useI18n.getState(),
): string {
  return builtIn(manifest, 'name', state) ?? manifest.name;
}

/** What a component does, in the reader's language, or its manifest's own words. */
export function componentDescription(
  manifest: Pick<ComponentManifest, 'id' | 'kind' | 'description'>,
  state: TextState = useI18n.getState(),
): string | undefined {
  return builtIn(manifest, 'description', state) ?? manifest.description;
}

/** The categories the built-ins use. Any other is shown as written. */
export const KNOWN_CATEGORIES = [
  'all',
  'other',
  'data',
  'file',
  'flow',
  'media',
  'network',
  'system',
] as const;

/**
 * A category's label. A category id is a word a manifest chose, so one this file does not know —
 * from a component added later — is shown as the id rather than as a raw translation key.
 */
export function categoryLabel(id: string, state: TextState = useI18n.getState()): string {
  return (KNOWN_CATEGORIES as readonly string[]).includes(id)
    ? translate(
        `components.categories.${id}`,
        undefined,
        state as ReturnType<typeof useI18n.getState>,
      )
    : id;
}

/** The same three, bound to the current locale and re-rendered when it changes. */
export function useComponentText() {
  const locale = useI18n((s) => s.locale);
  const messages = useI18n((s) => s.messages);
  return useMemo(() => {
    const state: TextState = { locale, messages };
    return {
      name: (manifest: Pick<Described, 'id' | 'kind' | 'name'>) => componentName(manifest, state),
      description: (manifest: Pick<Described, 'id' | 'kind' | 'description'>) =>
        componentDescription(manifest, state),
      category: (id: string) => categoryLabel(id, state),
    };
  }, [locale, messages]);
}
