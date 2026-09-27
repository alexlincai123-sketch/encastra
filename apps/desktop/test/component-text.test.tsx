// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  categoryLabel,
  componentDescription,
  componentName,
  KNOWN_CATEGORIES,
} from '../src/component-text';
import fixture from '../src/fixtures/components.json';
import { LOCALES, type Locale, lookup, type Messages, useI18n } from '../src/i18n';
import de from '../src/i18n/locales/de';
import en from '../src/i18n/locales/en';
import es from '../src/i18n/locales/es';
import fr from '../src/i18n/locales/fr';
import italian from '../src/i18n/locales/it';
import pt from '../src/i18n/locales/pt';
import { projectFileFilters } from '../src/ipc';
import { Palette } from '../src/panels/Palette';
import { useEditor } from '../src/store';
import type { ComponentManifest } from '../src/types';
import { Components } from '../src/views/Components';

/**
 * The words about a component, in the reader's language.
 *
 * Before this, every built-in component's name and description went from its English manifest
 * straight onto every screen, the category pills showed their raw ids ("media", "file"), the
 * header said "1 instalados", and the native file dialog offered an "Encastra project" filter in
 * every locale. Each check below fails against that code.
 */

const BUILT_INS = fixture as unknown as ComponentManifest[];
const LOCALE_FILES: Record<Locale, Messages> = { en, es, fr, de, it: italian, pt };
const INITIAL_EDITOR = useEditor.getState();
const INITIAL_I18N = useI18n.getState();

function inSpanish(): void {
  useI18n.setState({ locale: 'es', messages: { en, es } });
}

function seed(manifests: ComponentManifest[]): void {
  const byRef: Record<string, ComponentManifest> = {};
  for (const m of manifests) byRef[`${m.id}@${m.version}`] = m;
  useEditor.setState({ manifests: byRef });
}

function builtIn(id: string): ComponentManifest {
  const found = BUILT_INS.find((m) => m.id === id);
  if (!found) throw new Error(`no built-in ${id}`);
  return found;
}

beforeEach(() => {
  useEditor.setState(INITIAL_EDITOR, true);
});

afterEach(() => {
  cleanup();
  useI18n.setState(INITIAL_I18N, true);
});

describe('every built-in component has its words in every locale', () => {
  it('there are 21 built-ins, all shipped with the application', () => {
    expect(BUILT_INS).toHaveLength(21);
    expect(BUILT_INS.every((m) => m.kind === 'core')).toBe(true);
  });

  it.each(LOCALES.filter((l) => l !== 'en'))('%s translates every name and description', (l) => {
    const missing = BUILT_INS.flatMap((m) =>
      ['name', 'description']
        .filter((field) => !lookup(LOCALE_FILES[l], `components.core.${m.id}.${field}`))
        .map((field) => `${m.id}.${field}`),
    );
    expect(missing).toEqual([]);
  });

  it('the English copy is the manifest word for word, so it cannot drift from it', () => {
    for (const m of BUILT_INS) {
      expect(lookup(en, `components.core.${m.id}.name`)).toBe(m.name);
      expect(lookup(en, `components.core.${m.id}.description`)).toBe(m.description);
    }
  });
});

describe('componentName and componentDescription', () => {
  it('translate a built-in', () => {
    inSpanish();
    const resize = builtIn('encastra.image.resize');
    expect(componentName(resize)).toBe(lookup(es, 'components.core.encastra.image.resize.name'));
    expect(componentName(resize)).not.toBe(resize.name);
    expect(componentDescription(resize)).not.toBe(resize.description);
  });

  it('show the manifest in English', () => {
    useI18n.setState({ locale: 'en', messages: { en } });
    const resize = builtIn('encastra.image.resize');
    expect(componentName(resize)).toBe(resize.name);
  });

  it('never lend a built-in’s name to a third-party component claiming its id', () => {
    inSpanish();
    const impostor: ComponentManifest = {
      ...builtIn('encastra.file.read'),
      kind: 'wasm',
      name: 'Totally Read File',
    };
    expect(componentName(impostor)).toBe('Totally Read File');
  });

  it('fall back to the manifest for a built-in nobody has translated', () => {
    inSpanish();
    const unknown = { ...builtIn('encastra.file.read'), id: 'encastra.file.unheard', name: 'X' };
    expect(componentName(unknown)).toBe('X');
    expect(componentDescription({ ...unknown, description: undefined })).toBeUndefined();
  });
});

describe('category labels', () => {
  it('are translated in every locale, for every category the built-ins use', () => {
    const used = new Set(BUILT_INS.map((m) => m.category ?? 'other'));
    for (const id of used) expect(KNOWN_CATEGORIES).toContain(id);
    for (const l of LOCALES) {
      for (const id of KNOWN_CATEGORIES) {
        expect(lookup(LOCALE_FILES[l], `components.categories.${id}`)).toBeTruthy();
      }
    }
  });

  it('show a category nobody has named as written, not as a raw key', () => {
    inSpanish();
    expect(categoryLabel('file')).toBe(lookup(es, 'components.categories.file'));
    expect(categoryLabel('text')).toBe('text');
  });
});

describe('the Components view in Spanish', () => {
  it('names the category pills in Spanish, not by their ids', () => {
    inSpanish();
    seed(BUILT_INS);
    render(<Components />);

    for (const id of ['all', 'media', 'file']) {
      const label = lookup(es, `components.categories.${id}`) ?? '';
      expect(screen.getByRole('button', { name: label })).toBeDefined();
      expect(screen.queryByRole('button', { name: id })).toBeNull();
    }
  });

  it('says "1 instalado", not "1 instalados"', () => {
    inSpanish();
    seed([builtIn('encastra.flow.delay')]);
    render(<Components />);

    expect(screen.getByText(/^1 instalado\./)).toBeDefined();
    expect(screen.queryByText(/1 instalados/)).toBeNull();
  });

  it('agrees both counts: the installed total and the triggers, each with its own number', () => {
    inSpanish();
    // count 1, triggerCount 1: the one installed component is the trigger.
    seed([builtIn('encastra.file.watch')]);
    render(<Components />);
    expect(screen.getByText(/^1 instalado — 1 inicia un flujo/)).toBeDefined();
    expect(screen.queryByText(/1 instalados/)).toBeNull();
    cleanup();

    // count 2, triggerCount 1.
    seed([builtIn('encastra.file.watch'), builtIn('encastra.flow.delay')]);
    render(<Components />);
    expect(screen.getByText(/^2 instalados — 1 inicia un flujo/)).toBeDefined();
    expect(screen.queryByText(/inician/)).toBeNull();
    cleanup();

    // count 3, triggerCount 2.
    seed([
      builtIn('encastra.file.watch'),
      builtIn('encastra.system.timer'),
      builtIn('encastra.flow.delay'),
    ]);
    render(<Components />);
    expect(screen.getByText(/^3 instalados — 2 de ellos inician un flujo/)).toBeDefined();
  });

  it('shows a built-in under its Spanish name and description', () => {
    inSpanish();
    seed([builtIn('encastra.image.resize')]);
    render(<Components />);

    const name = lookup(es, 'components.core.encastra.image.resize.name') ?? '';
    const description = lookup(es, 'components.core.encastra.image.resize.description') ?? '';
    expect(screen.getByRole('heading', { name })).toBeDefined();
    expect(screen.getByText(description)).toBeDefined();
  });
});

describe('the palette in Spanish', () => {
  it('names the component and its category in Spanish', () => {
    inSpanish();
    seed([builtIn('encastra.image.resize')]);
    render(<Palette />);

    const name = lookup(es, 'components.core.encastra.image.resize.name') ?? '';
    expect(screen.getByRole('button', { name: new RegExp(name) })).toBeDefined();
    expect(
      screen.getByRole('heading', { name: lookup(es, 'components.categories.media') }),
    ).toBeDefined();
  });
});

describe('the project file filter in the native dialogs', () => {
  it('is named in the reader’s language', () => {
    inSpanish();
    expect(projectFileFilters()).toEqual([
      { name: lookup(es, 'common.projectFileType'), extensions: ['encastra'] },
    ]);
    expect(projectFileFilters()[0]?.name).not.toBe('Encastra project');
  });
});
