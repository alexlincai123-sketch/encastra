import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Card, CTA, PageHeader, SectionHeading, SourceRef } from '@/components/ui/Ui';
import { DOCS } from '@/config/site';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'What is written down, and who it is written for. The repository is not public yet, so this page describes each document rather than hosting it.',
};

const ENGINEER_DOCS = DOCS.filter((doc) => doc.audience === 'engineers');
const EVERYONE_DOCS = DOCS.filter((doc) => doc.audience === 'everyone');

export default function DocsPage(): ReactNode {
  return (
    <div className="page">
      <PageHeader
        eyebrow="Documentation"
        title="What is written down"
        lead="The reference material lives in the repository as docs/*.md, next to the code it describes. The repository is not public, so this page says what each document is and who it was written for, rather than hosting or linking to it."
      />

      <SectionHeading eyebrow="For anyone" title="Written for somebody who is not an engineer" />
      <div className={`grid ${styles.grid}`}>
        {EVERYONE_DOCS.map((doc) => (
          <Card key={doc.slug}>
            <div className={styles.card}>
              <span className={styles.audience}>{doc.audience}</span>
              <h3>{doc.title}</h3>
              <p>{doc.summary}</p>
              <SourceRef path={`docs/${doc.slug}`} />
            </div>
          </Card>
        ))}
      </div>

      <section className="section">
        <SectionHeading eyebrow="For engineers" title="Reference material" />
        <div className={`grid ${styles.grid}`}>
          {ENGINEER_DOCS.map((doc) => (
            <Card key={doc.slug}>
              <div className={styles.card}>
                <span className={styles.audience}>{doc.audience}</span>
                <h3>{doc.title}</h3>
                <p>{doc.summary}</p>
                <SourceRef path={`docs/${doc.slug}`} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="stack">
          <p className="lead">
            The tutorial itself is written out in full, not just described — it is the one place
            this site does host the actual content rather than pointing at it.
          </p>
          <CTA href="/tutorials">Read the tutorial</CTA>
        </div>
      </section>
    </div>
  );
}
