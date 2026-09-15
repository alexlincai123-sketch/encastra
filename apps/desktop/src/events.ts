/**
 * Live progress from the runtime.
 *
 * Requests and answers go through `ipc.ts`. This is the other direction: the runtime telling
 * the interface what is happening while it happens. They are separate because they are
 * genuinely different — a run's journal arrives once, at the end, and is immutable; progress is
 * a stream that exists only while something is running.
 *
 * In the browser preview there is no runtime, so subscribing succeeds and nothing ever arrives.
 * That is the honest behaviour: the preview does not simulate a run.
 */

import type { NodeRecord, RunJournal } from './types';

export interface RunStarted {
  run_id: string;
  order: string[];
}

export interface NodeEvent {
  run_id: string;
  node: string;
  record?: NodeRecord;
}

export interface WorkflowStatus {
  running: boolean;
  /** True when the workflow starts itself and keeps going until stopped. */
  watching: boolean;
  runs: number;
  pending: number;
  dropped: number;
  message?: string;
}

export interface RuntimeEvents {
  runStarted: RunStarted;
  nodeStarted: NodeEvent;
  nodeFinished: NodeEvent;
  runFinished: RunJournal;
  status: WorkflowStatus;
  notification: string;
}

const CHANNELS: Record<keyof RuntimeEvents, string> = {
  runStarted: 'encastra://run-started',
  nodeStarted: 'encastra://node-started',
  nodeFinished: 'encastra://node-finished',
  runFinished: 'encastra://run-finished',
  status: 'encastra://status',
  notification: 'encastra://notification',
};

type Handlers = {
  [K in keyof RuntimeEvents]?: (payload: RuntimeEvents[K]) => void;
};

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Subscribes to everything the runtime reports. Returns a function that unsubscribes.
 *
 * Every listener is torn down together: a half-unsubscribed set would leave the interface
 * updating from a workflow the user has already closed.
 */
export async function subscribe(handlers: Handlers): Promise<() => void> {
  if (!inTauri()) {
    return () => {};
  }

  const { listen } = await import('@tauri-apps/api/event');
  const unlisteners = await Promise.all(
    (Object.keys(handlers) as (keyof RuntimeEvents)[]).map(async (key) => {
      const handler = handlers[key];
      if (!handler) return () => {};
      return listen(CHANNELS[key], (event) => {
        (handler as (payload: unknown) => void)(event.payload);
      });
    }),
  );

  return () => {
    for (const off of unlisteners) off();
  };
}

/**
 * The window being asked to close, before it does.
 *
 * Separate from `subscribe` above because it is not progress from a run: it is the operating
 * system asking a question the editor is the only one who can answer. The runtime has already
 * refused the close by the time this arrives — see `on_window_event` in `src-tauri/src/lib.rs` —
 * so nothing is lost while somebody reads the dialog, and the window closes only when the
 * editor asks for it again through `ipc.closeWindow()`.
 *
 * In the browser preview there is nothing to listen to: a tab's own "leave site?" prompt is the
 * browser's, and this application does not get to answer it.
 */
export async function onCloseRequested(handler: () => void): Promise<() => void> {
  if (!inTauri()) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  return listen('encastra://close-requested', () => handler());
}
