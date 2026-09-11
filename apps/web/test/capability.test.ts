import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectCapability } from '../src/three/capability';

/**
 * Whether the 3D layer mounts at all.
 *
 * This is the one decision on the site with a visible consequence for people who never see the
 * thing it decides about: get it wrong in one direction and a visitor who asked for stillness
 * gets a moving canvas; get it wrong in the other and a capable machine is shown the flat page
 * for no reason. It is also the only part of the 3D stack that can be checked without a GPU,
 * which is why it is the part that is pure.
 *
 * The environment here is `node`, so every global the function reads is stubbed. That is not a
 * weaker test than a browser one would be — the function's whole job is to interrogate those
 * globals, and stubbing them is how each answer gets exercised deliberately rather than by
 * whatever the machine running the suite happens to report.
 */

interface FakeWorld {
  readonly reducedMotion?: boolean;
  readonly webgl2?: boolean;
  readonly cores?: number;
  readonly memory?: number;
  readonly width?: number;
  readonly pixelRatio?: number;
  readonly throwOnContext?: boolean;
}

function world({
  reducedMotion = false,
  webgl2 = true,
  cores = 8,
  memory = 8,
  width = 1440,
  pixelRatio = 2,
  throwOnContext = false,
}: FakeWorld = {}): void {
  const lose = { loseContext: vi.fn() };
  const canvas = {
    getContext: (kind: string) => {
      if (throwOnContext) throw new Error('refused');
      if (kind !== 'webgl2') return null;
      return webgl2 ? { getExtension: () => lose } : null;
    },
  };

  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('navigator', { hardwareConcurrency: cores, deviceMemory: memory });
  vi.stubGlobal('window', {
    innerWidth: width,
    devicePixelRatio: pixelRatio,
    matchMedia: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detectCapability', () => {
  it('mounts the 3D layer on an ordinary desktop browser', () => {
    world();
    const capability = detectCapability();
    expect(capability.webgl).toBe(true);
    expect(capability.use3d).toBe(true);
    expect(capability.reason).toBeNull();
  });

  it('refuses before it even asks about WebGL when reduced motion is requested', () => {
    world({ reducedMotion: true });
    const capability = detectCapability();
    expect(capability.use3d).toBe(false);
    expect(capability.reason).toBe('reduced-motion');
    // The preference is not a capability, and treating it as one would mean a visitor who asked
    // for stillness still paid for a context before being told no.
    expect(capability.webgl).toBe(false);
  });

  it('falls back when there is no WebGL2 context to be had', () => {
    world({ webgl2: false });
    expect(detectCapability()).toMatchObject({ webgl: false, use3d: false, reason: 'no-webgl2' });
  });

  it('falls back when asking for a context throws rather than returning null', () => {
    world({ throwOnContext: true });
    expect(detectCapability().use3d).toBe(false);
  });

  it('leaves a two-core machine on the flat page even though WebGL works there', () => {
    world({ cores: 2 });
    const capability = detectCapability();
    expect(capability.webgl).toBe(true);
    expect(capability.use3d).toBe(false);
    expect(capability.reason).toBe('low-cores');
  });

  it('leaves a 2GB device on the flat page', () => {
    world({ memory: 2 });
    expect(detectCapability()).toMatchObject({ use3d: false, reason: 'low-memory' });
  });

  it('ignores an unreported device memory rather than assuming the worst', () => {
    // `deviceMemory` is not implemented in every browser. Absent is not small.
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ getExtension: () => null }) }) });
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
    vi.stubGlobal('window', {
      innerWidth: 1440,
      devicePixelRatio: 1,
      matchMedia: () => ({ matches: false }),
    });
    expect(detectCapability().use3d).toBe(true);
  });

  it('caps the pixel ratio at 2, and lower on a narrow screen', () => {
    world({ pixelRatio: 3 });
    expect(detectCapability().pixelRatio).toBe(2);

    world({ pixelRatio: 3, width: 430 });
    expect(detectCapability().pixelRatio).toBe(1.5);
  });

  it('reports "server" when there is no document at all', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    expect(detectCapability()).toMatchObject({ use3d: false, reason: 'server' });
  });
});
