import type { Locale } from './i18n/locale';

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

/**
 * The two wire labels.
 *
 * `decode-image` is the operation's real id in `packages/protocol/data/type-graph.json` and stays
 * in every language — it is what the runtime calls the conversion, and a reader who searches for
 * it should find it. The refusal is a sentence about it rather than a name, so it translates.
 */
export const CONNECT_ACCEPTED_LABEL = 'FILE → IMAGE · decode-image';

const CONNECT_REFUSED_LABELS: Record<Locale, string> = {
  en: 'INT → IMAGE · no conversion exists',
  es: 'INT → IMAGE · no existe conversión',
};

export function connectRefusedLabel(locale: Locale): string {
  return CONNECT_REFUSED_LABELS[locale];
}

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
 *
 * Typed against an explicit `SceneCopy` interface rather than `typeof SCENE_COPY` — the usual
 * pattern for a single-language constant — because that would have made `SCENE_COPY`'s string
 * fields literal types (via the `as const` it used to carry), and `SCENE_COPY_ES` below has to
 * hold different strings in the same shape, not the same strings. The interface is the shape
 * both languages share; `as const` would have pinned the English words to it too.
 * ---------------------------------------------------------------------------------------- */

interface BodyCopy {
  readonly index: string;
  readonly eyebrow: string;
  readonly headline: string;
  readonly body: string;
}

interface IntroCopy {
  readonly index: string;
  readonly eyebrow: string;
  readonly headline: string;
  readonly sub: string;
}

/**
 * A scene that renders its own `<section>` — scenes 3 to 10, in `components/scenes/Scene0*.tsx`.
 *
 * `label` is that section's accessible name. It used to be an English literal in each component
 * (`aria-label="Connect"`), which meant a Spanish visitor got a page whose landmarks were all in
 * a language the page was not in. It is kept separate from `eyebrow` rather than reused from it
 * even where the two read the same today: the eyebrow is a line of display copy that can be
 * rewritten for rhythm, and the landmark name should not silently change with it. Scene 9's are
 * already different — "Terminal" against an eyebrow of "The same thing, typed".
 *
 * Scenes 1 and 2 (`scenes3d/SceneAssembly.tsx`) do not have one: that component is out of scope
 * for this pass and does not read this file.
 */
interface SceneSectionCopy extends BodyCopy {
  readonly label: string;
}

interface ConnectCopy extends SceneSectionCopy {
  /** The verdict under each of the two attempts. The refused one is not an error message the
      product prints — it is this page saying, in a sentence, what the editor does. */
  readonly acceptedNote: string;
  readonly refusedNote: string;
}

interface BuildCopy extends SceneSectionCopy {
  readonly resolve: string;
}

interface ResultCopy extends SceneSectionCopy {
  /** The four labelled cards of the result panel. */
  readonly modules: {
    readonly preview: string;
    readonly metadata: string;
    readonly step: string;
    readonly output: string;
  };
}

interface ReuseCopy extends SceneSectionCopy {
  readonly steps: readonly string[];
  /**
   * The note under the saved template's name. The three component names inside it stay in
   * English in both languages — they are the names the application itself shows — and only the
   * sentence around them translates.
   */
  readonly templateNote: string;
}

interface EcosystemCopy extends SceneSectionCopy {
  /** The two outer rings of the nesting diagram; the innermost is a real component's own name. */
  readonly tierProject: string;
  readonly tierWorkflow: string;
}

interface TryCopy extends SceneSectionCopy {
  readonly downloadCta: string;
  readonly docsCta: string;
}

interface SceneCopy {
  readonly intro: IntroCopy;
  readonly whatIf: BodyCopy;
  readonly connect: ConnectCopy;
  readonly build: BuildCopy;
  readonly run: SceneSectionCopy;
  readonly result: ResultCopy;
  readonly reuse: ReuseCopy;
  readonly ecosystem: EcosystemCopy;
  readonly terminal: SceneSectionCopy;
  readonly try: TryCopy;
}

export const SCENE_COPY: SceneCopy = {
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
    label: 'Connect',
    eyebrow: 'Connect',
    headline: 'A line means something before it means anything else',
    body: 'Draw a wire and the type system answers on the spot. A file can become an image — narrowing, and the editor shows you the conversion that could fail. A number cannot: there is no path from a count to an image, so the connection is refused, not attempted.',
    acceptedNote: '✓ Connected — a real, narrowing conversion',
    refusedNote: 'Refused — no path from a number to an image',
  },
  build: {
    index: '04',
    label: 'Build',
    eyebrow: 'Build',
    headline: 'Structure, not chaos',
    body: 'Three steps. Eight. Twenty — nearly the whole palette, wired up at once. Pull back far enough and what looked like scatter reads as a system with one way in.',
    resolve: 'It resolves into a workflow: Watch Folder → Resize Image → Save File.',
  },
  run: {
    index: '05',
    label: 'Run',
    eyebrow: 'Run',
    headline: 'Nothing runs until you press run',
    body: 'Every step goes idle, then running, then done — in order, visible while it happens, the same journal the runtime writes for real.',
  },
  result: {
    index: '06',
    label: 'Result',
    eyebrow: 'Result',
    headline: 'One file in, one file out',
    body: 'holiday.png at 800×400 becomes holiday-small.png at 200×100, saved into the folder you allowed. Then the workflow that made it comes apart — the run is over, not the graph.',
    modules: {
      preview: 'Preview',
      metadata: 'Metadata',
      step: 'Step',
      output: 'Output',
    },
  },
  reuse: {
    index: '07',
    label: 'Reuse',
    eyebrow: 'Reuse',
    headline: 'Build it once. Keep it.',
    body: 'The three steps collapse into one template — Image Processor, the same one that ships with the app. Save it. Reuse it in another project. Hand someone the .encastra file — a plain, deterministic file, not an account.',
    steps: ['Build', 'Save', 'Reuse', 'Share'],
    templateNote: 'Watch Folder → Resize Image → Save File, saved as one template.',
  },
  ecosystem: {
    index: '08',
    label: 'Compose',
    eyebrow: 'Compose',
    headline: 'A component sits inside a workflow. A workflow sits inside a project.',
    body: 'Every project is one .encastra file — the graph, its lockfile, its variables, its version history. Nothing above the component is a separate system with its own rules; it is the same graph, one size up, each time.',
    tierProject: 'Project · one .encastra file',
    tierWorkflow: 'Workflow',
  },
  terminal: {
    index: '09',
    label: 'Terminal',
    eyebrow: 'The same thing, typed',
    headline: 'Everything above, from a shell',
    body: 'Every component the app ships also exists as a command. This transcript is recorded, not live — the story keeps going, it just stops drawing itself and starts printing itself.',
  },
  try: {
    index: '10',
    label: 'Try it',
    eyebrow: 'Try it',
    headline: 'BUILD SOFTWARE LIKE SYSTEMS.',
    body: `Windows only, for now. Not code-signed — the published SHA-256 is what you have instead of a publisher's signature.`,
    downloadCta: 'Download the beta',
    docsCta: 'Read the documentation',
  },
};

/**
 * Spanish translation of `SCENE_COPY`, same shape, same order, same facts (component names,
 * filenames, dimensions, the SHA-256 sentence's meaning) — only the sentences around them
 * change. `test/i18n.test.ts` checks the two objects carry exactly the same keys in both
 * directions, the same way it checks `dictionaries/en.ts` against `dictionaries/es.ts`.
 *
 * `intro` and `whatIf` are translated here for completeness and because a half-translated data
 * file is worse than a whole one, but neither currently reaches the screen in Spanish: both are
 * rendered by `components/scenes3d/SceneAssembly.tsx`, which is out of scope for this pass (see
 * `HomeExperience.tsx`'s own note on why) and does not read `SCENE_COPY` at all today. Scenes 3
 * through 10, in `components/scenes/Scene0*.tsx`, do read it, via `sceneCopy()` below, and are
 * the scenes a Spanish visitor actually sees translated.
 */
const SCENE_COPY_ES: SceneCopy = {
  intro: {
    index: '01',
    eyebrow: 'Encastra',
    headline: 'EL SOFTWARE NO SIEMPRE TIENE QUE EMPEZAR DE CERO.',
    sub: 'Una aplicación de escritorio local-first que ejecuta un grafo tipado de componentes. Desplázate.',
  },
  whatIf: {
    index: '02',
    eyebrow: '¿Y si…',
    headline: '¿Y si el software se pudiera ensamblar?',
    body: 'No es una metáfora de componentes — son los reales. Esta versión incluye diecinueve componentes y dos disparadores, cada uno con una tarea concreta y con sus propias entradas, salidas y tipo.',
  },
  connect: {
    index: '03',
    label: 'Conectar',
    eyebrow: 'Conectar',
    headline: 'Una línea significa algo antes de significar cualquier otra cosa',
    body: 'Dibuja un cable y el sistema de tipos responde al instante. Un archivo puede convertirse en una imagen — una conversión que estrecha el tipo, y el editor te muestra el paso que podría fallar. Un número no puede: no existe ningún camino de un recuento a una imagen, así que la conexión se rechaza, no se intenta.',
    acceptedNote: '✓ Conectada — una conversión real que estrecha el tipo',
    refusedNote: 'Rechazada — no hay camino de un número a una imagen',
  },
  build: {
    index: '04',
    label: 'Construir',
    eyebrow: 'Construir',
    headline: 'Estructura, no caos',
    body: 'Tres pasos. Ocho. Veinte — casi toda la paleta, conectada a la vez. Aléjate lo suficiente y lo que parecía dispersión se lee como un sistema con una sola entrada.',
    resolve: 'Se resuelve en un flujo de trabajo: Watch Folder → Resize Image → Save File.',
  },
  run: {
    index: '05',
    label: 'Ejecutar',
    eyebrow: 'Ejecutar',
    headline: 'Nada se ejecuta hasta que pulsas ejecutar',
    body: 'Cada paso pasa de inactivo a en ejecución y luego a terminado — en orden, visible mientras ocurre, el mismo registro que escribe el runtime de verdad.',
  },
  result: {
    index: '06',
    label: 'Resultado',
    eyebrow: 'Resultado',
    headline: 'Un archivo entra, un archivo sale',
    body: 'holiday.png a 800×400 se convierte en holiday-small.png a 200×100, guardado en la carpeta que permitiste. Luego el flujo de trabajo que lo hizo se deshace — termina la ejecución, no el grafo.',
    modules: {
      preview: 'Vista previa',
      metadata: 'Metadatos',
      step: 'Paso',
      output: 'Salida',
    },
  },
  reuse: {
    index: '07',
    label: 'Reutilizar',
    eyebrow: 'Reutilizar',
    headline: 'Constrúyelo una vez. Consérvalo.',
    body: 'Los tres pasos se reducen a una sola plantilla — Image Processor, la misma que trae la aplicación. Guárdala. Reutilízala en otro proyecto. Pásale a alguien el archivo .encastra — un archivo plano y determinista, no una cuenta.',
    steps: ['Construir', 'Guardar', 'Reutilizar', 'Compartir'],
    templateNote: 'Watch Folder → Resize Image → Save File, guardado como una sola plantilla.',
  },
  ecosystem: {
    index: '08',
    label: 'Componer',
    eyebrow: 'Componer',
    headline:
      'Un componente vive dentro de un flujo de trabajo. Un flujo de trabajo vive dentro de un proyecto.',
    body: 'Cada proyecto es un único archivo .encastra — el grafo, su lockfile, sus variables, su historial de versiones. Nada por encima del componente es un sistema aparte con sus propias reglas; es el mismo grafo, una talla más grande, cada vez.',
    tierProject: 'Proyecto · un solo archivo .encastra',
    tierWorkflow: 'Flujo de trabajo',
  },
  terminal: {
    index: '09',
    label: 'Terminal',
    eyebrow: 'Lo mismo, pero escrito',
    headline: 'Todo lo anterior, desde una terminal',
    body: 'Cada componente que trae la aplicación también existe como comando. Esta transcripción está grabada, no es en directo — la historia continúa, solo que deja de dibujarse a sí misma y empieza a imprimirse.',
  },
  try: {
    index: '10',
    label: 'Pruébalo',
    eyebrow: 'Pruébalo',
    headline: 'CONSTRUYE SOFTWARE COMO SISTEMAS.',
    body: 'Solo Windows, por ahora. Sin firmar — el SHA-256 publicado es lo que tienes en lugar de la firma de un editor.',
    downloadCta: 'Descarga la beta',
    docsCta: 'Lee la documentación',
  },
};

/** The scene copy for a given locale — English for anything that is not Spanish. */
export function sceneCopy(locale: Locale): SceneCopy {
  return locale === 'es' ? SCENE_COPY_ES : SCENE_COPY;
}
