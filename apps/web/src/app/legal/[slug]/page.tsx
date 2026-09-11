import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Callout, PageHeader } from '@/components/ui/Ui';
import { findLegalDoc, LEGAL_DOCS } from '@/config/legal';

import styles from './page.module.css';

interface RouteParams {
  slug: string;
}

export function generateStaticParams(): RouteParams[] {
  return LEGAL_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (doc === undefined) return {};
  return { title: doc.title, description: `Draft — ${doc.summary}` };
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (doc === undefined) notFound();

  return (
    <div className="page page--narrow">
      <PageHeader eyebrow="Legal · Draft" title={doc.title} lead={doc.summary} />
      <Callout tone="warn" title="Draft — not legal advice">
        This document has not been reviewed by qualified legal counsel and is not a finished policy.
        It states, honestly, what the project currently intends to promise. See{' '}
        <a href="/legal">all documents</a> for the same notice on every one of them.
      </Callout>

      <div className={`prose ${styles.body}`}>
        {doc.sections.map((section) => (
          <div key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
