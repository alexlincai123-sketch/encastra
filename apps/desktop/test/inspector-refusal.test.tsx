// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fixture from '../src/fixtures/components.json';
import { lookup, useI18n } from '../src/i18n';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import { Inspector } from '../src/panels/Inspector';
import { useEditor } from '../src/store';
import type { ComponentManifest, NodeRecord, RunJournal } from '../src/types';

/**
 * Why a step was refused, where somebody looking at the step can read it.
 *
 * When the broker refuses a call — Save File onto a name that is already taken — the step fails
 * with the generic `denied` error, and the broker's actual reason travels in the journal on the
 * refused call, as `denied_because`. The inspector used to show the call's kind and detail and
 * drop the reason, so the only sentence that said *why* never reached the screen.
 */

const REASON = 'a file of that name is already there, and a run does not replace files';

const SAVE = (fixture as unknown as ComponentManifest[]).find(
  (m) => m.id === 'encastra.file.save',
) as ComponentManifest;
const REF = `${SAVE.id}@${SAVE.version}`;

const INITIAL_EDITOR = useEditor.getState();
const INITIAL_I18N = useI18n.getState();

function recordWith(error: NodeRecord['error']): NodeRecord {
  return {
    component: REF,
    status: 'failed',
    inputs: {},
    outputs: {},
    capability_calls: [
      { at_ms: 1, kind: 'fs.read', detail: 'C:\\in\\photo.png', allowed: true },
      {
        at_ms: 2,
        kind: 'fs.write',
        detail: 'C:\\out\\photo.png',
        allowed: false,
        denied_because: REASON,
      },
    ],
    logs: [],
    error,
  };
}

function seed(record: NodeRecord): void {
  const journal: RunJournal = {
    run_id: 'run-1',
    started_at_ms: 0,
    status: 'failed',
    nodes: { 'save-1': record },
    order: ['save-1'],
  } as RunJournal;
  useEditor.setState({
    manifests: { [REF]: SAVE },
    nodes: [
      {
        id: 'save-1',
        type: 'component',
        position: { x: 0, y: 0 },
        data: { componentRef: REF, config: {}, disabled: false },
      },
    ],
    selectedNodeId: 'save-1',
    journal,
  });
}

function english(key: string): string {
  const found = lookup(en, key);
  if (!found) throw new Error(`missing English key ${key}`);
  return found;
}

const DENIED = { code: 'denied', message: 'denied', retryable: false };

beforeEach(() => {
  useEditor.setState(INITIAL_EDITOR, true);
  useI18n.setState({ locale: 'en', messages: { en } });
});

afterEach(() => {
  cleanup();
  useI18n.setState(INITIAL_I18N, true);
});

describe('a refused call in the inspector’s run record', () => {
  it('shows the broker’s reason on the refused call', () => {
    seed(recordWith(DENIED));
    render(<Inspector />);

    const reason = screen.getByText(`— ${REASON}`);
    expect(reason.closest('.trace__line')?.textContent).toContain('fs.write');
  });

  it('shows no reason on a call that was allowed', () => {
    seed(recordWith(DENIED));
    render(<Inspector />);

    const allowed = screen.getByText('C:\\in\\photo.png').closest('.trace__line');
    expect(allowed).not.toBeNull();
    expect(allowed?.querySelector('.trace__reason')).toBeNull();
    expect(document.querySelectorAll('.trace__reason')).toHaveLength(1);
  });

  it('points from the denied error to the reason, in the reader’s language', () => {
    const hint = lookup(es, 'inspector.runRecord.seeRefusalReason');
    expect(hint).toBeTypeOf('string');
    useI18n.setState({ locale: 'es', messages: { en, es } });
    seed(recordWith(DENIED));
    render(<Inspector />);

    expect(screen.getByText(hint as string)).toBeDefined();
  });

  it('does not point anywhere when the error is not a refusal', () => {
    seed(recordWith({ code: 'io', message: 'disk full', retryable: false }));
    render(<Inspector />);

    expect(screen.queryByText(english('inspector.runRecord.seeRefusalReason'))).toBeNull();
  });
});
