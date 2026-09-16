import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ipc } from '../src/ipc';
import { useEditor } from '../src/store';
import type { FilePurpose, FolderPurpose, OpenProject } from '../src/types';

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
  /**
   * Anything that opens the folder chooser, however it reaches `choose_folder`.
   *
   * `ipc.pickFolder` is the bare call; `chooseFolder` and `chooseFolderOrExplain` in
   * `chooser.ts` wrap it so that a refusal becomes a sentence somebody can read rather than an
   * unhandled rejection. All three take the purpose as their first argument, so one pattern
   * finds every one of them — and a new wrapper that quietly dropped the purpose would show up
   * as a call with nothing to match.
   */
  const OPENS_A_CHOOSER = /(?:ipc\.pickFolder|chooseFolderOrExplain|chooseFolder)\(([^,)]*)/g;

  /** Each file that opens the chooser, and the purposes its flows may ask for. */
  const CALLERS: { file: string; purposes: FolderPurpose[]; why: string }[] = [
    {
      file: 'apps/desktop/src/store.ts',
      purposes: ['import-from', 'grant-to-component'],
      why: 'beginImport reads a publication out of a folder, and chooseConfigFolder makes one a grant',
    },
    {
      file: 'apps/desktop/src/panels/Publish.tsx',
      purposes: ['publish-into'],
      why: 'prepare writes a publication into the folder',
    },
    {
      file: 'apps/desktop/src/views/Settings.tsx',
      purposes: ['projects-location'],
      why: 'it is a preference and gates nothing',
    },
  ];

  it.each(CALLERS)('$file asks for $purposes — $why', ({ file, purposes }) => {
    const source = read(file);
    const calls = [...source.matchAll(OPENS_A_CHOOSER)].map((m) => m[1].trim());

    expect(calls.length, `${file} should open the folder chooser`).toBeGreaterThan(0);
    const allowed = purposes.map((purpose) => `'${purpose}'`);
    for (const argument of calls) {
      expect(argument, `${file} must name a purpose, not open a bare chooser`).not.toBe('');
      expect(allowed, `${file} named ${argument}`).toContain(argument);
    }
    // Every purpose claimed above is actually asked for, so an entry cannot go stale by being
    // widened and then never used.
    for (const purpose of allowed) expect(calls).toContain(purpose);
  });

  it('is the whole list — no other file opens the chooser without being named here', () => {
    // A fifth call site added without a purpose decision is the failure this catches. The
    // search is over the editor's own source; `ipc.ts` declares and implements the method and
    // `chooser.ts` wraps it — both are where the callers above end up, not callers themselves.
    // The Inspector reaches the chooser through the store (`chooseConfigFolder`), which is what
    // gives its refusals somewhere to be shown, so it names no purpose of its own.
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
      const source = read(file);
      expect(
        [...source.matchAll(OPENS_A_CHOOSER)],
        `${file} opens the folder chooser and is not in CALLERS`,
      ).toEqual([]);
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

/**
 * The file a run is seeded with.
 *
 * `inputs[].path` was the last path the WebView named freely: the runtime canonicalised it and
 * imported the file into the run's scratch folder, where the step wired to that port read it.
 * The chooser now runs on the privileged side, which is the half that matters; this is the
 * editor's half — that nothing here can put a path into an input except that chooser, and that
 * opening a project cannot arrive with one already filled in.
 */
describe('the file an input is given', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditor.setState({ inputs: [], projectPath: null, dirty: false, message: null });
  });

  it('is chosen through the runtime, not through the dialog plugin', () => {
    const source = read('apps/desktop/src/ipc.ts');
    const tauri = source.slice(
      source.indexOf('class TauriIpc'),
      source.indexOf('class PreviewIpc'),
    );
    const body = tauri.slice(tauri.indexOf('async pickFile'));
    const implementation = body.slice(0, body.indexOf('\n  }'));

    expect(implementation).toContain("invoke<string | null>('choose_file'");
    // The plugin is still right for the two `.encastra` choosers, and wrong for this one: a path
    // it produced is a string this side made up, which is exactly what the record exists to tell
    // apart from a path the operating system handed over.
    expect(implementation).not.toContain('plugin-dialog');
  });

  it('names the purpose the Rust enum accepts', () => {
    const purpose: FilePurpose = 'run-input';
    const lib = read('apps/desktop/src-tauri/src/lib.rs');
    const block = lib.match(/enum FilePurpose \{([\s\S]*?)\n\}/);
    expect(block, 'lib.rs should declare an enum FilePurpose').toBeTruthy();

    const variants = [...(block?.[1] ?? '').matchAll(/^\s{4}([A-Z][A-Za-z]*),$/gm)].map((m) =>
      m[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
    );

    expect(variants).toEqual([purpose]);
    expect(read('apps/desktop/src/ipc.ts')).toContain(`const purpose: FilePurpose = '${purpose}'`);
  });

  it('reaches the store only through setInput, and only from the chooser', () => {
    // `setInput` is the single door. If a second place started writing into `inputs`, a path
    // could arrive without a chooser having been opened — and while the runtime would refuse
    // it, the person would be shown a filled-in field for a file that cannot be read.
    //
    // The button now calls a store method rather than the chooser directly, because
    // `choose_file` can *refuse* the file it was handed and a rejection in an `onClick` is a
    // button that silently does nothing. The door is still one door; it moved by one file.
    const inspector = read('apps/desktop/src/panels/Inspector.tsx');
    expect(inspector).toContain('onClick={() => void chooseEntryInput(nodeId, port)}');
    expect(inspector).not.toContain('ipc.pickFile(');

    const store = read('apps/desktop/src/store.ts');
    expect(store).toContain('const choice = await chooseFile();');
    expect(store).toContain("if (choice.outcome === 'chosen') get().setInput(nodeId, port, choice");
    // One assignment that adds to `inputs`; every other mention clears it or reads it.
    const additions = [...store.matchAll(/\.\.\.s\.inputs\.filter\(/g)];
    expect(additions).toHaveLength(1);
  });

  it('is cleared when a project is opened, so a file cannot arrive pre-chosen', async () => {
    // A `.encastra` holds a manifest, a graph, a lockfile, variables and history — no inputs.
    // The editor clears them anyway on open, and that is what this pins: a path left over from
    // the previous project would be shown against a graph it has nothing to do with, and the
    // person would press Run on a file they picked for something else.
    const opened: OpenProject = {
      name: 'Thumbnails',
      path: 'C:\\work\\thumbnails.encastra',
      graph: { nodes: {}, edges: [] },
      history: { snapshots: [] },
      missing: [],
    };
    vi.spyOn(ipc, 'pickProjectToOpen').mockResolvedValue(opened.path);
    vi.spyOn(ipc, 'openProject').mockResolvedValue(opened);

    useEditor.setState({
      dirty: false,
      inputs: [{ node: 'read', port: 'file', path: 'C:\\work\\private.csv' }],
    });
    await useEditor.getState().openProject();

    expect(useEditor.getState().projectPath).toBe(opened.path);
    expect(useEditor.getState().inputs).toEqual([]);
  });
});
