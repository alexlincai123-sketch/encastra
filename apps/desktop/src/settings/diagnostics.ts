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

export interface DiagnosticsRow {
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

export function assembleDiagnostics(input: DiagnosticsInput): readonly DiagnosticsRow[] {
  const { total } = summarizeComponents(input.manifests);
  return [
    { label: 'Encastra version', value: input.about?.version ?? 'unknown' },
    {
      label: 'Runtime',
      value: input.runtimeAttached
        ? (input.about?.runtime ?? 'unknown')
        : 'not attached — browser preview',
    },
    {
      label: 'Component protocol schema',
      value: input.about ? String(input.about.protocolSchema) : 'unknown',
    },
    {
      label: 'Project format schema',
      value: input.about ? String(input.about.projectSchema) : 'unknown',
    },
    { label: 'Installed components', value: String(total) },
    { label: 'Platform', value: input.platform },
    { label: 'Architecture', value: input.architecture },
    { label: 'GPU', value: input.gpu ?? 'Not discoverable' },
    { label: 'WebView user agent', value: input.userAgent },
  ];
}

/** One `label: value` per line — what Copy and Export both hand over, so what a person sees on
 * screen is exactly what lands in their clipboard or their file. */
export function diagnosticsToText(rows: readonly DiagnosticsRow[]): string {
  return rows.map((row) => `${row.label}: ${row.value}`).join('\n');
}

// --- Best-effort detection, from the WebView's own strings ------------------------------

/**
 * Parses only what a beta report needs out of the WebView's user agent string.
 *
 * Never throws and never guesses past what the string actually says: an unrecognised WebView is
 * `'Unknown'`, not a wrong answer dressed up as a right one.
 */
export function detectPlatform(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux') || ua.includes('x11')) return 'Linux';
  return 'Unknown';
}

export function detectArchitecture(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('arm64') || ua.includes('aarch64')) return 'ARM64';
  if (ua.includes('wow64')) return 'x64 (32-bit process)';
  if (ua.includes('win64') || ua.includes('x86_64') || ua.includes('amd64')) return 'x64';
  if (ua.includes('win32')) return 'x86';
  return 'Not reported by the WebView';
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
