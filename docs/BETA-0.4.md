# Beta 0.4

A third dimension, a voice of its own, and a scroll bug that had been slowing every scene on the
page since it was written.

---

## 1. What this release is, and what it is not

0.4 was asked for a complete reconstruction of the website: sixteen scenes, 3D throughout, a
terminal rebuilt as an interactive tutorial, every secondary page reworked.

**What it delivers is the foundation for that and one scene standing on it.** That is stated
first because everything else here is worth less if this is not clear:

| Asked for | Delivered |
|---|---|
| A 3D architecture with an honest fallback | **Done** and tested |
| A typographic identity | **Done** |
| A 3D scene carrying parts → assemble → connect → execute | **Done**, and verified in the browser |
| Sixteen reconstructed scenes | **One.** The other eight are 0.3.1's two-dimensional scenes, unchanged |
| Terminal rebuilt as a download-to-reuse tutorial | **Not started.** The 0.3.1 terminal remains: synchronised with its diagram, still safe |
| Secondary pages reworked to the new system | **Not started** |

The parts that exist are finished and checked. The parts that do not are named, here and in the
final report, rather than implied by a version number.

## 2. Typography

**Archivo** for display, **Instrument Sans** for body, **JetBrains Mono** for the terminal, ports
and hashes — self-hosted at build time through `next/font`, so the Content-Security-Policy keeps
`font-src 'self'` with no third-party exception and nothing arrives late enough to shift the
layout.

Instrument Sans rather than Inter, deliberately: Inter is excellent and is also the default voice
of every developer-tool landing page written since 2021, which makes it the one choice that
cannot carry an identity. The reasoning for all three is in
[`WEB_EXPERIENCE.md`](WEB_EXPERIENCE.md) §2.

The desktop application still uses the operating system's UI font, and should.

## 3. The 3D layer

**Three.js, not React Three Fiber, on a fact rather than a preference**: R3F's stable release
declares `react: >=19 <19.3` and this project is on React 19.3.0. The only release that accepts
19.3 is a `10.0.0-canary`, and a canary reconciler does not go under a product build. Plain
Three.js also turned out to fit better — the scene is driven by a scrubbed GSAP timeline, so
React's only job is to mount a canvas and stay out of the way.

Everything is arithmetic. No model, no texture file, no loader, nothing fetched — which is what
lets a 3D layer exist under a policy that permits no third-party request at all.

The first scene, `SceneAssembly`, is the whole argument of the product in one pinned sequence:
eighteen parts exist and are not arranged, three of them are the real Image Processor steps and
find their places, a connection is *made* rather than drawn, and then a pulse travels the path
that was built. If a visitor scrolls this one scene and nothing else, they have seen what
Encastra is.

## 4. Three findings worth keeping

**A scrubbed 3D scene must render from the timeline's tick, not the ScrollTrigger's.** With
`scrub`, a scroll event does not move the playhead to its new position — ScrollTrigger eases it
there over the next second, and the trigger's `onUpdate` fires once, at the scroll. Rendering
from there draws one frame per wheel notch and skips everything in between: the scene is always
correct and is never seen to move. Measured on this page: **1 frame** per scroll jump before,
**83** after.

**`end: '+=320%'` is a percentage of the trigger, and the trigger is the section the timeline is
about to pin.** Pinning inserts a spacer, the section grows, and on refresh the percentage is
taken against the taller section. A scene asking for 320% of the viewport was measured being
given 320% of 3,780px — it played at a third of its intended pace. **Every scene on the page had
this**, through `pinnedTimeline`; both now compute the distance from `window.innerHeight` in a
function, so it also survives a resize.

**`MeshStandardMaterial` with high metalness and no environment map renders black**, because a
mirror with nothing to reflect is a black object. The blocks were invisible until metalness came
down to 0.12. They are anodised aluminium, not chrome.

## 5. The fallback is the page

The inversion that matters: the DOM is not a fallback bolted on after the 3D — it is the page,
and the 3D is added on top of it when it is welcome.

Every scene renders its heading, body and diagram as real elements, always. A stage that really
mounts marks its host and the stylesheet stands the flat diagram down. No WebGL, a refused
context, two logical cores, 2GB of memory, or a request for reduced motion: the marker is never
set and the page is simply the flat one — which is also what a crawler and a reader with
JavaScript off get.

Reduced motion is checked **before** any context is requested. It is a stated preference, not a
capability, and somebody who asked for stillness should not pay for a WebGL context to be told
no.

## 6. Verified

| Checked | Result |
|---|---|
| Gate | Biome 0, typecheck 0/0, **vitest 225**, web build 0, rustfmt clean, clippy 0, **cargo test 135** |
| 3D mounts | `data-three="on"`, canvas present, frames counting |
| Scrub renders | 83 frames for one scroll transition |
| Assembly | Three blocks reach their row, wires grow, edges change state, pulse travels |
| Typography | Archivo on headings, Instrument Sans on body, both self-hosted |
| Capability gate | 9 tests, including a throwing context and an unreported `deviceMemory`; mutation-checked by removing the reduced-motion guard |
| Installed application | 0.4.0-beta.1, runtime attached, 21 components |
| Settings | 18 categories, still translated, language preference survived the upgrade |
| Runtime | Checkpoint end to end: 800×400 in, **800×400 out** |

## 7. Known limitations

- **Eight of the nine homepage scenes are still the 0.3.1 2D ones.** They are good and they are
  not 3D.
- **The terminal is unchanged.** It synchronises with its diagram and is still an animation with
  no evaluator, but it does not yet teach download → install → create → modify → reuse.
- **Secondary pages are unchanged.** They inherit the new typography, and nothing else.
- **No horizontal scroll moment, no custom cursor work, no new microinteractions.**
- Settings translation still stops at Settings: the builder toolbar, the Components browser and
  part of the Security screen remain English, as recorded in 0.3.1.
- Unchanged and still true: nothing is signed, no external audit has happened, third-party
  components cannot be installed or executed, no update channel, no accounts, Windows only,
  licence `UNLICENSED`.
