import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { TerminalDemo } from '@/components/terminal/Terminal';
import { Card, CTA, PageHeader, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { RELEASE, SITE, STATUS } from '@/config/site';
import { COMPONENT_COUNT, COMPONENTS, TRIGGER_COUNT } from '@/lib/components.data';

import styles from './page.module.css';

export const metadata: Metadata = {
  description: SITE.description,
};

const PREVIEW_IDS = [
  'encastra.file.watch',
  'encastra.image.resize',
  'encastra.flow.switch',
  'encastra.net.http',
  'encastra.data.csv.read',
  'encastra.system.notify',
] as const;

const HOW_IT_WORKS_TEASER = [
  { title: 'Choose', body: 'Pick components from a palette of nineteen, each doing one job.' },
  {
    title: 'Drag',
    body: 'Place them on a canvas. Nothing runs until you connect and press run.',
  },
  { title: 'Connect', body: 'Draw a line. The type system decides on the spot whether it fits.' },
  {
    title: 'Configure permissions',
    body: 'A step that needs a folder, a host or a notification asks for exactly that.',
  },
  { title: 'Run', body: 'Every step, its state, and its timing, visible while it happens.' },
  { title: 'Inspect', body: 'What went in, what came out, and every permission the gate saw.' },
] as const;

export default function HomePage(): ReactNode {
  return (
    <div>
      <div className="page">
        <PageHeader eyebrow="Local-first, beta" title={SITE.tagline} lead={SITE.description}>
          <p className={styles.heroMeta}>
            <StatusBadge
              state="built"
              label={`${COMPONENT_COUNT} components + ${TRIGGER_COUNT} triggers`}
            />
            <span>
              Version <code>{RELEASE.installerVersion}</code>
            </span>
            <span>Windows only, for now</span>
            <span>Not code-signed</span>
          </p>
          <div className={styles.heroActions}>
            <CTA href="/download">Download the beta</CTA>
            <CTA href="/how-it-works" variant="secondary">
              See how it works
            </CTA>
          </div>
        </PageHeader>
      </div>

      <section className="section" aria-labelledby="demo-heading">
        <div className="page">
          <div className={styles.demoHeading}>
            <SectionHeading
              id="demo-heading"
              eyebrow="Watch it refuse, then allow it"
              title="A component that ships with the product tries to write a file, and is refused"
              lead="Most demos show something succeeding. This one shows the permission model working: a refusal that says exactly why, and a run that keeps going anyway. Add one flag — naming one step and one folder — and it runs. This is a recorded transcript, replayed; the diagram beside it lights up the node the terminal is talking about."
            />
          </div>
          <TerminalDemo />
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow="What exists today"
            title="A working engine, not a mockup"
            lead="Every claim below is either a shipped test or a component you can open in the palette. What is designed and not built is labelled that way, in the same place, every time."
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
          <SectionHeading
            eyebrow="Six steps"
            title="How a workflow gets built"
            lead="The same shape every time, whether the workflow watches a folder or runs once and stops."
          />
          <div className={`grid ${styles.steps}`}>
            {HOW_IT_WORKS_TEASER.map((step) => (
              <Card key={step.title}>
                <div className={styles.step}>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className={styles.sectionCta}>
            <CTA href="/how-it-works" variant="secondary">
              Walk through it in full
            </CTA>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow={`${COMPONENT_COUNT} components + ${TRIGGER_COUNT} triggers`}
            title="Small parts, deliberately narrow"
            lead="Everything you can use ships in the box. There is no marketplace yet, so this is the whole set."
          />
          <div className={`grid ${styles.componentsPreview}`}>
            {PREVIEW_IDS.map((id) => {
              const component = COMPONENTS.find((c) => c.id === id);
              if (component === undefined) return null;
              return (
                <Card key={id}>
                  <div className={styles.componentRow}>
                    <h3>{component.name}</h3>
                    <span className={styles.componentType}>{component.category}</span>
                  </div>
                  <p className={styles.componentDescription}>{component.description}</p>
                </Card>
              );
            })}
          </div>
          <div className={styles.sectionCta}>
            <CTA href="/components" variant="secondary">
              Browse every component
            </CTA>
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
