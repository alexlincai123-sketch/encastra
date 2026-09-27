import Link from 'next/link';
import type { ReactNode } from 'react';

import { FOOTER_NAV } from '@/config/nav';
import { CONTACT_EMAIL, LICENSE_URL, SITE, VERSION } from '@/config/site';
import type { Locale } from '@/lib/i18n/locale';
import { t } from '@/lib/i18n/translate';

import styles from './Footer.module.css';
import { Logo } from './Logo';

export function Footer({ locale }: { locale: Locale }): ReactNode {
  return (
    <footer className={styles.footer}>
      <div className={`page ${styles.inner}`}>
        <div className={styles.brandBlock}>
          <Link className={styles.brand} href="/">
            <Logo size={24} title="Encastra" />
            <span>Encastra</span>
          </Link>
          <p className={styles.blurb}>{t(locale, 'site.tagline')}</p>
          <p className={styles.version}>{t(locale, 'footer.versionLine', { version: VERSION })}</p>
        </div>

        <nav className={styles.columns} aria-label={t(locale, 'footer.navAriaLabel')}>
          {FOOTER_NAV.map((group) => (
            <div key={group.title}>
              <h2 className={styles.columnTitle}>{t(locale, `nav.footer.groups.${group.id}`)}</h2>
              <ul className={styles.columnList}>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link className={styles.columnLink} href={item.href}>
                      {t(locale, `nav.footer.items.${item.id}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className={`page ${styles.legalBar}`}>
        <p>
          {t(locale, 'footer.legal.namePrefix')}{' '}
          <Link href="/about#name">{t(locale, 'footer.legal.nameLinkText')}</Link>.
        </p>
        <p>
          {t(locale, 'footer.legal.licencePrefix')}{' '}
          <a href={LICENSE_URL}>{t(locale, 'footer.legal.licenceLinkText')}</a>
          {t(locale, 'footer.legal.licenceMiddle')}{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{' '}
          {t(locale, 'footer.legal.emailOr')}{' '}
          <a href={SITE.repository}>{t(locale, 'footer.legal.repoLinkText')}</a>.{' '}
          {t(locale, 'footer.legal.draftsPrefix')}{' '}
          <Link href="/legal">{t(locale, 'footer.legal.draftsLinkText')}</Link>.
        </p>
      </div>
    </footer>
  );
}
