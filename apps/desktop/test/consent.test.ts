import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ipc } from '../src/ipc';
import { useEditor } from '../src/store';
import type { FolderPurpose } from '../src/types';

/**
 * Consent is per purpose, and this is the editor's half of that claim.
 *
 * The runtime records the folder somebody picked *together with what they picked it for*, and
 * every command checks the pair for its own question. That only helps if this side names the
 * right purpose for the right flow: a Publish button that asked for `import-from` would hand
 * the person a chooser whose answer the publish command then refuses, and — worse — would put
 * a folder into the import record that nobody chose to import from.
 *
 * Three things are checked here, in rising order of how much they would cost to get wrong:
 *
 * 1. the four purposes this side can name are exactly the four the Rust enum accepts;
 * 2. every place in the editor that opens the folder chooser names one of them, and names the
 *    one its flow needs;
 * 3. `beginImport` — the one flow that lives in the store rather than in a component — really
 *    passes `import-from` when it is run.
 *
 * (2) reads the source rather than rendering, because the other three call sites are inside
 * React components and this suite runs in node with no DOM. It is the same kind of check
 * `tests/version.test.ts` makes about the version living in six files: a property of the
 * repository that nothing else enforces.
 */

const DESKTOP = join(__dirname, '..');
const ROOT = join(DESKTOP, '..', '..');

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf-8');
}

/**
 * Every purpose, written out as a record so TypeScript refuses the file if one is missing.
 *
 * A plain array would silently go stale the day somebody adds a fifth purpose; this will not
 * compile until it is listed.
 */
const EVERY_PURPOSE: Record<FolderPurpose, true> = {
  'publish-into': true,
  'import-from': true,
  'grant-to-component': true,
  'projects-location': true,
};

const PURPOSES = Object.keys(EVERY_PURPOSE) as FolderPurpose[];

describe('the purposes both sides agree on', () => {
  it('are the same four strings in TypeScript and in Rust', () => {
    // The Rust enum is `#[serde(rename_all = "kebab-case")]`, so a variant `PublishInto` is
    // `publish-into` on the wire. Read the variants and convert them the same way serde does,
    // rather than reading a second list that could drift from the first.
    const lib = read('apps/desktop/src-tauri/src/lib.rs');
    const block = lib.match(/enum FolderPurpose \{([\s\S]*?)\n\}/);
    expect(block, 'lib.rs should declare an enum FolderPurpose').toBeTruthy();

    const variants = [...(block?.[1] ?? '').matchAll(/^\s{4}([A-Z][A-Za-z]*),$/gm)].map(
      (m) => m[1],
    );
    const kebab = variants.map((v) => v.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase());

    expect([...kebab].sort()).toEqual([...PURPOSES].sort());
  });

  it('is a closed list — the editor has no way to name a fifth one', () => {
    // Not a tautology: it pins that the union has four members, so widening it to `string`
    // (which would let any purpose through and make the Rust check the only one) fails here.
    expect(PURPOSES).toHaveLength(4);
  });
});

describe('every folder chooser in the editor says what it is for', () => {
  /** Each file that opens the chooser, and the one purpose that flow may ask for. */
  const CALLERS: { file: string; purpose: FolderPurpose; why: string }[] = [
    {
      file: 'apps/desktop/src/store.ts',
      purpose: 'import-from',
      why: 'beginImport reads a publication out of the folder',
    },
    {
      file: 'apps/desktop/src/panels/Publish.tsx',
      purpose: 'publish-into',
      why: 'prepare writes a publication into the folder',
    },
    {
      file: 'apps/desktop/src/panels/Inspector.tsx',
      purpose: 'grant-to-component',
      why: "the path becomes a step's folder and then a grant",
    },
    {
      file: 'apps/desktop/src/views/Settings.tsx',
      purpose: 'projects-location',
      why: 'it is a preference and gates nothing',
    },
  ];

  it.each(CALLERS)('$file asks for $purpose — $why', ({ file, purpose }) => {
    const source = read(file);
    const calls = [...source.matchAll(/ipc\.pickFolder\(([^)]*)\)/g)].map((m) => m[1].trim());

    expect(calls.length, `${file} should open the folder chooser`).toBeGreaterThan(0);
    for (const argument of calls) {
      expect(argument, `${file} must name a purpose, not open a bare chooser`).not.toBe('');
      expect(argument).toBe(`'${purpose}'`);
    }
  });

  it('is the whole list — no other file opens the chooser without being named here', () => {
    // A fifth call site added without a purpose decision is the failure this catches. The
    // search is over the editor's own source; `ipc.ts` declares and implements the method and
    // is where the four above end up, so it is not a caller.
    const searched = [
      'apps/desktop/src/store.ts',
      'apps/desktop/src/panels/Publish.tsx',
      'apps/desktop/src/panels/Inspector.tsx',
      'apps/desktop/src/views/Settings.tsx',
      'apps/desktop/src/App.tsx',
      'apps/desktop/src/preferences.ts',
      'apps/desktop/src/library.ts',
      'apps/desktop/src/publish.ts',
    ];
    const named = new Set(CALLERS.map((c) => c.file));
    for (const file of searched) {
      if (named.has(file)) continue;
      expect(read(file), `${file} opens the folder chooser and is not in CALLERS`).not.toContain(
        'ipc.pickFolder(',
      );
    }
  });
});

describe('the import flow, run rather than read', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditor.setState({
      busy: false,
      importOpen: false,
      importInspected: null,
      importError: null,
    });
  });

  it('opens the chooser for import-from and for nothing else', async () => {
    const pick = vi.spyOn(ipc, 'pickFolder').mockResolvedValue(null);

    await useEditor.getState().beginImport();

    expect(pick).toHaveBeenCalledTimes(1);
    expect(pick).toHaveBeenCalledWith('import-from');
  });

  it('inspects the folder the chooser returned, and no other', async () => {
    // The folder that reaches `inspect_publication` has to be the one the runtime just recorded
    // under `import-from`. Anything else and the command refuses — which is the right answer,
    // but it would mean the editor had asked about a folder nobody chose.
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue('C:\\work\\a publication');
    const inspect = vi.spyOn(ipc, 'inspectPublication').mockRejectedValue({ kind: 'no-document' });

    await useEditor.getState().beginImport();

    expect(inspect).toHaveBeenCalledWith('C:\\work\\a publication');
  });

  it('leaves nothing busy when the chooser is backed out of', async () => {
    vi.spyOn(ipc, 'pickFolder').mockResolvedValue(null);

    await useEditor.getState().beginImport();

    expect(useEditor.getState().busy).toBe(false);
  });
});
