import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { HomeExperience } from '@/components/scenes/HomeExperience';
import { Card, CTA, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { RELEASE, STATUS } from '@/config/site';
import { getLocale, t } from '@/lib/i18n';

import styles from './home.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { description: t(locale, 'site.description') };
}

export default async function HomePage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div>
      {/* The ten-scene scroll narrative. A client component so it can run GSAP ScrollTrigger;
          everything below it stays server-rendered so a crawler — or a browser with JavaScript
          disabled — still gets the facts a visitor would otherwise only see mid-scroll. `locale`
          is resolved here, server-side, and handed down as a prop rather than re-read on the
          client — see `HomeExperience.tsx`'s own note on why. */}
      <HomeExperience locale={locale} />

      <section className="section" aria-labelledby="status-heading">
        <div className="page">
          <SectionHeading
            id="status-heading"
            eyebrow={t(locale, 'home.whatExists.eyebrow')}
            title={t(locale, 'home.whatExists.title')}
            lead={t(locale, 'home.whatExists.lead')}
          />
          <div className={`grid ${styles.statusGrid}`}>
            <Card>
              <div className={styles.statusCard}>
                <StatusBadge state={STATUS.runtime} label={t(locale, `status.${STATUS.runtime}`)} />
                <h3>{t(locale, 'home.whatExists.runtime.title')}</h3>
                <p>{t(locale, 'home.whatExists.runtime.body')}</p>
              </div>
            </Card>
            <Card>
              <div className={styles.statusCard}>
                <StatusBadge
                  state={STATUS.capabilityBroker}
                  label={t(locale, `status.${STATUS.capabilityBroker}`)}
                />
                <h3>{t(locale, 'home.whatExists.capabilityBroker.title')}</h3>
                <p>{t(locale, 'home.whatExists.capabilityBroker.body')}</p>
              </div>
            </Card>
            <Card>
              <div className={styles.statusCard}>
                <StatusBadge
                  state={STATUS.projectFormat}
                  label={t(locale, `status.${STATUS.projectFormat}`)}
                />
                <h3>{t(locale, 'home.whatExists.projectFormat.title')}</h3>
                <p>{t(locale, 'home.whatExists.projectFormat.body')}</p>
              </div>
            </Card>
            <Card>
              <div className={styles.statusCard}>
                <StatusBadge
                  state={STATUS.wasmSandbox}
                  label={t(locale, `status.${STATUS.wasmSandbox}`)}
                />
                <h3>{t(locale, 'home.whatExists.thirdParty.title')}</h3>
                <p>{t(locale, 'home.whatExists.thirdParty.body')}</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <div className={styles.closing}>
            <div className={styles.closingBody}>
              <span className="eyebrow">
                {t(locale, 'home.closing.eyebrow', { version: RELEASE.installerVersion })}
              </span>
              <h2 className={styles.closingTitle}>{t(locale, 'home.closing.title')}</h2>
              <p className={styles.closingLead}>{t(locale, 'home.closing.lead')}</p>
            </div>
            <div className={styles.closingActions}>
              <CTA href="/download">{t(locale, 'home.closing.downloadAndVerify')}</CTA>
              <CTA href="/security" variant="secondary">
                {t(locale, 'home.closing.readSecurityModel')}
              </CTA>
              <CTA href="/components" variant="secondary">
                {t(locale, 'home.closing.browseComponents')}
              </CTA>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
