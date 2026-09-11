'use client';

/**
 * Can this browser actually render the 3D layer, and should it?
 *
 * Two separate questions, and conflating them is how sites end up showing a black rectangle to
 * somebody on a machine that technically reported a context.
 *
 * - **Can it.** A real context is requested and immediately thrown away. Nothing else is a
 *   reliable answer: `window.WebGLRenderingContext` exists in browsers that will then refuse to
 *   create a context, and a software renderer will happily claim support it cannot deliver.
 * - **Should it.** A visitor who has asked for reduced motion, a machine reporting a handful of
 *   logical cores, or a device with very little memory gets the 2D telling of the same story.
 *   That is not a lesser page: every scene renders its whole narrative in the DOM regardless,
 *   and the 3D layer is added on top of it when it is welcome.
 */

export interface Capability {
  /** A WebGL2 context was created and released successfully. */
  readonly webgl: boolean;
  /** True when the 3D layer should be mounted at all. */
  readonly use3d: boolean;
  /** Why not, when `use3d` is false — for the diagnostics panel, never shown to a visitor. */
  readonly reason: string | null;
  /** Renderer pixel ratio ceiling. Never above 2: past that it is heat, not detail. */
  readonly pixelRatio: number;
}

const NO_3D = (reason: string): Capability => ({
  webgl: false,
  use3d: false,
  reason,
  pixelRatio: 1,
});

export function detectCapability(): Capability {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return NO_3D('server');
  }

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    // Not a capability question — a stated preference, and the strongest signal on this list.
    return NO_3D('reduced-motion');
  }

  let webgl = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    webgl = gl !== null;
    // Releasing the context explicitly rather than waiting for the garbage collector: browsers
    // cap the number of live contexts per page, and a probe that hangs on to one can be the
    // reason the real renderer later fails to get one.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }

  if (!webgl) return NO_3D('no-webgl2');

  const cores = navigator.hardwareConcurrency ?? 4;
  if (cores <= 2) return { webgl: true, use3d: false, reason: 'low-cores', pixelRatio: 1 };

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === 'number' && memory <= 2) {
    return { webgl: true, use3d: false, reason: 'low-memory', pixelRatio: 1 };
  }

  // A phone renders the same scene with fewer objects (each scene decides that) and at a lower
  // ratio. 2 is already more pixels than a 3× screen can show a difference at, for this content.
  const narrow = window.innerWidth < 900;
  return {
    webgl: true,
    use3d: true,
    reason: null,
    pixelRatio: Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 2),
  };
}
