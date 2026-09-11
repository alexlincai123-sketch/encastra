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
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  formatDate,
  formatNumber,
  formatTime,
  LOCALE_NAMES,
  LOCALES,
  type Locale,
  loadLocale,
  PLANNED_LOCALES,
  useI18n,
} from '../i18n';
import { ipc } from '../ipc';
import { PREFERENCE_KEYS, usePreferences } from '../preferences';
import {
  CATEGORIES,
  type CategoryId,
  capabilityLabel,
  countGrants,
  DEFAULT_CATEGORY,
  findCategory,
  isNavKey,
  moveIndex,
  reachOf,
  summarizeComponents,
} from '../settings/categories';
import {
  Button,
  DangerButton,
  FolderField,
  Pre,
  Segmented,
  SettingCard,
  SettingRow,
  StatusPill,
  Toggle,
} from '../settings/controls';
import {
  assembleDiagnostics,
  detectArchitecture,
  detectGpuRenderer,
  detectPlatform,
  diagnosticsToText,
} from '../settings/diagnostics';
import '../settings.css';
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
  const startup = usePreferences((p) => p.startup);
  const set = usePreferences((p) => p.set);

  return (
    <SettingCard title="Get started">
      <SettingRow label="Welcome tour" hint="The guided first workflow, shown once on first run.">
        <Button onClick={() => set('welcomeSeen', false)}>Show the welcome again</Button>
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

function AppearanceSection() {
  const theme = usePreferences((p) => p.theme);
  const motion = usePreferences((p) => p.motion);
  const set = usePreferences((p) => p.set);

  return (
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
  );
}

/** Display names for the locales the architecture is ready for but nobody has translated yet.
 * `i18n/index.ts` has no reason to name a locale it cannot render — these live here, next to the
 * only place that shows them. */
const PLANNED_LOCALE_NAMES: Record<string, string> = {
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
};

function LanguageSection() {
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (next: Locale) => {
    if (next === locale || pending) return;
    setPending(true);
    setError(null);
    loadLocale(next)
      .then(() => setLocale(next))
      .catch(() => setError(`Could not load ${LOCALE_NAMES[next]}. Staying on the current one.`))
      .finally(() => setPending(false));
  };

  const now = new Date();

  return (
    <>
      <SettingCard title="Language">
        <SettingRow
          label="Interface language"
          hint="Translates this application. English is always the fallback for anything not yet translated in the language you pick."
        >
          <Segmented
            legend="Language"
            value={locale}
            onChange={choose}
            disabled={pending}
            options={LOCALES.map((code) => ({ value: code, label: LOCALE_NAMES[code] }))}
          />
        </SettingRow>
        {pending ? <p className="s-note">Loading…</p> : null}
        {error ? <p className="s-note">{error}</p> : null}
        <SettingRow
          label="Coming later"
          hint="The interface is structured to support these; nobody has translated them yet."
        >
          {PLANNED_LOCALES.map((code) => (
            <StatusPill key={code} tone="muted">
              {PLANNED_LOCALE_NAMES[code] ?? code}
            </StatusPill>
          ))}
        </SettingRow>
      </SettingCard>

      <SettingCard title="How this locale writes things">
        <SettingRow label="Dates" hint="Today, in this locale's own order and words.">
          <code>{formatDate(locale, now)}</code>
        </SettingRow>
        <SettingRow label="Times" hint="The current time, in this locale's own convention.">
          <code>{formatTime(locale, now)}</code>
        </SettingRow>
        <SettingRow
          label="Numbers"
          hint="An example number, grouped the way this locale groups them."
        >
          <code>{formatNumber(locale, 1234567.89)}</code>
        </SettingRow>
        <p className="s-note">
          Every date, time and number this application shows follows the language above — there is
          no separate format to choose, the same way there is not in most software that gets this
          right.
        </p>
      </SettingCard>
    </>
  );
}

function WorkspaceSection() {
  const startup = usePreferences((p) => p.startup);
  const lastProjectPath = usePreferences((p) => p.lastProjectPath);
  const set = usePreferences((p) => p.set);

  return (
    <SettingCard title="Startup">
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
      <SettingRow
        label="Last project"
        hint="Recorded automatically whenever you open or save one. Used when On startup is set to Last project — one that has since moved or been deleted is quietly forgotten rather than shown as an error."
      >
        {lastProjectPath ? (
          <code>{lastProjectPath}</code>
        ) : (
          <StatusPill tone="muted">None yet</StatusPill>
        )}
      </SettingRow>
    </SettingCard>
  );
}

function ProjectsSection() {
  const projectFolder = usePreferences((p) => p.projectFolder);
  const set = usePreferences((p) => p.set);
  const about = useEditor((s) => s.about);

  const browse = () => {
    void ipc.pickFolder().then((chosen) => {
      if (chosen) set('projectFolder', chosen);
    });
  };

  return (
    <>
      <SettingCard title="Where they open from">
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
            browseTitle={
              ipc.live ? undefined : 'Needs the desktop runtime, not this browser preview'
            }
          />
        </SettingRow>
      </SettingCard>

      <SettingCard title="Format">
        <SettingRow label="Project file format" hint="What a saved .encastra file is written as.">
          <code>schema {about?.projectSchema ?? '?'}</code>
        </SettingRow>
      </SettingCard>

      <SettingCard title="Not built yet">
        <p className="s-copy">
          There is no recent-projects list. Settings are per machine rather than per project — a
          project opened on a different machine does not carry its own preferences with it, only the
          graph itself.
        </p>
      </SettingCard>
    </>
  );
}

const SHORTCUTS: readonly { readonly keys: string; readonly action: string }[] = [
  {
    keys: 'Ctrl / Cmd + Enter',
    action: 'Run the workflow, or start watching if it opens with a trigger',
  },
  { keys: 'Ctrl / Cmd + S', action: 'Save' },
  { keys: 'Ctrl / Cmd + Shift + S', action: 'Save as' },
  { keys: 'Ctrl / Cmd + O', action: 'Open a project' },
  { keys: 'Ctrl / Cmd + Z', action: 'Undo' },
  { keys: 'Ctrl / Cmd + Shift + Z', action: 'Redo' },
  { keys: 'Ctrl / Cmd + Y', action: 'Redo' },
  { keys: 'Ctrl / Cmd + C', action: 'Copy the selection' },
  { keys: 'Ctrl / Cmd + V', action: 'Paste' },
  { keys: 'Ctrl / Cmd + D', action: 'Duplicate the selection' },
  { keys: 'Ctrl / Cmd + A', action: 'Select all' },
  { keys: 'Delete / Backspace', action: 'Delete the selection' },
];

function EditorSection() {
  return (
    <>
      <SettingCard title="Keyboard shortcuts">
        <table className="table">
          <thead>
            <tr>
              <th>Shortcut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((shortcut) => (
              <tr key={shortcut.keys}>
                <td>
                  <code>{shortcut.keys}</code>
                </td>
                <td>{shortcut.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="s-note">
          Fixed today rather than remappable. None of these fire while you are typing into a text
          field.
        </p>
      </SettingCard>

      <SettingCard title="Not built yet">
        <p className="s-copy">
          Autosave, a configurable save interval, and customising the shortcuts above are not built
          yet.
        </p>
      </SettingCard>
    </>
  );
}

function CanvasSection() {
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
    <>
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
        <SettingRow
          label="Runtime"
          hint="Whether a real Encastra runtime is attached to this window."
        >
          <StatusPill tone={ipc.live ? 'ok' : 'warn'}>
            {ipc.live ? 'Attached' : 'Not attached — browser preview'}
          </StatusPill>
        </SettingRow>
      </SettingCard>

      <SettingCard title="Not built yet">
        <p className="s-copy">
          Running steps in parallel, execution timeouts, retry limits and per-run resource limits
          are not configurable. A workflow runs its steps in the order validation settled on, to
          completion or failure, with whatever time and memory the machine gives it.
        </p>
      </SettingCard>
    </>
  );
}

function ComponentsSection({ onOpenSecurity }: { onOpenSecurity: () => void }) {
  const manifests = useEditor((s) => s.manifests);
  const summary = summarizeComponents(manifests);
  const all = Object.values(manifests).sort((a, b) => a.id.localeCompare(b.id));

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

      <SettingCard title="Every component, and what it can reach">
        <table className="table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Version</th>
              <th>Source</th>
              <th>Can reach</th>
            </tr>
          </thead>
          <tbody>
            {all.map((manifest) => {
              const reach = reachOf(manifest);
              return (
                <tr key={`${manifest.id}@${manifest.version}`}>
                  <td>
                    <strong>{manifest.name}</strong>
                    <br />
                    <code className="table__id">{manifest.id}</code>
                  </td>
                  <td>{manifest.version}</td>
                  <td>
                    <span className="badge badge--ok">
                      {manifest.kind === 'core' ? 'built in' : 'third-party'}
                    </span>
                  </td>
                  <td>
                    {reach.length === 0 ? (
                      <span className="table__none">nothing</span>
                    ) : (
                      reach.map((capability) => (
                        <span
                          className="table__reach"
                          key={capability.kind}
                          title={capability.reason}
                        >
                          {capabilityLabel(capability.kind)}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="s-note">
          Nothing outside this list is installed, and nothing here can reach anything its own row
          does not name — no arbitrary file access, no shell, no network beyond what is listed.
        </p>
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
      <SettingRow label="Signing" hint="Whether this build can prove who produced it.">
        <StatusPill tone="warn">Not signed</StatusPill>
      </SettingRow>
      <SettingRow
        label="Third-party components"
        hint="Whether anything outside this build can be installed and run."
      >
        <StatusPill tone="muted">Not possible yet — the sandbox is not built</StatusPill>
      </SettingRow>
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
      <SettingCard title="What this application could collect, and does not">
        <SettingRow
          label="Telemetry"
          hint="Usage data — which features get used, how often — sent to a server so a team could prioritise its work."
        >
          <StatusPill tone="ok">None collected</StatusPill>
        </SettingRow>
        <SettingRow
          label="Crash reports"
          hint="A stack trace and a build version, sent automatically when something fails, so it could be fixed without you filing it yourself."
        >
          <StatusPill tone="ok">None collected</StatusPill>
        </SettingRow>
        <SettingRow
          label="Usage analytics"
          hint="Feature counts, session length, or anything else that would turn how you use this application into a number on someone else's dashboard."
        >
          <StatusPill tone="ok">None collected</StatusPill>
        </SettingRow>
        <p className="s-note">
          All three would need a server to send to. There is none — an "off" switch here would imply
          a mechanism that does not exist.
        </p>
      </SettingCard>

      <SettingCard title="Account">
        <SettingRow
          label="Sign-in"
          hint="An identity tied to this application, the way most software with a server asks for one."
        >
          <StatusPill tone="ok">None — there is no server to sign in to</StatusPill>
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

function NotificationsSection() {
  const notifications = useEditor((s) => s.notifications);

  return (
    <>
      <SettingCard title="In this window">
        <SettingRow
          label="Toast notifications"
          hint="A workflow can ask to show one, using the same system.notify capability as any other permission — declared in its manifest and allowed before anything appears."
        >
          <StatusPill tone="ok">{notifications.length} shown this session</StatusPill>
        </SettingRow>
        <p className="s-note">
          Up to the most recent 20 are kept while the window is open; dismissing them clears the
          list. Closing the application forgets them, the same as everything else that is not a
          saved project.
        </p>
      </SettingCard>

      <SettingCard title="Not built yet">
        <p className="s-copy">
          There is no operating-system notification permission, no email, and no push notification —
          nothing reaches you outside this window. A history of past notifications beyond the
          current session is not built either.
        </p>
      </SettingCard>
    </>
  );
}

function FilesSection() {
  return (
    <>
      <SettingCard title="What lives on disk">
        <dl className="kv kv--wide">
          <dt>Projects</dt>
          <dd>
            <code>.encastra</code> files, wherever you choose to save them — see Projects for the
            default folder.
          </dd>
          <dt>Preferences</dt>
          <dd>
            Browser storage in this application's own origin, not a file you can open directly.
          </dd>
          <dt>Component data</dt>
          <dd>
            None. Every component in this build is compiled in; nothing is downloaded or cached.
          </dd>
          <dt>Logs</dt>
          <dd>
            None written to disk. A run journal is held in memory while the window is open and
            discarded when it closes.
          </dd>
        </dl>
      </SettingCard>

      <SettingCard title="Not built yet">
        <p className="s-copy">
          There is no import or export of settings, and no way to move preferences between machines
          short of setting them again there. A project itself is already portable — it is one file —
          but the preferences on this screen are not.
        </p>
      </SettingCard>
    </>
  );
}

function UpdatesSection() {
  const about = useEditor((s) => s.about);

  return (
    <>
      <SettingCard title="This build">
        <SettingRow label="Version" hint="The build you are running.">
          <code>{about?.version ?? 'unknown'}</code>
        </SettingRow>
        <SettingRow
          label="How a newer one reaches this machine"
          hint="What happens when a new version ships."
        >
          <span className="s-fact">
            No update channel. Updating means downloading a fresh installer and replacing this one.
          </span>
        </SettingRow>
      </SettingCard>

      <SettingCard title="Verifying what you install">
        <p className="s-copy">
          Builds are not code-signed, so Windows will warn about an unrecognised publisher — an
          accurate warning, since nothing here proves who produced the file. Each release publishes
          a SHA-256 hash instead, to check an installer against before running it.
        </p>
      </SettingCard>

      <SettingCard title="Not built yet">
        <p className="s-copy">
          Automatic update checks, update channels as a working mechanism, and background downloads
          are not built. Checking for a new version today means checking by hand.
        </p>
      </SettingCard>
    </>
  );
}

function AccountSection() {
  return (
    <SettingCard title="No accounts">
      <p className="s-copy">
        There is no sign-in, no account, and no server for one to talk to. Nothing here has a
        subscription, a plan, a session, or a list of devices to manage — every project and every
        preference on this screen lives on this machine, and only on this machine.
      </p>
    </SettingCard>
  );
}

function DeveloperSection() {
  const developerMode = usePreferences((p) => p.developerMode);
  const set = usePreferences((p) => p.set);
  const resetAll = usePreferences((p) => p.resetAll);
  const preferences = usePreferences((s) => s);
  const manifests = useEditor((s) => s.manifests);

  const preferenceValues = Object.fromEntries(
    PREFERENCE_KEYS.map((key) => [key, preferences[key]]),
  );

  const componentSummary = Object.values(manifests).map((manifest) => ({
    id: manifest.id,
    schema: manifest.schema,
    version: manifest.version,
    kind: manifest.kind,
    reaches: reachOf(manifest).map((capability) => capability.kind),
  }));

  return (
    <>
      <SettingCard title="Internals">
        <SettingRow
          label="Developer mode"
          hint="Surfaces the raw preference values and a compact summary of every loaded component, below."
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

      {developerMode ? (
        <>
          <SettingCard title="Current preferences">
            <Pre>{JSON.stringify(preferenceValues, null, 2)}</Pre>
          </SettingCard>
          <SettingCard title="Loaded components">
            <Pre>{JSON.stringify(componentSummary, null, 2)}</Pre>
          </SettingCard>
        </>
      ) : (
        <SettingCard title="Currently hidden">
          <p className="s-copy">
            Turn on developer mode above to see the raw preference values and a summary of every
            loaded component.
          </p>
        </SettingCard>
      )}

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

function DiagnosticsSection() {
  const about = useEditor((s) => s.about);
  const manifests = useEditor((s) => s.manifests);
  const [gpu] = useState<string | null>(() => detectGpuRenderer());
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (copyState === 'idle') return;
    const id = setTimeout(() => setCopyState('idle'), 2000);
    return () => clearTimeout(id);
  }, [copyState]);

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const rows = assembleDiagnostics({
    about,
    manifests,
    runtimeAttached: ipc.live,
    userAgent,
    platform: detectPlatform(userAgent),
    architecture: detectArchitecture(userAgent),
    gpu,
  });
  const text = diagnosticsToText(rows);

  const onCopy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setCopyState('failed');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => setCopyState('copied'),
      () => setCopyState('failed'),
    );
  };

  const onExport = () => {
    try {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'encastra-diagnostics.txt';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // Best effort: nothing to recover to if the WebView refuses a synthetic download.
    }
  };

  return (
    <>
      <SettingCard title="This machine and this build">
        <dl className="kv kv--wide">
          {rows.map((row) => (
            <Fragment key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </Fragment>
          ))}
        </dl>
      </SettingCard>

      <SettingCard title="Share it">
        <SettingRow label="Copy" hint="Copies every line above to the clipboard, exactly as shown.">
          <Button onClick={onCopy}>Copy</Button>
          {copyState === 'copied' ? <StatusPill tone="ok">Copied</StatusPill> : null}
          {copyState === 'failed' ? <StatusPill tone="warn">Could not copy</StatusPill> : null}
        </SettingRow>
        <SettingRow label="Export" hint="Saves the same report as a text file.">
          <Button onClick={onExport}>Export…</Button>
        </SettingRow>
        <p className="s-note">
          Nothing here includes a project path, a preference value, or a token — it is meant to be
          safe to paste somewhere public.
        </p>
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
    case 'appearance':
      return <AppearanceSection />;
    case 'language':
      return <LanguageSection />;
    case 'workspace':
      return <WorkspaceSection />;
    case 'projects':
      return <ProjectsSection />;
    case 'editor':
      return <EditorSection />;
    case 'canvas':
      return <CanvasSection />;
    case 'runtime':
      return <RuntimeSection />;
    case 'components':
      return <ComponentsSection onOpenSecurity={onOpenSecurity} />;
    case 'security':
      return <SecuritySection onOpenSecurity={onOpenSecurity} />;
    case 'privacy':
      return <PrivacySection />;
    case 'notifications':
      return <NotificationsSection />;
    case 'files':
      return <FilesSection />;
    case 'updates':
      return <UpdatesSection />;
    case 'account':
      return <AccountSection />;
    case 'developer':
      return <DeveloperSection />;
    case 'diagnostics':
      return <DiagnosticsSection />;
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
