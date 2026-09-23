/**
 * The one place the website is allowed to know a version number, a hash, or whether a piece of
 * the product exists.
 *
 * Nothing else in `apps/web` hardcodes any of this. If a page wants to say "not built yet", it
 * reads `STATUS` rather than deciding for itself, so a feature shipping is one edit here and
 * every surface follows.
 */

/** The release this website documents. Single module, imported everywhere. */
export const VERSION = '0.5.0-rc.5';

export const SITE = {
  name: 'Encastra',
  /**
   * A working name. `docs/BRANDING.md`: trademark registers have not been searched, so nobody
   * may state this name is legally clear. That is why no ™ or ® appears anywhere on this site.
   */
  tagline: 'Build software by assembling components.',
  description:
    'Encastra is a local-first desktop application that runs a typed graph of components. Pick components, connect them, grant permissions, press run. Everything happens on your machine.',
  /**
   * Not yet acquired — `docs/BRANDING.md` lists buying `encastra.dev` as a pre-launch step. It
   * is used only to build canonical URLs and is not linked to as if it were live elsewhere.
   */
  url: 'https://encastra.dev',
  repository: null,
} as const;

/**
 * What exists, what is in preview, and what is only a design document.
 *
 * `docs/BETA-0.2-AUDIT.md` §2 and §3, `docs/ARCHITECTURE.md` §0 and `docs/SECURITY.md` §9 are
 * the sources. Every one of these was verified against the tree, not remembered.
 */
export type BuildState = 'built' | 'preview' | 'designed' | 'planned';

/**
 * The four states a part of this product can be in.
 *
 * `planned` deliberately does not say "coming soon". Nothing here has a date, a milestone or a
 * commitment behind it, and "soon" is a promise the project has not made — the download page and
 * the homepage's availability section both say plainly that macOS and Linux are not built, and a
 * badge that quietly implied otherwise would contradict them on the same site.
 */
export const STATE_LABEL: Record<BuildState, string> = {
  built: 'Available',
  preview: 'Preview',
  designed: 'Designed, not built',
  planned: 'Not built',
};

export const STATUS = {
  desktopApp: 'built',
  runtime: 'built',
  capabilityBroker: 'built',
  typeSystem: 'built',
  projectFormat: 'built',
  cli: 'built',
  firstPartyComponents: 'built',
  windowsInstaller: 'built',
  /** Preparing a publication on your own machine. The registry it would be sent to is not built. */
  publishPreparation: 'built',
  /** Taking a publication folder in, checked again on this machine, into a local library. Nothing runs on import. */
  importFromFolder: 'built',

  macosBuild: 'planned',
  linuxBuild: 'planned',

  wasmSandbox: 'designed',
  signing: 'designed',
  updateChannel: 'designed',
  secretsKeystore: 'designed',
  perNodeLimits: 'designed',

  registry: 'planned',
  marketplace: 'planned',
  community: 'planned',
  accounts: 'planned',
  payments: 'planned',
} as const satisfies Record<string, BuildState>;

/**
 * The published build, mirroring the BUILD block in `docs/RELEASE.md`.
 *
 * These two must be edited together. The hash is only meaningful next to the exact filename it
 * was computed from, so both travel as one record — and `versionMatchesSite` says out loud
 * whether the artefact on record is the one this site is versioned at, because presenting a
 * hash from one build under another build's version number would be a lie by layout.
 */
export const RELEASE: {
  installerFilename: string;
  installerVersion: string;
  installerSize: string;
  installerSha256: string;
  binaryFilename: string;
  binarySize: string;
  binarySha256: string;
  builtOn: string;
  builtFor: string;
  commit: string;
  signed: boolean;
  installerFormat: string;
} = {
  /** Exactly as published in docs/RELEASE.md. */
  installerFilename: 'Encastra_0.5.0-rc.5_x64-setup.exe',
  installerVersion: '0.5.0-rc.5',
  installerSize: '3.5 MB',
  installerSha256: 'afaec18b217d66171a5c9c9f530d94b6e7e591ca61af18a3101733cb01674f10',
  binaryFilename: 'encastra-desktop.exe',
  binarySize: '9.4 MB',
  binarySha256: '14dc5d615676830ce34882fe663f64f56be32910047b20f3d20a65fdd1a40402',
  builtOn: '2026-09-23',
  builtFor: 'Windows X64',
  commit: '1ce8e864da3eba12043684d86f4accf51707e519',
  signed: false,
  /** Installer format. Per user, no administrator required. See docs/RELEASE.md. */
  installerFormat: 'NSIS',
} as const;

/** True when the artefact on record is the build this site is versioned at. */
export const RELEASE_MATCHES_VERSION: boolean = RELEASE.installerVersion === VERSION;

export const REQUIREMENTS = {
  windows: ['Windows 10 or 11, 64-bit (x64)', 'WebView2 runtime — already present on Windows 11'],
  disk: 'About 25 MB installed',
  network: 'None. The application does not require an internet connection to run a workflow.',
  install: 'Installs for the current user only. No administrator prompt.',
} as const;

/**
 * Documentation that genuinely exists in the repository. Nothing here is invented: each entry
 * is a file under `docs/`. The website does not host them — it says what they are and what
 * audience they were written for, which `docs/BETA-0.2-AUDIT.md` §3.2 is blunt about.
 */
export const DOCS = [
  {
    slug: 'ARCHITECTURE.md',
    title: 'Architecture',
    summary: 'How the system is built and why, including what is designed and not yet built.',
    audience: 'engineers',
  },
  {
    slug: 'SECURITY.md',
    title: 'Security',
    summary:
      'The implementation report: what each control enforces, and §9, what it does not. Not a claim that the product is secure.',
    audience: 'engineers',
  },
  {
    slug: 'THREAT-MODEL.md',
    title: 'Threat model',
    summary: 'Assets, trust boundaries, STRIDE per boundary, and what is knowingly undefended.',
    audience: 'engineers',
  },
  {
    slug: 'RUNTIME.md',
    title: 'Runtime',
    summary: 'Validation, scheduling, execution, the journal, and conversions on edges.',
    audience: 'engineers',
  },
  {
    slug: 'COMPONENT-SDK.md',
    title: 'Component SDK',
    summary:
      'The contract a third-party component would implement. Documents the contract, not a working path — the host does not exist yet.',
    audience: 'engineers',
  },
  {
    slug: 'PROJECT-FORMAT.md',
    title: 'Project format',
    summary: 'What a .encastra file contains and the guarantees it makes.',
    audience: 'engineers',
  },
  {
    slug: 'OBSERVABILITY.md',
    title: 'Observability',
    summary:
      'Nothing is collected and nothing is sent. What would be worth knowing after launch, how it would be collected without carrying anyone’s data, and what is never sent under any setting.',
    audience: 'everyone',
  },
  {
    slug: 'RELEASE.md',
    title: 'Release',
    summary: 'How a build is produced, what it contains, and what you can check about it.',
    audience: 'everyone',
  },
  {
    slug: 'TESTING.md',
    title: 'Testing',
    summary: 'What is tested, how, and which tests are the load-bearing ones.',
    audience: 'engineers',
  },
  {
    slug: 'PRODUCT-ROADMAP.md',
    title: 'Product roadmap',
    summary: 'What ships when, and a named list of what would make this fail.',
    audience: 'everyone',
  },
  {
    slug: 'THIRD-PARTY.md',
    title: 'Third-party software',
    summary:
      'Every crate compiled into the application and every npm package bundled into its interface, with licence and origin. Generated from the dependency tree; the build fails when it is stale.',
    audience: 'everyone',
  },
  {
    slug: 'security/CI_SECURITY.md',
    title: 'CI security',
    summary:
      'Two workflows, two trust levels: what pull-request CI may touch, what a release build may not, and the first real runs with what they found.',
    audience: 'engineers',
  },
  {
    slug: 'security/AI-AGENT-SURFACE.md',
    title: 'The AI-agent attack surface',
    summary:
      'What changes when the thing driving Encastra is an agent: as the user’s tool, as the author of a file, or as a reader of text. What is tested and what is not.',
    audience: 'engineers',
  },
  {
    slug: 'adr/',
    title: 'Decision records',
    summary: 'The decisions, with the alternatives that lost.',
    audience: 'engineers',
  },
] as const;
