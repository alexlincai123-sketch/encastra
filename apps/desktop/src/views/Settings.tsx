/**
 * Settings.
 *
 * A category sidebar on the left, one category's worth of grouped cards on the right — the
 * organising principle mature settings screens share, built from this app's own tokens and
 * classes rather than anyone else's colours or components.
 *
 * The rule everything here answers to: **every control writes a real, persisted preference, or
 * it is not a control.** `preferences.ts` lists every preference that exists; nothing here
 * invents one. Where the honest answer is "there is nothing to configure" — telemetry, an
 * update channel, an account — this says so as a status, not a switch wired to nothing.
 */

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import {
  CATEGORIES,
  type CategoryId,
  countGrants,
  DEFAULT_CATEGORY,
  findCategory,
  isNavKey,
  moveIndex,
  summarizeComponents,
} from '../settings/categories';
import {
  Button,
  DangerButton,
  FolderField,
  Segmented,
  SettingCard,
  SettingRow,
  StatusPill,
  Toggle,
} from '../settings/controls';
import '../settings.css';
import { ipc } from '../ipc';
import { usePreferences } from '../preferences';
import { useEditor } from '../store';

/** The same mark `App.tsx` draws in the top bar — duplicated rather than imported, since the
 * shell does not export it and this file may not edit the shell to make it. */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M20 3h7a1.5 1.5 0 0 1 1.5 1.5v16A1.5 1.5 0 0 1 27 22h-7a1.5 1.5 0 0 1-1.5-1.5v-1.4h4.7a1.2 1.2 0 0 0 1.2-1.2v-3.8a1.2 1.2 0 0 0-1.2-1.2h-4.7V4.5A1.5 1.5 0 0 1 20 3Z"
      />
      <path
        fill="currentColor"
        d="M5 10h7a1.5 1.5 0 0 1 1.5 1.5v3.3h8.3a1.2 1.2 0 0 1 1.2 1.2v1a1.2 1.2 0 0 1-1.2 1.2H13.5v9.3A1.5 1.5 0 0 1 12 29H5a1.5 1.5 0 0 1-1.5-1.5v-16A1.5 1.5 0 0 1 5 10Z"
      />
    </svg>
  );
}

// --- Category sections -------------------------------------------------------------------

function GeneralSection() {
  const theme = usePreferences((p) => p.theme);
  const motion = usePreferences((p) => p.motion);
  const set = usePreferences((p) => p.set);

  return (
    <>
      <SettingCard title="Appearance">
        <SettingRow
          label="Theme"
          hint="System follows your operating system. Light and dark stay fixed regardless of it."
        >
          <Segmented
            legend="Theme"
            value={theme}
            onChange={(value) => set('theme', value)}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </SettingRow>
        <SettingRow
          label="Motion"
          hint="Reduced turns transitions off entirely rather than shortening them, regardless of what your system prefers."
        >
          <Segmented
            legend="Motion"
            value={motion}
            onChange={(value) => set('motion', value)}
            options={[
              { value: 'system', label: 'System' },
              { value: 'reduced', label: 'Reduced' },
            ]}
          />
        </SettingRow>
      </SettingCard>

      <SettingCard title="Get started">
        <SettingRow label="Welcome tour" hint="The guided first workflow, shown once on first run.">
          <Button onClick={() => set('welcomeSeen', false)}>Show the welcome again</Button>
        </SettingRow>
      </SettingCard>
    </>
  );
}

function WorkspaceSection() {
  const projectFolder = usePreferences((p) => p.projectFolder);
  const startup = usePreferences((p) => p.startup);
  const set = usePreferences((p) => p.set);

  const browse = () => {
    void ipc.pickFolder().then((chosen) => {
      if (chosen) set('projectFolder', chosen);
    });
  };

  return (
    <SettingCard title="Projects">
      <SettingRow
        label="Default project folder"
        hint="Where the save dialog starts. Left empty, it opens wherever the system last was."
        htmlFor="pref-project-folder"
      >
        <FolderField
          id="pref-project-folder"
          value={projectFolder}
          placeholder="No default folder set"
          onChange={(value) => set('projectFolder', value)}
          onBrowse={browse}
          browseDisabled={!ipc.live}
          browseTitle={ipc.live ? undefined : 'Needs the desktop runtime, not this browser preview'}
        />
      </SettingRow>
      <SettingRow label="On startup" hint="What this application shows you when it opens.">
        <Segmented
          legend="On startup"
          value={startup}
          onChange={(value) => set('startup', value)}
          options={[
            { value: 'home', label: 'Home' },
            { value: 'last-project', label: 'Last project' },
          ]}
        />
      </SettingRow>
    </SettingCard>
  );
}

function EditorSection() {
  const showGrid = usePreferences((p) => p.showGrid);
  const snapToGrid = usePreferences((p) => p.snapToGrid);
  const showMinimap = usePreferences((p) => p.showMinimap);
  const set = usePreferences((p) => p.set);

  return (
    <SettingCard title="Canvas">
      <SettingRow
        label="Grid"
        hint="Shows the alignment grid behind nodes on the canvas."
        htmlFor="pref-show-grid"
      >
        <Toggle
          id="pref-show-grid"
          label="Grid"
          checked={showGrid}
          onChange={(value) => set('showGrid', value)}
        />
      </SettingRow>
      <SettingRow
        label="Snap to grid"
        hint="Nodes settle onto the grid as you drag them, instead of landing free."
        htmlFor="pref-snap-to-grid"
      >
        <Toggle
          id="pref-snap-to-grid"
          label="Snap to grid"
          checked={snapToGrid}
          onChange={(value) => set('snapToGrid', value)}
        />
      </SettingRow>
      <SettingRow
        label="Minimap"
        hint="A small overview of the whole graph in the corner of the canvas."
        htmlFor="pref-show-minimap"
      >
        <Toggle
          id="pref-show-minimap"
          label="Minimap"
          checked={showMinimap}
          onChange={(value) => set('showMinimap', value)}
        />
      </SettingRow>
    </SettingCard>
  );
}

function RuntimeSection() {
  const openRunPanelOnRun = usePreferences((p) => p.openRunPanelOnRun);
  const set = usePreferences((p) => p.set);

  return (
    <SettingCard title="Runs">
      <SettingRow
        label="Open the run panel"
        hint="Bring the execution panel forward automatically the moment a run starts."
        htmlFor="pref-run-panel"
      >
        <Toggle
          id="pref-run-panel"
          label="Open the run panel on run"
          checked={openRunPanelOnRun}
          onChange={(value) => set('openRunPanelOnRun', value)}
        />
      </SettingRow>
    </SettingCard>
  );
}

function ComponentsSection({ onOpenSecurity }: { onOpenSecurity: () => void }) {
  const manifests = useEditor((s) => s.manifests);
  const summary = summarizeComponents(manifests);

  return (
    <>
      <SettingCard title="Installed">
        <SettingRow
          label="Components"
          hint="Everything this build ships with, built in rather than downloaded."
        >
          <StatusPill tone="ok">{summary.core} built in</StatusPill>
        </SettingRow>
        <SettingRow
          label="Third-party"
          hint="Components from outside this application, run in a sandbox with no ambient authority."
        >
          {summary.thirdParty > 0 ? (
            <StatusPill tone="ok">{summary.thirdParty} installed</StatusPill>
          ) : (
            <StatusPill tone="muted">Sandbox not built yet</StatusPill>
          )}
        </SettingRow>
        <SettingRow
          label="Full permission table"
          hint="Every installed component, its version, and exactly what it can reach."
        >
          <Button onClick={onOpenSecurity}>Open Security</Button>
        </SettingRow>
      </SettingCard>

      <SettingCard title="Install more">
        <SettingRow label="Install from a file" hint="Add a third-party component to this build.">
          <StatusPill tone="muted">Not built yet</StatusPill>
        </SettingRow>
        <p className="s-note">
          The sandbox this would run components in is designed and documented but not built, so
          nothing outside the {summary.total} listed above can be installed yet.
        </p>
      </SettingCard>
    </>
  );
}

function SecuritySection({ onOpenSecurity }: { onOpenSecurity: () => void }) {
  const grants = useEditor((s) => s.grants);
  const grantCount = countGrants(grants);

  return (
    <SettingCard title="Permission model">
      <p className="s-copy">
        A component cannot reach your files, your network, or your clipboard unless its manifest
        declares it and you allow it — once per run. Every request, allowed or refused, is recorded
        where you can read it.
      </p>
      <SettingRow
        label="Allowed in the open workflow"
        hint="Cleared the moment this application closes."
      >
        <StatusPill tone={grantCount > 0 ? 'warn' : 'ok'}>
          {grantCount === 0 ? 'Nothing allowed' : `${grantCount} allowed`}
        </StatusPill>
      </SettingRow>
      <SettingRow
        label="Full detail"
        hint="What was allowed, to what, and what this does not protect against."
      >
        <Button onClick={onOpenSecurity}>Open Security</Button>
      </SettingRow>
    </SettingCard>
  );
}

function PrivacySection() {
  return (
    <>
      <SettingCard title="Collection">
        <SettingRow label="Telemetry" hint="Usage data sent back to a server.">
          <StatusPill tone="ok">None collected</StatusPill>
        </SettingRow>
        <SettingRow
          label="Crash reports"
          hint="Automatic reports sent somewhere when something fails."
        >
          <StatusPill tone="ok">None</StatusPill>
        </SettingRow>
        <SettingRow label="Analytics" hint="Usage patterns, feature counts, or anything similar.">
          <StatusPill tone="ok">None</StatusPill>
        </SettingRow>
        <SettingRow label="Account" hint="A sign-in or subscription tied to this application.">
          <StatusPill tone="ok">None — there is no server</StatusPill>
        </SettingRow>
      </SettingCard>

      <SettingCard title="Your data">
        <SettingRow
          label="Projects"
          hint="Kept as .encastra files wherever you save them. No hidden second copy."
        >
          <StatusPill tone="ok">Stays on this machine</StatusPill>
        </SettingRow>
        <SettingRow
          label="Run journals"
          hint="Record sizes and shapes, never file contents. Held in memory while the window is open."
        >
          <StatusPill tone="ok">Discarded on close</StatusPill>
        </SettingRow>
      </SettingCard>
    </>
  );
}

function AdvancedSection() {
  const developerMode = usePreferences((p) => p.developerMode);
  const set = usePreferences((p) => p.set);
  const resetAll = usePreferences((p) => p.resetAll);

  return (
    <>
      <SettingCard title="Internals">
        <SettingRow
          label="Developer mode"
          hint="Surfaces component ids, digests, and the raw run journal for people who want them."
          htmlFor="pref-developer-mode"
        >
          <Toggle
            id="pref-developer-mode"
            label="Developer mode"
            checked={developerMode}
            onChange={(value) => set('developerMode', value)}
          />
        </SettingRow>
      </SettingCard>

      <SettingCard title="Reset">
        <SettingRow
          label="Restore defaults"
          hint="Puts every setting on this screen back to how it was on first run. Does not touch your projects, grants, or installed components."
        >
          <DangerButton onClick={resetAll}>Reset all settings</DangerButton>
        </SettingRow>
      </SettingCard>
    </>
  );
}

function AboutSection() {
  const about = useEditor((s) => s.about);

  return (
    <>
      <SettingCard title="Encastra">
        <div className="s-brand">
          <Mark />
          <div>
            <p className="s-brand__name">Encastra</p>
            <p className="s-brand__tagline">Build software from parts that actually fit.</p>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="This build">
        <SettingRow label="Version" hint="The build you are running.">
          <code>{about?.version ?? 'unknown'}</code>
        </SettingRow>
        <SettingRow
          label="Runtime"
          hint="Whether a real Encastra runtime is attached to this window."
        >
          <StatusPill tone={ipc.live ? 'ok' : 'warn'}>
            {ipc.live ? 'Attached' : 'Not attached — browser preview'}
          </StatusPill>
        </SettingRow>
        <SettingRow label="Component protocol" hint="What a component manifest must match to load.">
          <code>schema {about?.protocolSchema ?? '?'}</code>
        </SettingRow>
        <SettingRow label="Project format" hint="What a saved .encastra file is written as.">
          <code>schema {about?.projectSchema ?? '?'}</code>
        </SettingRow>
        <SettingRow label="Signing" hint="Whether this build can prove who produced it.">
          <StatusPill tone="warn">Not signed</StatusPill>
        </SettingRow>
        <SettingRow label="Updates" hint="How a newer version reaches this machine.">
          <span className="s-fact">
            No update channel. Updating means downloading a new installer.
          </span>
        </SettingRow>
      </SettingCard>

      <SettingCard title="Read more">
        <ul className="s-links">
          <li>
            <code>README.md</code>
            what Encastra is
          </li>
          <li>
            <code>docs/SECURITY.md</code>
            the permission model, in full
          </li>
          <li>
            <code>docs/RELEASE.md</code>
            how a build is produced and verified
          </li>
          <li>
            <code>docs/PRODUCT-ROADMAP.md</code>
            what is built, and what is not yet
          </li>
        </ul>
      </SettingCard>
    </>
  );
}

// --- Shell ---------------------------------------------------------------------------------

function sectionFor(id: CategoryId, onOpenSecurity: () => void) {
  switch (id) {
    case 'general':
      return <GeneralSection />;
    case 'workspace':
      return <WorkspaceSection />;
    case 'editor':
      return <EditorSection />;
    case 'runtime':
      return <RuntimeSection />;
    case 'components':
      return <ComponentsSection onOpenSecurity={onOpenSecurity} />;
    case 'security':
      return <SecuritySection onOpenSecurity={onOpenSecurity} />;
    case 'privacy':
      return <PrivacySection />;
    case 'advanced':
      return <AdvancedSection />;
    case 'about':
      return <AboutSection />;
  }
}

export function Settings() {
  const [categoryId, setCategoryId] = useState<CategoryId>(DEFAULT_CATEGORY);
  const setView = useEditor((s) => s.setView);
  const navRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const category = findCategory(categoryId);
  const openSecurity = () => setView('security');

  const onNavKeyDown = (event: ReactKeyboardEvent<HTMLElement>, index: number) => {
    if (!isNavKey(event.key)) return;
    event.preventDefault();
    const next = moveIndex(index, event.key, CATEGORIES.length);
    const target = CATEGORIES[next];
    if (!target) return;
    setCategoryId(target.id);
    navRefs.current[next]?.focus();
  };

  return (
    <main className="view view--settings">
      <div className="settings">
        <nav className="settings__nav" aria-label="Settings categories">
          {CATEGORIES.map((item, index) => (
            <button
              type="button"
              key={item.id}
              ref={(el) => {
                navRefs.current[index] = el;
              }}
              className="settings__nav-item"
              aria-current={category.id === item.id ? 'page' : undefined}
              onClick={() => setCategoryId(item.id)}
              onKeyDown={(event) => onNavKeyDown(event, index)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings__content">
          <header className="view__header">
            <p className="settings__eyebrow">Settings</p>
            <h1>{category.label}</h1>
            <p>{category.description}</p>
          </header>

          {sectionFor(category.id, openSecurity)}
        </div>
      </div>
    </main>
  );
}
