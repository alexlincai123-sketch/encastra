import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Card, CTA, PageHeader, SectionHeading, SourceRef } from '@/components/ui/Ui';
import { DOCS } from '@/config/site';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    title: t(locale, 'docs.hero.eyebrow'),
    description: t(locale, 'docs.meta.description'),
    path: '/docs',
  });
}

/** Maps each `config/site.ts` `DOCS` slug to its `docs.items.*` translation key — the slug itself
    (`ARCHITECTURE.md`, `adr/`) is not a safe dotted-path segment for `t()`. */
const DOC_KEY: Record<string, string> = {
  'ARCHITECTURE.md': 'architecture',
  'SECURITY.md': 'security',
  'THREAT-MODEL.md': 'threatModel',
  'RUNTIME.md': 'runtime',
  'COMPONENT-SDK.md': 'componentSdk',
  'PROJECT-FORMAT.md': 'projectFormat',
  'RELEASE.md': 'release',
  'TESTING.md': 'testing',
  'PRODUCT-ROADMAP.md': 'productRoadmap',
  'THIRD-PARTY.md': 'thirdParty',
  'security/CI_SECURITY.md': 'ciSecurity',
  'security/AI-AGENT-SURFACE.md': 'aiAgentSurface',
  'adr/': 'adr',
};

const ENGINEER_DOCS = DOCS.filter((doc) => doc.audience === 'engineers');
const EVERYONE_DOCS = DOCS.filter((doc) => doc.audience === 'everyone');

export default async function DocsPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page">
      <PageHeader
        eyebrow={t(locale, 'docs.hero.eyebrow')}
        title={t(locale, 'docs.hero.title')}
        lead={t(locale, 'docs.hero.lead')}
      />

      <SectionHeading
        eyebrow={t(locale, 'docs.forAnyone.eyebrow')}
        title={t(locale, 'docs.forAnyone.title')}
      />
      <div className={`grid ${styles.grid}`}>
        {EVERYONE_DOCS.map((doc) => {
          const key = DOC_KEY[doc.slug] ?? doc.slug;
          return (
            <Card key={doc.slug}>
              <div className={styles.card}>
                <span className={styles.audience}>
                  {t(locale, `docs.audience.${doc.audience}`)}
                </span>
                <h3>{t(locale, `docs.items.${key}.title`)}</h3>
                <p>{t(locale, `docs.items.${key}.summary`)}</p>
                <SourceRef path={`docs/${doc.slug}`} locale={locale} />
              </div>
            </Card>
          );
        })}
      </div>

      <section className="section">
        <SectionHeading
          eyebrow={t(locale, 'docs.forEngineers.eyebrow')}
          title={t(locale, 'docs.forEngineers.title')}
        />
        <div className={`grid ${styles.grid}`}>
          {ENGINEER_DOCS.map((doc) => {
            const key = DOC_KEY[doc.slug] ?? doc.slug;
            return (
              <Card key={doc.slug}>
                <div className={styles.card}>
                  <span className={styles.audience}>
                    {t(locale, `docs.audience.${doc.audience}`)}
                  </span>
                  <h3>{t(locale, `docs.items.${key}.title`)}</h3>
                  <p>{t(locale, `docs.items.${key}.summary`)}</p>
                  <SourceRef path={`docs/${doc.slug}`} locale={locale} />
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="stack">
          <p className="lead">{t(locale, 'docs.closing.lead')}</p>
          <CTA href="/tutorials">{t(locale, 'docs.closing.cta')}</CTA>
        </div>
      </section>
    </div>
  );
}
