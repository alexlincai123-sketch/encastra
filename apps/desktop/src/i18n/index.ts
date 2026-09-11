/**
 * Translation.
 *
 * Deliberately small and dependency-free. An interface this size does not need a framework, and
 * a framework would bring a bundle, a build step and a second place for the locale to live.
 *
 * Three rules hold the whole thing together:
 *
 * - **English is the fallback, always.** A missing key renders the English string, never a raw
 *   key and never an empty space. A half-translated locale should read as a half-translated
 *   application, not as a broken one.
 * - **Keys are paths into one object.** `settings.appearance.theme`, not a flat namespace, so
 *   the shape of the file matches the shape of the interface and an unused key is visible.
 * - **Nothing formats numbers or dates by hand.** Those go through `Intl`, with the locale and
 *   the person's regional choices, because inventing date formatting is how a product ends up
 *   showing an American date to a German.
 *
 * Loading follows the same shape as `preferences.ts`, on purpose: English ships in the bundle,
 * every other locale is a dynamic import fetched only once it is actually chosen, and the choice
 * is persisted under its own `localStorage` key — read and written exactly as forgivingly as
 * preferences are, because storage can be unavailable or throw and that is never a reason to fail
 * to start.
 */

import { create } from 'zustand';
import en from './locales/en';

/** The languages with a locale file. Adding one means adding a file and a line here. */
export const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

/** Languages the architecture is ready for but which have no translations yet. */
export const PLANNED_LOCALES = ['ja', 'ko', 'zh'] as const;

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
};

/** A translation file: nested objects of strings, as deep as the interface needs. */
export type Messages = { [key: string]: string | Messages };

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * The language the system asks for, if it is one that exists here.
 *
 * Matches on the base language, so `es-419` and `es-ES` both get Spanish rather than falling all
 * the way back to English over a region tag.
 */
export function detectLocale(candidates: readonly string[]): Locale {
  for (const tag of candidates) {
    const base = tag.toLowerCase().split('-')[0];
    const found = LOCALES.find((l) => l === base);
    if (found) return found;
  }
  return 'en';
}

/** Walks a dotted path. Returns undefined rather than throwing: a missing key is not a crash. */
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
 * An unmatched placeholder is left exactly as written rather than blanked, so a translator who
 * mistypes one sees `{cont}` in the interface and can find it, instead of a sentence with a
 * hole in it that nobody can trace.
 */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * Splits a translated template on a single `{name}` placeholder, without substituting it.
 *
 * For a caller that needs to wrap the value in its own element — `<code>{bridge}</code>` inside
 * a sentence, say — rather than flatten it into plain text. Translating "before" and "after" as
 * two separate keys reads fine in English and silently breaks in a language that puts the
 * placeholder first; splitting one real, whole-sentence translation at the point the translator
 * chose does not.
 */
export function splitOnPlaceholder(template: string, name: string): [string, string] {
  const marker = `{${name}}`;
  const index = template.indexOf(marker);
  if (index < 0) return [template, ''];
  return [template.slice(0, index), template.slice(index + marker.length)];
}

interface I18nStore {
  locale: Locale;
  /** `null` until a locale file has been loaded; English is compiled in and always present. */
  messages: Record<string, Messages>;
  setLocale: (locale: Locale) => void;
  register: (locale: Locale, messages: Messages) => void;
}

// --- Loading -----------------------------------------------------------------------------

/**
 * Dynamic importers for every locale but English. Kept as a lookup table rather than inline in
 * `loadLocale` so a typo in a path is a missing table entry, not a silently-swallowed import
 * failure buried inside a function.
 */
const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Messages }>> = {
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  it: () => import('./locales/it'),
  pt: () => import('./locales/pt'),
};

/** English is registered at start-up; everything in here has already been fetched once. */
const loaded = new Set<Locale>(['en']);

/**
 * Loads and registers a locale on demand.
 *
 * English ships in the bundle; every other locale is fetched only once it is actually chosen, so
 * picking Spanish does not cost everyone the weight of Portuguese too. Safe to call more than
 * once for the same locale — the second call is a no-op, not a second fetch.
 */
export async function loadLocale(locale: Locale): Promise<void> {
  if (loaded.has(locale)) return;
  const load = LOADERS[locale as Exclude<Locale, 'en'>];
  if (!load) return;
  const mod = await load();
  useI18n.getState().register(locale, mod.default);
  loaded.add(locale);
}

// --- Persistence -------------------------------------------------------------------------

const LOCALE_STORAGE_KEY = 'encastra.locale';

/**
 * Reads the person's saved choice, exactly as forgiving as `preferences.ts` is about its own
 * storage: unavailable, empty, or holding something this build does not recognise are all "no
 * choice saved yet", never a crash.
 */
function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return raw && isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // A choice that fails to save reverts to detection on the next launch. That is a worse
    // session, not a broken one, and not worth interrupting anybody over.
  }
}

// --- Store -------------------------------------------------------------------------------

export const useI18n = create<I18nStore>((set) => ({
  locale: 'en',
  messages: {},
  setLocale: (locale) => {
    set({ locale });
    // The explicit choice always wins over detection from here on, and the interface should
    // not sit on the English fallback while the file it needs is still in flight.
    persistLocale(locale);
    void loadLocale(locale);
  },
  register: (locale, messages) =>
    set((s) => ({ messages: { ...s.messages, [locale]: messages } })),
}));

/**
 * Translates a key.
 *
 * Exported as a plain function as well as a hook so that code outside React — a store action
 * building a message, or a callback whose own dependency array must not change on every render —
 * can reach the same strings rather than growing its own English-only copy.
 */
export function translate(
  key: string,
  vars?: Record<string, string | number>,
  state = useI18n.getState(),
): string {
  const active = state.messages[state.locale];
  const english = state.messages.en;
  const found = (active && lookup(active, key)) ?? (english && lookup(english, key));
  // The key itself is the last resort. Visible, searchable, and obviously wrong — which is what
  // you want from a string nobody has written yet.
  return interpolate(found ?? key, vars);
}

export function useTranslation() {
  const locale = useI18n((s) => s.locale);
  const messages = useI18n((s) => s.messages);
  return {
    locale,
    t: (key: string, vars?: Record<string, string | number>) =>
      translate(key, vars, { locale, messages } as I18nStore),
  };
}

// --- Startup -----------------------------------------------------------------------------

let started = false;

/**
 * Registers English, then picks the starting locale: the person's saved choice if one exists,
 * otherwise whatever the system asks for.
 *
 * Runs once, as a side effect of importing this module, because every screen that shows
 * translated text already imports it — there is no separate "call this on startup" step in the
 * shell for it to need. Idempotent, so importing the module from more than one place, or a test
 * importing it directly, cannot run it twice.
 */
export function initI18n(): void {
  if (started) return;
  started = true;
  useI18n.getState().register('en', en);
  const stored = readStoredLocale();
  const candidates =
    typeof navigator !== 'undefined' && Array.isArray(navigator.languages)
      ? navigator.languages
      : [];
  const initial = stored ?? detectLocale(candidates);
  useI18n.setState({ locale: initial });
  if (initial !== 'en') void loadLocale(initial);
}

initI18n();

// --- Regional formatting -----------------------------------------------------------------

/**
 * Every date, time and number shown to a person goes through one of these four. `Intl` already
 * knows how Germans order a date and how French groups a number; hand-rolling either is how a
 * product ends up showing an American date to a German.
 */
export function formatDate(
  locale: Locale,
  value: Date | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export function formatTime(
  locale: Locale,
  value: Date | number,
  options: Intl.DateTimeFormatOptions = { timeStyle: 'short' },
): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatRelative(
  locale: Locale,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
): string {
  return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
}

/**
 * Which plural category a count falls into for this locale — `'one'` or `'other'` covers every
 * language shipped here (French included: CLDR counts zero and one as `'one'` for French, which
 * `Intl.PluralRules` already knows and a hand-written `n === 1` check does not).
 *
 * Pairs with a message tree shaped `{ one: '...', other: '...' }`: look up the category, then
 * translate that key, rather than gluing a count onto an English-only "s".
 */
export function selectPlural(locale: Locale, count: number): Intl.LDMLPluralRule {
  return new Intl.PluralRules(locale).select(count);
}
