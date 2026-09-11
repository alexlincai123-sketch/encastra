/**
 * The guided first workflow, as data.
 *
 * Kept out of the component so the whole script can be read in one place and checked against
 * what the product actually does. A tour that describes a button that is not there is worse
 * than no tour, and a tour written inline across JSX is a tour nobody re-reads.
 *
 * The workflow it teaches is the one the product is built around and the one the runtime is
 * tested against: watch a folder, resize what appears, save the result.
 */

import type { View } from '../store';

export interface TourStep {
  /** Short, and a statement of what the person is about to do. */
  title: string;
  /** Two sentences at most. The tour is meant to take a minute, not to be read. */
  body: string;
  /** Where this step happens, so the tour can take them there rather than describing it. */
  view: View;
  /** The part of the screen this step is about, used to highlight it. */
  focus: 'palette' | 'canvas' | 'inspector' | 'toolbar' | 'none';
  /**
   * What the person has to do before the step is finished, checked against real editor state.
   * `null` means there is nothing to wait for and Next simply moves on.
   */
  done: 'node-placed' | 'two-nodes' | 'connected' | 'configured' | 'granted' | 'ran' | null;
}

export const TOUR: TourStep[] = [
  {
    title: 'This is your canvas',
    body: 'A workflow is a few components joined together. Everything runs on this machine, and nothing reaches your files until you allow it.',
    view: 'builder',
    focus: 'canvas',
    done: null,
  },
  {
    title: 'Add the first step',
    body: 'On the left is every component installed. Find Watch Folder and add it — it starts the workflow whenever a file appears somewhere you choose.',
    view: 'builder',
    focus: 'palette',
    done: 'node-placed',
  },
  {
    title: 'Add something to do',
    body: 'Now add Resize Image. It takes a picture and makes a smaller copy, leaving the original alone.',
    view: 'builder',
    focus: 'palette',
    done: 'two-nodes',
  },
  {
    title: 'Join them together',
    body: 'Drag from the file port on Watch Folder to the image port on Resize Image. A file is not yet a picture, so the editor inserts the step that opens it — and refuses the join outright if the two could never fit.',
    view: 'builder',
    focus: 'canvas',
    done: 'connected',
  },
  {
    title: 'Tell it which folder',
    body: 'Select a step to configure it on the right. Watch Folder needs to know which folder to watch, and Save File needs to know where to put the result.',
    view: 'builder',
    focus: 'inspector',
    done: 'configured',
  },
  {
    title: 'Allow it that folder',
    body: 'A component cannot touch anything until you say so, and a permission is scoped to the one folder you pick. Press Allow on the step that asked.',
    view: 'builder',
    focus: 'inspector',
    done: 'granted',
  },
  {
    title: 'Run it',
    body: 'Press Run, or Ctrl+Enter. Each step lights up as it happens, and the panel below records what it did and how long it took.',
    view: 'builder',
    focus: 'toolbar',
    done: 'ran',
  },
];

/** Whether the editor is now in the state a step was waiting for. */
export interface TourProgress {
  nodes: number;
  edges: number;
  configuredFolders: number;
  grants: number;
  hasRun: boolean;
}

export function isStepSatisfied(step: TourStep, progress: TourProgress): boolean {
  switch (step.done) {
    case null:
      return true;
    case 'node-placed':
      return progress.nodes >= 1;
    case 'two-nodes':
      return progress.nodes >= 2;
    case 'connected':
      return progress.edges >= 1;
    case 'configured':
      return progress.configuredFolders >= 1;
    case 'granted':
      return progress.grants >= 1;
    case 'ran':
      return progress.hasRun;
    default:
      return true;
  }
}

/**
 * The next step to show, given where the tour is and what the person has already done.
 *
 * Skips ahead past anything already satisfied, because somebody who added two components before
 * reading the second card should not be told to add a component. Returns `null` when the tour is
 * finished.
 */
export function advance(from: number, progress: TourProgress): number | null {
  let at = from + 1;
  while (at < TOUR.length) {
    const next = TOUR[at];
    // A step with nothing to wait for is never skipped — it is there to be read.
    if (!next || next.done === null || !isStepSatisfied(next, progress)) break;
    at += 1;
  }
  return at < TOUR.length ? at : null;
}
