import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { HomeExperience } from '@/components/scenes/HomeExperience';
import { Card, CTA, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { RELEASE, SITE, STATUS } from '@/config/site';

import styles from './home.module.css';

export const metadata: Metadata = {
  description: SITE.description,
};

export default function HomePage(): ReactNode {
  return (
    <div>
      {/* The ten-scene scroll narrative. A client component so it can run GSAP ScrollTrigger;
          everything below it stays server-rendered so a crawler — or a browser with JavaScript
          disabled — still gets the facts a visitor would otherwise only see mid-scroll. */}
      <HomeExperience />

      <section className="section" aria-labelledby="status-heading">
        <div className="page">
          <SectionHeading
            id="status-heading"
            eyebrow="What exists today"
            title="A working engine, not a mockup"
            lead="Every claim in the scenes above is either a shipped test or a component you can open in the palette. What is designed and not built is labelled that way, in the same place, every time."
          />
          <div className={`grid ${styles.statusGrid}`}>
            <Card>
              <div className={styles.statusCard}>
                <StatusBadge state={STATUS.runtime} />
                <h3>Runtime</h3>
                <p>Validation, scheduling, capability enforcement, and a journal of what ran.</p>
              </div>
            </Card>
            <Card>
              <div className={styles.statusCard}>
                <StatusBadge state={STATUS.capabilityBroker} />
                <h3>Capability broker</h3>
                <p>
                  The only code that touches OS authority — including for components that ship with
                  the product.
                </p>
              </div>
            </Card>
            <Card>
              <div className={styles.statusCard}>
                <StatusBadge state={STATUS.projectFormat} />
                <h3>Project format</h3>
                <p>A deterministic .encastra file: graph, lockfile, variables, version history.</p>
              </div>
            </Card>
            <Card>
              <div className={styles.statusCard}>
                <StatusBadge state={STATUS.wasmSandbox} />
                <h3>Third-party components</h3>
                <p>
                  The WebAssembly sandbox is designed and documented. Nothing third-party runs yet.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <div className={styles.closing}>
            <div className={styles.closingBody}>
              <span className="eyebrow">Beta {RELEASE.installerVersion}</span>
              <h2 className={styles.closingTitle}>
                Windows only, not code-signed, and honest about both
              </h2>
              <p className={styles.closingLead}>
                SmartScreen will warn about an unrecognised publisher. That warning is accurate —
                nothing in the file proves who built it. The published SHA-256 is what you have
                instead.
              </p>
            </div>
            <div className={styles.closingActions}>
              <CTA href="/download">Download and verify</CTA>
              <CTA href="/security" variant="secondary">
                Read the security model
              </CTA>
              <CTA href="/components" variant="secondary">
                Browse every component
              </CTA>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
