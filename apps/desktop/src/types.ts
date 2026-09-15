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
