import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Callout, Card, CTA, PageHeader, SectionHeading } from '@/components/ui/Ui';
import { RELEASE } from '@/config/site';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    title: t(locale, 'about.hero.eyebrow'),
    description: t(locale, 'about.meta.description'),
    path: '/about',
  });
}

export default async function AboutPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={t(locale, 'about.hero.eyebrow')}
        title={t(locale, 'about.hero.title')}
        lead={t(locale, 'about.hero.lead')}
      />

      <div className="prose">
        <h2>{t(locale, 'about.checkpoint.title')}</h2>
        <p>{t(locale, 'about.checkpoint.lead')}</p>
      </div>
      <p className={styles.checkpoint}>{t(locale, 'about.checkpoint.body')}</p>
      <p className="prose">
        {t(locale, 'about.checkpoint.bodyPrefix')}{' '}
        <code>crates/encastra-builtins/tests/image_processor.rs</code>
        {t(locale, 'about.checkpoint.bodyMiddle')}{' '}
        <a href="/tutorials">{t(locale, 'about.checkpoint.tutorialLinkText')}</a>{' '}
        {t(locale, 'about.checkpoint.bodySuffix')}
      </p>

      <section className="section" id="name">
        <SectionHeading
          eyebrow={t(locale, 'about.name.eyebrow')}
          title={t(locale, 'about.name.title')}
        />
        <div className="prose">
          <p>
            <em>{t(locale, 'about.name.body1Prefix')}</em> {t(locale, 'about.name.body1Middle')}{' '}
            <em>{t(locale, 'about.name.body1LatinWord')}</em>
            {t(locale, 'about.name.body1Suffix')}
            <code>{t(locale, 'about.name.body1Dev')}</code>
            {t(locale, 'about.name.body1End')}
          </p>
          <p>
            <strong>{t(locale, 'about.name.body2Strong')}</strong>{' '}
            {t(locale, 'about.name.body2Prefix')}{' '}
            <a href="/legal/trademark">{t(locale, 'about.name.body2LinkText')}</a>{' '}
            {t(locale, 'about.name.body2Suffix')}
          </p>
          <p>{t(locale, 'about.name.body3')}</p>
        </div>
        <Callout tone="note" title={t(locale, 'about.name.calloutTitle')}>
          {t(locale, 'about.name.calloutBody')}
        </Callout>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow={t(locale, 'about.nonGoals.eyebrow')}
          title={t(locale, 'about.nonGoals.title')}
        />
        <div className="prose">
          <p>
            <strong>{t(locale, 'about.nonGoals.noAiStrong')}</strong>{' '}
            {t(locale, 'about.nonGoals.noAiBody')}
          </p>
          <p>
            <strong>{t(locale, 'about.nonGoals.noFinishedStrong')}</strong>{' '}
            {t(locale, 'about.nonGoals.noFinishedBody')}
          </p>
        </div>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow={t(locale, 'about.stands.eyebrow')}
          title={t(locale, 'about.stands.title')}
        />
        <div className={`grid ${styles.grid}`}>
          <Card>
            <h3>{t(locale, 'about.stands.engine.title')}</h3>
            <p>{t(locale, 'about.stands.engine.body')}</p>
          </Card>
          <Card>
            <h3>{t(locale, 'about.stands.desktop.title')}</h3>
            <p>{t(locale, 'about.stands.desktop.body')}</p>
          </Card>
          <Card>
            <h3>{t(locale, 'about.stands.website.title')}</h3>
            <p>{t(locale, 'about.stands.website.bodyPrefix')}</p>
          </Card>
          <Card>
            <h3>{t(locale, 'about.stands.everythingElse.title')}</h3>
            <p>{t(locale, 'about.stands.everythingElse.body')}</p>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="stack">
          <p className="lead">{t(locale, 'about.closing.lead', { commit: RELEASE.commit })}</p>
          <CTA href="/download">{t(locale, 'about.closing.cta')}</CTA>
        </div>
      </section>
    </div>
  );
}
