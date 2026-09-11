/**
 * Generates `src/lib/components.data.ts` from the real component manifests.
 *
 * The website must never state a component that does not exist, a port that is not there, or a
 * capability a component does not declare. The only way to guarantee that is to read the
 * manifests rather than retype them: they live as JSON literals inside
 * `crates/encastra-builtins/src/*.rs`, parsed at start-up by the real validator.
 *
 * Run from the repository root or from apps/web:
 *
 *   node apps/web/scripts/generate-components.mjs
 *
 * The output is committed so that a build of the website never needs the Rust tree. Re-run it
 * whenever a component is added, removed, or has its manifest changed.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');
const srcDir = join(repoRoot, 'crates', 'encastra-builtins', 'src');
const outFile = resolve(here, '..', 'src', 'lib', 'components.data.ts');

/** Pulls every `r#"{ ... }"#` raw string out of a Rust file and keeps the ones that parse. */
function manifestsIn(rust) {
  const found = [];
  const pattern = /r#"(\{[\s\S]*?\})"#/g;
  let match = pattern.exec(rust);
  while (match !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.id && parsed.ports) found.push(parsed);
    } catch {
      // Not a manifest — the builtins also embed schema fragments and test fixtures.
    }
    match = pattern.exec(rust);
  }
  return found;
}

const files = readdirSync(srcDir)
  .filter((f) => f.endsWith('.rs'))
  .sort();
const manifests = [];
for (const file of files) {
  for (const m of manifestsIn(readFileSync(join(srcDir, file), 'utf8'))) {
    manifests.push({ ...m, sourceFile: `crates/encastra-builtins/src/${file}` });
  }
}

if (manifests.length === 0) {
  throw new Error('No manifests found — the extraction pattern no longer matches the source.');
}

/**
 * Triggers carry a manifest so the editor lists them beside everything else, but they have no
 * implementation in the component set because they do not run as a step — `lib.rs` registers
 * them through `TriggerSet`. The manifest says so itself with `"trigger": true`, which is read
 * here rather than kept as a second list that could fall out of step with the source.
 */
const shaped = manifests
  .map((m) => ({
    id: m.id,
    version: m.version,
    name: m.name,
    description: m.description,
    category: m.category,
    isTrigger: m.trigger === true,
    inputs: Object.entries(m.ports.inputs ?? {}).map(([key, p]) => ({
      key,
      label: p.label ?? key,
      type: p.type,
      required: p.required === true,
    })),
    outputs: Object.entries(m.ports.outputs ?? {}).map(([key, p]) => ({
      key,
      label: p.label ?? key,
      type: p.type,
    })),
    config: Object.entries(m.config ?? {}).map(([key, c]) => ({
      key,
      label: c.label ?? key,
      type: c.type,
      required: c.required === true,
      doc: c.doc ?? null,
    })),
    capabilities: (m.capabilities ?? []).map((c) => ({
      kind: c.kind,
      scope: c.scope,
      reason: c.reason,
    })),
    platforms: m.platforms ?? [],
    sourceFile: m.sourceFile,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const componentCount = shaped.filter((c) => !c.isTrigger).length;
const triggerCount = shaped.filter((c) => c.isTrigger).length;

const banner = `/**
 * GENERATED — do not edit by hand.
 *
 * Source: crates/encastra-builtins/src/*.rs (the manifests the runtime actually parses).
 * Regenerate: node apps/web/scripts/generate-components.mjs
 *
 * ${componentCount} components + ${triggerCount} triggers, counted from the manifests.
 */

import type { ComponentRecord } from './components.types';

export const COMPONENT_COUNT = ${componentCount};
export const TRIGGER_COUNT = ${triggerCount};

export const COMPONENTS: readonly ComponentRecord[] = ${JSON.stringify(shaped, null, 2)} as const;
`;

// Emitted as plain JSON, then handed to Biome. Rewriting quotes here with a regular expression
// would corrupt any description containing an apostrophe, and several of them do.
writeFileSync(outFile, banner, 'utf8');

process.stdout.write(
  `wrote ${outFile}\n${componentCount} components + ${triggerCount} triggers\n` +
    'now run: npx biome check --write apps/web/src/lib/components.data.ts\n',
);
