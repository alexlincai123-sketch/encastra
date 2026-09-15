import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Callout, Card, CTA, PageHeader, SectionHeading, SourceRef } from '@/components/ui/Ui';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    title: t(locale, 'security.hero.eyebrow'),
    description: t(locale, 'security.meta.description'),
    path: '/security',
  });
}

const SCOPE_KEYS = ['inputHandles', 'directory', 'httpHosts', 'allowed'] as const;

const ASKS_FOR = [
  { component: 'Read File', kind: 'fs.read', scope: 'input-handles' },
  {
    component: 'Write File · Save File · Move File · Rename File',
    kind: 'fs.write',
    scope: 'chosen-folder',
  },
  {
    component: 'Resize Image · Convert Image · Thumbnail · Image Info',
    kind: 'fs.read',
    scope: 'input-handles',
  },
  { component: 'Parse JSON · Write JSON · Read CSV · Write CSV', kind: 'nothing', scope: '—' },
  { component: 'If · Switch · Delay', kind: 'nothing', scope: '—' },
  { component: 'Notify', kind: 'system.notify', scope: 'notifications' },
  { component: 'Copy to Clipboard', kind: 'system.clipboard', scope: 'write' },
  { component: 'HTTP Request', kind: 'net.http', scope: 'allowed-hosts' },
  { component: 'Watch Folder (trigger)', kind: 'fs.read', scope: 'watched-folder' },
  { component: 'Timer (trigger)', kind: 'nothing', scope: '—' },
] as const;

const ABSENT_KEYS = [
  'processExecution',
  'webhookListener',
  'videoInformation',
  'nativePlugin',
] as const;

const LIMITATION_KEYS = [
  'noSandbox',
  'nothingSigned',
  'noCeiling',
  'noDenyList',
  'secretsUnresolved',
  'grantsPerRun',
  'bridgeTrusts',
  'noAudit',
  'sideChannels',
] as const;

export default async function SecurityPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow={t(locale, 'security.hero.eyebrow')}
          title={t(locale, 'security.hero.title')}
          lead={t(locale, 'security.hero.lead')}
        />

        <div className={styles.intro}>
          <Callout tone="warn" title={t(locale, 'security.reviewed.title')}>
            {t(locale, 'security.reviewed.body')}
          </Callout>
        </div>

        <SectionHeading
          eyebrow={t(locale, 'security.broker.eyebrow')}
          title={t(locale, 'security.broker.title')}
          lead={t(locale, 'security.broker.lead')}
        />

        <div className={`grid ${styles.scopeGrid}`}>
          {SCOPE_KEYS.map((key) => (
            <Card key={key}>
              <div className={styles.scopeCard}>
                <h3>{t(locale, `security.scopes.${key}.scope`)}</h3>
                <p>{t(locale, `security.scopes.${key}.body`)}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow={t(locale, 'security.asksFor.eyebrow')}
            title={t(locale, 'security.asksFor.title')}
            lead={t(locale, 'security.asksFor.lead')}
          />
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  {/* `scope="col"` so a screen reader announces the right heading with each
                      cell; without it the association is inferred, and three columns of
                      capability names are exactly the table where being told the wrong one
                      matters. */}
                  <th scope="col">{t(locale, 'security.asksFor.component')}</th>
                  <th scope="col">{t(locale, 'security.asksFor.asksForColumn')}</th>
                  <th scope="col">{t(locale, 'security.asksFor.scopeColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {ASKS_FOR.map((row) => (
                  <tr key={row.component}>
                    <td>{row.component}</td>
                    <td>
                      <code>{row.kind}</code>
                    </td>
                    <td>{row.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceRef
            path="docs/SECURITY.md"
            note={t(locale, 'security.asksFor.sourceNote')}
            locale={locale}
          />
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow={t(locale, 'security.absent.eyebrow')}
            title={t(locale, 'security.absent.title')}
            lead={t(locale, 'security.absent.lead')}
          />
          <div className={`grid ${styles.absentGrid}`}>
            {ABSENT_KEYS.map((key) => (
              <Card key={key}>
                <div className={styles.absentCard}>
                  <h3>{t(locale, `security.absent.${key}.title`)}</h3>
                  <p>{t(locale, `security.absent.${key}.body`)}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow={t(locale, 'security.limitations.eyebrow')}
            title={t(locale, 'security.limitations.title')}
            lead={t(locale, 'security.limitations.lead')}
          />
          <div className={`prose ${styles.limitations}`}>
            <ol>
              {LIMITATION_KEYS.map((key) => (
                <li key={key}>
                  <strong>{t(locale, `security.limitations.items.${key}.strong`)}</strong>{' '}
                  {key === 'noSandbox' ? (
                    <>
                      {t(locale, 'security.limitations.items.noSandbox.rest')}{' '}
                      <code>kind: &quot;wasm&quot;</code>{' '}
                      {t(locale, 'security.limitations.items.noSandbox.middle')}{' '}
                      <code>no-implementation</code>
                      {t(locale, 'security.limitations.items.noSandbox.suffix')}
                    </>
                  ) : (
                    t(locale, `security.limitations.items.${key}.rest`)
                  )}
                </li>
              ))}
            </ol>
          </div>
          <SourceRef
            path="docs/SECURITY.md"
            note={t(locale, 'security.limitations.sourceNote')}
            locale={locale}
          />
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow={t(locale, 'security.reporting.eyebrow')}
            title={t(locale, 'security.reporting.title')}
            lead={t(locale, 'security.reporting.lead')}
          />
          <Callout tone="note">
            <p>{t(locale, 'security.reporting.noAddress')}</p>
          </Callout>
          <div className={styles.disclosureCta}>
            <CTA href="/legal/security-disclosure" variant="secondary">
              {t(locale, 'security.reporting.readDisclosure')}
            </CTA>
          </div>
        </div>
      </section>
    </div>
  );
}
