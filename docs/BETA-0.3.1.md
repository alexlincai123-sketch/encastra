# Beta 0.3.1

Motion with a vocabulary, and a Settings screen that finally speaks the language it is set to.

---

## 1. The problem this release exists for

0.3 shipped a scroll-driven homepage and reported it honestly: ten scenes, real ScrollTrigger
cleanup, `prefers-reduced-motion` respected. It was technically sound, and it felt like a slide
deck that fades.

The cause was not a shortage of animation. It was a shortage of *vocabulary*: nearly every beat
in every scene was `autoAlpha` plus `y` plus `scale`, so however many timelines the page had, it
only ever did one thing. More animation would have made that worse.

0.3.1 replaces almost all of it with a grammar of eleven verbs — assemble, snap, stack, flow,
morph, split, merge, execute, settle, break, encapsulate — under one rule: **a beat whose verb
nobody can name does not go on the page.** The full argument is in [`MOTION.md`](MOTION.md).

0.3 also shipped with a plainly visible defect: switching language relabelled the sidebar and
left the entire Settings screen in English. That is fixed, and the fix turned out to be four
times the size the 0.3 report claimed.

## 2. What the homepage now does

| Scene | What it says without a word of copy |
|---|---|
| 01 Intro | Sixteen scattered, tilted pieces ASSEMBLE into a structure and STACK; the headline rises out of the settled composition rather than preceding it |
| 02 What if | Six real components arrive, align, and a wire SNAPs between two of them |
| 03 Connect | A legal conversion SNAPs. An illegal one BREAKs — the wire retracts to the end it came from, because the editor refuses that connection rather than failing it later |
| 04 Build | Blocks enter from different edges, latch into a growing machine, then STACK; it resolves into the three-step workflow |
| 05 Run | EXECUTE down the chain, one traveller per wire at constant speed |
| 06 Result | A picture SPLITs into tiles, the tiles MORPH into modules, the modules MERGE into the smaller file |
| 07 Reuse | The workflow ENCAPSULATEs into one component; saved templates STACK |
| 08 Ecosystem | Components regroup into their real categories, with Flip |
| 09 Terminal | Each command has a visible consequence beside it |
| 10 Try | The composition SETTLEs into the calls to action |

Scenes hand over rather than end: `handoff` and `handon` are why ten scenes read as one
experience instead of ten animations.

**Still no WebGL**, and for the same reason as in 0.3: the product is a 2D node editor, and a
WebGL layer would buy a large dependency and a GPU-tier fallback surface for an effect the
composition does not need. Depth is CSS 3D through a long lens.

## 3. The terminal is a tutorial now

It always lit nodes up as the transcript played. What it did not do was *build* anything: all
three steps and both wires were on screen from the first frame, so `encastra add` added nothing
you could see and `encastra connect` connected two things already joined.

A step now appears on the command that adds it and a wire is drawn on the command that connects
it, both counted from the same transcript the text is read from, so the two cannot drift.

The safety contract is unchanged and was not weakened: no `eval`, no `new Function`, no shell, no
server round-trip, no input element. It replays `lib/terminal-script.ts` and nothing else.

## 4. Settings, in six languages

The 0.3 report said the locale files already carried a complete `settings.*` tree and that
adopting it was one mechanical pass. **That was wrong, and measuring it was the first thing this
release did.** `Settings.tsx` never called `t()` at all; `categories.ts` held a second, already
drifted copy of the English labels; and the locale tree covered nine of the eighteen categories.

- **122 new keys per locale**, identical in shape across all six, checked both directions:
  nothing missing, nothing stray, in any of them.
- `categories.ts` now owns ids and order only, so a label lives in exactly one place.
- A source scanner fails the suite if a hardcoded user-visible string reappears — proved by
  putting one back and watching the test go red.
- **Diagnostics says two things at once, deliberately.** The table is translated, because it is
  one of the eighteen categories and a person reads it. The report the Copy and Export buttons
  hand over is English, because it is pasted into a bug tracker where everyone has to read it.
  The note under the buttons says so, and the old promise of "exactly as shown" was corrected
  rather than left quietly untrue.

## 5. Three defects the browser found

None of these would have shown up in a screenshot, and two of them had been shipping silently.

**A horizontal scrollbar on every page load.** The terminal scene is the only one not pinned, so
it was the only one with nothing containing its own entrance; its outward-starting card sat 61px
past the right edge of the document.

**Dead beats.** `Scenes.module.css` declares five classes with `composes:`, and a composed class
resolves to *two* class names — so `` `.${styles.stageFull}` `` was a descendant selector
matching nothing. Measured in the built page: `.a b c` matched 0 elements, `.a.b.c` matched 1.
Scene 2's HANDON and HANDOFF were both animating `null`, and every scene reaching for
`.headlineMd` was animating a heading that was not there. GSAP had been warning about it in the
console the whole time. Every selector in every scene now goes through `sel()`.

**An empty first screen.** ASSEMBLE faded parts in from nothing — right in the middle of a
scroll, wrong as the opening frame: the hero was a dot grid and the word SCROLL. `assemble` now
takes `fade: false`, and the intro opens on the scattered pieces it was always meant to show
before it says anything in words.

A fourth, found while building: a `translateZ` renders only if **every** element between the
perspective root and the target preserves 3D. Three depth tweens were doing nothing at all, and
were deleted rather than shipped — a no-op tween costs what a real one costs and convinces the
next person the depth is already there.

## 6. Verified, and how

Measured in a real browser and in the installed application, not judged from screenshots.

| Checked | Result |
|---|---|
| Console on the homepage | No errors, no warnings |
| Horizontal overflow at 1920, 1440, 1024, 430, 390 | None at any width |
| Scroll length | 30.0 / 31.3 / 32.6 / 25.6 / 28.4 screens |
| ScrollTrigger leaks | Pin spacers 9 → 0 → 9 across four route changes plus back and forward |
| `prefers-reduced-motion` | Zero pins, all ten scenes present and readable, scroll 25.6 → 15.6 screens |
| Settings in the installed app | All eighteen categories, translated, live-switched through de, fr, it, pt, en, es |
| Language persistence | Survived a full restart of the application |
| Diagnostics | Rows translated; version 0.3.1-beta.1, runtime attached, 21 components, real GPU and WebView strings |
| Checkpoint end to end | 800×400 in, **800×400 out** — the no-enlarge fix from 0.3 still holds |

## 7. What is still in English

Settings is done. The rest of the application is not, and saying otherwise would be false.

Measured by scanning the visible text of each screen with the application set to Spanish:

| Screen | Untranslated |
|---|---|
| Builder toolbar | New, Open, Save, Run, Settings |
| Components browser | Add to canvas, All of it, New name |
| Security | Run journals |

Component **names and descriptions** ("Save File", "Shows a message when this step runs.") are a
different problem and deliberately out of this pass: they come from the manifests the Rust
runtime loads, so translating them means localising manifests, not adding keys to a locale file.

Each of the three screens above is a job the size Settings just turned out to be. Starting one
and not finishing it would leave the application worse than it is now.

## 8. Unchanged from 0.3, and still true

- Nothing is signed.
- No external audit has happened.
- Third-party components cannot be installed or executed; the sandbox is designed, not built.
- No update channel, no accounts, no marketplace, no community, no payments.
- Windows only.
- The licence is still `UNLICENSED`, which grants nobody any rights.
