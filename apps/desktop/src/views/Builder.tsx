/**
 * The editor: palette, canvas, inspector.
 *
 * The keyboard handling lives here rather than on the window, so shortcuts belong to the canvas
 * and do not fire while somebody is typing a folder name three panels away.
 */

import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Canvas } from '../canvas/Canvas';
import { Inspector } from '../panels/Inspector';
import { Palette } from '../panels/Palette';
import { RunPanel } from '../panels/RunPanel';
import { useEditor } from '../store';

/** True when the keystroke belongs to whatever the person is typing in. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
}

export function Builder() {
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const copySelection = useEditor((s) => s.copySelection);
  const pasteClipboard = useEditor((s) => s.pasteClipboard);
  const duplicateSelection = useEditor((s) => s.duplicateSelection);
  const selectAll = useEditor((s) => s.selectAll);
  const deleteSelected = useEditor((s) => s.deleteSelected);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const meta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (meta && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (meta && key === 'c') {
        event.preventDefault();
        copySelection();
        return;
      }
      if (meta && key === 'v') {
        event.preventDefault();
        pasteClipboard();
        return;
      }
      if (meta && key === 'd') {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (meta && key === 'a') {
        event.preventDefault();
        selectAll();
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        deleteSelected();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, copySelection, pasteClipboard, duplicateSelection, selectAll, deleteSelected]);

  return (
    <>
      <Palette />
      {/* Canvas and execution panel share the middle column. Keeping them in one wrapper rather
          than adding a row to the shell grid means the panel can come and go without the
          palette and inspector resizing around it. */}
      <div className="workarea">
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
        <RunPanel />
      </div>
      <Inspector />
    </>
  );
}
