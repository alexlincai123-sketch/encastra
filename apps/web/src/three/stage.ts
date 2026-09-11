'use client';

import * as THREE from 'three';

import { type Capability, detectCapability } from './capability';

/**
 * One 3D stage: a renderer, a camera, a scene, and a promise to give all of it back.
 *
 * Three rules this file exists to enforce, because each of them is a bug that is invisible until
 * it is expensive:
 *
 * 1. **Nothing renders unless something changed.** There is no `requestAnimationFrame` loop.
 *    `invalidate()` schedules exactly one frame, and the scroll timeline calls it when it moves
 *    the scene. A pinned scene that is not being scrolled costs nothing at all, which is the
 *    difference between a page that is pleasant on a laptop and one that spins its fans.
 * 2. **Nothing renders off screen.** An `IntersectionObserver` stops the stage when it leaves
 *    the viewport. A page with several stages must only ever be paying for the one being read.
 * 3. **Everything is returned.** `dispose()` walks the scene graph disposing geometries,
 *    materials and textures, disposes the renderer, releases the WebGL context and removes the
 *    canvas. A renderer that outlives its component holds a context the browser will not give
 *    back, and a handful of those is a page that stops rendering 3D altogether with no error.
 */

export interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly capability: Capability;
  /** Schedule one frame. Safe to call many times per tick; it coalesces. */
  readonly invalidate: () => void;
  /** Recompute size and aspect from the host element. Called on resize. */
  readonly resize: () => void;
  /** Give everything back. After this the stage must not be used again. */
  readonly dispose: () => void;
}

/** Colour read from the page's own tokens, so the 3D layer cannot drift from the CSS. */
function token(name: string, fallback: string): THREE.Color {
  if (typeof document === 'undefined') return new THREE.Color(fallback);
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  try {
    return new THREE.Color(value || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

export interface StageOptions {
  /** Vertical field of view. 32 is a long lens: depth without the fish-eye of a CSS 3D demo. */
  readonly fov?: number;
  /** Where the camera starts. Scenes move it from here. */
  readonly cameraZ?: number;
}

export function createStage(host: HTMLElement, opts: StageOptions = {}): Stage | null {
  const capability = detectCapability();
  if (!capability.use3d) return null;

  const { fov = 32, cameraZ = 9 } = opts;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    // The probe said yes and the real request said no. It happens — a context limit reached by
    // another tab, a driver reset — and it is not a reason to break the page.
    return null;
  }

  renderer.setPixelRatio(capability.pixelRatio);
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  renderer.setClearAlpha(0);
  // The canvas sits behind the scene's own DOM text, which is what stays readable if anything
  // here fails. It is decorative by construction.
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    fov,
    Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1),
    0.1,
    120,
  );
  camera.position.set(0, 0, cameraZ);

  // Three lights, and no more. A key to give the blocks a lit face, a rim from behind to find
  // their edges against a dark ground, and a low ambient so the unlit faces are not black holes.
  const key = new THREE.DirectionalLight(token('--ink', '#e6eaf0'), 3.2);
  key.position.set(4, 6, 8);
  const rim = new THREE.DirectionalLight(token('--focus', '#4da3ff'), 2.2);
  rim.position.set(-6, 2, -4);
  const ambient = new THREE.AmbientLight(token('--ground-4', '#262d37'), 2.4);
  scene.add(key, rim, ambient);

  let frame = 0;
  let running = true;
  let disposed = false;

  let frames = 0;

  const render = (): void => {
    frame = 0;
    if (disposed) return;
    renderer.render(scene, camera);
    frames += 1;
    // Two numbers a QA pass can read without a debugger, and the only way to tell a stage that
    // is idle because nothing changed from one that is idle because it is wedged. They cost a
    // string write per rendered frame, which is nothing next to the frame itself.
    host.dataset.threeFrames = String(frames);
  };

  const invalidate = (): void => {
    if (disposed || !running || frame !== 0) return;
    frame = requestAnimationFrame(render);
  };

  const resize = (): void => {
    if (disposed) return;
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  };

  // Pausing is not just skipping a render: with `running` false, `invalidate` does not even
  // schedule one, so a scene being scrolled past off screen cannot queue work at all.
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      running = visible;
      host.dataset.threeRunning = visible ? 'yes' : 'no';
      if (visible) invalidate();
    },
    { rootMargin: '200px' },
  );
  observer.observe(host);

  const onContextLost = (event: Event): void => {
    // Without this the browser will not attempt to restore, and the canvas stays black for good.
    event.preventDefault();
    running = false;
  };
  const onContextRestored = (): void => {
    running = true;
    resize();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    running = false;
    if (frame !== 0) cancelAnimationFrame(frame);
    observer.disconnect();
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const m of material) m.dispose();
      } else material?.dispose?.();
    });
    scene.clear();

    renderer.dispose();
    // `forceContextLoss` is what actually hands the context back. `dispose()` alone frees
    // Three's own resources and leaves the context alive, which is the leak that matters.
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };

  invalidate();

  return { scene, camera, renderer, capability, invalidate, resize, dispose };
}
