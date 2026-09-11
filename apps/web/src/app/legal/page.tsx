import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Callout, Card, PageHeader } from '@/components/ui/Ui';
import { LEGAL_DOCS } from '@/config/legal';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Legal',
  description:
    'The nine legal documents this project has drafted. All nine are drafts pending review by qualified legal counsel and are not legal advice.',
};

export default function LegalIndexPage(): ReactNode {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Legal"
        title="All documents"
        lead="Every document below is a draft. None has been reviewed by a lawyer, and every page says so again before the text itself."
      />
      <Callout tone="warn" title="Not legal advice">
        These are working drafts written to state, honestly, what this project currently intends to
        promise — not finished policies. Nothing on this page or the pages it links to should be
        relied upon as legal advice, and nothing here has been reviewed by qualified legal counsel.
      </Callout>

      <div className={`grid ${styles.list}`}>
        {LEGAL_DOCS.map((doc) => (
          <Link key={doc.slug} className={styles.docLink} href={`/legal/${doc.slug}`}>
            <Card>
              <div className={styles.docCard}>
                <h2>{doc.title}</h2>
                <p>{doc.summary}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
