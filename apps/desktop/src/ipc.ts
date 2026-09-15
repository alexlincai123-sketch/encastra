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
  FilePurpose,
  FolderPurpose,
  GrantSpec,
  InputSpec,
  Inspected,
  LibraryEntry,
  LibraryListing,
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
  /**
   * Opens the native file chooser for the one question a file answers: the value of a graph
   * input.
   *
   * It takes no purpose because there is exactly one, and adding an argument nobody can vary
   * would be ceremony. A second reason to pick a file adds the argument then, the way
   * `pickFolder` has one. What matters is on the other side: the runtime records the file it
   * handed back, and `run_graph`/`start_workflow` seed an input from nothing else.
   */
  pickFile(): Promise<string | null>;
  /**
   * Opens the native folder chooser to answer one particular question.
   *
   * `purpose` is required rather than optional, so a flow that forgets to say what it is
   * choosing a folder for does not compile. The runtime records the folder against that
   * purpose and nothing else: a folder picked to import a publication from is not a folder a
   * component may be given, and the command that asks the wrong question refuses.
   */
  pickFolder(purpose: FolderPurpose): Promise<string | null>;
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
  /**
   * Reads a publication folder and reports what is in it. Writes nothing and runs nothing.
   *
   * Rejects with a serialised `ImportError` rather than an `Error` — the refusals are matched
   * on, not read, so improving a sentence on the Rust side cannot change which explanation the
   * interface shows. `isImportError` in `library.ts` is how a caller tells the two apart.
   */
  inspectPublication(folder: string): Promise<Inspected>;
  /**
   * Takes a publication in: copies the bytes that were verified into the library and records it.
   *
   * It does not open the project and it does not run it. What comes back is the entry, so the
   * interface can decide whether to offer to open it — which is a separate thing to press.
   */
  importPublication(folder: string): Promise<LibraryEntry>;
  /**
   * Tells the window whether there is unsaved work in it.
   *
   * The window is closed by the operating system, not by this code: a title-bar X, Alt+F4 or a
   * shutdown never passes through the editor at all. The only way to answer one of those with
   * "there is unsaved work here" is for the privileged side to know it already, before the
   * question is asked — so the answer is pushed there whenever it changes, rather than fetched
   * at a moment when nothing can be prevented any more.
   */
  reportDirty(dirty: boolean): Promise<void>;
  /**
   * The same arrangement for an import being written.
   *
   * A window close arrives from the operating system and has to be answered before anything can
   * be asked of the webview, so the privileged side has to know already. It is a separate
   * question from `reportDirty`: unsaved work is the person's to lose if they say so, while an
   * import half-written is this software's mess — a process that exits between the staging write
   * and the rename leaves a directory nothing accounts for.
   */
  /**
   * Closes the window, this time for good.
   *
   * Only ever called after somebody has said, in the dialog, that the unsaved work can go. The
   * runtime marks the close as already decided before it asks for it, so its own guard lets this
   * one through instead of prompting about the same work forever.
   */
  closeWindow(): Promise<void>;
  /** Everything in the library, each with the answer to whether it is still where it was. */
  libraryList(): Promise<LibraryListing>;
  /**
   * Forgets an entry, and — only when it is a copy Encastra made — deletes it too.
   *
   * The runtime refuses `deleteCopy` for anything it did not put there itself. A project
   * somebody made is theirs; taking it off a list and deleting it are never the same act.
   */
  libraryRemove(id: string, deleteCopy: boolean): Promise<void>;
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

  /**
   * Choosing a file goes through the runtime, for the same reason choosing a folder does.
   *
   * This used to open the dialog plugin here and hand the path back as a string, and that
   * string went straight into `inputs[].path` on the next run — where the runtime canonicalised
   * it and imported the file into the scratch folder for the step wired to that port. The whole
   * of the authority for reading somebody's file was a string produced on this side, which is
   * indistinguishable from one a `.encastra` file supplied.
   *
   * `choose_file` opens the chooser on the privileged side and records what the operating system
   * returned. A path this side merely *says* somebody picked no longer seeds anything.
   */
  async pickFile(): Promise<string | null> {
    const purpose: FilePurpose = 'run-input';
    const chosen = await this.invoke<string | null>('choose_file', { purpose });
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
   *
   * The record is of the folder *and* what it was chosen for. Passing the purpose is not a
   * formality: a folder recorded under one purpose answers no other, so a flow that names the
   * wrong one gets a chooser that satisfies nothing it then asks for.
   */
  async pickFolder(purpose: FolderPurpose): Promise<string | null> {
    const chosen = await this.invoke<string | null>('choose_folder', { purpose });
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

  inspectPublication(folder: string): Promise<Inspected> {
    return this.invoke<Inspected>('inspect_publication', { folder });
  }

  importPublication(folder: string): Promise<LibraryEntry> {
    return this.invoke<LibraryEntry>('import_publication', { folder });
  }

  reportDirty(dirty: boolean): Promise<void> {
    return this.invoke<void>('report_dirty', { dirty });
  }

  closeWindow(): Promise<void> {
    return this.invoke<void>('close_window');
  }

  libraryList(): Promise<LibraryListing> {
    return this.invoke<LibraryListing>('library_list');
  }

  libraryRemove(id: string, deleteCopy: boolean): Promise<void> {
    return this.invoke<void>('library_remove', { id, deleteCopy });
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

  async inspectPublication(): Promise<Inspected> {
    throw new PreviewOnlyError('Reading a publication');
  }

  async importPublication(): Promise<LibraryEntry> {
    throw new PreviewOnlyError('Importing a publication');
  }

  /**
   * Both of these do nothing in a browser, rather than refusing.
   *
   * There is no window to keep open and nothing to tell about unsaved work: a browser tab
   * already asks its own question on the way out, and it is not this application's to answer.
   * Throwing here would turn every edit in the preview into an error in the console — a refusal
   * is the honest answer to "run this graph", never to "there are unsaved changes".
   */
  async reportDirty(): Promise<void> {}

  async closeWindow(): Promise<void> {}

  /**
   * An empty library, rather than a refusal.
   *
   * The Library screen is worth looking at in a browser, and what somebody sees there is its
   * empty state — which is the screen that teaches. Inventing entries would be a fixture
   * pretending to be somebody's own work, which is a different thing from a recorded journal
   * labelled as one.
   */
  async libraryList(): Promise<LibraryListing> {
    return { entries: [], quarantined: null };
  }

  async libraryRemove(): Promise<void> {
    throw new PreviewOnlyError('Removing something from the library');
  }

  async about(): Promise<About> {
    // The preview knows what it is, and says so rather than inventing a build.
    return {
      version: 'preview',
      buildCommit: 'unknown',
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
