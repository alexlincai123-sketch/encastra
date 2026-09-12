import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CTA, NotBuilt, PageHeader } from '@/components/ui/Ui';
import { STATUS } from '@/config/site';
import { getLocale, t } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, 'community.hero.eyebrow'),
    description: t(locale, 'community.meta.description'),
  };
}

export default async function CommunityPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page">
      <PageHeader
        eyebrow={t(locale, 'community.hero.eyebrow')}
        title={t(locale, 'community.hero.title')}
      />
      <div className="stack-lg">
        <NotBuilt
          state={STATUS.community}
          title={t(locale, 'community.notBuilt.title')}
          locale={locale}
          blockedBy={[
            t(locale, 'community.notBuilt.blockedBy.item1'),
            t(locale, 'community.notBuilt.blockedBy.item2'),
            t(locale, 'community.notBuilt.blockedBy.item3'),
          ]}
        >
          <p>{t(locale, 'community.notBuilt.body1')}</p>
          <p>
            {t(locale, 'community.notBuilt.body2Prefix')}{' '}
            <a href="/about">{t(locale, 'community.notBuilt.body2LinkText')}</a>{' '}
            {t(locale, 'community.notBuilt.body2Suffix')}
          </p>
        </NotBuilt>
        <CTA href="/download" variant="secondary">
          {t(locale, 'community.cta')}
        </CTA>
      </div>
    </div>
  );
}
