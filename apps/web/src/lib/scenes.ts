/**
 * Copy and data for the ten homepage scenes.
 *
 * Scene components read structure and motion from here and from `lib/graph-nodes.ts` — they
 * never retype a component's name, ports or types by hand. Anything that looks like a fact about
 * the product (a component id, a type name, a coercion) is either a string this file hands to
 * `componentNode()`/`findComponent()` for `components/scenes` to resolve live, or is checked
 * against `packages/protocol/data/type-graph.json` in the comment beside it — never invented.
 */

/* -------------------------------------------------------------------------------------------
 * Scene 2 — WHAT IF: a spread of real components across every category.
 * ---------------------------------------------------------------------------------------- */

export const WHAT_IF_IDS = [
  'encastra.file.watch',
  'encastra.image.resize',
  'encastra.flow.if',
  'encastra.net.http',
  'encastra.system.notify',
  'encastra.data.csv.read',
] as const;

/* -------------------------------------------------------------------------------------------
 * Scene 3 — CONNECT: one compatible join, one the editor refuses.
 *
 * Both wires target the same input — `encastra.image.resize`'s `image` port — so the only
 * variable is what is trying to fill it.
 *
 * Compatible: `encastra.file.watch` outputs `file`. `file -> image` is listed in
 * `type-graph.json` under `coercions` as `kind: "explicit"`, `op: "decode-image"` — a real,
 * narrowing conversion the editor materialises as a step the run can fail at, not a silent same-
 * type match. This is the correction the brief calls out by name: Watch Folder does not emit an
 * image.
 *
 * Incompatible: `encastra.system.timer` outputs `count`, an `i64`. Scanning every entry in
 * `type-graph.json`'s `coercions` array, `i64` appears only as `i64 -> f64`, `i64 -> string`,
 * `i64 -> bool` (explicit) and `i64 -> json` (explicit) — there is no `i64 -> image` anywhere,
 * implicit or explicit, and `image` is not `i64`'s supertype. There is no legal edge, at all,
 * from a number to an image. The editor's real behaviour is to refuse the connection outright,
 * not fail at run time — so the wire in this scene never reaches the port.
 * ---------------------------------------------------------------------------------------- */

export const CONNECT_SOURCE_ID = 'encastra.file.watch';
export const CONNECT_TARGET_ID = 'encastra.image.resize';
export const CONNECT_REFUSED_SOURCE_ID = 'encastra.system.timer';

export const CONNECT_ACCEPTED_LABEL = 'FILE → IMAGE · decode-image';
export const CONNECT_REFUSED_LABEL = 'INT → IMAGE · no conversion exists';

/* -------------------------------------------------------------------------------------------
 * Scene 4 — BUILD: 3 -> 8 -> 20. Real component ids only, one instance each — twenty is every
 * component in the build except the second trigger, because a graph has one entry point.
 * ---------------------------------------------------------------------------------------- */

export const BUILD_STAGE_3 = [
  'encastra.file.watch',
  'encastra.image.resize',
  'encastra.file.save',
] as const;

export const BUILD_STAGE_8_ADDED = [
  'encastra.data.csv.read',
  'encastra.net.http',
  'encastra.flow.if',
  'encastra.system.notify',
  'encastra.system.clipboard',
] as const;

export const BUILD_STAGE_20_ADDED = [
  'encastra.data.csv.write',
  'encastra.data.json',
  'encastra.data.json.write',
  'encastra.file.move',
  'encastra.file.read',
  'encastra.file.rename',
  'encastra.file.write',
  'encastra.flow.delay',
  'encastra.flow.switch',
  'encastra.image.convert',
  'encastra.image.info',
  'encastra.image.thumbnail',
] as const;

/* -------------------------------------------------------------------------------------------
 * Scenes 5-7 — RUN, RESULT, REUSE: the same three-node flow named on `/templates` as
 * "Image Processor" (`WATCH -> RESIZE -> SAVE`), with the exact numbers the terminal transcript
 * in `lib/terminal-script.ts` already uses for this run, never invented separately.
 * ---------------------------------------------------------------------------------------- */

export const RUN_FLOW_IDS = [
  'encastra.file.watch',
  'encastra.image.resize',
  'encastra.file.save',
] as const;

/** The second wire in the Image Processor flow — widening, so it is silent. Paired with
    `CONNECT_ACCEPTED_LABEL` above (the first wire) everywhere this flow recurs. */
export const RUN_SECOND_WIRE_LABEL = 'IMAGE → FILE';

export const RESULT_BEFORE = { name: 'holiday.png', dims: '800×400' } as const;
export const RESULT_AFTER = { name: 'holiday-small.png', dims: '200×100' } as const;

/* -------------------------------------------------------------------------------------------
 * Scene copy. Kept in one place so a claim can be audited without opening ten component files.
 * ---------------------------------------------------------------------------------------- */

export const SCENE_COPY = {
  intro: {
    index: '01',
    eyebrow: 'Encastra',
    headline: 'SOFTWARE SHOULD NOT ALWAYS START FROM ZERO.',
    sub: 'A local-first desktop application that runs a typed graph of components. Scroll.',
  },
  whatIf: {
    index: '02',
    eyebrow: 'What if',
    headline: 'What if software could be assembled?',
    body: 'Not a metaphor for components — these are the real ones. Nineteen components and two triggers ship in this build, each doing one narrow job with named inputs, outputs and a type.',
  },
  connect: {
    index: '03',
    eyebrow: 'Connect',
    headline: 'A line means something before it means anything else',
    body: 'Draw a wire and the type system answers on the spot. A file can become an image — narrowing, and the editor shows you the conversion that could fail. A number cannot: there is no path from a count to an image, so the connection is refused, not attempted.',
  },
  build: {
    index: '04',
    eyebrow: 'Build',
    headline: 'Structure, not chaos',
    body: 'Three steps. Eight. Twenty — nearly the whole palette, wired up at once. Pull back far enough and what looked like scatter reads as a system with one way in.',
    resolve: 'It resolves into a workflow: Watch Folder → Resize Image → Save File.',
  },
  run: {
    index: '05',
    eyebrow: 'Run',
    headline: 'Nothing runs until you press run',
    body: 'Every step goes idle, then running, then done — in order, visible while it happens, the same journal the runtime writes for real.',
  },
  result: {
    index: '06',
    eyebrow: 'Result',
    headline: 'One file in, one file out',
    body: 'holiday.png at 800×400 becomes holiday-small.png at 200×100, saved into the folder you allowed. Then the workflow that made it comes apart — the run is over, not the graph.',
  },
  reuse: {
    index: '07',
    eyebrow: 'Reuse',
    headline: 'Build it once. Keep it.',
    body: 'The three steps collapse into one template — Image Processor, the same one that ships with the app. Save it. Reuse it in another project. Hand someone the .encastra file — a plain, deterministic file, not an account.',
    steps: ['Build', 'Save', 'Reuse', 'Share'],
  },
  ecosystem: {
    index: '08',
    eyebrow: 'Compose',
    headline: 'A component sits inside a workflow. A workflow sits inside a project.',
    body: 'Every project is one .encastra file — the graph, its lockfile, its variables, its version history. Nothing above the component is a separate system with its own rules; it is the same graph, one size up, each time.',
  },
  terminal: {
    index: '09',
    eyebrow: 'The same thing, typed',
    headline: 'Everything above, from a shell',
    body: 'Every component the app ships also exists as a command. This transcript is recorded, not live — the story keeps going, it just stops drawing itself and starts printing itself.',
  },
  try: {
    index: '10',
    eyebrow: 'Try it',
    headline: 'BUILD SOFTWARE LIKE SYSTEMS.',
    body: `Windows only, for now. Not code-signed — the published SHA-256 is what you have instead of a publisher's signature.`,
  },
} as const;
