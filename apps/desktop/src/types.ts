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
