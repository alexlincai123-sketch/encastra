import type { CSSProperties, ReactNode } from 'react';

import styles from './Plate.module.css';

/**
 * The picture the homepage puts through the machine.
 *
 * Several scenes need "an image" — something that can be split into tiles, carried through a
 * workflow and reassembled — and the honest options were a stock photograph or something the
 * page draws itself. This draws itself:
 *
 * - **No network.** The whole picture is an SVG built at module scope and inlined as a data
 *   URI. Nothing is fetched, so nothing can be slow, blocked, or missing on first paint, and
 *   there is no third-party asset whose licence anybody has to take on trust.
 * - **Deterministic.** Every coordinate below is a constant. The server and the browser render
 *   the same bytes, so there is no hydration mismatch and a visual regression is a real change
 *   rather than a reroll.
 * - **Plainly a drawing.** It is an abstract composition in the product's own palette, not a
 *   photograph and not pretending to be one. The scenes around it talk about a file being
 *   resized; they do not claim this is a holiday snap.
 *
 * Tiling is done with `background-position` on a grid of plain divs rather than by cloning the
 * SVG N times. One decoded image, N compositor layers — a twelve-tile split costs what twelve
 * empty divs cost.
 */

const W = 800;
const H = 400;

/** Deterministic, hand-placed. Each layer is a closed path so nothing depends on a filter. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0d1320"/>
<stop offset="0.55" stop-color="#24304a"/>
<stop offset="1" stop-color="#7a4520"/>
</linearGradient>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#3a2a2a"/>
<stop offset="1" stop-color="#101520"/>
</linearGradient>
<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#ff8a3d" stop-opacity="0.85"/>
<stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/>
</linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<circle cx="556" cy="236" r="46" fill="#ffb072"/>
<rect x="0" y="200" width="${W}" height="90" fill="url(#glow)"/>
<path d="M0 262 L118 206 L212 250 L318 186 L430 246 L524 214 L640 258 L${W} 220 L${W} 300 L0 300 Z" fill="#1b2536"/>
<path d="M0 286 L96 250 L196 284 L296 242 L408 286 L512 256 L622 292 L${W} 258 L${W} 330 L0 330 Z" fill="#141b28"/>
<rect x="0" y="300" width="${W}" height="100" fill="url(#water)"/>
<rect x="510" y="300" width="92" height="100" fill="#ff8a3d" opacity="0.20"/>
<rect x="534" y="300" width="44" height="100" fill="#ffb072" opacity="0.16"/>
<g fill="#4da3ff" opacity="0.5">
<rect x="62" y="318" width="34" height="2"/>
<rect x="120" y="342" width="22" height="2"/>
<rect x="196" y="330" width="40" height="2"/>
<rect x="292" y="356" width="26" height="2"/>
</g>
<path d="M0 296 L${W} 296 L${W} 300 L0 300 Z" fill="#0b0d10" opacity="0.55"/>
</svg>`;

/** `encodeURIComponent` rather than base64: smaller, and the markup stays readable in devtools. */
export const PLATE_URI = `url("data:image/svg+xml,${encodeURIComponent(SVG)}")`;

export const PLATE_SIZE = { width: W, height: H } as const;

/** The whole picture, at whatever size the caller's box gives it. */
export function Plate({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}): ReactNode {
  return (
    <div
      className={`${styles.plate} ${className ?? ''}`}
      style={{ backgroundImage: PLATE_URI, ...style }}
      aria-hidden="true"
    />
  );
}

export interface PlateTilesProps {
  readonly cols?: number;
  readonly rows?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * The same picture, cut into a grid.
 *
 * Every tile carries the full image as its background and shifts it by its own offset, so the
 * grid is seamless at rest and each tile is independently transformable. `data-tile` is the
 * hook a scene's timeline animates; the index is on the element so a scene can give tile *n* a
 * vector without measuring anything.
 */
export function PlateTiles({ cols = 4, rows = 3, className, style }: PlateTilesProps): ReactNode {
  const tiles = Array.from({ length: cols * rows }, (_, i) => i);
  return (
    <div
      className={`${styles.tiles} ${className ?? ''}`}
      style={
        {
          '--plate-cols': cols,
          '--plate-rows': rows,
          ...style,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {tiles.map((i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <div
            key={i}
            className={styles.tile}
            data-tile={i}
            style={{
              backgroundImage: PLATE_URI,
              // A percentage background-position on a tile that is 1/cols of the image resolves
              // to exactly the right slice: 0% is the left edge, 100% the right, and the
              // intermediate steps divide the overflow evenly. No pixel arithmetic, so it stays
              // correct at every container size.
              backgroundPosition: `${cols > 1 ? (col / (cols - 1)) * 100 : 0}% ${
                rows > 1 ? (row / (rows - 1)) * 100 : 0
              }%`,
              backgroundSize: `${cols * 100}% ${rows * 100}%`,
            }}
          />
        );
      })}
    </div>
  );
}
