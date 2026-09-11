#!/usr/bin/env python3
"""Generates the Encastra mark and every icon size the product needs.

The logo lives here as code rather than as a binary somebody once exported, so it is
reproducible, reviewable in a diff, and impossible to lose the source of.

THE MARK
--------
A tab and a slot — an *encastre*. One module carries a tongue on its right edge; the other has
a matching groove cut into it, and the two sit staggered, as though caught mid-assembly.

The first attempt was two equal bars with a centred connector. It rendered as a capital H:
symmetry reads as a letter before it reads as a mechanism. Staggering the modules and making
the joint directional — something protrudes, something receives — removes that reading.

It has to survive 16 pixels, so it is three shapes and one cut. Anything finer disappears.

        ┌────┐
   ┌────┤    │
   │  ══╡    │      the tongue enters the groove
   │    │    │
   └────┤    │
        └────┘

Usage:  python scripts/make_brand.py
Writes: apps/desktop/src-tauri/icons/, packages/ui/brand/
"""

from __future__ import annotations

import pathlib
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - a developer without Pillow gets told what to do
    sys.exit("This script needs Pillow:  pip install Pillow")

ROOT = pathlib.Path(__file__).resolve().parent.parent

# From packages/ui/src/tokens.css. Kept in step by hand, which is acceptable for exactly one
# value used in exactly one place; anything more would need generating from the token file.
ACCENT = (255, 138, 61, 255)  # --accent
INK = (230, 234, 240, 255)  # --ink
GROUND = (11, 13, 16, 255)  # --ground-0


def draw_mark(size: int, fg: tuple[int, int, int, int], bg: tuple[int, int, int, int] | None):
    """Draws the mark at `size` pixels square.

    Every measurement is a fraction of `size`, so the geometry is identical at 16px and
    1024px and the shape is never redrawn by hand for a new size.
    """
    # Supersample, then downscale. Rounded corners and a narrow groove alias badly otherwise,
    # and the 16px favicon is where that shows most.
    scale = 8
    s = size * scale
    image = Image.new("RGBA", (s, s), bg if bg else (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    u = s / 32.0  # a 32-unit grid
    r = u * 1.5

    # Staggered: the receiving module sits higher, the one with the tongue lower. The offset is
    # what stops two vertical bars from reading as a letter.
    left = (u * 3.5, u * 10, u * 13.5, u * 29)
    right = (u * 18.5, u * 3, u * 28.5, u * 22)

    draw.rounded_rectangle(right, radius=r, fill=fg)

    # The groove, cut out of the receiving module. Drawn with a fully transparent fill, which
    # ImageDraw writes rather than composites, so it removes pixels instead of tinting them.
    groove_half = u * 2.6
    groove_y = u * 16.5
    draw.rounded_rectangle(
        (u * 17.0, groove_y - groove_half, u * 24.5, groove_y + groove_half),
        radius=r * 0.8,
        fill=(0, 0, 0, 0) if bg is None else bg,
    )

    draw.rounded_rectangle(left, radius=r, fill=fg)

    # The tongue: leaves the left module, crosses the gap, and stops short of the end of the
    # groove. That remaining clearance is what says "these are two parts", not one shape.
    tongue_half = u * 1.7
    draw.rounded_rectangle(
        (u * 11.0, groove_y - tongue_half, u * 22.0, groove_y + tongue_half),
        radius=r * 0.6,
        fill=fg,
    )

    return image.resize((size, size), Image.LANCZOS)


def write(path: pathlib.Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    print(f"  {path.relative_to(ROOT)}")


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <title>Encastra</title>
  <path fill="{fg}" fill-rule="evenodd" d="M20 3h7a1.5 1.5 0 0 1 1.5 1.5v16A1.5 1.5 0 0 1 27 22h-7a1.5 1.5 0 0 1-1.5-1.5v-1.4h4.7a1.2 1.2 0 0 0 1.2-1.2v-3.8a1.2 1.2 0 0 0-1.2-1.2h-4.7V4.5A1.5 1.5 0 0 1 20 3Z"/>
  <path fill="{fg}" d="M5 10h7a1.5 1.5 0 0 1 1.5 1.5v3.3h8.3a1.2 1.2 0 0 1 1.2 1.2v1a1.2 1.2 0 0 1-1.2 1.2H13.5v9.3A1.5 1.5 0 0 1 12 29H5a1.5 1.5 0 0 1-1.5-1.5v-16A1.5 1.5 0 0 1 5 10Z"/>
</svg>
"""


# The mark beside the name. This is the form a site header needs, and the one that was missing:
# a mark alone says nothing to somebody who has not met the product yet.
#
# The name is set as `<text>` rather than as outlines. Outlines would be self-contained but would
# also freeze a typeface into the asset, and this repository ships no font it has the right to
# embed. A stack ending in a generic family degrades to something sane everywhere, and the two
# places that matter — the website and the desktop shell — both load the UI font already.
WORDMARK = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168 32" fill="none" role="img" aria-label="Encastra">
  <title>Encastra</title>
  <path fill="{fg}" fill-rule="evenodd" d="M20 3h7a1.5 1.5 0 0 1 1.5 1.5v16A1.5 1.5 0 0 1 27 22h-7a1.5 1.5 0 0 1-1.5-1.5v-1.4h4.7a1.2 1.2 0 0 0 1.2-1.2v-3.8a1.2 1.2 0 0 0-1.2-1.2h-4.7V4.5A1.5 1.5 0 0 1 20 3Z"/>
  <path fill="{fg}" d="M5 10h7a1.5 1.5 0 0 1 1.5 1.5v3.3h8.3a1.2 1.2 0 0 1 1.2 1.2v1a1.2 1.2 0 0 1-1.2 1.2H13.5v9.3A1.5 1.5 0 0 1 12 29H5a1.5 1.5 0 0 1-1.5-1.5v-16A1.5 1.5 0 0 1 5 10Z"/>
  <text x="42" y="22" fill="{text}" font-family="Inter, 'Segoe UI', system-ui, sans-serif" font-size="19" font-weight="600" letter-spacing="0.4">Encastra</text>
</svg>
"""


def main() -> None:
    icons = ROOT / "apps" / "desktop" / "src-tauri" / "icons"
    brand = ROOT / "packages" / "ui" / "brand"

    print("Application icons:")
    # Tauri's expected set. Transparent background so the OS decides the surround.
    for name, size in [
        ("32x32.png", 32),
        ("128x128.png", 128),
        ("128x128@2x.png", 256),
        ("icon.png", 512),
    ]:
        write(icons / name, draw_mark(size, ACCENT, None))

    # Windows .ico carries several sizes in one file; 16px is the one that has to survive.
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    largest = draw_mark(256, ACCENT, None)
    largest.save(
        icons / "icon.ico",
        format="ICO",
        sizes=[(n, n) for n in ico_sizes],
    )
    print(f"  {(icons / 'icon.ico').relative_to(ROOT)}  ({', '.join(str(n) for n in ico_sizes)})")

    print("Brand assets:")
    write(brand / "mark-accent.png", draw_mark(512, ACCENT, None))
    write(brand / "mark-light.png", draw_mark(512, INK, None))
    write(brand / "mark-dark.png", draw_mark(512, GROUND, None))
    write(brand / "mark-on-dark.png", draw_mark(512, ACCENT, GROUND))
    write(brand / "favicon.png", draw_mark(32, ACCENT, None))

    for name, colour in [
        ("mark-accent.svg", "#FF8A3D"),
        ("mark-current.svg", "currentColor"),
    ]:
        (brand / name).write_text(SVG.format(fg=colour), encoding="utf-8")
        print(f"  {(brand / name).relative_to(ROOT)}")

    # Wordmarks. `current` takes both the mark and the name from `currentColor`, which is what
    # makes one file work on a light page, a dark page and inside a button.
    for name, fg, text in [
        ("wordmark-accent.svg", "#FF8A3D", "#0B0C0E"),
        ("wordmark-on-dark.svg", "#FF8A3D", "#F2F3F5"),
        ("wordmark-current.svg", "currentColor", "currentColor"),
    ]:
        (brand / name).write_text(WORDMARK.format(fg=fg, text=text), encoding="utf-8")
        print(f"  {(brand / name).relative_to(ROOT)}")

    print("\nDone. Re-run after changing the geometry; do not hand-edit the output.")


if __name__ == "__main__":
    main()
