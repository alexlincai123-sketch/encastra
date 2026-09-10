/**
 * The only place the editor talks to the runtime.
 *
 * Two implementations. The desktop one calls Tauri. The browser one exists so the interface
 * can be built and looked at in an ordinary browser — and it is **not a second runtime**. It
 * serves recordings: `fixtures/components.json` is what the real runtime reports, and the run
 * fixtures are journals the real engine produced, captured with `encastra run --json`.
 *
 * The browser implementation refuses to invent a validation or a run for a graph it has not
 * seen. A UI harness that quietly simulated the engine would be the most dangerous kind of
 * drift: it would look right, and it would be lying about the one thing this product sells.
 */

import componentsFixture from './fixtures/components.json';
import exampleRunFixture from './fixtures/example-run.json';
import deniedRunFixture from './fixtures/example-run-denied.json';
import type {
  ComponentManifest,
  EncastraGraph,
  GrantSpec,
  InputSpec,
  OpenProject,
  RunJournal,
  RunResult,
  Validation,
} from './types';

export interface Ipc {
  /** Whether a real runtime is behind this. The UI tells the user when there is not. */
  readonly live: boolean;
  listComponents(): Promise<ComponentManifest[]>;
  validateGraph(graph: EncastraGraph, inputs: InputSpec[]): Promise<Validation>;
  runGraph(graph: EncastraGraph, inputs: InputSpec[], grants: GrantSpec[]): Promise<RunResult>;
  pickFile(): Promise<string | null>;
  pickFolder(): Promise<string | null>;
  pickProjectToOpen(): Promise<string | null>;
  pickProjectToSave(suggested: string): Promise<string | null>;
  saveProject(
    path: string,
    name: string,
    graph: EncastraGraph,
    label?: string,
  ): Promise<OpenProject>;
  openProject(path: string): Promise<OpenProject>;
  restoreVersion(path: string, snapshot: string): Promise<OpenProject>;
  compareVersions(path: string, from: string, to: string): Promise<string[]>;
}

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

class TauriIpc implements Ipc {
  readonly live = true;

  private async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }

  listComponents(): Promise<ComponentManifest[]> {
    return this.invoke<ComponentManifest[]>('list_components');
  }

  validateGraph(graph: EncastraGraph, inputs: InputSpec[]): Promise<Validation> {
    return this.invoke<Validation>('validate_graph', { graph, inputs });
  }

  runGraph(graph: EncastraGraph, inputs: InputSpec[], grants: GrantSpec[]): Promise<RunResult> {
    return this.invoke<RunResult>('run_graph', { graph, inputs, grants });
  }

  async pickFile(): Promise<string | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const chosen = await open({ multiple: false, directory: false });
    return typeof chosen === 'string' ? chosen : null;
  }

  async pickFolder(): Promise<string | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const chosen = await open({ multiple: false, directory: true });
    return typeof chosen === 'string' ? chosen : null;
  }

  async pickProjectToOpen(): Promise<string | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const chosen = await open({
      multiple: false,
      filters: [{ name: 'Encastra project', extensions: ['encastra'] }],
    });
    return typeof chosen === 'string' ? chosen : null;
  }

  async pickProjectToSave(suggested: string): Promise<string | null> {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const chosen = await save({
      defaultPath: `${suggested}.encastra`,
      filters: [{ name: 'Encastra project', extensions: ['encastra'] }],
    });
    return typeof chosen === 'string' ? chosen : null;
  }

  saveProject(
    path: string,
    name: string,
    graph: EncastraGraph,
    label?: string,
  ): Promise<OpenProject> {
    return this.invoke<OpenProject>('save_project', { path, name, graph, label });
  }

  openProject(path: string): Promise<OpenProject> {
    return this.invoke<OpenProject>('open_project', { path });
  }

  restoreVersion(path: string, snapshot: string): Promise<OpenProject> {
    return this.invoke<OpenProject>('restore_version', { path, snapshot });
  }

  compareVersions(path: string, from: string, to: string): Promise<string[]> {
    return this.invoke<string[]>('compare_versions', { path, from, to });
  }
}

/** Thrown when the preview is asked for something only the real runtime can answer. */
export class PreviewOnlyError extends Error {
  constructor(what: string) {
    super(
      `${what} needs the Encastra runtime, which is not running in a browser. ` +
        'Open the desktop app to run a graph.',
    );
    this.name = 'PreviewOnlyError';
  }
}

class PreviewIpc implements Ipc {
  readonly live = false;

  async listComponents(): Promise<ComponentManifest[]> {
    return componentsFixture as unknown as ComponentManifest[];
  }

  async validateGraph(): Promise<Validation> {
    throw new PreviewOnlyError('Checking a graph');
  }

  async runGraph(): Promise<RunResult> {
    throw new PreviewOnlyError('Running a graph');
  }

  async pickFile(): Promise<string | null> {
    throw new PreviewOnlyError('Choosing a file');
  }

  async pickFolder(): Promise<string | null> {
    throw new PreviewOnlyError('Choosing a folder');
  }

  async pickProjectToOpen(): Promise<string | null> {
    throw new PreviewOnlyError('Opening a project');
  }

  async pickProjectToSave(): Promise<string | null> {
    throw new PreviewOnlyError('Saving a project');
  }

  async saveProject(): Promise<OpenProject> {
    throw new PreviewOnlyError('Saving a project');
  }

  async openProject(): Promise<OpenProject> {
    throw new PreviewOnlyError('Opening a project');
  }

  async restoreVersion(): Promise<OpenProject> {
    throw new PreviewOnlyError('Restoring a version');
  }

  async compareVersions(): Promise<string[]> {
    throw new PreviewOnlyError('Comparing versions');
  }
}

export const ipc: Ipc = inTauri() ? new TauriIpc() : new PreviewIpc();

/**
 * Journals the real engine produced, for looking at the debugger without a runtime.
 *
 * They are labelled as recordings wherever they are shown. Presenting a recording as a live
 * result would be exactly the "demo dressed as a product" this project is meant not to be.
 */
export const recordedRuns: { readonly label: string; readonly journal: RunJournal }[] = [
  {
    label: 'Recorded: everything allowed',
    journal: exampleRunFixture as unknown as RunJournal,
  },
  {
    label: 'Recorded: the folder was not allowed',
    journal: deniedRunFixture as unknown as RunJournal,
  },
];
