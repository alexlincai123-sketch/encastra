/**
 * What the person has chosen, kept apart from what they are building.
 *
 * A separate store from the editor on purpose: preferences outlive a project, are written far
 * less often, and survive a restart. Mixing them into the editor state would mean every keypress
 * on the canvas touched the same object that decides whether the minimap is shown.
 *
 * **Every preference here does something.** A settings screen full of switches wired to nothing
 * is worse than a short one, because it teaches people that the controls are decorative. Where
 * the honest answer is "there is nothing to configure" — telemetry, for instance, because none
 * is collected — Settings states that as a fact rather than offering a switch.
 */

import { create } from 'zustand';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type MotionChoice = 'system' | 'reduced';
export type StartupChoice = 'home' | 'last-project';

export interface Preferences {
  // --- Appearance -----------------------------------------------------------------------
  theme: ThemeChoice;
  /** `system` follows `prefers-reduced-motion`; `reduced` turns transitions off regardless. */
  motion: MotionChoice;

  // --- Workspace ------------------------------------------------------------------------
  /** Where the save dialog starts. Empty means "wherever the system last was". */
  projectFolder: string;
  startup: StartupChoice;

  // --- Editor ---------------------------------------------------------------------------
  showGrid: boolean;
  snapToGrid: boolean;
  showMinimap: boolean;

  // --- Runtime --------------------------------------------------------------------------
  /** Keep the execution panel open while a workflow runs. */
  openRunPanelOnRun: boolean;

  // --- Advanced -------------------------------------------------------------------------
  /** Surfaces internals — component ids, digests, raw journal — for people who want them. */
  developerMode: boolean;

  // --- First run ------------------------------------------------------------------------
  /** False until the welcome has been dismissed, however it was dismissed. */
  welcomeSeen: boolean;
}

export const DEFAULTS: Preferences = {
  theme: 'system',
  motion: 'system',
  projectFolder: '',
  startup: 'home',
  showGrid: true,
  snapToGrid: true,
  showMinimap: true,
  openRunPanelOnRun: true,
  developerMode: false,
  welcomeSeen: false,
};

const STORAGE_KEY = 'encastra.preferences';

/**
 * Reads what was stored, and is deliberately forgiving about it.
 *
 * Storage can be unavailable (a locked-down browser profile), empty (first run), or hold
 * something written by an older build. None of those is a reason to fail to start, so anything
 * unrecognised falls back to the default for that one key rather than throwing the lot away.
 */
export function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const stored = JSON.parse(raw) as Partial<Preferences>;
    const merged = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as (keyof Preferences)[]) {
      const value = stored[key];
      // Same shape as the default, or the default. Keeps a hand-edited or stale value from
      // putting a control into a state it has no way to render.
      if (typeof value === typeof DEFAULTS[key]) {
        Object.assign(merged, { [key]: value });
      }
    }
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

function save(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences that cannot be written are preferences that do not survive a restart. That is
    // a worse session, not a broken one, and it is not worth interrupting anybody over.
  }
}

interface PreferencesStore extends Preferences {
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  resetAll: () => void;
}

export const usePreferences = create<PreferencesStore>((setState, getState) => ({
  ...load(),

  set(key, value) {
    setState({ [key]: value } as Pick<Preferences, typeof key>);
    save(current(getState()));
  },

  resetAll() {
    setState({ ...DEFAULTS });
    save({ ...DEFAULTS });
  },
}));

/**
 * The preference values out of the store, without the functions.
 *
 * Written out key by key rather than copied in a loop, because the compiler then refuses to
 * build if a new preference is added and not persisted here — which is exactly the mistake that
 * would otherwise show up as one setting quietly not surviving a restart.
 */
function current(s: PreferencesStore): Preferences {
  return {
    theme: s.theme,
    motion: s.motion,
    projectFolder: s.projectFolder,
    startup: s.startup,
    showGrid: s.showGrid,
    snapToGrid: s.snapToGrid,
    showMinimap: s.showMinimap,
    openRunPanelOnRun: s.openRunPanelOnRun,
    developerMode: s.developerMode,
    welcomeSeen: s.welcomeSeen,
  };
}

/**
 * Applies the choices that live on the document rather than in React.
 *
 * `data-theme` is read by the token file, and `data-motion` lets a person who has not set a
 * system preference still turn motion off — the system setting remains the default, and this
 * only ever overrides it towards less motion, never towards more.
 */
export function applyToDocument(preferences: Pick<Preferences, 'theme' | 'motion'>): void {
  const root = document.documentElement;
  if (preferences.theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.dataset.theme = preferences.theme;
  }
  if (preferences.motion === 'reduced') {
    root.dataset.motion = 'reduced';
  } else {
    root.removeAttribute('data-motion');
  }
}
