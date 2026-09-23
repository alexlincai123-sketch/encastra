/**
 * The native chooser answers three ways, and only two of them were ever handled.
 *
 * `choose_folder` and `choose_file` live on the privileged side (see `pickFolder` in `ipc.ts` for
 * why), and they do not merely hand a path back or hand nothing back. They can **refuse**: a path
 * that will not canonicalise, something that is not a folder, a sensitive root, a startup folder —
 * `resolve_grant_directory` in `crates/encastra-core/src/broker.rs` and `resolve_input_file` in the
 * desktop `lib.rs` decide, and the command rejects with an `AppError` saying which.
 *
 * Four of the five places that opened a chooser treated a rejection as though it were a cancel,
 * which it is not: the promise rejected and nobody was holding it, so the person saw *nothing* —
 * no sentence, no error, a console they cannot open. A refusal that is correct and invisible is
 * the worst of both, because it reads as the application being broken rather than as the runtime
 * saying no.
 *
 * So the three answers are made into three answers here, once, rather than in four panels:
 *
 * - **chosen** — a path, which is the only case that should change anything.
 * - **cancelled** — the chooser was closed with nothing. Not a refusal and not a failure; nobody
 *   said no to a folder, because there was no folder. Nothing is shown, which is the behaviour
 *   that already existed and the one thing easiest to break while fixing the other two.
 * - **refused** — a sentence in the reader's language, from `describeAppError`, ready to be put
 *   wherever the panel already puts its errors.
 *
 * Nothing here decides anything. The runtime made the decision; this is the wording of it, and
 * the place that stops it going missing.
 */

import { describeAppError, type Translate } from './errors';
import { translate } from './i18n';
import { ipc } from './ipc';
import type { FolderPurpose } from './types';

/** What opening a chooser came back with. */
export type Choice =
  | { outcome: 'chosen'; path: string }
  | { outcome: 'cancelled' }
  | { outcome: 'refused'; text: string };

const CANCELLED: Choice = { outcome: 'cancelled' };

/**
 * One sentence for anything a rejected command handed back.
 *
 * A structured refusal gets its translated sentence; an `Error` or a string keeps its own words,
 * because those come from this side of the bridge and there is nothing better to say; a bare
 * object carrying a `message` is a rejected Tauri command that did not cross as an `Error`. The
 * last line is the only invented one, and it says plainly that nothing answered.
 *
 * `store.ts` used to hold a private copy of exactly this. It now calls this one, so a chooser
 * refusal and a failed save are described the same way rather than by two functions that agree
 * only until somebody edits one.
 */
export function describeFailure(cause: unknown, t: Translate = translate): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'string') return cause;
  const described = describeAppError(cause, t);
  if (described !== null) return described;
  if (typeof cause === 'object' && cause !== null) {
    const { message } = cause as { message?: unknown };
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return t('messages.runtimeSilent');
}

/** Opens the folder chooser for one purpose and reports which of the three things happened. */
export async function chooseFolder(
  purpose: FolderPurpose,
  t: Translate = translate,
): Promise<Choice> {
  try {
    const path = await ipc.pickFolder(purpose);
    return path ? { outcome: 'chosen', path } : CANCELLED;
  } catch (cause) {
    return { outcome: 'refused', text: describeFailure(cause, t) };
  }
}

/** The same for the file chooser, which has one purpose and so takes no argument. */
export async function chooseFile(t: Translate = translate): Promise<Choice> {
  try {
    const path = await ipc.pickFile();
    return path ? { outcome: 'chosen', path } : CANCELLED;
  } catch (cause) {
    return { outcome: 'refused', text: describeFailure(cause, t) };
  }
}

/**
 * A folder, or nothing — with a refusal handed to whatever the caller shows errors with.
 *
 * The shape a panel wants: one `await`, a path or `null`, and the guarantee that a `null` which
 * came from a refusal has already been explained on screen while a `null` which came from a
 * cancel has correctly explained nothing. `show` is the panel's own error surface — `setError`
 * in the Publish panel, a local note in Settings — so no new mechanism is introduced anywhere.
 */
export async function chooseFolderOrExplain(
  purpose: FolderPurpose,
  show: (text: string) => void,
  t: Translate = translate,
): Promise<string | null> {
  const choice = await chooseFolder(purpose, t);
  if (choice.outcome === 'refused') show(choice.text);
  return choice.outcome === 'chosen' ? choice.path : null;
}

/** The same for a file. */
export async function chooseFileOrExplain(
  show: (text: string) => void,
  t: Translate = translate,
): Promise<string | null> {
  const choice = await chooseFile(t);
  if (choice.outcome === 'refused') show(choice.text);
  return choice.outcome === 'chosen' ? choice.path : null;
}
