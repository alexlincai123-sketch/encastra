import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CTA, NotBuilt, PageHeader } from '@/components/ui/Ui';
import { STATUS } from '@/config/site';

export const metadata: Metadata = {
  title: 'Marketplace',
  description:
    'Not built yet. There is no way to install a component beyond the nineteen that ship with the app.',
};

export default function MarketplacePage(): ReactNode {
  return (
    <div className="page">
      <PageHeader eyebrow="Marketplace" title="Not built yet" />
      <div className="stack-lg">
        <NotBuilt
          state={STATUS.marketplace}
          title="You cannot install a component"
          blockedBy={[
            'The WebAssembly sandbox third-party components would run in',
            'Signing and a revocation list, so an installed component can be verified',
            'A registry: publish, verify, install, revoke',
            'A listing model — money movement is explicitly out of scope even after that',
          ]}
        >
          <p>
            Every component you can use is in the box — nineteen, plus two triggers, all first-party
            and compiled into the application. See <a href="/components">the full catalogue</a> for
            exactly what that set can do.
          </p>
          <p>
            When this exists, listings will come before any money moves through it — the roadmap
            treats a marketplace listing model and real payments as separate milestones, in that
            order.
          </p>
        </NotBuilt>
        <CTA href="/components" variant="secondary">
          See what you actually have today
        </CTA>
      </div>
    </div>
  );
}
