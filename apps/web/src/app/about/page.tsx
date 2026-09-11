import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Callout, Card, CTA, PageHeader, SectionHeading } from '@/components/ui/Ui';
import { RELEASE } from '@/config/site';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'About',
  description:
    'What Encastra is, where the name comes from, its unresolved legal status, and where the project actually stands today.',
};

export default function AboutPage(): ReactNode {
  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow="About"
        title="What this is, and where it stands"
        lead="Encastra is a local-first runtime that executes a typed graph of components, plus the editor, protocol and CLI built around it. This page is the honest version of that sentence — what exists, what is a working name, and what is still only a design document."
      />

      <div className="prose">
        <h2>The checkpoint the product is measured against</h2>
        <p>Not a slide. A test in the repository, run on every change:</p>
      </div>
      <p className={styles.checkpoint}>
        Watch a folder. Drop an 800×400 PNG into it. A 200×100 copy appears in another folder, and
        nothing was written anywhere that was not explicitly allowed.
      </p>
      <p className="prose">
        That is <code>crates/encastra-builtins/tests/image_processor.rs</code>, and it is also the
        workflow <a href="/tutorials">the tutorial</a> builds by hand and the terminal on the
        homepage replays.
      </p>

      <section className="section" id="name">
        <SectionHeading eyebrow="The name" title="Encastra is a working name" />
        <div className="prose">
          <p>
            <em>Encastrar</em> is a real Spanish verb, from Latin <em>incastrare</em>: to interlock
            or couple two pieces so that each holds the other — the product, stated in one word. It
            was chosen from a researched shortlist: the npm scope, the GitHub org and the
            <code>.dev</code> domain all appear unregistered, and no product or company by this name
            surfaced in a search of any industry.
          </p>
          <p>
            <strong>What was not checked, and matters: trademark registers.</strong> USPTO, EUIPO
            and TMview have not been searched. An available npm handle is not trademark clearance,
            and nobody associated with this project states that the name is legally clear — see{' '}
            <a href="/legal/trademark">the trademark notice</a> for the full, equally honest version
            of this paragraph.
          </p>
          <p>
            The product was originally developed under a different working name that referenced a
            well-known interlocking-brick toy. That name created real trademark risk and has been
            permanently retired from every public surface — it does not appear on this site, in the
            repository, or in any package name, and it will not reappear.
          </p>
        </div>
        <Callout tone="note" title="Until clearance happens">
          The name is treated as reversible. It appears in exactly three shapes across the codebase
          — the npm scope, the crate prefix, and the project file extension — specifically so a
          rename, if one is ever needed, is one scripted commit rather than a migration.
        </Callout>
      </section>

      <section className="section">
        <SectionHeading eyebrow="Non-goals" title="What this is deliberately not" />
        <div className="prose">
          <p>
            <strong>No AI in the runtime.</strong> Workflows execute without a model in the loop, by
            design — no component, no scheduling decision, and no validation path calls one. An
            authoring aid that suggests a component or explains an error is a possible future
            addition, strictly outside the execution path; it is not a plan to make the runtime
            itself probabilistic.
          </p>
          <p>
            <strong>No claim of being finished.</strong> The runtime, the type system, the
            capability broker and the project format are built and tested. The website you are
            reading, the onboarding flow, and accessibility fixes are what the current release adds
            on top of that — see /download for exactly which build is which.
          </p>
        </div>
      </section>

      <section className="section">
        <SectionHeading eyebrow="Where it stands" title="Beta, and the word is meant" />
        <div className={`grid ${styles.grid}`}>
          <Card>
            <h3>The engine</h3>
            <p>
              Runtime, type system, capability broker, project format, CLI: built, tested, and
              cross-checked between the TypeScript and Rust readers of the same rule table.
            </p>
          </Card>
          <Card>
            <h3>The desktop application</h3>
            <p>
              A canvas, a palette, an inspector that doubles as a debugger, and native version
              history. Windows-tested; components declare macOS and Linux support the engine does
              not yet ship a build for.
            </p>
          </Card>
          <Card>
            <h3>This website</h3>
            <p>
              New. Its whole purpose is to make the above legible to somebody who has not read the
              source — see docs/BETA-0.2-AUDIT.md&rsquo;s own account of why it did not exist
              before.
            </p>
          </Card>
          <Card>
            <h3>Everything else</h3>
            <p>
              Third-party components, a registry, a marketplace, accounts and payments are designed
              and not built. /security and /marketplace say so specifically, not just here.
            </p>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="stack">
          <p className="lead">
            Build {RELEASE.commit} is the one this site&rsquo;s download page documents.
          </p>
          <CTA href="/download">See the real build record</CTA>
        </div>
      </section>
    </div>
  );
}
