'use client';

import * as THREE from 'three';

import { PLATE_SIZE, PLATE_URI } from '@/components/visual/Plate';

/**
 * The same picture the 2D scenes use, as a texture.
 *
 * Deliberately the *same* drawing rather than a second one made for 3D: a visitor who falls back
 * to the DOM telling of the story and a visitor who gets the 3D one should be looking at the
 * same image, or the two are different pages wearing the same copy.
 *
 * It is an inline SVG data URI, so this decodes from memory. Nothing is fetched, which is what
 * lets the 3D layer exist under a policy that permits no third-party request — and it is also
 * why there is no error path here worth writing: the only way this fails is a browser that
 * cannot decode its own SVG.
 */

let cached: THREE.CanvasTexture | null = null;

/**
 * Draws the picture into a canvas and hands back a texture.
 *
 * `onReady` fires once the image has decoded. Decoding is asynchronous even for a data URI, so a
 * scene that renders on demand has to be told to draw a frame when the pixels actually arrive —
 * otherwise the panel is correct, is in the scene, and is blank until the next scroll tick.
 */
export function loadPictureTexture(onReady: () => void): THREE.CanvasTexture {
  if (cached !== null) {
    // Already decoded once for another scene. Still call back, on a later turn so the caller
    // cannot be surprised by a synchronous callback it registered a moment ago.
    queueMicrotask(onReady);
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = PLATE_SIZE.width;
  canvas.height = PLATE_SIZE.height;
  const context = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Without this the picture is visibly soft at a glancing angle, which is exactly the angle a
  // tile is at while it is coming apart.
  texture.anisotropy = 4;
  cached = texture;

  const image = new Image();
  image.onload = () => {
    context?.drawImage(image, 0, 0, canvas.width, canvas.height);
    texture.needsUpdate = true;
    onReady();
  };
  // `PLATE_URI` is a CSS `url("…")` wrapper; the `src` attribute wants what is inside it.
  image.src = PLATE_URI.slice(PLATE_URI.indexOf('"') + 1, PLATE_URI.lastIndexOf('"'));

  return texture;
}

export const PICTURE_ASPECT = PLATE_SIZE.width / PLATE_SIZE.height;
