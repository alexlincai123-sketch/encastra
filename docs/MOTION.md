# MOTION

How the website moves, and why each movement is allowed to exist.

---

## The problem this replaces

Version 0.3 shipped a scroll-driven homepage: ten scenes, GSAP ScrollTrigger, real cleanup,
`prefers-reduced-motion` honoured. It was technically sound and it still felt like a slide deck.

The reason was vocabulary. Nearly every beat in every scene was some combination of `autoAlpha`,
`y` and `scale` — a fade, a nudge, a grow — so however many timelines the page had, it only ever
did one thing. Adding more animation would have made that worse.

0.3.1 removes almost all of that and replaces it with a grammar.

---

## The grammar

Eleven verbs. A scene composes them; a scene does not invent a twelfth. They live in
[`apps/web/src/lib/motion-system.ts`](../apps/web/src/lib/motion-system.ts), which is the only
file allowed to construct a tween on a composition.

| Verb | What it means | What it looks like |
|---|---|---|
| `assemble` | Scattered parts arrive and take their places | Displaced, rotated, small → laid out, decelerating |
| `snap` | A part finds its slot and latches | Covers the last distance fast, stops dead; the joint pulses once |
| `stack` | Parts pile into a physical stack | Each lands behind and below the last, with a real Z offset |
| `flow` | Something travels along a built path | One traveller crossing a track at constant speed |
| `morph` | A thing changes what it *is* | Crossfade where one shrinks and the other grows into place |
| `split` | One whole becomes its parts | Tiles push apart along their own outward vectors |
| `merge` | Parts become one whole | The reverse, decelerating instead of accelerating |
| `execute` | A sequence runs, in order, visibly | Each step lifts while active and returns to the plane |
| `settle` | The system comes to rest | The one permitted overshoot, and a small one |
| `breakApart` | An invalid join is refused and recoils | The wire retracts to where it came from; the ends push apart |
| `encapsulate` | A finished system becomes one reusable piece | Members converge and vanish behind a shell that grows into their place |

Plus two for continuity — `handoff` and `handon` — which are what stop ten scenes from reading as
ten animations.

### The test a beat has to pass

Before adding a tween: **which verb is this?** If the honest answer is "none, it just looks
nice", it does not go on the page. Motion here is load-bearing: it is how somebody who reads
none of the copy still learns that components have types, that a refused connection is refused
rather than broken, and that a workflow can become a component.

The inverse test, from the brief and worth keeping: **remove every word of copy. Does the
animation still say components → connection → construction → execution → result → reuse?**

---

## Two rules that are not about taste

### Only `transform` and `opacity` are animated

Every verb above is expressible as translate, rotate, scale and alpha. Those the compositor
handles without touching layout or paint. Nothing animates `width`, `height`, `top`, `left`,
`margin` or a `filter`.

`clip-path` is the single deliberate exception, and only as a *static* value: the picture in
scene 6 is cut into tiles by `background-position`, which is set once and never tweened. A
twelve-tile split therefore costs what twelve transformed divs cost.

`will-change` appears in exactly one place — the picture's tiles — because those are the elements
that are certainly about to move, there are few of them, and they are briefly on screen.
Promoting a layer that never moves spends memory for nothing.

### Timings are normalised, not absolute

Scenes drive these from a scrubbed timeline, so a "duration" is a fraction of the scene's scroll
distance. `BEAT` names the four lengths a scene may use — `tick`, `short`, `base`, `long` — which
is what stops ten scenes from each inventing their own pace. `EASE` names five curves, each of
which is a physical claim: things that arrive decelerate, things that latch stop hard, things
that leave accelerate away, things that travel do not change speed, and only a settle overshoots.

---

## Depth, without WebGL

0.3 decided against WebGL and 0.3.1 keeps that decision. The product is a 2D node editor; a
WebGL layer would add a large dependency and a GPU-tier fallback surface to buy an effect the
composition does not need.

Depth instead comes from CSS 3D: `perspective` on the stage (`.u-stage`), `transform-style:
preserve-3d` on the group (`.u-depth`), and `translateZ` on the members, using five named planes
(`DEPTH.back`, `under`, `plane`, `lift`, `near`) rather than a continuum.

The perspective is deliberately long — 1600px. A short perspective gives the fish-eyed look of a
CSS 3D demo; a long one reads as a camera with a normal lens, which is the difference between
"cards floating" and "a composition with depth". Depth is there to reinforce composition. Where
it would only decorate, it is not used.

---

## The picture

Several scenes need an image to put through the machine. Rather than a stock photograph, the
page draws its own: [`components/visual/Plate.tsx`](../apps/web/src/components/visual/Plate.tsx)
builds an SVG at module scope and inlines it as a data URI.

- **No network.** Nothing to fetch, so nothing to be slow, blocked or missing on first paint,
  and no third-party asset whose licence has to be taken on trust.
- **Deterministic.** Every coordinate is a constant, so the server and the browser render the
  same bytes and a visual change is a real change.
- **Plainly a drawing.** It is an abstract composition in the product's own palette. The copy
  around it talks about a file being resized; it does not claim this is a photograph.

Tiling uses `background-position` on a grid of plain divs rather than cloning the SVG: one
decoded image, N compositor layers.

---

## Reduced motion

`prefers-reduced-motion` **reduces the motion, not the content**. Under it, `createScope` returns
`null` and a scene's build function never runs at all — no timeline, no pin, no scrub.

That puts a hard requirement on every scene: **the JSX must already be the finished, complete,
readable composition.** Every piece visible, every word legible, nothing positioned only by a
timeline, and nothing hidden in CSS that only a tween would reveal. A reduced-motion visitor sees
the whole story; they simply see it laid out instead of assembled.

`globals.css` also drops the stage perspective for these visitors, so a static rotation cannot
skew anything, and `[data-animate]` is forced back to full opacity and no transform in case GSAP
staged an entrance before deciding not to animate it.

---

## Mobile

Not "animations off on small screens". Each scene branches with `gsap.matchMedia()`:

- **≥900px** — the full composition.
- **<900px** — fewer pieces in motion, depth values halved, and no pin longer than 140vh.

The concept of assembly, the hierarchy and the story survive; the piece count and the travel
distances do not need to.

---

## Lifecycle

One pinned timeline per scene, built inside `useScrollScene`, which wraps everything in a
`gsap.context` and reverts it on unmount. `matchMedia` created inside that context is reverted
with it.

Two lifecycle rules learned the hard way and worth restating:

- **Never create a tween inside a callback on a scrubbed timeline.** The visitor owns the
  playhead and scrolls backwards as freely as forwards; a tween spawned in `onComplete` has no
  place in the timeline to rewind to. `execute` returns its beat positions so a caller can place
  reversible `tl.set(...)` calls instead of using `onStart`.
- **Never pass an array literal of query results to GSAP.** `querySelector` returns
  `Element | null`, and a `null` *inside* an array reaches `target._gsap` and throws, which takes
  the page down. `targets(...)` in `lib/scroll.ts` filters them; nothing else is allowed.

And one CSS Modules trap that has already cost this page a crash: a class that uses `composes`
resolves to **two** class names. That is a perfectly good `className` and an invalid
`querySelector` argument. Scenes select with `[data-…]` attributes.

---

## Where the scenes are

`apps/web/src/components/scenes/` — one component and one CSS module per scene, plus
`HomeExperience.tsx` which mounts all ten and refreshes ScrollTrigger once everything has
measured. Copy and every component id live in `lib/scenes.ts`, so a claim on the page can be
audited without opening ten component files.
