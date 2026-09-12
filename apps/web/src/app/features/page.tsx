import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Card, CTA, NotBuilt, PageHeader, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { STATUS } from '@/config/site';
import { COMPONENT_COUNT, TRIGGER_COUNT } from '@/lib/components.data';
import { getLocale, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, 'nav.primary.features'),
    description: t(locale, 'features.meta.description'),
  };
}

const BUILT_KEYS = [
  'typedCanvas',
  'realRuntime',
  'broker',
  'componentCount',
  'triggers',
  'versioning',
  'cli',
  'imageProcessing',
] as const;

export default async function FeaturesPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page">
      <PageHeader
        eyebrow={t(locale, 'features.hero.eyebrow')}
        title={t(locale, 'features.hero.title')}
        lead={t(locale, 'features.hero.lead')}
      />

      <div className={`grid ${styles.grid}`}>
        {BUILT_KEYS.map((key) => (
          <Card key={key}>
            <div className={styles.card}>
              <StatusBadge state="built" />
              <h3>
                {key === 'componentCount'
                  ? t(locale, `features.built.${key}.title`, {
                      count: String(COMPONENT_COUNT),
                      triggers: String(TRIGGER_COUNT),
                    })
                  : t(locale, `features.built.${key}.title`)}
              </h3>
              <p>{t(locale, `features.built.${key}.body`)}</p>
            </div>
          </Card>
        ))}
      </div>

      <SectionHeading
        eyebrow={t(locale, 'features.notYet.eyebrow')}
        title={t(locale, 'features.notYet.title')}
        lead={t(locale, 'features.notYet.lead')}
      />

      <NotBuilt
        state={STATUS.wasmSandbox}
        title={t(locale, 'features.sandbox.title')}
        locale={locale}
        blockedBy={[
          t(locale, 'features.sandbox.blockedBy.item1'),
          t(locale, 'features.sandbox.blockedBy.item2'),
          t(locale, 'features.sandbox.blockedBy.item3'),
        ]}
      >
        <p>
          {t(locale, 'features.sandbox.bodyPrefix')} <code>kind: &quot;wasm&quot;</code>{' '}
          {t(locale, 'features.sandbox.bodySuffix')} <code>no-implementation</code>.
        </p>
      </NotBuilt>

      <div className={styles.notBuilt}>
        <NotBuilt
          state={STATUS.registry}
          title={t(locale, 'features.registry.title')}
          locale={locale}
          blockedBy={[
            t(locale, 'features.registry.blockedBy.item1'),
            t(locale, 'features.registry.blockedBy.item2'),
            t(locale, 'features.registry.blockedBy.item3'),
          ]}
        >
          <p>
            {t(locale, 'features.registry.bodyPrefix')} <a href="/marketplace">/marketplace</a>{' '}
            {t(locale, 'features.registry.bodyMiddle')} <a href="/community">/community</a>{' '}
            {t(locale, 'features.registry.bodySuffix')}
          </p>
        </NotBuilt>
      </div>

      <div className={styles.cta}>
        <CTA href="/components">{t(locale, 'features.cta')}</CTA>
      </div>
    </div>
  );
}
