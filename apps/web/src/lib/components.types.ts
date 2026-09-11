/**
 * The shape of a component record as the website consumes it.
 *
 * `components.data.ts` is generated from the Rust manifests and conforms to this. Keeping the
 * type here rather than in the generated file means the generator only ever emits data.
 */

/** Type names come from `packages/protocol/data/type-graph.json`. */
export type TypeName =
  | 'bool'
  | 'i64'
  | 'f64'
  | 'string'
  | 'json'
  | 'file'
  | 'dir'
  | 'bytes'
  | 'image'
  | 'video'
  | 'audio';

export interface PortRecord {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly required?: boolean;
}

export interface ConfigRecord {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly required: boolean;
  readonly doc: string | null;
}

export interface CapabilityRecord {
  readonly kind: string;
  readonly scope: string;
  readonly reason: string;
}

export interface ComponentRecord {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  /** Triggers carry a manifest but do not run as a step — they start a session. */
  readonly isTrigger: boolean;
  readonly inputs: readonly PortRecord[];
  readonly outputs: readonly PortRecord[];
  readonly config: readonly ConfigRecord[];
  readonly capabilities: readonly CapabilityRecord[];
  readonly platforms: readonly string[];
  readonly sourceFile: string;
}
