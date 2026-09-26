// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Canvas } from '../src/canvas/Canvas';
import fixture from '../src/fixtures/components.json';
import { lookup, useI18n } from '../src/i18n';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import { usePreferences } from '../src/preferences';
import { useEditor } from '../src/store';
import type { ComponentManifest } from '../src/types';

/**
 * The canvas, read in Spanish.
 *
 * React Flow names its own controls — "Zoom In", "Fit View", "Mini Map", "Control Panel" — in
 * English unless it is handed other words, and the node on the canvas used to carry its English
 * manifest name. Both are asserted against what React Flow actually drew. The refusal toast's
 * accessible name is checked in the source, because producing a refusal needs a pointer drag
 * jsdom cannot perform.
 *
 * The layout stubs are the ones `canvas-selection.test.tsx` explains: jsdom has no layout, and
 * React Flow culls what measures 0×0.
 */

class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element): void {
    const el = target as HTMLElement;
    const contentRect = { width: el.offsetWidth, height: el.offsetHeight };
    this.callback(
      [{ target, contentRect } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
}

class DOMMatrixReadOnlyStub {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
    this.m22 = scale !== undefined ? Number(scale) : 1;
  }
}

const saved: {
  name: 'offsetWidth' | 'offsetHeight';
  descriptor: PropertyDescriptor | undefined;
}[] = [];
const savedGlobals: Record<string, unknown> = {};

beforeAll(() => {
  const g = globalThis as Record<string, unknown>;
  for (const name of ['ResizeObserver', 'DOMMatrixReadOnly']) savedGlobals[name] = g[name];
  g.ResizeObserver = ResizeObserverStub;
  g.DOMMatrixReadOnly = DOMMatrixReadOnlyStub;
  const sizes = { offsetWidth: 1600, offsetHeight: 1000 } as const;
  for (const name of ['offsetWidth', 'offsetHeight'] as const) {
    saved.push({ name, descriptor: Object.getOwnPropertyDescriptor(HTMLElement.prototype, name) });
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('react-flow__node')
          ? name === 'offsetWidth'
            ? 180
            : 60
          : sizes[name];
      },
    });
  }
});

afterAll(() => {
  const g = globalThis as Record<string, unknown>;
  for (const [name, value] of Object.entries(savedGlobals)) g[name] = value;
  for (const { name, descriptor } of saved) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
  }
});

const RESIZE = (fixture as unknown as ComponentManifest[]).find(
  (m) => m.id === 'encastra.image.resize',
) as ComponentManifest;

const INITIAL_EDITOR = useEditor.getState();
const INITIAL_I18N = useI18n.getState();
const INITIAL_PREFERENCES = usePreferences.getState();

function spanish(key: string): string {
  const found = lookup(es, key);
  if (!found) throw new Error(`missing Spanish key ${key}`);
  return found;
}

beforeEach(() => {
  useEditor.setState(INITIAL_EDITOR, true);
  useI18n.setState({ locale: 'es', messages: { en, es } });
  usePreferences.setState({ showMinimap: true });
  useEditor.setState({ manifests: { [`${RESIZE.id}@${RESIZE.version}`]: RESIZE } });
  useEditor.getState().addNode(`${RESIZE.id}@${RESIZE.version}`, { x: 220, y: 140 });
});

afterEach(() => {
  cleanup();
  useI18n.setState(INITIAL_I18N, true);
  usePreferences.setState(INITIAL_PREFERENCES, true);
});

function renderCanvas(): void {
  render(
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>,
  );
}

describe('React Flow’s own controls speak Spanish', () => {
  it('names the zoom and fit buttons, and the panel around them', async () => {
    renderCanvas();

    for (const key of ['zoomIn', 'zoomOut', 'fitView']) {
      expect(
        await screen.findByRole('button', { name: spanish(`canvas.controls.${key}`) }),
      ).toBeDefined();
    }
    expect(screen.queryByRole('button', { name: 'Zoom In' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fit View' })).toBeNull();
    const panel = document.querySelector('[data-testid="rf__controls"]');
    expect(panel?.getAttribute('aria-label')).toBe(spanish('canvas.controls.panel'));
  });

  it('names the minimap', async () => {
    renderCanvas();
    await waitFor(() => expect(document.querySelector('.react-flow__minimap')).not.toBeNull());
    const minimap = document.querySelector('.react-flow__minimap');
    expect(minimap?.textContent).toContain(spanish('canvas.controls.minimap'));
    expect(minimap?.textContent).not.toContain('Mini Map');
  });
});

describe('a built-in step on the canvas', () => {
  it('carries its Spanish name', async () => {
    renderCanvas();
    await waitFor(() => expect(document.querySelector('.node__name')).not.toBeNull());
    expect(document.querySelector('.node__name')?.textContent).toBe(
      spanish('components.core.encastra.image.resize.name'),
    );
  });
});

describe('the refusal toast’s close button', () => {
  it('is named by the word it shows, with no aria-label saying something else', () => {
    // Resolved with `node:path`, not `new URL(...)`: under jsdom `URL` is jsdom's, and its
    // `file:` URLs are not ones `fileURLToPath` accepts.
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '../src/canvas/Canvas.tsx'), 'utf8');
    const start = source.indexOf('className="refusal"');
    const end = source.indexOf('</button>', start);
    expect(start).toBeGreaterThan(0);
    const toast = source.slice(start, end);
    expect(toast).toContain("t('common.close')");
    expect(toast).not.toMatch(/aria-label=/);
  });
});
