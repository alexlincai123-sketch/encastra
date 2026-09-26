/**
 * What this machine has agreed to.
 *
 * The point of a screen like this is not to reassure. It is to make the permission model
 * legible: what is installed, what each thing can reach, what it was actually allowed in the
 * workflow that is open, and what the product does **not** protect against.
 */

import { componentName } from '../component-text';
import { splitOnPlaceholder, useTranslation } from '../i18n';
import { ipc } from '../ipc';
import { capabilityLabel } from '../settings/categories';
import { useEditor } from '../store';

export function Security() {
  const manifests = useEditor((s) => s.manifests);
  const nodes = useEditor((s) => s.nodes);
  const grants = useEditor((s) => s.grants);
  const about = useEditor((s) => s.about);
  const { t } = useTranslation();

  const all = Object.values(manifests);
  const thirdParty = all.filter((m) => m.kind !== 'core');

  // Split around `{notBuilt}` once, the same way `canvas/Canvas.tsx` splits its own bridge
  // sentence — see `i18n/index.ts` — so the emphasised word can sit in its own `<strong>` no
  // matter where a translation puts it in the sentence.
  const [thirdPartyBefore, thirdPartyAfter] = splitOnPlaceholder(
    t('security.installed.thirdPartyNote'),
    'notBuilt',
  );

  return (
    <main className="view view--security">
      <header className="view__header">
        <h1>{t('security.title')}</h1>
        <p>{t('security.intro')}</p>
      </header>

      <section className="panel-block">
        <h2>{t('security.installed.title')}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>{t('security.installed.headers.component')}</th>
              <th>{t('security.installed.headers.version')}</th>
              <th>{t('security.installed.headers.origin')}</th>
              <th>{t('security.installed.headers.canReach')}</th>
            </tr>
          </thead>
          <tbody>
            {all
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((manifest) => {
                const reach = manifest.capabilities.filter((c) => c.scope !== 'input-handles');
                return (
                  <tr key={`${manifest.id}@${manifest.version}`}>
                    <td>
                      <strong>{componentName(manifest)}</strong>
                      <br />
                      <code className="table__id">{manifest.id}</code>
                    </td>
                    <td>{manifest.version}</td>
                    <td>
                      <span className="badge badge--ok">{t('security.installed.builtIn')}</span>
                    </td>
                    <td>
                      {reach.length === 0 ? (
                        <span className="table__none">{t('security.installed.nothing')}</span>
                      ) : (
                        reach.map((c) => (
                          <span className="table__reach" key={c.kind} title={c.reason}>
                            {capabilityLabel(c.kind, t)}
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {thirdParty.length === 0 ? (
          <p className="home__note">
            {thirdPartyBefore}
            <strong>{t('security.installed.thirdPartyNoteEmphasis')}</strong>
            {thirdPartyAfter}
          </p>
        ) : null}
      </section>

      <section className="panel-block">
        <h2>{t('security.grants.title')}</h2>
        {grants.length === 0 ? (
          <p className="empty">{t('security.grants.empty')}</p>
        ) : (
          <ul className="grants">
            {grants.map((grant) => {
              const node = nodes.find((n) => n.id === grant.node);
              const manifest = node ? manifests[node.data.componentRef] : undefined;
              return (
                <li key={`${grant.node}-${grant.kind}`}>
                  <strong>{manifest ? componentName(manifest) : grant.node}</strong>
                  <span className="grants__what">{capabilityLabel(grant.kind, t)}</span>
                  {grant.folder ? <code>{grant.folder}</code> : null}
                  {grant.hosts?.length ? <code>{grant.hosts.join(', ')}</code> : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="home__note">{t('security.grants.note')}</p>
      </section>

      <section className="panel-block">
        <h2>{t('security.privacy.title')}</h2>
        <dl className="kv kv--wide">
          <dt>{t('security.privacy.telemetry.label')}</dt>
          <dd>{t('security.privacy.telemetry.value')}</dd>
          <dt>{t('security.privacy.crashReports.label')}</dt>
          <dd>{t('security.privacy.crashReports.value')}</dd>
          <dt>{t('security.privacy.accounts.label')}</dt>
          <dd>{t('security.privacy.accounts.value')}</dd>
          <dt>{t('security.privacy.yourFiles.label')}</dt>
          <dd>{t('security.privacy.yourFiles.value')}</dd>
          {/* The label reuses the Settings screen's own translation of this exact word — see
              `security.privacy.runJournals` in `i18n/locales/en.ts`. */}
          <dt>{t('settings.privacy.yourData.runJournals.label')}</dt>
          <dd>{t('security.privacy.runJournals.value')}</dd>
        </dl>
      </section>

      <section className="panel-block">
        <h2>{t('security.limits.title')}</h2>
        <ul className="limits">
          <li>{t('security.limits.misuse')}</li>
          <li>{t('security.limits.trustedBase')}</li>
          <li>{t('security.limits.noAudit')}</li>
          <li>{ipc.live ? t('security.limits.unsigned') : t('security.limits.previewOnly')}</li>
        </ul>
      </section>

      {about ? (
        <p className="home__note">
          {t('security.footer', {
            runtime: about.runtime,
            protocolSchema: about.protocolSchema,
            projectSchema: about.projectSchema,
          })}
        </p>
      ) : null}
    </main>
  );
}
