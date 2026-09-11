/**
 * Diagnostics.
 *
 * What a beta tester would need to paste into a bug report: the build, the runtime, the schemas
 * it speaks, and what the WebView says about the machine it is running on.
 *
 * Assembly is a pure function of values the caller already has, or has cheaply read from the
 * browser — `About`, the loaded manifests, whether a runtime is attached, and a few strings read
 * from `navigator`. That keeps it testable without a DOM, and keeps every line honest the same
 * way the About screen is: nothing here is ever typed into the interface by hand, so nothing
 * here can quietly drift from what the build actually reports.
 *
 * Deliberately excludes anything that would be awkward to paste somewhere public: no project
 * paths, no preference values, no tokens.
 */

import type { About, ComponentManifest } from '../types';
import { summarizeComponents } from './categories';

/** Resolves a translation key. The same shape `useTranslation()` hands a component. */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * A row before a language has been chosen.
 *
 * Rows are keys rather than text because this card has to say two different things at once: the
 * person reading the screen wants their own language, and the report they paste into a bug
 * tracker wants to be readable by everyone on the project. Keeping the row as a key lets the
 * same list be rendered twice — once in the active locale for the screen, once in English for
 * the clipboard — without this file holding a second copy of the English strings that already
 * live in `i18n/locales/en.ts`.
 */
export interface DiagnosticsRow {
  /** Full key for the row's label. */
  readonly key: string;
  /** The value when it is the same in every language: a version, a count, a user agent. */
  readonly literal: string | null;
  /** Full key for the value when it is a sentence rather than a datum. */
  readonly valueKey: string | null;
}

/** A row with a language applied. What the card renders, and what the report is built from. */
export interface RenderedRow {
  readonly label: string;
  readonly value: string;
}

export interface DiagnosticsInput {
  readonly about: About | null;
  readonly manifests: Record<string, ComponentManifest>;
  readonly runtimeAttached: boolean;
  readonly userAgent: string;
  readonly platform: string;
  readonly architecture: string;
  /** `null` when a renderer string could not be read — a locked-down driver, a headless
   * environment, or simply a WebView that will not disclose it. Never invented. */
  readonly gpu: string | null;
}

const ROWS = 'settings.diagnostics.rows';

export function assembleDiagnostics(input: DiagnosticsInput): readonly DiagnosticsRow[] {
  const { total } = summarizeComponents(input.manifests);

  /** A datum: the same characters whatever language the reader speaks. */
  const datum = (key: string, literal: string): DiagnosticsRow => ({
    key: `${ROWS}.${key}`,
    literal,
    valueKey: null,
  });

  /** A sentence: translated on screen, English in the report. */
  const sentence = (key: string, valueKey: string): DiagnosticsRow => ({
    key: `${ROWS}.${key}`,
    literal: null,
    valueKey,
  });

  return [
    input.about
      ? datum('version', input.about.version)
      : sentence('version', 'settings.shared.version.unknown'),
    input.runtimeAttached
      ? input.about
        ? datum('runtime', input.about.runtime)
        : sentence('runtime', 'settings.shared.version.unknown')
      : sentence('runtime', 'settings.shared.runtimeStatus.notAttached'),
    input.about
      ? datum('protocolSchema', String(input.about.protocolSchema))
      : sentence('protocolSchema', 'settings.shared.version.unknown'),
    input.about
      ? datum('projectSchema', String(input.about.projectSchema))
      : sentence('projectSchema', 'settings.shared.version.unknown'),
    datum('components', String(total)),
    input.platform === UNKNOWN_PLATFORM
      ? sentence('platform', `${ROWS}.platformUnknown`)
      : datum('platform', input.platform),
    input.architecture === UNREPORTED_ARCHITECTURE
      ? sentence('architecture', `${ROWS}.architectureUnknown`)
      : datum('architecture', input.architecture),
    input.gpu === null ? sentence('gpu', `${ROWS}.gpuUnknown`) : datum('gpu', input.gpu),
    datum('userAgent', input.userAgent),
  ];
}

/** Applies a language. Pass the active `t` for the screen, an English one for the report. */
export function renderDiagnostics(
  rows: readonly DiagnosticsRow[],
  t: Translate,
): readonly RenderedRow[] {
  return rows.map((row) => ({
    label: t(row.key),
    value: row.literal ?? (row.valueKey === null ? '' : t(row.valueKey)),
  }));
}

/** One `label: value` per line. Built from rows rendered in English, so a report pasted into an
 * issue reads the same whichever language the person who produced it was using. */
export function diagnosticsToText(rows: readonly RenderedRow[]): string {
  return rows.map((row) => `${row.label}: ${row.value}`).join('\n');
}

// --- Best-effort detection, from the WebView's own strings ------------------------------

/**
 * Parses only what a beta report needs out of the WebView's user agent string.
 *
 * Never throws and never guesses past what the string actually says: an unrecognised WebView is
 * `'Unknown'`, not a wrong answer dressed up as a right one.
 */
export const UNKNOWN_PLATFORM = 'Unknown';
export const UNREPORTED_ARCHITECTURE = 'Not reported by the WebView';

export function detectPlatform(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux') || ua.includes('x11')) return 'Linux';
  return UNKNOWN_PLATFORM;
}

export function detectArchitecture(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('arm64') || ua.includes('aarch64')) return 'ARM64';
  if (ua.includes('wow64')) return 'x64 (32-bit process)';
  if (ua.includes('win64') || ua.includes('x86_64') || ua.includes('amd64')) return 'x64';
  if (ua.includes('win32')) return 'x86';
  return UNREPORTED_ARCHITECTURE;
}

/**
 * The GPU's renderer string, read through a throwaway WebGL context — the same technique a
 * browser's own `about:gpu` page uses.
 *
 * Best-effort, and allowed to come back empty: a headless environment, a locked-down driver, or
 * — as in every test that exercises this function — a runtime with no `document` at all are all
 * ordinary reasons to have nothing to report, not a crash in a diagnostics panel.
 */
export function detectGpuRenderer(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (!info) return null;
    const renderer = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === 'string' && renderer.length > 0 ? renderer : null;
  } catch {
    return null;
  }
}
