'use client';

import type { ReactNode } from 'react';
import * as THREE from 'three';

import { GraphFlow } from '@/components/graph/Graph';
import { componentNode } from '@/lib/graph-nodes';
import type { Locale } from '@/lib/i18n/locale';
import {
  CONNECT_ACCEPTED_LABEL,
  RUN_FLOW_IDS,
  RUN_SECOND_WIRE_LABEL,
  sceneCopy,
} from '@/lib/scenes';
import { sel, useScrollScene } from '@/lib/scroll';
import type { Category, Glyph } from '@/three/face';
import { createBlock, createConnection, createPulse, setBlockEdge } from '@/three/objects';
import { useStage3D } from '@/three/useStage';

import styles from './Scene3D.module.css';

/**
 * The first 3D scene, and the one the rest of the experience is judged against.
 *
 * It carries the whole argument of the product in one pinned sequence: parts exist, parts find
 * each other, a connection is *made*, and then something travels through what was built. If a
 * visitor scrolls this one scene and nothing else, they have seen what Encastra is.
 *
 * The three that assemble are the real Image Processor steps — Watch Folder, Resize Image, Save
 * File — so the shapes on screen are not a metaphor for components, they are those components.
 *
 * **The DOM below the canvas is not a fallback bolted on afterwards; it is the page.** The
 * heading, the body and the diagram are always rendered and always readable. When a stage
 * actually mounts, `useStage3D` marks the host and the stylesheet stands the flat diagram down
 * so the 3D one can speak instead. No WebGL, a refused context, or a visitor who asked for
 * reduced motion: the marker is never set, and the page is simply the flat one.
 */

const STEPS = RUN_FLOW_IDS.map((id) => componentNode(id));
const FLOW = [
  { node: STEPS[0] },
  { node: STEPS[1], wire: { type: 'file', label: CONNECT_ACCEPTED_LABEL } },
  { node: STEPS[2], wire: { type: 'image', label: RUN_SECOND_WIRE_LABEL } },
].filter((step) => step.node !== undefined) as Parameters<typeof GraphFlow>[0]['steps'];

/** Where the three that matter come to rest, in world units. */
const ROW = [-2.4, 0, 2.4];

/**
 * A fixed scatter.
 *
 * Two irrational multipliers rather than `Math.random`, for the same reason the 2D scenes use
 * one: a scatter that re-rolls on every mount makes a visual regression impossible to see, and
 * makes the server and the client disagree about what they drew.
 */
function scatter(i: number): { x: number; y: number; z: number; rx: number; ry: number } {
  const a = (i * 0.6180339887) % 1;
  const b = (i * 0.7548776662) % 1;
  const c = (i * 0.5436890126) % 1;
  return {
    x: (a - 0.5) * 13,
    y: (b - 0.5) * 7.5,
    z: (c - 0.5) * 6 - 4,
    rx: (a - 0.5) * 1.6,
    ry: (b - 0.5) * 2.2,
  };
}

/**
 * The three that assemble, and the face each one wears.
 *
 * The names come from the real manifests through `componentNode`, so what is written on a block
 * is what the component is called in the application. The glyph and the category are this file's
 * choice about how to draw them.
 */
const PRINCIPAL_FACES: ReadonlyArray<{ glyph: Glyph; category: Category }> = [
  { glyph: 'folder', category: 'file' },
  { glyph: 'image', category: 'media' },
  { glyph: 'document', category: 'file' },
];

/**
 * The field around them: other components this build ships, each in its own category colour, so
 * the scatter reads as a set of parts rather than as a texture.
 */
const FIELD_FACES: ReadonlyArray<{ label: string; glyph: Glyph; category: Category }> = [
  { label: 'Read CSV', glyph: 'document', category: 'data' },
  { label: 'HTTP', glyph: 'link', category: 'network' },
  { label: 'If', glyph: 'branch', category: 'flow' },
  { label: 'Notify', glyph: 'bell', category: 'system' },
  { label: 'Thumbnail', glyph: 'image', category: 'media' },
  { label: 'Move File', glyph: 'folder', category: 'file' },
  { label: 'Parse JSON', glyph: 'document', category: 'data' },
  { label: 'Switch', glyph: 'branch', category: 'flow' },
  { label: 'Clipboard', glyph: 'gear', category: 'system' },
  { label: 'Convert', glyph: 'image', category: 'media' },
  { label: 'Write CSV', glyph: 'document', category: 'data' },
  { label: 'Rename', glyph: 'folder', category: 'file' },
  { label: 'Delay', glyph: 'gear', category: 'flow' },
  { label: 'Read File', glyph: 'document', category: 'file' },
  { label: 'Image Info', glyph: 'image', category: 'media' },
];

const DESKTOP_EXTRAS = 15;
const MOBILE_EXTRAS = 7;

export function SceneAssembly({ locale }: { locale: Locale }): ReactNode {
  // The opening sentence comes from the shared copy table rather than being written here, so the
  // scene that leads the page is translated by the same table as the nine that follow it.
  const COPY = sceneCopy(locale).intro;
  const words = COPY.headline.split(' ');

  const stageRef = useStage3D<HTMLDivElement>(
    ({ host, stage, gsap }) => {
      const mm = gsap.matchMedia();

      mm.add({ desktop: '(min-width: 900px)', mobile: '(max-width: 899px)' }, (context) => {
        const conditions = context.conditions as { desktop?: boolean } | undefined;
        const desktop = conditions?.desktop ?? true;
        const extras = desktop ? DESKTOP_EXTRAS : MOBILE_EXTRAS;

        const root = new THREE.Group();
        // The composition lives in the upper half and the copy in the lower third, so the two
        // never overlap. Separating them in space rather than by putting a scrim over the
        // objects: a veil dark enough to make type legible is dark enough to hide what the type
        // is about.
        root.position.y = desktop ? 1.5 : 2;
        stage.scene.add(root);

        // The three that become the workflow, and the field they emerge from. The extras are
        // the same object at a smaller size: the point of the scene is that everything here is
        // the same kind of thing, and three of them happen to be the ones being talked about.
        const principals = ROW.map((_, i) => {
          const node = STEPS[i];
          const look = PRINCIPAL_FACES[i];
          return createBlock({
            width: 1.7,
            height: 1.05,
            depth: 0.24,
            ...(look ? { category: look.category } : {}),
            ...(node && look
              ? { face: { label: node.name, glyph: look.glyph, category: look.category } }
              : {}),
          });
        });
        const others = Array.from({ length: extras }, (_, i) => {
          const look = FIELD_FACES[i % FIELD_FACES.length];
          return createBlock({
            width: 1.05,
            height: 0.68,
            depth: 0.16,
            color: '#242b36',
            ...(look ? { category: look.category, face: look } : {}),
          });
        });

        [...principals, ...others].forEach((block, i) => {
          const at = scatter(i + 3);
          block.position.set(at.x, at.y, at.z);
          block.rotation.set(at.rx, at.ry, 0);
          root.add(block);
        });

        const wires = [
          createConnection(
            new THREE.Vector3(ROW[0] ?? 0, 0, 0),
            new THREE.Vector3(ROW[1] ?? 0, 0, 0),
          ),
          createConnection(
            new THREE.Vector3(ROW[1] ?? 0, 0, 0),
            new THREE.Vector3(ROW[2] ?? 0, 0, 0),
          ),
        ];
        for (const wire of wires) {
          wire.scale.x = 0;
          root.add(wire);
        }

        const pulses = wires.map(() => {
          const pulse = createPulse();
          pulse.visible = false;
          root.add(pulse);
          return pulse;
        });

        const camera = stage.camera;
        camera.position.set(0, 0, desktop ? 13 : 15.5);

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          // The render has to hang off the *timeline*, not off the ScrollTrigger.
          //
          // With `scrub`, a scroll event does not move the playhead straight to its new place:
          // ScrollTrigger eases it there over the following second, and the trigger's own
          // `onUpdate` fires once, at the scroll. Rendering from there draws one frame per wheel
          // notch and skips everything in between — the scene is always correct and never seen
          // to move. The timeline's `onUpdate` fires on every tick of that catch-up, which is
          // exactly the set of moments something changed.
          onUpdate: stage.invalidate,
          scrollTrigger: {
            trigger: host.closest('section') ?? host,
            start: 'top top',
            end: () => `+=${Math.round(window.innerHeight * (desktop ? 3.2 : 2))}`,
            scrub: 1,
            pin: host.closest(`${sel(styles.pin)}`) ?? host,
            pinSpacing: true,
            anticipatePin: 1,
            // One invalidate per scroll tick, rather than one per tween. The stage renders a
            // frame only because the scroll moved, which is the whole demand-rendering
            // contract in a single line.
            // Still invalidating here as well: a refresh, a resize or a jump to an anchor
            // moves the trigger without the timeline easing anywhere.
            onUpdate: stage.invalidate,
            onRefresh: stage.resize,
          },
        });

        // DRIFT — the parts exist, and they are not arranged. The camera closes in a little,
        // which is what makes the field read as space rather than as a wallpaper.
        tl.to(camera.position, { z: desktop ? 9.2 : 12, duration: 0.18 }, 0);
        for (const block of others) {
          tl.to(block.rotation, { x: '+=0.5', y: '+=0.7', duration: 0.34 }, 0);
        }

        // ASSEMBLE — the three find their places. Everything else withdraws rather than
        // vanishing: they are still there, they are simply not what this is about.
        principals.forEach((block, i) => {
          tl.to(
            block.position,
            { x: ROW[i] ?? 0, y: 0, z: 0, duration: 0.2, ease: 'power3.out' },
            0.2 + i * 0.05,
          ).to(
            block.rotation,
            { x: 0, y: 0, z: 0, duration: 0.2, ease: 'power3.out' },
            0.2 + i * 0.05,
          );
        });
        others.forEach((block, i) => {
          tl.to(
            block.position,
            { z: `-=${4 + (i % 4)}`, duration: 0.26, ease: 'power2.in' },
            0.22 + i * 0.01,
          );
        });

        // SNAP — each wire grows out of the port it starts at, and the block it reaches
        // acknowledges it. A connection that faded in would be a drawing of a connection.
        wires.forEach((wire, i) => {
          const at = 0.46 + i * 0.08;
          tl.to(
            wire.scale,
            { x: wire.userData.length as number, duration: 0.06, ease: 'power4.out' },
            at,
          );
          tl.call(
            () => setBlockEdge(principals[i + 1] as THREE.Group, '#4da3ff', 1),
            undefined,
            at + 0.05,
          );
        });

        // EXECUTE — something travels the path that was just built, in order.
        pulses.forEach((pulse, i) => {
          const from = ROW[i] ?? 0;
          const to = ROW[i + 1] ?? 0;
          const at = 0.64 + i * 0.1;
          tl.set(pulse, { visible: true }, at);
          tl.fromTo(
            pulse.position,
            { x: from, y: 0, z: 0.16 },
            { x: to, duration: 0.08, ease: 'none' },
            at,
          );
          tl.set(pulse, { visible: false }, at + 0.08);
          tl.call(
            () => setBlockEdge(principals[i + 1] as THREE.Group, '#3ecf8e', 1),
            undefined,
            at + 0.08,
          );
        });

        // SETTLE — the camera steps back and the system holds still. The one place the scene
        // is allowed to stop moving before the scroll does.
        tl.to(camera.position, { z: desktop ? 9.4 : 12, duration: 0.14, ease: 'power2.out' }, 0.84);
        tl.to(root.rotation, { y: 0.16, duration: 0.16, ease: 'power2.out' }, 0.84);

        return () => {
          // Reverting the media query tears this branch down without touching the stage, so
          // crossing the breakpoint rebuilds the composition instead of leaving two of them.
          stage.scene.remove(root);
        };
      });
    },
    { fov: 32, cameraZ: 11 },
  );

  // The copy is on its own scroll-driven timeline rather than the 3D one, because it has to
  // work identically whether or not a stage ever mounted.
  const textRef = useScrollScene<HTMLDivElement>((ctx) => {
    const { gsap } = ctx;
    const eyebrow = ctx.root.querySelector(sel(styles.eyebrow));
    const words = gsap.utils.toArray<HTMLElement>(sel(styles.word), ctx.root);
    const lead = ctx.root.querySelector(sel(styles.lead));

    gsap.set(words, { yPercent: 110 });
    gsap.set(lead, { autoAlpha: 0, y: 14 });

    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: ctx.root.closest('section') ?? ctx.root,
          start: 'top top',
          // The same distance the 3D timeline above asks for, for the same reason, so the copy
          // and the composition are reading from one clock.
          end: () => `+=${Math.round(window.innerHeight * 3.2)}`,
          scrub: 1,
        },
      })
      .to(eyebrow, { autoAlpha: 1, duration: 0.06 }, 0.04)
      // The words arrive with the parts, not before them: the sentence is a consequence of the
      // structure finding its shape, which is the one thing this scene is trying to say.
      .to(words, { yPercent: 0, stagger: 0.03, duration: 0.1, ease: 'power3.out' }, 0.3)
      .to(lead, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.46);
  });

  return (
    <section className={styles.scene} aria-label={COPY.label} data-scene="assembly">
      <div className={styles.pin} data-pin>
        <div ref={stageRef} className={styles.stage3d} />

        <div ref={textRef} className={styles.copy}>
          <span className={styles.eyebrow} data-animate>
            {COPY.index} — {COPY.eyebrow}
          </span>
          <h1 className={styles.headline}>
            {/* The space lives outside the mask: inside an `inline-block` with
                `overflow: hidden` a trailing space is clipped and the sentence arrives as one
                word. Keyed by word *and* position, because a translated sentence is free to
                repeat a word where the English one does not. */}
            {words.map((word, i) => (
              // A fixed sentence from a copy table, never reordered, so the position is a stable
              // identity — and it has to be part of the key, because a translation is free to
              // repeat a word where the English does not.
              // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered copy.
              <span key={`${word}-${i}`}>
                <span className={styles.mask}>
                  <span className={styles.word} data-animate>
                    {word}
                  </span>
                </span>{' '}
              </span>
            ))}
          </h1>
          <p className={styles.lead} data-animate>
            {COPY.sub}
          </p>
        </div>

        {/* Always rendered, always true, and stood down by CSS only once a stage exists. */}
        <div className={styles.flat}>
          <GraphFlow steps={FLOW} dense />
        </div>
      </div>
    </section>
  );
}
