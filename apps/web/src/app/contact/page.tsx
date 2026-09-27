import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ButtonRow, Callout, Card, CTA, PageHeader, SectionHeading } from '@/components/ui/Ui';
import { CONTACT_EMAIL, SECURITY_REPORT_URL, SITE } from '@/config/site';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    title: t(locale, 'contact.hero.eyebrow'),
    description: t(locale, 'contact.meta.description'),
    path: '/contact',
  });
}

export default async function ContactPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={t(locale, 'contact.hero.eyebrow')}
        title={t(locale, 'contact.hero.title')}
        lead={t(locale, 'contact.hero.lead')}
      />

      <Callout tone="note" title={t(locale, 'contact.email.title')}>
        {t(locale, 'contact.email.bodyPrefix')}{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        {t(locale, 'contact.email.bodySuffix')}
      </Callout>

      <section className="section">
        <SectionHeading
          eyebrow={t(locale, 'contact.security.eyebrow')}
          title={t(locale, 'contact.security.title')}
        />
        <Card>
          <p className="prose">{t(locale, 'contact.security.body')}</p>
          <ButtonRow>
            <CTA href={SECURITY_REPORT_URL}>{t(locale, 'contact.security.reportCta')}</CTA>
            <CTA href="/legal/security-disclosure" variant="secondary">
              {t(locale, 'contact.security.cta')}
            </CTA>
          </ButtonRow>
        </Card>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow={t(locale, 'contact.everythingElse.eyebrow')}
          title={t(locale, 'contact.everythingElse.title')}
        />
        <p className="prose">
          {t(locale, 'contact.everythingElse.bodyPrefix')}{' '}
          <a href={SITE.repository} rel="noopener noreferrer">
            {SITE.repository.replace('https://', '')}
          </a>{' '}
          {t(locale, 'contact.everythingElse.bodySuffix')}
        </p>
      </section>
    </div>
  );
}
