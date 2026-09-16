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
 *
 * Every word on this screen goes through `t()`, the same reactive path `Home.tsx` and
 * `Palette.tsx` use: `useTranslation()` re-renders this tree whenever the active locale changes,
 * so switching language in the Language category relabels this screen too, live, with no reload.
 */

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { chooseFolderOrExplain } from '../chooser';
import {
  formatDate,
  formatNumber,
  formatTime,
  LOCALE_NAMES,
  LOCALES,
  type Locale,
  loadLocale,
  PLANNED_LOCALES,
  translateIn,
  useI18n,
  useTranslation,
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
  renderDiagnostics,
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
  const { t } = useTranslation();
  const startup = usePreferences((p) => p.startup);
  const set = usePreferences((p) => p.set);

  return (
    <SettingCard title={t('settings.general.title')}>
      <SettingRow
        label={t('settings.general.welcomeTour.label')}
        hint={t('settings.general.welcomeTour.hint')}
      >
        <Button onClick={() => set('welcomeSeen', false)}>
          {t('settings.general.welcomeTour.button')}
        </Button>
      </SettingRow>
      <SettingRow
        label={t('settings.shared.startup.label')}
        hint={t('settings.shared.startup.hint')}
      >
        <Segmented
          legend={t('settings.shared.startup.label')}
          value={startup}
          onChange={(value) => set('startup', value)}
          options={[
            { value: 'home', label: t('settings.shared.startup.options.home') },
            { value: 'last-project', label: t('settings.shared.startup.options.lastProject') },
          ]}
        />
      </SettingRow>
    </SettingCard>
  );
}

function AppearanceSection() {
  const { t } = useTranslation();
  const theme = usePreferences((p) => p.theme);
  const motion = usePreferences((p) => p.motion);
  const set = usePreferences((p) => p.set);

  return (
    <SettingCard title={t('settings.appearance.title')}>
      <SettingRow
        label={t('settings.appearance.theme.label')}
        hint={t('settings.appearance.theme.hint')}
      >
        <Segmented
          legend={t('settings.appearance.theme.label')}
          value={theme}
          onChange={(value) => set('theme', value)}
          options={[
            { value: 'system', label: t('settings.appearance.theme.options.system') },
            { value: 'light', label: t('settings.appearance.theme.options.light') },
            { value: 'dark', label: t('settings.appearance.theme.options.dark') },
          ]}
        />
      </SettingRow>
      <SettingRow
        label={t('settings.appearance.motion.label')}
        hint={t('settings.appearance.motion.hint')}
      >
        <Segmented
          legend={t('settings.appearance.motion.label')}
          value={motion}
          onChange={(value) => set('motion', value)}
          options={[
            { value: 'system', label: t('settings.appearance.motion.options.system') },
            { value: 'reduced', label: t('settings.appearance.motion.options.reduced') },
          ]}
        />
      </SettingRow>
    </SettingCard>
  );
}

/** Display names for the locales the architecture is ready for but nobody has translated yet.
 * `i18n/index.ts` has no reason to name a locale it cannot render — these live here, next to the
 * only place that shows them. Native-script proper nouns, the same as `LOCALE_NAMES` itself, so
 * neither is translated. */
const PLANNED_LOCALE_NAMES: Record<string, string> = {
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
};

function LanguageSection() {
  const { t, locale } = useTranslation();
  const setLocale = useI18n((s) => s.setLocale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (next: Locale) => {
    if (next === locale || pending) return;
    setPending(true);
    setError(null);
    loadLocale(next)
      .then(() => setLocale(next))
      .catch(() =>
        setError(t('settings.language.interface.loadError', { name: LOCALE_NAMES[next] })),
      )
      .finally(() => setPending(false));
  };

  const now = new Date();

  return (
    <>
      <SettingCard title={t('settings.language.interface.title')}>
        <SettingRow
          label={t('settings.language.interface.picker.label')}
          hint={t('settings.language.interface.picker.hint')}
        >
          <Segmented
            legend={t('settings.language.interface.picker.label')}
            value={locale}
            onChange={choose}
            disabled={pending}
            options={LOCALES.map((code) => ({ value: code, label: LOCALE_NAMES[code] }))}
          />
        </SettingRow>
        {pending ? <p className="s-note">{t('settings.language.interface.loading')}</p> : null}
        {error ? <p className="s-note">{error}</p> : null}
        <SettingRow
          label={t('settings.language.interface.comingLater.label')}
          hint={t('settings.language.interface.comingLater.hint')}
        >
          {PLANNED_LOCALES.map((code) => (
            <StatusPill key={code} tone="muted">
              {PLANNED_LOCALE_NAMES[code] ?? code}
            </StatusPill>
          ))}
        </SettingRow>
      </SettingCard>

      <SettingCard title={t('settings.language.formatting.title')}>
        <SettingRow
          label={t('settings.language.formatting.dates.label')}
          hint={t('settings.language.formatting.dates.hint')}
        >
          <code>{formatDate(locale, now)}</code>
        </SettingRow>
        <SettingRow
          label={t('settings.language.formatting.times.label')}
          hint={t('settings.language.formatting.times.hint')}
        >
          <code>{formatTime(locale, now)}</code>
        </SettingRow>
        <SettingRow
          label={t('settings.language.formatting.numbers.label')}
          hint={t('settings.language.formatting.numbers.hint')}
        >
          <code>{formatNumber(locale, 1234567.89)}</code>
        </SettingRow>
        <p className="s-note">{t('settings.language.formatting.note')}</p>
      </SettingCard>
    </>
  );
}

function WorkspaceSection() {
  const { t } = useTranslation();
  const startup = usePreferences((p) => p.startup);
  const lastProjectPath = usePreferences((p) => p.lastProjectPath);
  const set = usePreferences((p) => p.set);

  return (
    <SettingCard title={t('settings.workspace.title')}>
      <SettingRow
        label={t('settings.shared.startup.label')}
        hint={t('settings.shared.startup.hint')}
      >
        <Segmented
          legend={t('settings.shared.startup.label')}
          value={startup}
          onChange={(value) => set('startup', value)}
          options={[
            { value: 'home', label: t('settings.shared.startup.options.home') },
            { value: 'last-project', label: t('settings.shared.startup.options.lastProject') },
          ]}
        />
      </SettingRow>
      <SettingRow
        label={t('settings.workspace.lastProject.label')}
        hint={t('settings.workspace.lastProject.hint')}
      >
        {lastProjectPath ? (
          <code>{lastProjectPath}</code>
        ) : (
          <StatusPill tone="muted">{t('settings.workspace.lastProject.none')}</StatusPill>
        )}
      </SettingRow>
    </SettingCard>
  );
}

function ProjectsSection() {
  const { t } = useTranslation();
  const projectFolder = usePreferences((p) => p.projectFolder);
  const set = usePreferences((p) => p.set);
  const about = useEditor((s) => s.about);
  // The same local-note pattern `LanguageSection` above uses for a locale that would not load:
  // one string, cleared when the next attempt starts, rendered as an `s-note` under the control
  // it is about. This category had no error surface at all, which is why a refused folder here
  // was the most invisible of the four.
  const [error, setError] = useState<string | null>(null);

  const browse = () => {
    // A preference, and only a preference. This used to share one record with grants, publishing
    // and importing, so browsing here quietly made this folder writable by a component and
    // publishable into. Under its own purpose it answers only the question it was asked.
    //
    // And the runtime can say no to the folder that was picked — a sensitive root, a startup
    // folder — which arrived here as an unhandled rejection: the Browse button appeared to do
    // nothing, forever. Cancelling still does nothing, because nothing was refused.
    setError(null);
    void chooseFolderOrExplain('projects-location', setError).then((chosen) => {
      if (chosen) set('projectFolder', chosen);
    });
  };

  return (
    <>
      <SettingCard title={t('settings.projects.location.title')}>
        <SettingRow
          label={t('settings.projects.location.label')}
          hint={t('settings.projects.location.hint')}
          htmlFor="pref-project-folder"
        >
          <FolderField
            id="pref-project-folder"
            value={projectFolder}
            placeholder={t('settings.projects.location.placeholder')}
            onChange={(value) => set('projectFolder', value)}
            onBrowse={browse}
            browseDisabled={!ipc.live}
            browseLabel={t('settings.projects.location.browse')}
            browseTitle={ipc.live ? undefined : t('settings.projects.location.browseUnavailable')}
          />
        </SettingRow>
        {error ? <p className="s-note">{error}</p> : null}
      </SettingCard>

      <SettingCard title={t('settings.projects.format.title')}>
        <SettingRow
          label={t('settings.projects.format.label')}
          hint={t('settings.shared.projectFormatHint')}
        >
          <code>{t('settings.shared.schemaValue', { value: about?.projectSchema ?? '?' })}</code>
        </SettingRow>
      </SettingCard>

      <SettingCard title={t('settings.projects.notBuilt.title')}>
        <p className="s-copy">{t('settings.projects.notBuilt.copy')}</p>
      </SettingCard>
    </>
  );
}

/** One entry per row of the shortcuts table. `keys` is a literal key combination, not natural
 * language, and stays as written in every locale — the same reasoning that keeps `.encastra` and
 * file paths untranslated elsewhere on this screen. `actionKey` is looked up in
 * `settings.editor.shortcuts.actions` at render time, so the description of what the shortcut
 * does is translated like everything else. */
const SHORTCUTS: readonly { readonly keys: string; readonly actionKey: string }[] = [
  { keys: 'Ctrl / Cmd + Enter', actionKey: 'runOrWatch' },
  { keys: 'Ctrl / Cmd + S', actionKey: 'save' },
  { keys: 'Ctrl / Cmd + Shift + S', actionKey: 'saveAs' },
  { keys: 'Ctrl / Cmd + O', actionKey: 'openProject' },
  { keys: 'Ctrl / Cmd + Z', actionKey: 'undo' },
  { keys: 'Ctrl / Cmd + Shift + Z', actionKey: 'redo' },
  { keys: 'Ctrl / Cmd + Y', actionKey: 'redo' },
  { keys: 'Ctrl / Cmd + C', actionKey: 'copySelection' },
  { keys: 'Ctrl / Cmd + V', actionKey: 'paste' },
  { keys: 'Ctrl / Cmd + D', actionKey: 'duplicateSelection' },
  { keys: 'Ctrl / Cmd + A', actionKey: 'selectAll' },
  { keys: 'Delete / Backspace', actionKey: 'deleteSelection' },
  // The three that belong to the canvas rather than to the window. They are listed for the
  // reason the note below the table gives: a shortcut nobody can find is folklore — and joining
  // two steps without a mouse is not a convenience, it is the only way somebody who cannot use
  // one builds anything at all.
  { keys: 'C', actionKey: 'connectFromStep' },
  { keys: 'E', actionKey: 'cycleConnections' },
  { keys: 'Delete / Backspace', actionKey: 'deleteConnection' },
];

function EditorSection() {
  const { t } = useTranslation();

  return (
    <>
      <SettingCard title={t('settings.editor.shortcuts.title')}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('settings.editor.shortcuts.table.shortcut')}</th>
              <th>{t('settings.editor.shortcuts.table.action')}</th>
            </tr>
          </thead>
          <tbody>
            {/* Keyed by both halves: one chord can do two things in two places — Delete removes
                the selected step, or the connection the canvas is holding — and a key of the
                chord alone would collide. */}
            {SHORTCUTS.map((shortcut) => (
              <tr key={`${shortcut.keys}-${shortcut.actionKey}`}>
                <td>
                  <code>{shortcut.keys}</code>
                </td>
                <td>{t(`settings.editor.shortcuts.actions.${shortcut.actionKey}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="s-note">{t('settings.editor.shortcuts.note')}</p>
      </SettingCard>

      <SettingCard title={t('settings.editor.notBuilt.title')}>
        <p className="s-copy">{t('settings.editor.notBuilt.copy')}</p>
      </SettingCard>
    </>
  );
}

function CanvasSection() {
  const { t } = useTranslation();
  const showGrid = usePreferences((p) => p.showGrid);
  const snapToGrid = usePreferences((p) => p.snapToGrid);
  const showMinimap = usePreferences((p) => p.showMinimap);
  const set = usePreferences((p) => p.set);

  return (
    <SettingCard title={t('settings.canvas.title')}>
      <SettingRow
        label={t('settings.canvas.grid.label')}
        hint={t('settings.canvas.grid.hint')}
        htmlFor="pref-show-grid"
      >
        <Toggle
          id="pref-show-grid"
          label={t('settings.canvas.grid.label')}
          checked={showGrid}
          onChange={(value) => set('showGrid', value)}
        />
      </SettingRow>
      <SettingRow
        label={t('settings.canvas.snapToGrid.label')}
        hint={t('settings.canvas.snapToGrid.hint')}
        htmlFor="pref-snap-to-grid"
      >
        <Toggle
          id="pref-snap-to-grid"
          label={t('settings.canvas.snapToGrid.label')}
          checked={snapToGrid}
          onChange={(value) => set('snapToGrid', value)}
        />
      </SettingRow>
      <SettingRow
        label={t('settings.canvas.minimap.label')}
        hint={t('settings.canvas.minimap.hint')}
        htmlFor="pref-show-minimap"
      >
        <Toggle
          id="pref-show-minimap"
          label={t('settings.canvas.minimap.label')}
          checked={showMinimap}
          onChange={(value) => set('showMinimap', value)}
        />
      </SettingRow>
    </SettingCard>
  );
}

function RuntimeSection() {
  const { t } = useTranslation();
  const openRunPanelOnRun = usePreferences((p) => p.openRunPanelOnRun);
  const set = usePreferences((p) => p.set);

  return (
    <>
      <SettingCard title={t('settings.runtime.runs.title')}>
        <SettingRow
          label={t('settings.runtime.runs.openRunPanel.label')}
          hint={t('settings.runtime.runs.openRunPanel.hint')}
          htmlFor="pref-run-panel"
        >
          <Toggle
            id="pref-run-panel"
            label={t('settings.runtime.runs.openRunPanel.toggleLabel')}
            checked={openRunPanelOnRun}
            onChange={(value) => set('openRunPanelOnRun', value)}
          />
        </SettingRow>
        <SettingRow
          label={t('settings.shared.runtimeStatus.label')}
          hint={t('settings.shared.runtimeStatus.hint')}
        >
          <StatusPill tone={ipc.live ? 'ok' : 'warn'}>
            {ipc.live
              ? t('settings.shared.runtimeStatus.attached')
              : t('settings.shared.runtimeStatus.notAttached')}
          </StatusPill>
        </SettingRow>
      </SettingCard>

      <SettingCard title={t('settings.runtime.notBuilt.title')}>
        <p className="s-copy">{t('settings.runtime.notBuilt.copy')}</p>
      </SettingCard>
    </>
  );
}

function ComponentsSection({ onOpenSecurity }: { onOpenSecurity: () => void }) {
  const { t } = useTranslation();
  const manifests = useEditor((s) => s.manifests);
  const summary = summarizeComponents(manifests);
  const all = Object.values(manifests).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <>
      <SettingCard title={t('settings.components.installed.title')}>
        <SettingRow
          label={t('settings.components.installed.components.label')}
          hint={t('settings.components.installed.components.hint')}
        >
          <StatusPill tone="ok">
            {t('settings.components.installed.components.builtIn', { count: summary.core })}
          </StatusPill>
        </SettingRow>
        <SettingRow
          label={t('settings.components.installed.thirdParty.label')}
          hint={t('settings.components.installed.thirdParty.hint')}
        >
          {summary.thirdParty > 0 ? (
            <StatusPill tone="ok">
              {t('settings.components.installed.thirdParty.installed', {
                count: summary.thirdParty,
              })}
            </StatusPill>
          ) : (
            <StatusPill tone="muted">
              {t('settings.components.installed.thirdParty.notBuilt')}
            </StatusPill>
          )}
        </SettingRow>
        <SettingRow
          label={t('settings.components.installed.permissionTable.label')}
          hint={t('settings.components.installed.permissionTable.hint')}
        >
          <Button onClick={onOpenSecurity}>{t('settings.shared.openSecurity')}</Button>
        </SettingRow>
      </SettingCard>

      <SettingCard title={t('settings.components.table.title')}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('settings.components.table.headers.component')}</th>
              <th>{t('settings.components.table.headers.version')}</th>
              <th>{t('settings.components.table.headers.source')}</th>
              <th>{t('settings.components.table.headers.canReach')}</th>
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
                      {manifest.kind === 'core'
                        ? t('settings.components.table.kind.core')
                        : t('settings.components.table.kind.thirdParty')}
                    </span>
                  </td>
                  <td>
                    {reach.length === 0 ? (
                      <span className="table__none">{t('settings.components.table.none')}</span>
                    ) : (
                      reach.map((capability) => (
                        <span
                          className="table__reach"
                          key={capability.kind}
                          title={capability.reason}
                        >
                          {capabilityLabel(capability.kind, t)}
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="s-note">{t('settings.components.table.note')}</p>
      </SettingCard>

      <SettingCard title={t('settings.components.installMore.title')}>
        <SettingRow
          label={t('settings.components.installMore.installFromFile.label')}
          hint={t('settings.components.installMore.installFromFile.hint')}
        >
          <StatusPill tone="muted">{t('settings.shared.notBuilt')}</StatusPill>
        </SettingRow>
        <p className="s-note">
          {t('settings.components.installMore.note', { count: summary.total })}
        </p>
      </SettingCard>
    </>
  );
}

function SecuritySection({ onOpenSecurity }: { onOpenSecurity: () => void }) {
  const { t } = useTranslation();
  const grants = useEditor((s) => s.grants);
  const grantCount = countGrants(grants);

  return (
    <SettingCard title={t('settings.security.title')}>
      <p className="s-copy">{t('settings.security.copy')}</p>
      <SettingRow
        label={t('settings.shared.signing.label')}
        hint={t('settings.shared.signing.hint')}
      >
        <StatusPill tone="warn">{t('settings.shared.signing.status')}</StatusPill>
      </SettingRow>
      <SettingRow
        label={t('settings.security.thirdParty.label')}
        hint={t('settings.security.thirdParty.hint')}
      >
        <StatusPill tone="muted">{t('settings.security.thirdParty.status')}</StatusPill>
      </SettingRow>
      <SettingRow
        label={t('settings.security.allowedInOpenWorkflow.label')}
        hint={t('settings.security.allowedInOpenWorkflow.hint')}
      >
        <StatusPill tone={grantCount > 0 ? 'warn' : 'ok'}>
          {grantCount === 0
            ? t('settings.security.allowedInOpenWorkflow.nothingAllowed')
            : t('settings.security.allowedInOpenWorkflow.allowed', { count: grantCount })}
        </StatusPill>
      </SettingRow>
      <SettingRow
        label={t('settings.security.fullDetail.label')}
        hint={t('settings.security.fullDetail.hint')}
      >
        <Button onClick={onOpenSecurity}>{t('settings.shared.openSecurity')}</Button>
      </SettingRow>
    </SettingCard>
  );
}

function PrivacySection() {
  const { t } = useTranslation();

  return (
    <>
      <SettingCard title={t('settings.privacy.collect.title')}>
        <SettingRow
          label={t('settings.privacy.collect.telemetry.label')}
          hint={t('settings.privacy.collect.telemetry.hint')}
        >
          <StatusPill tone="ok">{t('settings.shared.noneCollected')}</StatusPill>
        </SettingRow>
        <SettingRow
          label={t('settings.privacy.collect.crashReports.label')}
          hint={t('settings.privacy.collect.crashReports.hint')}
        >
          <StatusPill tone="ok">{t('settings.shared.noneCollected')}</StatusPill>
        </SettingRow>
        <SettingRow
          label={t('settings.privacy.collect.analytics.label')}
          hint={t('settings.privacy.collect.analytics.hint')}
        >
          <StatusPill tone="ok">{t('settings.shared.noneCollected')}</StatusPill>
        </SettingRow>
        <p className="s-note">{t('settings.privacy.collect.note')}</p>
      </SettingCard>

      <SettingCard title={t('settings.privacy.account.title')}>
        <SettingRow
          label={t('settings.privacy.account.signIn.label')}
          hint={t('settings.privacy.account.signIn.hint')}
        >
          <StatusPill tone="ok">{t('settings.privacy.account.signIn.status')}</StatusPill>
        </SettingRow>
      </SettingCard>

      <SettingCard title={t('settings.privacy.yourData.title')}>
        <SettingRow
          label={t('settings.privacy.yourData.projects.label')}
          hint={t('settings.privacy.yourData.projects.hint')}
        >
          <StatusPill tone="ok">{t('settings.privacy.yourData.projects.status')}</StatusPill>
        </SettingRow>
        <SettingRow
          label={t('settings.privacy.yourData.runJournals.label')}
          hint={t('settings.privacy.yourData.runJournals.hint')}
        >
          <StatusPill tone="ok">{t('settings.privacy.yourData.runJournals.status')}</StatusPill>
        </SettingRow>
      </SettingCard>
    </>
  );
}

function NotificationsSection() {
  const { t } = useTranslation();
  const notifications = useEditor((s) => s.notifications);

  return (
    <>
      <SettingCard title={t('settings.notifications.window.title')}>
        <SettingRow
          label={t('settings.notifications.window.toast.label')}
          hint={t('settings.notifications.window.toast.hint')}
        >
          <StatusPill tone="ok">
            {t('settings.notifications.window.toast.shown', { count: notifications.length })}
          </StatusPill>
        </SettingRow>
        <p className="s-note">{t('settings.notifications.window.note')}</p>
      </SettingCard>

      <SettingCard title={t('settings.notifications.notBuilt.title')}>
        <p className="s-copy">{t('settings.notifications.notBuilt.copy')}</p>
      </SettingCard>
    </>
  );
}

function FilesSection() {
  const { t } = useTranslation();

  return (
    <>
      <SettingCard title={t('settings.files.disk.title')}>
        <dl className="kv kv--wide">
          <dt>{t('settings.files.disk.projects.term')}</dt>
          <dd>
            <code>.encastra</code> {t('settings.files.disk.projects.detail')}
          </dd>
          <dt>{t('settings.files.disk.preferences.term')}</dt>
          <dd>{t('settings.files.disk.preferences.detail')}</dd>
          <dt>{t('settings.files.disk.componentData.term')}</dt>
          <dd>{t('settings.files.disk.componentData.detail')}</dd>
          <dt>{t('settings.files.disk.logs.term')}</dt>
          <dd>{t('settings.files.disk.logs.detail')}</dd>
        </dl>
      </SettingCard>

      <SettingCard title={t('settings.files.notBuilt.title')}>
        <p className="s-copy">{t('settings.files.notBuilt.copy')}</p>
      </SettingCard>
    </>
  );
}

function UpdatesSection() {
  const { t } = useTranslation();
  const about = useEditor((s) => s.about);

  return (
    <>
      <SettingCard title={t('settings.updates.thisBuild.title')}>
        <SettingRow
          label={t('settings.shared.version.label')}
          hint={t('settings.shared.version.hint')}
        >
          <code>{about?.version ?? t('settings.shared.version.unknown')}</code>
        </SettingRow>
        <SettingRow
          label={t('settings.updates.thisBuild.channel.label')}
          hint={t('settings.updates.thisBuild.channel.hint')}
        >
          <span className="s-fact">{t('settings.updates.thisBuild.channel.fact')}</span>
        </SettingRow>
      </SettingCard>

      <SettingCard title={t('settings.updates.verify.title')}>
        <p className="s-copy">{t('settings.updates.verify.copy')}</p>
      </SettingCard>

      <SettingCard title={t('settings.updates.notBuilt.title')}>
        <p className="s-copy">{t('settings.updates.notBuilt.copy')}</p>
      </SettingCard>
    </>
  );
}

function AccountSection() {
  const { t } = useTranslation();

  return (
    <SettingCard title={t('settings.account.title')}>
      <p className="s-copy">{t('settings.account.copy')}</p>
    </SettingCard>
  );
}

function DeveloperSection() {
  const { t } = useTranslation();
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
      <SettingCard title={t('settings.developer.internals.title')}>
        <SettingRow
          label={t('settings.developer.internals.developerMode.label')}
          hint={t('settings.developer.internals.developerMode.hint')}
          htmlFor="pref-developer-mode"
        >
          <Toggle
            id="pref-developer-mode"
            label={t('settings.developer.internals.developerMode.label')}
            checked={developerMode}
            onChange={(value) => set('developerMode', value)}
          />
        </SettingRow>
      </SettingCard>

      {developerMode ? (
        <>
          <SettingCard title={t('settings.developer.currentPreferences.title')}>
            <Pre>{JSON.stringify(preferenceValues, null, 2)}</Pre>
          </SettingCard>
          <SettingCard title={t('settings.developer.loadedComponents.title')}>
            <Pre>{JSON.stringify(componentSummary, null, 2)}</Pre>
          </SettingCard>
        </>
      ) : (
        <SettingCard title={t('settings.developer.hidden.title')}>
          <p className="s-copy">{t('settings.developer.hidden.copy')}</p>
        </SettingCard>
      )}

      <SettingCard title={t('settings.developer.reset.title')}>
        <SettingRow
          label={t('settings.developer.reset.restoreDefaults.label')}
          hint={t('settings.developer.reset.restoreDefaults.hint')}
        >
          <DangerButton onClick={resetAll}>
            {t('settings.developer.reset.restoreDefaults.button')}
          </DangerButton>
        </SettingRow>
      </SettingCard>
    </>
  );
}

function DiagnosticsSection() {
  const { t } = useTranslation();
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
  // The card says two different things at once, on purpose.
  //
  // What is on screen is in the reader's language, like every other category — a table of
  // English rows under translated headings would have been the one part of Settings that never
  // changed. What the Copy and Export buttons hand over is English, because a diagnostics report
  // is pasted into a bug tracker where anybody on the project has to be able to read it, and a
  // report nobody can read is worse than one in a language the reporter did not choose.
  //
  // `assembleDiagnostics` returns keys rather than text so the same rows can be rendered twice,
  // and the note under the buttons says plainly that the report is in English. Both of those
  // matter: a promise of "exactly as shown" that had quietly stopped being true would be worse
  // than either behaviour on its own.
  const rows = assembleDiagnostics({
    about,
    manifests,
    runtimeAttached: ipc.live,
    userAgent,
    platform: detectPlatform(userAgent),
    architecture: detectArchitecture(userAgent),
    gpu,
  });
  const shown = renderDiagnostics(rows, t);
  const text = diagnosticsToText(renderDiagnostics(rows, (key) => translateIn('en', key)));

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
      <SettingCard title={t('settings.diagnostics.machine.title')}>
        <dl className="kv kv--wide">
          {shown.map((row) => (
            <Fragment key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </Fragment>
          ))}
        </dl>
      </SettingCard>

      <SettingCard title={t('settings.diagnostics.share.title')}>
        <SettingRow
          label={t('settings.diagnostics.share.copy.label')}
          hint={t('settings.diagnostics.share.copy.hint')}
        >
          <Button onClick={onCopy}>{t('settings.diagnostics.share.copy.button')}</Button>
          {copyState === 'copied' ? (
            <StatusPill tone="ok">{t('settings.diagnostics.share.copy.copied')}</StatusPill>
          ) : null}
          {copyState === 'failed' ? (
            <StatusPill tone="warn">{t('settings.diagnostics.share.copy.failed')}</StatusPill>
          ) : null}
        </SettingRow>
        <SettingRow
          label={t('settings.diagnostics.share.export.label')}
          hint={t('settings.diagnostics.share.export.hint')}
        >
          <Button onClick={onExport}>{t('settings.diagnostics.share.export.button')}</Button>
        </SettingRow>
        <p className="s-note">{t('settings.diagnostics.share.note')}</p>
      </SettingCard>
    </>
  );
}

function AboutSection() {
  const { t } = useTranslation();
  const about = useEditor((s) => s.about);

  return (
    <>
      <SettingCard title={t('settings.about.brand.title')}>
        <div className="s-brand">
          <Mark />
          <div>
            <p className="s-brand__name">{t('settings.about.brand.title')}</p>
            <p className="s-brand__tagline">{t('settings.about.brand.tagline')}</p>
          </div>
        </div>
      </SettingCard>

      <SettingCard title={t('settings.about.thisBuild.title')}>
        <SettingRow
          label={t('settings.shared.version.label')}
          hint={t('settings.shared.version.hint')}
        >
          <code>{about?.version ?? t('settings.shared.version.unknown')}</code>
        </SettingRow>
        <SettingRow
          label={t('settings.shared.runtimeStatus.label')}
          hint={t('settings.shared.runtimeStatus.hint')}
        >
          <StatusPill tone={ipc.live ? 'ok' : 'warn'}>
            {ipc.live
              ? t('settings.shared.runtimeStatus.attached')
              : t('settings.shared.runtimeStatus.notAttached')}
          </StatusPill>
        </SettingRow>
        <SettingRow
          label={t('settings.about.thisBuild.componentProtocol.label')}
          hint={t('settings.about.thisBuild.componentProtocol.hint')}
        >
          <code>{t('settings.shared.schemaValue', { value: about?.protocolSchema ?? '?' })}</code>
        </SettingRow>
        <SettingRow
          label={t('settings.about.thisBuild.projectFormat.label')}
          hint={t('settings.shared.projectFormatHint')}
        >
          <code>{t('settings.shared.schemaValue', { value: about?.projectSchema ?? '?' })}</code>
        </SettingRow>
        <SettingRow
          label={t('settings.shared.signing.label')}
          hint={t('settings.shared.signing.hint')}
        >
          <StatusPill tone="warn">{t('settings.shared.signing.status')}</StatusPill>
        </SettingRow>
        <SettingRow
          label={t('settings.about.thisBuild.updates.label')}
          hint={t('settings.about.thisBuild.updates.hint')}
        >
          <span className="s-fact">{t('settings.about.thisBuild.updates.fact')}</span>
        </SettingRow>
      </SettingCard>

      <SettingCard title={t('settings.about.readMore.title')}>
        <ul className="s-links">
          <li>
            <code>README.md</code>
            {t('settings.about.readMore.readme')}
          </li>
          <li>
            <code>docs/SECURITY.md</code>
            {t('settings.about.readMore.security')}
          </li>
          <li>
            <code>docs/RELEASE.md</code>
            {t('settings.about.readMore.release')}
          </li>
          <li>
            <code>docs/PRODUCT-ROADMAP.md</code>
            {t('settings.about.readMore.roadmap')}
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
  const { t } = useTranslation();
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
        <nav className="settings__nav" aria-label={t('settings.nav.ariaLabel')}>
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
              {t(`settings.categories.${item.id}.label`)}
            </button>
          ))}
        </nav>

        <div className="settings__content">
          <header className="view__header">
            <p className="settings__eyebrow">{t('settings.eyebrow')}</p>
            <h1>{t(`settings.categories.${category.id}.label`)}</h1>
            <p>{t(`settings.categories.${category.id}.description`)}</p>
          </header>

          {sectionFor(category.id, openSecurity)}
        </div>
      </div>
    </main>
  );
}
