'use client';

import * as THREE from 'three';

/**
 * The vocabulary of things a scene can put on a stage.
 *
 * Everything here is built from primitives at runtime. There is no model to download, no
 * texture to fetch and no loader to fail: the whole 3D layer is arithmetic, which is why it can
 * be added to a page whose Content-Security-Policy allows no third-party request at all.
 *
 * The blocks are meant to read as **objects**, not as floating cards. What makes the difference
 * is almost entirely the bevel: a box with hard corners is a rectangle that happens to be in
 * perspective, and a box with a 2mm chamfer catches the key light along every edge and becomes
 * a thing with a surface. That chamfer is why these are extruded shapes rather than
 * `BoxGeometry`.
 */

export interface BlockOptions {
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
  /** Corner radius in the same units as the box. Small: this is milled metal, not a lozenge. */
  readonly radius?: number;
  readonly color?: THREE.ColorRepresentation;
  readonly edge?: THREE.ColorRepresentation;
  /**
   * Kept low on purpose. A `MeshStandardMaterial` with high metalness and no environment map
   * renders black everywhere a light does not hit it directly, because a mirror with nothing to
   * reflect is a black object. These blocks are anodised aluminium, not chrome: a little
   * metalness for the sheen along the bevel, and roughness to carry the key light across the
   * face. The alternative — a PMREM environment — is a lot of memory to buy a reflection of a
   * room that does not exist.
   */
  readonly metalness?: number;
  readonly roughness?: number;
}

/**
 * A rounded, bevelled slab.
 *
 * Built by extruding a rounded rectangle with a bevel on both faces, so the silhouette is
 * rounded *and* the front and back edges are chamfered. `ExtrudeGeometry` puts the shape on the
 * XY plane and extrudes along Z, which is already the orientation these are used in.
 */
function slabGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
): THREE.ExtrudeGeometry {
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  const w = width / 2;
  const h = height / 2;
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);

  const bevel = Math.min(depth / 4, 0.02);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  // Extrusion grows along +Z from the shape plane; centring it means a block's position is its
  // middle, which is what every transform in every scene assumes.
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * One block: the slab plus the hairline along its edges.
 *
 * Returned as a `Group` so a scene can move "the block" without caring that it is two objects,
 * and so the edge can be brightened independently when a block becomes active.
 */
export function createBlock(options: BlockOptions = {}): THREE.Group {
  const {
    width = 1.6,
    height = 1,
    depth = 0.22,
    radius = 0.06,
    color = '#2b3441',
    edge = '#63748c',
    metalness = 0.12,
    roughness = 0.52,
  } = options;

  const group = new THREE.Group();
  const geometry = slabGeometry(width, height, depth, radius);
  const material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // `EdgesGeometry` keeps only edges where two faces meet at a real angle, so the bevel's own
  // segments do not each draw a line and turn the block into a wireframe.
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 28),
    new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: 0.85 }),
  );
  group.add(lines);

  group.userData.mesh = mesh;
  group.userData.edge = lines;
  return group;
}

/** Brightens a block's edge — how a scene says "this one, now" without moving it. */
export function setBlockEdge(
  block: THREE.Group,
  color: THREE.ColorRepresentation,
  opacity = 1,
): void {
  const lines = block.userData.edge as THREE.LineSegments | undefined;
  const material = lines?.material as THREE.LineBasicMaterial | undefined;
  if (!material) return;
  material.color.set(color);
  material.opacity = opacity;
}

/**
 * A connection between two points, drawn as a thin slab rather than a line.
 *
 * A `Line` is one pixel wide whatever the distance and whatever the screen, which reads as a
 * diagram. A wire with thickness reads as a part of the machine, catches the light like the
 * blocks do, and can be scaled from zero along its own length so a connection is *made* rather
 * than faded in.
 */
export function createConnection(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: THREE.ColorRepresentation = '#4da3ff',
): THREE.Mesh {
  const length = from.distanceTo(to);
  const geometry = new THREE.BoxGeometry(1, 0.02, 0.02);
  // The box is built one unit long about its own centre and then shifted so its origin sits at
  // the start of the run: scaling x from 0 to 1 then grows it *out of* the source port, which is
  // what a connection being drawn looks like.
  geometry.translate(0.5, 0, 0);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    metalness: 0.2,
    roughness: 0.6,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(from);
  mesh.scale.x = length;
  mesh.lookAt(to);
  // `lookAt` points -Z at the target; the wire runs along +X, so it needs a quarter turn.
  mesh.rotateY(Math.PI / 2);
  mesh.userData.length = length;
  return mesh;
}

/** The travelling pulse a run sends down a wire. Small, bright, and the only emissive thing. */
export function createPulse(color: THREE.ColorRepresentation = '#ff8a3d'): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(0.05, 12, 8);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
  return new THREE.Mesh(geometry, material);
}

/**
 * A flat panel carrying a canvas-drawn image — the picture a workflow puts through itself.
 *
 * The texture comes from a canvas this module draws, never from a file. `colorSpace` has to be
 * set explicitly or the picture renders noticeably dark: Three assumes linear data for a texture
 * it did not load itself.
 */
export function createPanel(texture: THREE.Texture, width: number, height: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  return new THREE.Mesh(geometry, material);
}

/**
 * One tile of a picture, as its own panel.
 *
 * Each tile shares the single decoded texture and shows its own region through `offset` and
 * `repeat` — so a twelve-tile split costs one texture and twelve quads, not twelve images. The
 * clone is necessary because those two properties live on the texture rather than the material.
 */
export function createTile(
  texture: THREE.Texture,
  cols: number,
  rows: number,
  index: number,
  width: number,
  height: number,
): THREE.Mesh {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const tileTexture = texture.clone();
  tileTexture.needsUpdate = true;
  tileTexture.repeat.set(1 / cols, 1 / rows);
  // Texture V runs bottom-up while the grid is read top-down, hence the flip on the row.
  tileTexture.offset.set(col / cols, 1 - (row + 1) / rows);
  const mesh = createPanel(tileTexture, width / cols, height / rows);
  mesh.userData.col = col;
  mesh.userData.row = row;
  return mesh;
}
