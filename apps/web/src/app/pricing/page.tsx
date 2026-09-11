import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Card, CTA, NotBuilt, PageHeader, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { STATUS } from '@/config/site';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'What it costs today: nothing. There are no paid plans, no accounts, and no payment system in this build.',
};

export default function PricingPage(): ReactNode {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Pricing"
        title="What it costs today"
        lead="Nothing. There is no payment system, no account, and no plan to choose between — so there is one real price on this page and a stated absence rather than a pricing table with invented numbers on it."
      />

      <Card>
        <div className={styles.freeCard}>
          <StatusBadge state="built" label="Free — beta" />
          <h2 className={styles.freeTitle}>Download and run it</h2>
          <p className={styles.freeBody}>
            The Windows installer costs nothing and needs no account. Everything documented on this
            site — the runtime, the capability broker, all nineteen components — is available in the
            beta today, with the limitations stated on /security.
          </p>
          <CTA href="/download">Download the beta</CTA>
        </div>
      </Card>

      <section className="section">
        <SectionHeading
          eyebrow="Not yet"
          title="What would eventually cost money"
          lead="Real payments are explicitly out of scope for the current milestone, and the roadmap places them after a marketplace listing model exists — a listing is not the same as money moving through it."
        />
        <NotBuilt
          state={STATUS.payments}
          title="No paid plans, no marketplace purchases, no subscriptions"
          blockedBy={[
            'A backend with accounts and billing',
            'A marketplace listing model (built without payments first)',
            'Real payments, kept sandboxed until that is deliberately turned off',
          ]}
        >
          <p>
            When any of this exists, it will replace this page&rsquo;s claim of &ldquo;nothing to
            pay&rdquo; with real numbers — not the other way around.
          </p>
        </NotBuilt>
      </section>
    </div>
  );
}
