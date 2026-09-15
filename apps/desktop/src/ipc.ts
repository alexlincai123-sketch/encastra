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

import type { WorkflowStatus } from './events';
import componentsFixture from './fixtures/components.json';
import exampleRunFixture from './fixtures/example-run.json';
import deniedRunFixture from './fixtures/example-run-denied.json';
import type {
  About,
  ComponentManifest,
  EncastraGraph,
  GrantSpec,
  InputSpec,
  OpenProject,
  Prepared,
  PublicationDraft,
  PublicationReview,
  Publisher,
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
  startWorkflow(
    graph: EncastraGraph,
    inputs: InputSpec[],
    grants: GrantSpec[],
  ): Promise<WorkflowStatus>;
  stopWorkflow(): Promise<void>;
  /** Reads a saved project as somebody receiving it would, and reports what it finds. */
  reviewPublication(path: string, license: PublicationDraft['license']): Promise<PublicationReview>;
  /**
   * Writes a publication into a folder, or refuses with the reason.
   *
   * The runtime reviews the project again inside this command. What the interface showed is
   * not what authorises it.
   */
  preparePublication(
    path: string,
    draft: PublicationDraft,
    publisher: Publisher,
    into: string,
  ): Promise<Prepared>;
  about(): Promise<About>;
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

  /**
   * Choosing a folder goes through the runtime, not through the dialog plugin.
   *
   * Every other chooser here opens in this process and hands the path back as a string. For a
   * folder that is not good enough: the path becomes a permission, and a string produced on this
   * side is indistinguishable from one a `.encastra` file supplied. A project written by somebody
   * else could put `C:\` in a node's configuration, the prompt would display it accurately, and
   * clicking Allow would grant the drive.
   *
   * `choose_folder` opens the chooser on the privileged side, so the runtime learns the path from
   * the operating system rather than from here, and refuses a folder grant it has no record of.
   * The editor cannot add to that record, which is the point.
   */
  async pickFolder(): Promise<string | null> {
    const chosen = await this.invoke<string | null>('choose_folder');
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

  startWorkflow(
    graph: EncastraGraph,
    inputs: InputSpec[],
    grants: GrantSpec[],
  ): Promise<WorkflowStatus> {
    return this.invoke<WorkflowStatus>('start_workflow', { graph, inputs, grants });
  }

  stopWorkflow(): Promise<void> {
    return this.invoke<void>('stop_workflow');
  }

  reviewPublication(
    path: string,
    license: PublicationDraft['license'],
  ): Promise<PublicationReview> {
    return this.invoke<PublicationReview>('review_publication', { path, license });
  }

  preparePublication(
    path: string,
    draft: PublicationDraft,
    publisher: Publisher,
    into: string,
  ): Promise<Prepared> {
    return this.invoke<Prepared>('prepare_publication', { path, draft, publisher, into });
  }

  about(): Promise<About> {
    return this.invoke<About>('about');
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

  async startWorkflow(): Promise<WorkflowStatus> {
    throw new PreviewOnlyError('Running a workflow');
  }

  async stopWorkflow(): Promise<void> {
    throw new PreviewOnlyError('Stopping a workflow');
  }

  async reviewPublication(): Promise<PublicationReview> {
    throw new PreviewOnlyError('Reviewing a project for publication');
  }

  async preparePublication(): Promise<Prepared> {
    throw new PreviewOnlyError('Preparing a publication');
  }

  async about(): Promise<About> {
    // The preview knows what it is, and says so rather than inventing a build.
    return {
      version: 'preview',
      runtime: 'not attached',
      protocolSchema: 1,
      projectSchema: 1,
    };
  }
}

export const ipc: Ipc = inTauri() ? new TauriIpc() : new PreviewIpc();

/**
 * Journals the real engine produced, for looking at the debugger without a runtime.
 *
 * They are labelled as recordings wherever they are shown. Presenting a recording as a live
 * result would be exactly the "demo dressed as a product" this project is meant not to be.
 *
 * `labelKey` rather than the label itself: this array is built once, at module load, before
 * anybody has necessarily chosen a language — see `toolbar.recordedRuns` in `i18n/locales/en.ts`.
 * `App.tsx` resolves it with `t()` at render time, the same way `demos.ts` resolves its own keys.
 */
export const recordedRuns: { readonly labelKey: string; readonly journal: RunJournal }[] = [
  {
    labelKey: 'toolbar.recordedRuns.everythingAllowed',
    journal: exampleRunFixture as unknown as RunJournal,
  },
  {
    labelKey: 'toolbar.recordedRuns.folderNotAllowed',
    journal: deniedRunFixture as unknown as RunJournal,
  },
];
