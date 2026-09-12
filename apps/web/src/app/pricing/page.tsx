import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Card, CTA, NotBuilt, PageHeader, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { STATUS } from '@/config/site';
import { getLocale, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, 'pricing.hero.eyebrow'),
    description: t(locale, 'pricing.meta.description'),
  };
}

export default async function PricingPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page">
      <PageHeader
        eyebrow={t(locale, 'pricing.hero.eyebrow')}
        title={t(locale, 'pricing.hero.title')}
        lead={t(locale, 'pricing.hero.lead')}
      />

      <Card>
        <div className={styles.freeCard}>
          <StatusBadge state="built" label={t(locale, 'pricing.free.badge')} />
          <h2 className={styles.freeTitle}>{t(locale, 'pricing.free.title')}</h2>
          <p className={styles.freeBody}>{t(locale, 'pricing.free.body')}</p>
          <CTA href="/download">{t(locale, 'pricing.free.cta')}</CTA>
        </div>
      </Card>

      <section className="section">
        <SectionHeading
          eyebrow={t(locale, 'pricing.notYet.eyebrow')}
          title={t(locale, 'pricing.notYet.title')}
          lead={t(locale, 'pricing.notYet.lead')}
        />
        <NotBuilt
          state={STATUS.payments}
          title={t(locale, 'pricing.payments.title')}
          locale={locale}
          blockedBy={[
            t(locale, 'pricing.payments.blockedBy.item1'),
            t(locale, 'pricing.payments.blockedBy.item2'),
            t(locale, 'pricing.payments.blockedBy.item3'),
          ]}
        >
          <p>{t(locale, 'pricing.payments.body')}</p>
        </NotBuilt>
      </section>
    </div>
  );
}
