'use client';

import * as THREE from 'three';

/**
 * The face of a block: an icon, a name, and a colour that means something.
 *
 * A field of blank slabs is a field of rectangles in perspective. What makes one read as *a
 * component* is that it plainly carries a thing — a folder, a picture, a document — and that its
 * colour is the same colour that category has everywhere else in the product.
 *
 * Drawn into a canvas and used as a texture, for the same reason everything else in this folder
 * is built rather than loaded: no file to fetch, nothing for a policy to block, and no font to
 * wait for. The glyphs are canvas paths, so they do not depend on an icon set being installed
 * or on a webfont having arrived.
 *
 * The colours are the vivid end of the product's palette rather than the interface's muted one.
 * A page is looked at once; the application is looked at all day. They are allowed to differ,
 * and the category each one names is the same in both.
 */

export type Category = 'file' | 'media' | 'data' | 'flow' | 'network' | 'system';

export const CATEGORY_COLOUR: Record<Category, string> = {
  file: '#3b82f6',
  media: '#a855f7',
  data: '#22c55e',
  flow: '#ec4899',
  network: '#06b6d4',
  system: '#f59e0b',
};

export type Glyph = 'folder' | 'image' | 'document' | 'gear' | 'bell' | 'link' | 'branch';

/* ---------------------------------------------------------------------------------------------
 * Glyphs, as paths.
 *
 * Each is drawn inside a 0-100 box and the caller scales it, so a glyph never has to know how
 * big the tile it is going into happens to be.
 * ------------------------------------------------------------------------------------------ */

function drawGlyph(ctx: CanvasRenderingContext2D, glyph: Glyph): void {
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (glyph) {
    case 'folder':
      ctx.beginPath();
      ctx.moveTo(12, 78);
      ctx.lineTo(12, 28);
      ctx.lineTo(40, 28);
      ctx.lineTo(48, 38);
      ctx.lineTo(88, 38);
      ctx.lineTo(88, 78);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'image':
      ctx.strokeRect(14, 24, 72, 52);
      ctx.beginPath();
      ctx.moveTo(20, 68);
      ctx.lineTo(40, 46);
      ctx.lineTo(56, 62);
      ctx.lineTo(66, 52);
      ctx.lineTo(80, 68);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(66, 38, 6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'document':
      ctx.beginPath();
      ctx.moveTo(24, 18);
      ctx.lineTo(62, 18);
      ctx.lineTo(78, 34);
      ctx.lineTo(78, 84);
      ctx.lineTo(24, 84);
      ctx.closePath();
      ctx.stroke();
      // The folded corner is what makes a rectangle read as a page.
      ctx.beginPath();
      ctx.moveTo(62, 18);
      ctx.lineTo(62, 34);
      ctx.lineTo(78, 34);
      ctx.stroke();
      break;
    case 'gear':
      ctx.beginPath();
      ctx.arc(50, 51, 20, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(50 + Math.cos(angle) * 26, 51 + Math.sin(angle) * 26);
        ctx.lineTo(50 + Math.cos(angle) * 34, 51 + Math.sin(angle) * 34);
        ctx.stroke();
      }
      break;
    case 'bell':
      ctx.beginPath();
      ctx.moveTo(28, 68);
      ctx.lineTo(28, 46);
      ctx.arc(50, 46, 22, Math.PI, 0);
      ctx.lineTo(72, 68);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(50, 76, 6, 0, Math.PI);
      ctx.stroke();
      break;
    case 'link':
      ctx.beginPath();
      ctx.arc(34, 51, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(66, 51, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(49, 51);
      ctx.lineTo(51, 51);
      ctx.stroke();
      break;
    case 'branch':
      ctx.beginPath();
      ctx.moveTo(24, 76);
      ctx.lineTo(24, 34);
      ctx.lineTo(76, 34);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(24, 56);
      ctx.lineTo(76, 56);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(76, 34, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(76, 56, 6, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }
}

export interface FaceOptions {
  readonly label: string;
  readonly glyph: Glyph;
  readonly category: Category;
  /** Aspect of the face, so the drawing is not stretched by the block it goes on. */
  readonly aspect?: number;
}

/**
 * Draws a face and returns it as a texture.
 *
 * The canvas is sized in device pixels well above the on-screen size: a face is read at a glancing
 * angle while a block is tumbling, and a texture that is only just big enough is visibly soft
 * exactly when it is most looked at.
 */
export function faceTexture({
  label,
  glyph,
  category,
  aspect = 1.6,
}: FaceOptions): THREE.CanvasTexture {
  const height = 320;
  const width = Math.round(height * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (ctx === null) return texture;

  const colour = CATEGORY_COLOUR[category];

  // The panel. Transparent, so the block's own lit surface shows through and the face reads as
  // printed on it rather than as a sticker floating in front of it.
  ctx.clearRect(0, 0, width, height);

  // The icon tile: the one saturated shape on the block, and the thing the eye lands on.
  const tile = Math.round(height * 0.42);
  const tileX = Math.round(width * 0.5 - tile / 2);
  const tileY = Math.round(height * 0.18);
  const radius = tile * 0.24;
  ctx.beginPath();
  ctx.moveTo(tileX + radius, tileY);
  ctx.arcTo(tileX + tile, tileY, tileX + tile, tileY + tile, radius);
  ctx.arcTo(tileX + tile, tileY + tile, tileX, tileY + tile, radius);
  ctx.arcTo(tileX, tileY + tile, tileX, tileY, radius);
  ctx.arcTo(tileX, tileY, tileX + tile, tileY, radius);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();

  ctx.save();
  ctx.translate(tileX, tileY);
  ctx.scale(tile / 100, tile / 100);
  ctx.strokeStyle = 'rgba(255,255,255,0.94)';
  drawGlyph(ctx, glyph);
  ctx.restore();

  // The name. Monospace by family name only — whichever the machine has is fine, because this is
  // a label on an object rather than running text, and waiting on a webfont here would mean a
  // block that is blank for its first second on screen.
  ctx.fillStyle = 'rgba(233,238,245,0.92)';
  ctx.font = `500 ${Math.round(height * 0.115)}px ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.toUpperCase(), width / 2, tileY + tile + height * 0.17, width * 0.9);

  texture.needsUpdate = true;
  return texture;
}
