# WEB EXPERIENCE

The website's architecture: what draws it, what moves it, and what happens when any of that is
not available.

This is the companion to [`MOTION.md`](MOTION.md), which owns the vocabulary of movement.
This file owns the layers underneath it.

---

## 1. Scope of the 0.4 pass, stated plainly

0.4 was asked for a complete reconstruction of the website around a 3D layer. What it delivers is
**the foundation for that reconstruction and one scene built on it**, not sixteen. The parts that
exist are finished and verified; the parts that do not are named here and in
[`BETA-0.4.md`](BETA-0.4.md) rather than implied.

Delivered: the typographic identity, the 3D architecture with its capability gate and fallback,
the first 3D scene, and a correctness fix to the scroll system that every scene on the page was
already suffering from. The remaining scenes still run the 0.3.1 two-dimensional motion system,
which is good work and is not a placeholder — it is simply not 3D.

## 2. Typography

Three families, three jobs, and none of them chosen for being popular.

| Role | Family | Why |
|---|---|---|
| Display | **Archivo** | A grotesk with a real width axis, so a headline can be set narrow and tight without squashing glyphs with a transform. Industrial rather than friendly. |
| Body | **Instrument Sans** | Deliberately not Inter. Inter is excellent and is also the default voice of every developer-tool landing page written since 2021, which makes it the one choice that cannot carry an identity. |
| Mono | **JetBrains Mono** | The terminal, ports, types and hashes. Drawn for reading code at small sizes, which is what those are. |

They are loaded with `next/font/google`, which downloads them **at build time and serves them
from this origin**. That matters for two reasons beyond speed: the Content-Security-Policy keeps
`font-src 'self'` with no third-party exception, and there is no layout shift from a font that
arrives late.

The application keeps the operating system's UI font. A tool somebody keeps open all day belongs
to their desktop; a page read once by somebody deciding whether to care does not.

## 3. The 3D layer

### Three.js, not React Three Fiber

React Three Fiber was the natural first choice and was rejected on a fact: **its current stable
release declares `react: >=19 <19.3` and this project is on React 19.3.0.** The only version that
accepts React 19.3 is a `10.0.0-canary`, and a canary reconciler is not something to put under a
product release.

Plain Three.js turned out to be the better fit anyway. R3F's value is a declarative scene driven
by React state; here the scene is driven by a scrubbed GSAP timeline, and React's only job is to
mount a canvas and get out of the way. What is left is a smaller dependency and complete control
of when a frame is drawn.

### Everything is arithmetic

There is no model, no texture file and no loader. Blocks are extruded rounded rectangles, wires
are thin boxes, the picture is the same inline SVG the 2D scenes use, drawn to a canvas. Nothing
is fetched, which is what lets the 3D layer exist at all under a policy that permits no
third-party request.

### What makes a block an object

Almost entirely the bevel. A box with hard corners is a rectangle in perspective; a box with a
small chamfer catches the key light along every edge and becomes a thing with a surface. That is
why these are `ExtrudeGeometry` shapes with a bevel rather than `BoxGeometry`, and why each one
carries an `EdgesGeometry` hairline that a scene can brighten to say "this one, now".

One finding worth keeping: **`MeshStandardMaterial` with high metalness and no environment map
renders black**, because a mirror with nothing to reflect is a black object. The blocks are
anodised aluminium — metalness 0.12, roughness 0.52 — not chrome. The alternative is a PMREM
environment, which is a lot of memory to buy a reflection of a room that does not exist.

### The stage, and the three promises it keeps

[`three/stage.ts`](../apps/web/src/three/stage.ts) exists to enforce three things, each of which
is invisible until it is expensive:

1. **Nothing renders unless something changed.** There is no `requestAnimationFrame` loop.
   `invalidate()` schedules exactly one frame. A pinned scene nobody is scrolling costs nothing.
2. **Nothing renders off screen.** An `IntersectionObserver` sets `running` false, and
   `invalidate()` will not even schedule a frame while it is.
3. **Everything is returned.** `dispose()` walks the graph disposing geometries, materials and
   textures, disposes the renderer, calls `forceContextLoss()` and removes the canvas.
   `renderer.dispose()` alone frees Three's own resources and leaves the WebGL context alive,
   which is the leak that matters: browsers cap live contexts per page.

`host.dataset.threeFrames` and `host.dataset.threeRunning` are written as frames are drawn. Two
numbers a QA pass can read without a debugger, and the only way to tell a stage that is idle
because nothing changed from one that is idle because it is wedged.

### The bug those numbers found

**A scrubbed scene must render from the timeline's tick, not the ScrollTrigger's.** With `scrub`,
a scroll event does not move the playhead straight to its new position — ScrollTrigger eases it
there over the following second, and the trigger's own `onUpdate` fires once, at the scroll.
Rendering from there draws one frame per wheel notch and skips everything between: the scene is
always correct and is never seen to move. Measured on this page: one scroll jump rendered **1
frame** before the fix and **83** after it.

## 4. The capability gate

Two separate questions, and conflating them is how a site shows somebody a black rectangle.

- **Can it?** A real WebGL2 context is requested and immediately released — nothing else is
  reliable. The probe explicitly calls `WEBGL_lose_context`, because a probe that keeps a context
  can be the reason the real renderer later cannot get one.
- **Should it?** Reduced motion, two logical cores or 2GB of device memory all mean no. Reduced
  motion is checked *first*, before any context is requested: it is a stated preference, not a
  capability, and a visitor who asked for stillness should not pay for a context to be told no.

Nine tests cover it in [`apps/web/test/capability.test.ts`](../apps/web/test/capability.test.ts),
including the case where asking for a context throws rather than returning null, and the case
where `deviceMemory` is simply not implemented — absent is not small.

## 5. The fallback is the page

The important inversion: **the DOM is not a fallback bolted on after the 3D. It is the page, and
the 3D is added on top of it when it is welcome.**

Every scene renders its heading, its body and its diagram as real elements, always. When a stage
really mounts, `useStage3D` sets `data-three="on"` on the host and the stylesheet stands the flat
diagram down with `visibility`, which keeps its layout box so the section does not change height
the moment the canvas appears. Every path that returns early — no WebGL, a refused context,
reduced motion — never sets the marker, and the page is simply the flat one.

That is also what makes the page correct for a crawler and for a reader with JavaScript off.

## 6. The scroll-length bug, which was older than this release

`end: '+=320%'` is a percentage of the **trigger's** height — and the trigger is the section the
timeline is about to pin. Pinning inserts a spacer, the section grows by the scroll distance, and
on the next refresh the percentage is taken against the taller section. A scene asking for 320%
of the viewport was measured being given 320% of 3,780px: it consumed several times the scroll it
was written for and played at a fraction of its intended pace.

Every scene on the page had this, through `pinnedTimeline`. Both now compute the end from
`window.innerHeight` in a function, which is re-evaluated on refresh and so stays correct across
a resize.

## 7. Lifecycle

One stage per 3D scene, mounted by `useStage3D`, which mirrors `useScrollScene` deliberately so
there is one shape to learn. On unmount the GSAP context is reverted **first**, so no tween can
fire against objects whose geometry is about to be disposed, and only then is the stage given
back.

`gsap.matchMedia()` branches inside that context are reverted with it, and each branch returns a
cleanup that removes its own group from the scene — so crossing the breakpoint rebuilds the
composition rather than leaving two of them.

## 8. Performance posture

- Demand rendering, paused off screen, as above.
- Pixel ratio capped at 2, and at 1.5 below 900px. Past that it is heat, not detail.
- Three lights, and no shadow maps.
- One decoded texture shared by every tile of the picture through `offset`/`repeat`.
- No post-processing, no particles, no blur.

## 9. What the 3D layer must never become

A reason the page is slow, a requirement for reading it, or decoration. If a beat cannot name
what it explains, it does not belong on the page — the rule `MOTION.md` sets for movement applies
unchanged to the third dimension.
