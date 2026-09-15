import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The IPC surface is what an agent driving the editor through the WebView2 debugging port can
 * call (`docs/security/AI-AGENT-SURFACE.md` §2). Until now the list of commands in
 * `generate_handler!` and the gate table in `docs/DESKTOP.md` were kept in step by hand, and
 * "kept in step by hand" is how a command ships with no line saying what gates it.
 *
 * So this reads the one list the runtime registers and holds two other places to it: every
 * command must be named in `docs/DESKTOP.md`, and every command must be invoked from `ipc.ts`
 * (a command nobody calls is surface with no purpose — either remove it or say why). It does
 * not check what the documentation says, only that it says something; the gate table's
 * contents are reviewed, not parsed.
 */
const ROOT = join(__dirname, '..', '..', '..');
const read = (relative: string): string => readFileSync(join(ROOT, relative), 'utf8');

function registeredCommands(): string[] {
  const source = read('apps/desktop/src-tauri/src/lib.rs');
  const match = source.match(/generate_handler!\[([^\]]*)\]/);
  if (!match) throw new Error('generate_handler! not found in lib.rs');
  return match[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

describe('the IPC surface is documented and used', () => {
  const commands = registeredCommands();

  it('registers the commands this build is known to have', () => {
    // A number, on purpose: a command added or removed changes the attack surface, and the
    // change should be a deliberate edit here beside the documentation edit, not a drift.
    expect(commands.length).toBe(22);
    expect(new Set(commands).size).toBe(commands.length);
  });

  it('names every command in docs/DESKTOP.md', () => {
    const doc = read('docs/DESKTOP.md');
    const undocumented = commands.filter((name) => !doc.includes(`\`${name}\``));
    expect(undocumented).toEqual([]);
  });

  it('invokes every command from ipc.ts, and nothing that is not registered', () => {
    const ipc = read('apps/desktop/src/ipc.ts');
    const invoked = [...ipc.matchAll(/invoke<[^>]*>\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
    const registered = new Set(commands);
    // Two commands exist for tooling and for the conformance story rather than for the editor,
    // and docs/DESKTOP.md says so beside each. Anything else the editor does not call is
    // surface without a caller, and this list is where the exception has to be written down.
    const notCalledByTheEditor = ['type_graph', 'workflow_status'];
    const doc = read('docs/DESKTOP.md');
    for (const name of notCalledByTheEditor) {
      expect(doc.includes(`\`${name}\``), `${name} must be documented`).toBe(true);
    }
    const uncalled = commands.filter(
      (name) => !invoked.includes(name) && !notCalledByTheEditor.includes(name),
    );
    expect(uncalled).toEqual([]);
    expect(invoked.filter((name) => !registered.has(name))).toEqual([]);
  });
});
