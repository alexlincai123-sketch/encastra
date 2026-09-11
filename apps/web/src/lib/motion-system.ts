'use client';

/**
 * The motion grammar.
 *
 * The homepage's first pass had motion but no vocabulary: almost every scene reached for
 * `autoAlpha` and `y`, which is how a page ends up feeling like a slide deck that fades. The
 * fix is not more animation — it is fewer *kinds* of animation, each of which means something.
 *
 * Eleven verbs, and nothing else. A scene composes them; a scene does not invent a twelfth.
 * Before adding a tween, the question to answer is "which verb is this?", and if the honest
 * answer is "none, it just looks nice", the tween does not belong on the page.
 *
 *   ASSEMBLE   scattered parts arrive and take their places
 *   SNAP       a part finds its slot and latches
 *   STACK      parts pile into a physical stack
 *   FLOW       something travels along a built path
 *   MORPH      a thing changes what it *is*
 *   SPLIT      one whole becomes its parts
 *   MERGE      parts become one whole
 *   EXECUTE    a sequence runs, in order, visibly
 *   SETTLE     the system comes to rest
 *   BREAK      an invalid join is refused and recoils
 *   ENCAPSULATE a finished system becomes a single reusable piece
 *
 * Two hard rules, both about performance rather than taste:
 *
 * 1. **Only `transform` and `opacity` are animated.** Every verb below is expressible as some
 *    combination of translate, rotate, scale and alpha, which the compositor handles without
 *    touching layout or paint. Nothing here animates width, height, top, left, margin, or a
 *    filter. `clip-path` is the one deliberate exception, used by SPLIT alone, where the whole
 *    point is revealing a region of one element.
 * 2. **Timings are normalised, not absolute.** Scenes drive these from a scrubbed timeline, so
 *    a "duration" is a fraction of the scene's scroll distance. `BEAT` names the handful of
 *    lengths a scene is allowed to use, which is what stops ten scenes from each inventing
 *    their own sense of pace.
 */

/* ---------------------------------------------------------------------------------------------
 * Easing.
 *
 * Five, not twenty. Each one is a physical claim: things that arrive decelerate, things that
 * latch arrive slightly hard, things that come apart accelerate away, things that travel do not
 * change speed at all, and a settle is the only place a small overshoot is allowed.
 * ------------------------------------------------------------------------------------------ */

export const EASE = {
  /** Arriving under its own momentum and slowing into place. The default for ASSEMBLE. */
  arrive: 'power3.out',
  /** The last few pixels of a latch: fast, then abruptly still. Used by SNAP and STACK. */
  latch: 'power4.out',
  /** Leaving: slow to start, accelerating away. Used by SPLIT and BREAK. */
  depart: 'power2.in',
  /** Constant speed. Anything *travelling* a path — FLOW, EXECUTE — must not ease, or it reads
      as hesitating at the ends of a wire it has no reason to hesitate at. */
  travel: 'none',
  /** One small overshoot, for SETTLE only. Anywhere else it reads as bounce for its own sake. */
  rest: 'back.out(1.4)',
} as const;

/* ---------------------------------------------------------------------------------------------
 * Beats.
 *
 * A scrubbed timeline's total length is 1. These are the only durations a scene should use, so
 * that "a snap" is the same length of scroll in scene 3 as it is in scene 9.
 * ------------------------------------------------------------------------------------------ */

export const BEAT = {
  /** A state change with no travel: a status pip, a label swap. */
  tick: 0.06,
  /** A short move: a card sliding into a slot it is already beside. */
  short: 0.14,
  /** The standard beat. Most ASSEMBLE and MORPH moves. */
  base: 0.22,
  /** A long, deliberate move that the eye is meant to follow all the way. */
  long: 0.34,
} as const;

/* ---------------------------------------------------------------------------------------------
 * Depth.
 *
 * 2.5D without WebGL: a perspective on the stage, `preserve-3d` on the group, and translateZ on
 * the members. These are the only Z values used, so depth stays a small set of planes rather
 * than a continuum nobody can keep consistent.
 * ------------------------------------------------------------------------------------------ */

export const DEPTH = {
  /** Behind the plane of the page. Context, never content. */
  back: -220,
  /** Slightly recessed: a card that is part of the pile but not the top of it. */
  under: -70,
  /** The plane of the page. */
  plane: 0,
  /** Lifted: the piece currently being talked about. */
  lift: 90,
  /** Close enough to feel like it is leaving the screen. Used sparingly, for one element. */
  near: 220,
} as const;

export type Targets = gsap.TweenTarget;

interface At {
  /** Position on the parent timeline, in its normalised 0-1 space. */
  readonly at?: number;
  readonly duration?: number;
  readonly stagger?: number;
}

/* ---------------------------------------------------------------------------------------------
 * A deterministic scatter.
 *
 * ASSEMBLE needs every part to come from somewhere *different*, or the arrival reads as one
 * block sliding in. Random would do it, but random re-rolls on every render and makes a visual
 * regression impossible to spot, so this is a hash of the index instead: same input, same
 * scatter, every time, on the server and in the browser.
 * ------------------------------------------------------------------------------------------ */

export function scatterVector(index: number, spread = 1): { x: number; y: number; rotate: number } {
  // Two irrational multipliers, so the sequence never falls into a visible period the way a
  // simple modulus would. The constants are arbitrary; what matters is that they are fixed.
  const a = (index * 0.6180339887) % 1;
  const b = (index * 0.7548776662) % 1;
  return {
    x: (a - 0.5) * 2 * 340 * spread,
    y: (b - 0.5) * 2 * 260 * spread,
    rotate: (a - 0.5) * 26 * spread,
  };
}

/** The same idea for a stagger order that is not simply left-to-right. */
export function scatterOrder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i).sort(
    (l, r) => ((l * 0.6180339887) % 1) - ((r * 0.6180339887) % 1),
  );
}

/* =============================================================================================
 * The verbs.
 * ========================================================================================== */

/**
 * ASSEMBLE — scattered parts arrive and take their places.
 *
 * The parts start displaced, rotated and slightly small; they end at their laid-out positions.
 * Note that this animates *from* a scatter rather than *to* one: the DOM already holds the
 * finished composition, which is what a reduced-motion visitor sees, and the scatter only ever
 * exists as an inline transform GSAP puts on and takes back off.
 */
export function assemble(
  tl: gsap.core.Timeline,
  items: Targets,
  opts: At & { spread?: number } = {},
): gsap.core.Timeline {
  const { at = 0, duration = BEAT.base, stagger = 0.04, spread = 1 } = opts;
  return tl.fromTo(
    items,
    {
      x: (i: number) => scatterVector(i, spread).x,
      y: (i: number) => scatterVector(i, spread).y,
      rotate: (i: number) => scatterVector(i, spread).rotate,
      scale: 0.82,
      autoAlpha: 0,
    },
    {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 1,
      autoAlpha: 1,
      duration,
      stagger: { each: stagger, from: 'random' },
      ease: EASE.arrive,
    },
    at,
  );
}

/**
 * SNAP — a part finds its slot and latches.
 *
 * Two things happen, and both are needed for it to read as a latch rather than a move: the part
 * covers the last of its distance quickly and stops dead, and the *joint* acknowledges it with
 * a single pulse. Without the pulse it is a slide; without the hard stop the pulse looks like
 * decoration attached to nothing.
 */
export function snap(
  tl: gsap.core.Timeline,
  part: Targets,
  joint: Targets | null,
  opts: At & { from?: gsap.TweenVars } = {},
): gsap.core.Timeline {
  const { at = 0, duration = BEAT.short, from } = opts;
  tl.fromTo(
    part,
    from ?? { x: -120, autoAlpha: 0.4 },
    { x: 0, y: 0, autoAlpha: 1, duration, ease: EASE.latch },
    at,
  );
  if (joint != null) {
    // The pulse starts fractionally *before* the part lands, so the joint is already reacting
    // as contact is made rather than after it — which is the difference between a latch and a
    // notification that a latch happened.
    tl.fromTo(
      joint,
      { scaleX: 0, transformOrigin: 'left center', autoAlpha: 0 },
      { scaleX: 1, autoAlpha: 1, duration: duration * 0.8, ease: EASE.latch },
      at + duration * 0.35,
    ).to(
      joint,
      { scaleY: 2.2, duration: BEAT.tick * 0.5, yoyo: true, repeat: 1, ease: EASE.travel },
      at + duration * 0.95,
    );
  }
  return tl;
}

/**
 * STACK — parts pile into a physical stack.
 *
 * Each part lands a little behind and below the one before it, so the pile has a front and a
 * back rather than being a set of overlapping rectangles. `step` is the gap between cards; the
 * Z offset is what makes the difference visible when the stage has perspective.
 */
export function stack(
  tl: gsap.core.Timeline,
  items: Targets,
  opts: At & { step?: number; depth?: number } = {},
): gsap.core.Timeline {
  const { at = 0, duration = BEAT.base, stagger = 0.05, step = 14, depth = 34 } = opts;
  return tl.to(
    items,
    {
      x: 0,
      y: (i: number) => i * step,
      z: (i: number) => -i * depth,
      rotateX: 4,
      scale: 1,
      duration,
      stagger,
      ease: EASE.latch,
    },
    at,
  );
}

/**
 * FLOW — something travels along a built path.
 *
 * A single travelling element crossing a track, at constant speed. The caller positions the
 * track; this only moves the traveller across it. Constant speed matters: data moving through a
 * wire has no reason to slow down at the far end.
 */
export function flow(
  tl: gsap.core.Timeline,
  traveller: Targets,
  opts: At & { fromPercent?: number; toPercent?: number } = {},
): gsap.core.Timeline {
  const { at = 0, duration = BEAT.base, fromPercent = 0, toPercent = 100 } = opts;
  // Everything is a tween on the parent timeline rather than a callback that spawns one. On a
  // scrubbed timeline the visitor owns the playhead and scrolls backwards as freely as
  // forwards; a tween created inside `onComplete` has no place in the timeline to be rewound
  // to, so it would strand the traveller at whatever opacity it happened to reach.
  return tl
    .fromTo(
      traveller,
      { xPercent: fromPercent, autoAlpha: 0 },
      { xPercent: toPercent, autoAlpha: 1, duration, ease: EASE.travel },
      at,
    )
    .to(
      traveller,
      { autoAlpha: 0, duration: duration * 0.15, ease: EASE.travel },
      at + duration * 0.9,
    );
}

/**
 * MORPH — a thing changes what it is.
 *
 * A crossfade between two elements occupying the same box, with the outgoing one shrinking
 * slightly and the incoming one growing into place. Deliberately *not* a plain crossfade: the
 * scale difference is what tells the eye that one became the other rather than one replaced
 * the other.
 */
export function morph(
  tl: gsap.core.Timeline,
  from: Targets,
  to: Targets,
  opts: At = {},
): gsap.core.Timeline {
  const { at = 0, duration = BEAT.base } = opts;
  return tl
    .to(from, { scale: 0.9, autoAlpha: 0, duration: duration * 0.6, ease: EASE.depart }, at)
    .fromTo(
      to,
      { scale: 1.08, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: duration * 0.7, ease: EASE.arrive },
      at + duration * 0.35,
    );
}

/**
 * SPLIT — one whole becomes its parts.
 *
 * The tiles are already laid over the whole, each clipped to the region of it they represent;
 * this pushes them apart along their own outward vector. `clip-path` is set once by CSS and
 * never animated — only the transforms move, which is why a twelve-tile split costs no more
 * than twelve cards moving.
 */
export function split(
  tl: gsap.core.Timeline,
  tiles: Targets,
  opts: At & { vectors?: ReadonlyArray<{ x: number; y: number; rotate?: number }> } = {},
): gsap.core.Timeline {
  const { at = 0, duration = BEAT.base, stagger = 0.03, vectors } = opts;
  const vector = (i: number) => vectors?.[i] ?? scatterVector(i, 0.5);
  return tl.to(
    tiles,
    {
      x: (i: number) => vector(i).x,
      y: (i: number) => vector(i).y,
      rotate: (i: number) => vector(i).rotate ?? 0,
      z: (i: number) => (i % 3) * 30,
      duration,
      stagger,
      ease: EASE.depart,
    },
    at,
  );
}

/**
 * MERGE — parts become one whole.
 *
 * The reverse of SPLIT, and deliberately a separate function rather than `split` played
 * backwards: coming together decelerates into place (`arrive`), coming apart accelerates away
 * (`depart`). Reversing one tween would give both the same curve, and the pair would read as
 * one mechanism running in two directions instead of two different events.
 */
export function merge(tl: gsap.core.Timeline, tiles: Targets, opts: At = {}): gsap.core.Timeline {
  const { at = 0, duration = BEAT.base, stagger = 0.025 } = opts;
  return tl.to(
    tiles,
    {
      x: 0,
      y: 0,
      z: 0,
      rotate: 0,
      duration,
      stagger: { each: stagger, from: 'edges' },
      ease: EASE.arrive,
    },
    at,
  );
}

/**
 * EXECUTE — a sequence runs, in order, visibly.
 *
 * Each step lifts as it becomes active and returns to the plane as it finishes, so at any
 * moment exactly one step is forward.
 *
 * It returns the beat positions rather than calling back, and that is deliberate. A scrubbed
 * timeline is scrolled backwards as often as forwards, and an `onStart` callback that stamps a
 * state has no inverse — scroll back up and the step stays marked done. The caller places
 * `tl.set(...)` calls at the returned positions instead, and a `set` on a timeline rewinds
 * correctly because GSAP records what it overwrote.
 */
export interface ExecuteBeats {
  /** When step `i` becomes active. */
  readonly start: readonly number[];
  /** When step `i` finishes. */
  readonly done: readonly number[];
}

export function execute(
  tl: gsap.core.Timeline,
  steps: readonly Element[],
  opts: At = {},
): ExecuteBeats {
  const { at = 0, duration = BEAT.base } = opts;
  const each = duration / Math.max(steps.length, 1);
  const start: number[] = [];
  const done: number[] = [];
  steps.forEach((step, i) => {
    const from = at + i * each;
    start.push(from);
    done.push(from + each * 0.55);
    tl.to(step, { z: DEPTH.lift, scale: 1.04, duration: each * 0.4, ease: EASE.arrive }, from).to(
      step,
      { z: DEPTH.plane, scale: 1, duration: each * 0.4, ease: EASE.travel },
      from + each * 0.55,
    );
  });
  return { start, done };
}

/**
 * SETTLE — the system comes to rest.
 *
 * The only place an overshoot is allowed, and it is a small one. This is what tells the eye a
 * sequence is finished rather than paused, which matters on a scrubbed timeline where the
 * visitor controls the playhead and nothing stops on its own.
 */
export function settle(tl: gsap.core.Timeline, items: Targets, opts: At = {}): gsap.core.Timeline {
  const { at = 0, duration = BEAT.short, stagger = 0.02 } = opts;
  return tl.to(
    items,
    { scale: 1, rotate: 0, z: DEPTH.plane, duration, stagger, ease: EASE.rest },
    at,
  );
}

/**
 * BREAK — an invalid join is refused and recoils.
 *
 * The wire retracts to the end it came from rather than fading, and the two ends push apart.
 * The retraction is the important half: a fade would say "this connection disappeared", and
 * what actually happens in the editor is that the connection is never made.
 */
export function breakApart(
  tl: gsap.core.Timeline,
  wire: Targets,
  ends: Targets,
  opts: At = {},
): gsap.core.Timeline {
  const { at = 0, duration = BEAT.short } = opts;
  return tl
    .to(wire, { scaleX: 0, transformOrigin: 'left center', duration, ease: EASE.depart }, at)
    .to(
      ends,
      { x: (i: number) => (i === 0 ? -18 : 18), duration: duration * 0.5, ease: EASE.depart },
      at,
    )
    .to(ends, { x: 0, duration: duration * 0.7, ease: EASE.rest }, at + duration * 0.5);
}

/**
 * ENCAPSULATE — a finished system becomes a single reusable piece.
 *
 * The closing move of the whole narrative, and the one the product is named after. The members
 * converge on the centre and shrink out of sight behind a shell that grows into their place, so
 * the shell is plainly made *of* them rather than drawn over them.
 */
export function encapsulate(
  tl: gsap.core.Timeline,
  members: Targets,
  shell: Targets,
  opts: At = {},
): gsap.core.Timeline {
  const { at = 0, duration = BEAT.long } = opts;
  return tl
    .to(
      members,
      {
        x: 0,
        y: 0,
        z: DEPTH.under,
        scale: 0.42,
        autoAlpha: 0,
        duration: duration * 0.6,
        stagger: { each: 0.04, from: 'edges' },
        ease: EASE.arrive,
      },
      at,
    )
    .fromTo(
      shell,
      { scale: 0.6, autoAlpha: 0, z: DEPTH.under },
      { scale: 1, autoAlpha: 1, z: DEPTH.plane, duration: duration * 0.5, ease: EASE.rest },
      at + duration * 0.45,
    );
}

/* ---------------------------------------------------------------------------------------------
 * Continuity between scenes.
 *
 * The ten scenes are meant to read as one experience, which means a scene has to *hand over* to
 * the next rather than end. `handoff` is the shape every scene's last beat shares: the
 * composition recedes along Z and dims while the next scene's first beat is already arriving.
 * ------------------------------------------------------------------------------------------ */

export function handoff(tl: gsap.core.Timeline, items: Targets, opts: At = {}): gsap.core.Timeline {
  const { at = 0.78, duration = BEAT.base } = opts;
  return tl.to(
    items,
    { z: DEPTH.back, scale: 0.92, autoAlpha: 0, duration, ease: EASE.depart },
    at,
  );
}

/** The other half of a handoff, for the scene receiving it. */
export function handon(tl: gsap.core.Timeline, items: Targets, opts: At = {}): gsap.core.Timeline {
  const { at = 0, duration = BEAT.base, stagger = 0.03 } = opts;
  return tl.fromTo(
    items,
    { z: DEPTH.near, scale: 1.06, autoAlpha: 0 },
    { z: DEPTH.plane, scale: 1, autoAlpha: 1, duration, stagger, ease: EASE.arrive },
    at,
  );
}
