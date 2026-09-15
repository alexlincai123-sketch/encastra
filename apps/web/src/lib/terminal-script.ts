/**
 * The transcript the terminal on the home page replays.
 *
 * **This is data, and it is the only thing the terminal will ever show.** The component walks
 * this array and prints it. There is no evaluator, no `eval`, no `new Function`, no server
 * round-trip, and no visitor input path — the terminal has no text field. Reviewing this file is
 * reviewing everything the terminal can output.
 *
 * The session mirrors what the CLI actually does. The command shapes come from `README.md` and
 * `docs/RELEASE.md`; the graph is the Image Processor template from `apps/desktop/src/demos.ts`;
 * the refusal wording follows `crates/encastra-core/src/broker.rs` as quoted in the README.
 *
 * **`encastra.file.watch` emits a `file`, not an `image`.** `encastra.image.resize` takes an
 * `image`, and `file → image` is listed in `packages/protocol/data/type-graph.json` as an
 * `explicit` coercion (`op: "decode-image"`, "Narrowing. Fails if the file is not a decodable
 * image.") — never `direct`. The connection is legal, but it is not the same type arriving
 * twice: the runtime probes the bytes and only then reclassifies the handle. The transcript
 * below prints `FILE → IMAGE` and names the conversion, and the simulated run shows the probe
 * happening as its own line. Writing `IMAGE → IMAGE` here would be exactly the silent-conversion
 * lie `docs/CONCEPTS.md` warns a workflow author about.
 *
 * `step` ties a line to a node in the diagram beside the terminal. When the line prints, that
 * node lights up. The terminal teaches the idea; the diagram shows where it lands.
 *
 * **This file is English in every language, deliberately.** It is not copy: it is a recording of
 * what the CLI prints, and the CLI prints English. A Spanish visitor gets the chrome around it
 * translated — the caption, the controls, the transcript's introduction for assistive technology
 * (`components/terminal/Terminal.tsx`, via `dictionaries/*.ts`'s `terminal` section) — and the
 * transcript itself exactly as the binary would emit it. Translating a command or an output line
 * would put words in the product's mouth that it never says, directly under a caption promising
 * this is a recording and not a live terminal.
 */

export type LineKind =
  | 'command' // what a person typed
  | 'output' // ordinary output
  | 'ok' // a step that finished
  | 'info' // a detail under a step
  | 'warn'
  | 'error'
  | 'blank';

export interface TerminalLine {
  readonly kind: LineKind;
  readonly text: string;
  /** How long to wait after printing this line, in milliseconds, at 1× speed. */
  readonly pause?: number;
  /** Index of the node in the diagram this line refers to. */
  readonly step?: number;
}

/** The three steps the diagram shows, in order. Indices are what `step` points at. */
export const DEMO_STEPS = ['Watch Folder', 'Resize Image', 'Save File'] as const;

export const TERMINAL_SESSION: readonly TerminalLine[] = [
  { kind: 'command', text: 'encastra new photos', pause: 420 },
  { kind: 'output', text: 'Created photos.encastra' },
  { kind: 'blank', text: '', pause: 260 },

  { kind: 'command', text: 'encastra add encastra.file.watch', pause: 380, step: 0 },
  { kind: 'ok', text: 'added  watch   Watch Folder', step: 0 },
  {
    kind: 'info',
    text: 'outputs  file: file · name: string · extension: string',
    pause: 420,
    step: 0,
  },
  { kind: 'blank', text: '' },

  { kind: 'command', text: 'encastra add encastra.image.resize', pause: 380, step: 0 },
  { kind: 'ok', text: 'added  resize  Resize Image', step: 0 },
  { kind: 'info', text: 'inputs   image: image (required)', pause: 420, step: 0 },
  { kind: 'blank', text: '' },

  { kind: 'command', text: 'encastra connect watch.file resize.image', pause: 520, step: 1 },
  { kind: 'ok', text: '✓ FILE → IMAGE  (decode-image)', step: 1 },
  {
    kind: 'info',
    text: 'explicit — narrows the file to an image; fails if it does not decode',
    pause: 620,
    step: 1,
  },
  { kind: 'blank', text: '' },

  { kind: 'command', text: 'encastra add encastra.file.save', pause: 340, step: 1 },
  { kind: 'ok', text: 'added  save    Save File', step: 1 },
  { kind: 'command', text: 'encastra connect resize.image save.file', pause: 480, step: 2 },
  { kind: 'ok', text: '✓ IMAGE → FILE', step: 2 },
  {
    kind: 'info',
    text: 'widening — an image is a file, so it fits without conversion',
    pause: 620,
    step: 2,
  },
  { kind: 'blank', text: '' },

  { kind: 'command', text: 'encastra run --watch ./inbox', pause: 520, step: 2 },
  { kind: 'error', text: 'FAIL save  (encastra.file.save@1.0.0)', step: 2 },
  {
    kind: 'error',
    text: '     denied: This component tried to use fs.write and was not allowed:',
  },
  { kind: 'error', text: '     no folder has been allowed for this node.' },
  {
    kind: 'warn',
    text: '     Grant this component access to a folder, then run again.',
    pause: 900,
    step: 2,
  },
  { kind: 'blank', text: '' },
  {
    kind: 'output',
    text: '# The refusal is the product working. Nothing was written anywhere',
  },
  { kind: 'output', text: '# nobody allowed. Say which folder, and only that folder.', pause: 700 },
  { kind: 'blank', text: '' },

  {
    kind: 'command',
    text: 'encastra run --watch ./inbox --allow-write save=./small',
    pause: 620,
    step: 2,
  },
  { kind: 'output', text: 'Watching ./inbox — press Ctrl+C to stop', pause: 900, step: 0 },
  { kind: 'blank', text: '' },
  { kind: 'info', text: 'event  holiday.png  appeared', pause: 380, step: 0 },
  { kind: 'ok', text: 'ok   watch   (encastra.file.watch@1.0.0)   2ms', step: 0 },
  { kind: 'info', text: '       -> file: holiday.png', pause: 320, step: 0 },
  { kind: 'info', text: 'convert  decode-image  file → image  (800×400)', pause: 300, step: 1 },
  { kind: 'ok', text: 'ok   resize  (encastra.image.resize@1.0.0)  38ms', step: 1 },
  { kind: 'info', text: '       -> image: 200×100', pause: 320, step: 1 },
  { kind: 'ok', text: 'ok   save    (encastra.file.save@1.0.0)     4ms', step: 2 },
  { kind: 'info', text: '       -> ./small/holiday-small.png', pause: 420, step: 2 },
  { kind: 'blank', text: '' },
  { kind: 'ok', text: 'Finished 3 steps in 44ms. Still watching.', pause: 1200, step: 2 },
];

/** Playback speeds offered by the controls. */
export const SPEEDS = [0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
