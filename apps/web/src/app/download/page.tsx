import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Callout, Card, PageHeader, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { RELEASE, RELEASE_MATCHES_VERSION, REQUIREMENTS, STATUS, VERSION } from '@/config/site';

import { DownloadTarget } from './DownloadTarget';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Download',
  description: `The Windows installer for Encastra ${RELEASE.installerVersion} — size, SHA-256, and what to check before you run it. macOS and Linux are not built yet.`,
};

export default function DownloadPage(): ReactNode {
  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow="Download"
          title="Get the beta"
          lead="One installer, for Windows, not code-signed. Nothing else exists yet — no macOS build, no Linux build, no auto-update."
        />

        <div className={styles.detect}>
          <DownloadTarget />
        </div>

        {!RELEASE_MATCHES_VERSION ? (
          <Callout
            tone="note"
            title={`This site documents ${VERSION}; the published build is ${RELEASE.installerVersion}`}
          >
            <p>
              Version {VERSION} is the release this website is part of — it adds the site itself,
              onboarding, accessibility fixes and documentation. It does not change the runtime, the
              type system, the capability broker, the project format or the CLI, which are the same
              engine {RELEASE.installerVersion} shipped. The installer below is the real, built
              artefact; a {VERSION} installer has not been produced yet.
            </p>
          </Callout>
        ) : null}

        <div className={`grid ${styles.platforms}`}>
          <Card>
            <div className={`${styles.platformCard} ${styles.windowsCard}`}>
              <StatusBadge state={STATUS.windowsInstaller} label="Windows — available" />
              <h3>Windows 10 / 11, x64</h3>
              <p>
                NSIS installer, per user, no administrator required. This is the one artefact that
                actually exists.
              </p>
              <span className={styles.unavailableButton} aria-disabled="true">
                No public download host yet
              </span>
            </div>
          </Card>
          <Card>
            <div className={styles.platformCard}>
              <StatusBadge state={STATUS.macosBuild} />
              <h3>macOS</h3>
              <p>
                Components declare macOS support and the engine is written to be
                platform-independent, but nothing has actually been built or packaged for it.
              </p>
            </div>
          </Card>
          <Card>
            <div className={styles.platformCard}>
              <StatusBadge state={STATUS.linuxBuild} />
              <h3>Linux</h3>
              <p>Same story as macOS: declared support, no build, nothing to download.</p>
            </div>
          </Card>
        </div>

        <Callout tone="note">
          There is no public download host for this build yet — the repository is not public and{' '}
          <code>encastra.dev</code> is not registered (see <a href="/about#name">/about</a>). What
          follows is the real record of the build that exists: its exact filename, size and SHA-256,
          taken from <code>docs/RELEASE.md</code>, so that whoever hosts it — or hands you a copy
          directly — can be checked against it.
        </Callout>

        <div className={styles.artefact}>
          <SectionHeading eyebrow="This build" title={`Encastra ${RELEASE.installerVersion}`} />
          <div className="table-scroll">
            <table className="data">
              <tbody>
                <tr>
                  <th>Installer</th>
                  <td>
                    <code>{RELEASE.installerFilename}</code>
                  </td>
                </tr>
                <tr>
                  <th>Size</th>
                  <td>{RELEASE.installerSize}</td>
                </tr>
                <tr>
                  <th>Format</th>
                  <td>{RELEASE.installerFormat}</td>
                </tr>
                <tr>
                  <th>Built</th>
                  <td>
                    {RELEASE.builtOn} on {RELEASE.builtFor}
                  </td>
                </tr>
                <tr>
                  <th>Commit</th>
                  <td>
                    <code>{RELEASE.commit}</code>
                  </td>
                </tr>
                <tr>
                  <th>Code-signed</th>
                  <td>{RELEASE.signed ? 'Yes' : 'No'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className={styles.artefact}>SHA-256 of {RELEASE.installerFilename}:</p>
          <p className={styles.hashBlock}>{RELEASE.installerSha256}</p>

          <p className={styles.artefact}>Verify on Windows before you run it:</p>
          <p className={styles.verifyCommand}>
            Get-FileHash .\{RELEASE.installerFilename} -Algorithm SHA256
          </p>

          <Callout tone="warn" title="This build is not code-signed">
            <p>
              Windows SmartScreen will warn about an unrecognised publisher, and the warning is
              accurate — nothing in the file proves who built it. The SHA-256 above proves the file
              was not altered between wherever you got it and here; it proves nothing about who
              produced it. Both facts belong together.
            </p>
          </Callout>
        </div>

        <div className={styles.artefact}>
          <SectionHeading eyebrow="System requirements" title="What it needs" />
          <div className={`grid ${styles.requirements}`}>
            <Card>
              <h3>Operating system</h3>
              <ul className="prose">
                {REQUIREMENTS.windows.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3>Disk</h3>
              <p>{REQUIREMENTS.disk}</p>
            </Card>
            <Card>
              <h3>Network</h3>
              <p>{REQUIREMENTS.network}</p>
            </Card>
            <Card>
              <h3>Install</h3>
              <p>{REQUIREMENTS.install}</p>
            </Card>
          </div>
        </div>

        <div className={styles.artefact}>
          <SectionHeading eyebrow="After installing" title="What is not there yet" />
          <Callout tone="note">
            <p>
              Nothing updates itself — a new version means downloading a new installer and running
              it, once one is published somewhere. Uninstalling removes the application only; it
              does not touch any <code>.encastra</code> files, which live wherever you saved them.
            </p>
          </Callout>
        </div>
      </div>
    </div>
  );
}
