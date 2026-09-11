import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Callout, Card, CTA, PageHeader, SectionHeading } from '@/components/ui/Ui';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'How to reach the project today. There is no public email yet, no accounts, and no support desk — this page says exactly what does and does not exist.',
};

export default function ContactPage(): ReactNode {
  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow="Contact"
        title="How to reach the project"
        lead="Honestly: there is not much here yet. No account, no support desk, and no published general-purpose address — because none of those exist. This page names the one channel that does."
      />

      <Callout tone="note" title="No general contact address yet">
        The domain in this project&rsquo;s own identifiers, <code>encastra.dev</code>, is not
        registered (see <a href="/about#name">/about</a>), so an address anybody might guess from
        this site would go nowhere. Establishing one is a launch prerequisite, not something skipped
        by accident.
      </Callout>

      <section className="section">
        <SectionHeading eyebrow="Security" title="Found a vulnerability?" />
        <Card>
          <p className="prose">
            This is the one channel that is specified today. Please do not open a public issue —
            report privately through the repository host&rsquo;s private vulnerability reporting.
            See the disclosure draft for exactly what to include and what to expect.
          </p>
          <CTA href="/legal/security-disclosure" variant="secondary">
            Read the disclosure policy
          </CTA>
        </Card>
      </section>

      <section className="section">
        <SectionHeading eyebrow="Everything else" title="Bugs, questions, and feedback" />
        <p className="prose">
          There is no support desk and no dedicated feedback channel yet. If you have found this
          site, you most likely also have access to the repository it describes — the commit history
          and its issue tracker, where they exist, are the closest thing to a contact channel this
          project currently has.
        </p>
      </section>
    </div>
  );
}
