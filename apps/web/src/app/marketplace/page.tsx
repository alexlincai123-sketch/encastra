import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ButtonRow, CTA, NotBuilt, PageHeader } from '@/components/ui/Ui';
import { STATUS } from '@/config/site';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    title: t(locale, 'marketplace.hero.eyebrow'),
    description: t(locale, 'marketplace.meta.description'),
    path: '/marketplace',
  });
}

export default async function MarketplacePage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page">
      <PageHeader
        eyebrow={t(locale, 'marketplace.hero.eyebrow')}
        title={t(locale, 'marketplace.hero.title')}
      />
      <div className="stack-lg">
        <NotBuilt
          state={STATUS.marketplace}
          title={t(locale, 'marketplace.notBuilt.title')}
          locale={locale}
          blockedBy={[
            t(locale, 'marketplace.notBuilt.blockedBy.item1'),
            t(locale, 'marketplace.notBuilt.blockedBy.item2'),
            t(locale, 'marketplace.notBuilt.blockedBy.item3'),
            t(locale, 'marketplace.notBuilt.blockedBy.item4'),
          ]}
        >
          <p>
            {t(locale, 'marketplace.notBuilt.body1Prefix')}{' '}
            <a href="/components">{t(locale, 'marketplace.notBuilt.body1LinkText')}</a>{' '}
            {t(locale, 'marketplace.notBuilt.body1Suffix')}
          </p>
          <p>{t(locale, 'marketplace.notBuilt.body2')}</p>
        </NotBuilt>
        <ButtonRow>
          <CTA href="/ecosystem">{t(locale, 'marketplace.ctaEcosystem')}</CTA>
          <CTA href="/components" variant="secondary">
            {t(locale, 'marketplace.cta')}
          </CTA>
        </ButtonRow>
      </div>
    </div>
  );
}
