/**
 * The shapes the runtime sends over IPC.
 *
 * These are written by hand today, which is a known duplication: the authority is the Rust
 * struct, and nothing yet stops these from drifting away from it. Two things keep it honest
 * for now — the browser-preview fixtures are real serialised output from the runtime, so a
 * wrong shape here shows up as a broken panel rather than a silent mismatch, and the surface
 * is small.
 *
 * When it grows, generate this file from the Rust types (`ts-rs`) rather than maintaining it.
 * See docs/PRODUCT-ROADMAP.md.
 */

export type CoercionKind = 'direct' | 'implicit' | 'explicit';

export interface Port {
  type: string;
  required?: boolean;
  label?: string;
  doc?: string;
}

export interface ConfigField {
  type: string;
  label?: string;
  doc?: string;
  required?: boolean;
  min?: number;
  max?: number;
  choices?: string[];
  default?: unknown;
}

export interface Capability {
  kind: string;
  scope: string;
  reason: string;
}

export interface ComponentManifest {
  schema: number;
  id: string;
  version: string;
  name: string;
  description?: string;
  category?: string;
  runtime: string;
  kind: 'core' | 'wasm';
  /** A source of events rather than a step: it starts the workflow instead of running in it. */
  trigger?: boolean;
  ports: {
    inputs: Record<string, Port>;
    outputs: Record<string, Port>;
  };
  config: Record<string, ConfigField>;
  capabilities: Capability[];
  platforms: string[];
  retryable: boolean;
}

export interface PortRef {
  node: string;
  port: string;
}

export type IssueLocation =
  | { kind: 'graph' }
  | { kind: 'node'; 0: string }
  | { kind: 'port'; 0: PortRef }
  | { kind: 'edge'; from: PortRef; to: PortRef };

export interface Issue {
  severity: 'error' | 'warning';
  location: IssueLocation;
  message: string;
  hint?: string;
}

export interface Validation {
  issues: Issue[];
  order: string[];
  conversions: { from: PortRef; to: PortRef; ops: string[] }[];
}

export type NodeStatus =
  | 'pending'
  | 'running'
  | 'ok'
  | 'failed'
  | 'skipped'
  | 'cancelled'
  | 'disabled';

export type RunStatus = 'running' | 'ok' | 'partial' | 'failed' | 'cancelled';

export interface CapabilityCall {
  at_ms: number;
  kind: string;
  detail: string;
  allowed: boolean;
  denied_because?: string;
}

export interface LogLine {
  at_ms: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface NodeError {
  code: string;
  message: string;
  hint?: string;
  retryable: boolean;
}

export interface NodeRecord {
  component: string;
  status: NodeStatus;
  started_at_ms?: number;
  duration_ms?: number;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  capability_calls: CapabilityCall[];
  logs: LogLine[];
  error?: NodeError;
  skipped_because?: string;
}

export interface RunJournal {
  run_id: string;
  started_at_ms: number;
  finished_at_ms?: number;
  status: RunStatus;
  nodes: Record<string, NodeRecord>;
  order: string[];
}

export type RunResult =
  | { outcome: 'invalid'; validation: Validation }
  | { outcome: 'ran'; journal: RunJournal };

/** What the editor sends the runtime. Mirrors `encastra_core::graph::Graph`. */
export interface GraphNode {
  component: string;
  label?: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  disabled?: boolean;
}

export interface GraphEdge {
  from: PortRef;
  to: PortRef;
}

export interface EncastraGraph {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}

/** A value the application supplies for an input nothing in the graph produces. */
export interface InputSpec {
  node: string;
  port: string;
  path: string;
}

/** A decision the user made in the consent dialog, for one run. */
export interface GrantSpec {
  node: string;
  kind: string;
  folder?: string;
  hosts?: string[];
}

/**
 * What a folder is being chosen *for*.
 *
 * Consent is per question. The runtime records the folder somebody picked together with the
 * purpose the chooser was opened to serve, and each command checks the pair for its own
 * purpose — so a folder picked to import a publication from is not also a folder a component
 * may write into, which is what it used to be.
 *
 * These four strings are the wire form of `FolderPurpose` in `apps/desktop/src-tauri/src/lib.rs`;
 * `test/consent.test.ts` asserts the two lists are the same list. A string that is not one of
 * them fails to deserialise on the Rust side, so there is nothing to gain by inventing one.
 */
export type FolderPurpose =
  /** Where `prepare_publication` may write a publication. */
  | 'publish-into'
  /** Where `inspect_publication` and `import_publication` may read one from. */
  | 'import-from'
  /** A folder a step in the workflow may be given, via a grant on a run. */
  | 'grant-to-component'
  /** The Settings preference for where this person keeps their projects. */
  | 'projects-location';

/**
 * What a *file* is being chosen for.
 *
 * One member, because a file reaches the runtime in exactly one way: as the value of a graph
 * input that nothing upstream produces. `choose_file` records what the native chooser returned,
 * and `run_graph` / `start_workflow` seed an input from a path in that record and from nothing
 * else — so a path stored in a project, or named by a renderer that has been through a debugger,
 * is displayed and not read.
 *
 * The wire form of `FilePurpose` in `apps/desktop/src-tauri/src/lib.rs`.
 */
export type FilePurpose = 'run-input';

export interface Snapshot {
  id: string;
  parent?: string;
  created_at_ms: number;
  label?: string;
  message?: string;
  graph_hash: string;
  restored_from?: string;
}

export interface History {
  snapshots: Snapshot[];
}

export interface OpenProject {
  name: string;
  path: string;
  graph: EncastraGraph;
  history: History;
  /** Components the file pins that this build does not have. */
  missing: string[];
}

export interface About {
  version: string;
  /** Full commit hash the binary was built from; `<hash>-dirty` or `unknown` when it cannot say. */
  buildCommit: string;
  runtime: string;
  protocolSchema: number;
  projectSchema: number;
}

/**
 * What the runtime found when it read a saved project the way somebody receiving it would.
 *
 * Produced by the runtime, never built here. A review the interface assembled itself would be
 * a review nobody ran.
 */
export interface PublicationFinding {
  code: string;
  severity: 'note' | 'warning' | 'blocking';
  title: string;
  detail: string;
  /** What would change the answer. Always present. */
  remedy: string;
  at?: string;
}

export interface PublicationReview {
  outcome: 'may-publish' | { refused: { blocking: number } };
  findings: PublicationFinding[];
  /** Every permission this would ask of whoever installs it, gathered from the components. */
  capabilities: string[];
}

/** What a person fills in. Mirrors `PublicationDraft` in `crates/encastra-publish`. */
export interface PublicationDraft {
  listing_id: string;
  kind: 'project' | 'template';
  version: string;
  title: string;
  summary: string;
  categories: string[];
  tags: string[];
  license: { id: string; name?: string };
  pricing: { kind: 'free' } | { kind: 'paid'; amount_minor: number; currency: string };
  changelog?: string;
}

/**
 * Who is offering it.
 *
 * `verified` is false here and cannot be anything else: there are no accounts, so nobody has
 * checked that this name belongs to whoever typed it.
 */
export interface Publisher {
  id: string;
  display_name: string;
  bio?: string;
  verified: boolean;
}

export interface PublicationBundle {
  draft: PublicationDraft;
  publisher: string;
  checksum: string;
  size_bytes: number;
  capabilities: string[];
  runtime: string;
  prepared_at_ms: number;
}

/** What preparing one left on disk. Nothing was uploaded; there is nowhere to upload to. */
export interface Prepared {
  bundle: PublicationBundle;
  folder: string;
}

/**
 * What kinds of thing a publication can be. Mirrors `Kind` in `crates/encastra-publish`.
 *
 * Wider than `PublicationDraft['kind']` on purpose: this build only offers to publish a project
 * or a template, and it has to be able to *read* a document that says `component` in order to
 * refuse it by name rather than by a shrug.
 */
export type PublicationKind = 'project' | 'template' | 'component';

/**
 * Everything read out of a publication folder, and nothing taken on trust.
 *
 * Mirrors `Inspected` in `crates/encastra-publish/src/import.rs`, which is `camelCase`. Holding
 * one of these means the folder passed; it does not mean anything has been written anywhere.
 *
 * `provenanceVerified` and `publisherVerified` are always false in this build, and they are
 * fields rather than omissions so that an interface has to render "no" rather than being free
 * to imply "yes" by saying nothing.
 */
export interface Inspected {
  bundle: PublicationBundle;
  /** The file name inside the folder, never a path. */
  projectFile: string;
  projectName: string;
  projectId: string;
  /** `Option<String>` in Rust, which serialises as `null` rather than being left out. */
  projectDescription: string | null;
  steps: number;
  stepsSwitchedOff: number;
  versions: number;
  /** The findings of the check run on this machine, on these bytes. */
  review: PublicationReview;
  provenanceVerified: boolean;
  publisherVerified: boolean;
}

/**
 * Why a publication could not be taken in.
 *
 * Mirrors `ImportError` in `crates/encastra-publish/src/import.rs`, which is tagged on `kind`
 * and renamed kebab-case. Matched on rather than read, so that improving an English sentence on
 * the Rust side cannot change which explanation the interface shows — and so every one of them
 * can have a sentence of its own in six languages. `library.ts` holds that mapping.
 */
export type ImportError =
  | { kind: 'not-a-folder' }
  | { kind: 'folder-is-a-link' }
  | { kind: 'folder-not-chosen' }
  | { kind: 'no-document' }
  | { kind: 'document-is-a-link' }
  | { kind: 'document-too-large'; size: number; max: number }
  | { kind: 'document-unreadable'; reason: string }
  | { kind: 'no-project' }
  | { kind: 'more-than-one-project'; names: string[] }
  | { kind: 'project-is-a-link' }
  | { kind: 'unexpected-entries'; names: string[] }
  | { kind: 'too-many-entries'; max: number }
  | { kind: 'project-too-large'; size: number; max: number }
  | { kind: 'checksum-mismatch' }
  | { kind: 'project-unreadable'; reason: string }
  // Named `publicationKind` in the JSON: the enum is tagged on `kind`, and a field called
  // `kind` would land on top of the tag that says which refusal this is.
  | { kind: 'not-installable'; publicationKind: PublicationKind }
  | { kind: 'not-a-listing-id'; id: string }
  | { kind: 'not-a-version'; version: string }
  | { kind: 'not-publishers-namespace'; listing: string; publisher: string }
  | { kind: 'text-too-long'; field: string; max: number }
  | { kind: 'text-has-control-characters'; field: string }
  | { kind: 'document-disagrees-with-project'; about: string }
  | { kind: 'runtime-incompatible'; requires: string; have: string }
  | { kind: 'review-refused'; findings: PublicationFinding[] }
  | { kind: 'capabilities-disagree'; declared: string[]; actual: string[] }
  | { kind: 'already-imported'; listing: string; version: string }
  | { kind: 'io'; reason: string };

/** Where an entry came from, which is the only thing that decides what may be done to it. */
export type LibraryOrigin = 'created' | 'imported' | 'prepared';

/** Whether what an entry names is still there, and still what it was. */
export type LibraryStatus = 'present' | 'missing' | 'changed';

/**
 * One thing somebody has. Mirrors `Entry` in `crates/encastra-library`, which is `camelCase`.
 *
 * `checksum` is integrity, not provenance: it answers "is this still what it was", and nothing
 * about who made it.
 */
export interface LibraryEntry {
  id: string;
  origin: LibraryOrigin;
  name: string;
  description: string | null;
  /** The `.encastra` file for something created or imported; the folder for one prepared. */
  path: string;
  addedAtMs: number;
  lastOpenedMs: number | null;
  modifiedAtMs: number;
  checksum: string | null;
  sizeBytes: number | null;
  steps: number;
  runtime: string;
  listingId: string | null;
  version: string | null;
  publisher: string | null;
  /** What it will ask to reach when it runs. Present for an import. */
  capabilities: string[];
}

/** An entry with the answer to "is it still there", computed at the moment it was asked. */
export interface EntryWithStatus {
  entry: LibraryEntry;
  status: LibraryStatus;
}

export interface LibraryListing {
  entries: EntryWithStatus[];
  /** The name an unreadable index was moved to. Reported once, then forgotten. */
  quarantined: string | null;
}
