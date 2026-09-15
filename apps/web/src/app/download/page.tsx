import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Callout, Card, PageHeader, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { RELEASE, RELEASE_MATCHES_VERSION, REQUIREMENTS, STATUS, VERSION } from '@/config/site';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

import { DownloadTarget } from './DownloadTarget';
import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    title: t(locale, 'download.hero.eyebrow'),
    description: t(locale, 'download.meta.description', { version: RELEASE.installerVersion }),
    path: '/download',
  });
}

export default async function DownloadPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow={t(locale, 'download.hero.eyebrow')}
          title={t(locale, 'download.hero.title')}
          lead={t(locale, 'download.hero.lead')}
        />

        <div className={styles.detect}>
          <DownloadTarget locale={locale} />
        </div>

        {!RELEASE_MATCHES_VERSION ? (
          <Callout
            tone="note"
            title={t(locale, 'download.versionMismatch.title', {
              version: VERSION,
              release: RELEASE.installerVersion,
            })}
          >
            <p>
              {t(locale, 'download.versionMismatch.body', {
                version: VERSION,
                release: RELEASE.installerVersion,
              })}
            </p>
          </Callout>
        ) : null}

        <div className={`grid ${styles.platforms}`}>
          <Card>
            <div className={`${styles.platformCard} ${styles.windowsCard}`}>
              <StatusBadge
                state={STATUS.windowsInstaller}
                label={t(locale, 'download.platforms.windowsBadge')}
              />
              <h3>{t(locale, 'download.platforms.windowsTitle')}</h3>
              <p>{t(locale, 'download.platforms.windowsBody')}</p>
              <span className={styles.unavailableButton} aria-disabled="true">
                {t(locale, 'download.platforms.noHostYet')}
              </span>
            </div>
          </Card>
          <Card>
            <div className={styles.platformCard}>
              <StatusBadge state={STATUS.macosBuild} />
              <h3>{t(locale, 'download.platforms.macosTitle')}</h3>
              <p>{t(locale, 'download.platforms.macosBody')}</p>
            </div>
          </Card>
          <Card>
            <div className={styles.platformCard}>
              <StatusBadge state={STATUS.linuxBuild} />
              <h3>{t(locale, 'download.platforms.linuxTitle')}</h3>
              <p>{t(locale, 'download.platforms.linuxBody')}</p>
            </div>
          </Card>
        </div>

        <Callout tone="note">
          {t(locale, 'download.noHostCallout.part1')} <code>encastra.dev</code>{' '}
          {t(locale, 'download.noHostCallout.part2')} <a href="/about#name">/about</a>
          {t(locale, 'download.noHostCallout.part3')} <code>docs/RELEASE.md</code>
          {t(locale, 'download.noHostCallout.part4')}
        </Callout>

        <div className={styles.artefact}>
          <SectionHeading
            eyebrow={t(locale, 'download.thisBuild.eyebrow')}
            title={`Encastra ${RELEASE.installerVersion}`}
          />
          <div className="table-scroll">
            <table className="data">
              <tbody>
                <tr>
                  <th>{t(locale, 'download.thisBuild.installer')}</th>
                  <td>
                    <code>{RELEASE.installerFilename}</code>
                  </td>
                </tr>
                <tr>
                  <th>{t(locale, 'download.thisBuild.size')}</th>
                  <td>{RELEASE.installerSize}</td>
                </tr>
                <tr>
                  <th>{t(locale, 'download.thisBuild.format')}</th>
                  <td>{RELEASE.installerFormat}</td>
                </tr>
                <tr>
                  <th>{t(locale, 'download.thisBuild.built')}</th>
                  <td>
                    {t(locale, 'download.thisBuild.builtOn', {
                      date: RELEASE.builtOn,
                      target: RELEASE.builtFor,
                    })}
                  </td>
                </tr>
                <tr>
                  <th>{t(locale, 'download.thisBuild.commit')}</th>
                  <td>
                    <code>{RELEASE.commit}</code>
                  </td>
                </tr>
                <tr>
                  <th>{t(locale, 'download.thisBuild.codeSigned')}</th>
                  <td>
                    {RELEASE.signed
                      ? t(locale, 'download.thisBuild.yes')
                      : t(locale, 'download.thisBuild.no')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className={styles.artefact}>
            {t(locale, 'download.thisBuild.sha256Label', { file: RELEASE.installerFilename })}
          </p>
          <p className={styles.hashBlock}>{RELEASE.installerSha256}</p>

          <p className={styles.artefact}>{t(locale, 'download.thisBuild.verifyLabel')}</p>
          <p className={styles.verifyCommand}>
            Get-FileHash .\{RELEASE.installerFilename} -Algorithm SHA256
          </p>

          <Callout tone="warn" title={t(locale, 'download.notSigned.title')}>
            <p>{t(locale, 'download.notSigned.body')}</p>
          </Callout>
        </div>

        <div className={styles.artefact}>
          <SectionHeading
            eyebrow={t(locale, 'download.requirements.eyebrow')}
            title={t(locale, 'download.requirements.title')}
          />
          <div className={`grid ${styles.requirements}`}>
            <Card>
              <h3>{t(locale, 'download.requirements.os')}</h3>
              <ul className="prose">
                {REQUIREMENTS.windows.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3>{t(locale, 'download.requirements.disk')}</h3>
              <p>{REQUIREMENTS.disk}</p>
            </Card>
            <Card>
              <h3>{t(locale, 'download.requirements.network')}</h3>
              <p>{REQUIREMENTS.network}</p>
            </Card>
            <Card>
              <h3>{t(locale, 'download.requirements.install')}</h3>
              <p>{REQUIREMENTS.install}</p>
            </Card>
          </div>
        </div>

        <div className={styles.artefact}>
          <SectionHeading
            eyebrow={t(locale, 'download.afterInstall.eyebrow')}
            title={t(locale, 'download.afterInstall.title')}
          />
          <Callout tone="note">
            <p>
              {t(locale, 'download.afterInstall.bodyPrefix')} <code>.encastra</code>{' '}
              {t(locale, 'download.afterInstall.bodySuffix')}
            </p>
          </Callout>
        </div>
      </div>
    </div>
  );
}
