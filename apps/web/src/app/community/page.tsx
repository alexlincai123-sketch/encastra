import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CTA, NotBuilt, PageHeader } from '@/components/ui/Ui';
import { STATUS } from '@/config/site';

export const metadata: Metadata = {
  title: 'Community',
  description:
    'Not built yet. There is no community feature in this build — no accounts, no profiles, no forum.',
};

export default function CommunityPage(): ReactNode {
  return (
    <div className="page">
      <PageHeader eyebrow="Community" title="Not built yet" />
      <div className="stack-lg">
        <NotBuilt
          state={STATUS.community}
          title="No accounts, no profiles, no forum"
          blockedBy={[
            'A backend: authentication, users, projects',
            'A component registry to publish to',
            'A marketplace listing model',
          ]}
        >
          <p>
            There is nowhere on this site or in the application to sign in, follow another author,
            or post anything. This page is here so the sidebar and the site map are honest about
            what does not exist, rather than pointing at an empty screen.
          </p>
          <p>
            The product roadmap places Community after the backend and the component registry — see{' '}
            <a href="/about">/about</a> for the project&rsquo;s current stage.
          </p>
        </NotBuilt>
        <CTA href="/download" variant="secondary">
          Download the beta instead
        </CTA>
      </div>
    </div>
  );
}
