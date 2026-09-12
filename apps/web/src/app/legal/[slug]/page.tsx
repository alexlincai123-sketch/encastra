import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Callout, PageHeader } from '@/components/ui/Ui';
import { findLegalDoc, LEGAL_DOCS } from '@/config/legal';
import { getLocale, t } from '@/lib/i18n';

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
  const locale = await getLocale();
  return {
    title: doc.title,
    description: t(locale, 'legal.doc.metaDescription', { summary: doc.summary }),
  };
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (doc === undefined) notFound();
  const locale = await getLocale();

  return (
    <div className="page page--narrow">
      <PageHeader eyebrow={t(locale, 'legal.doc.eyebrow')} title={doc.title} lead={doc.summary} />
      <Callout tone="warn" title={t(locale, 'legal.doc.calloutTitle')}>
        {t(locale, 'legal.doc.calloutBodyPrefix')}{' '}
        <a href="/legal">{t(locale, 'legal.doc.calloutLinkText')}</a>{' '}
        {t(locale, 'legal.doc.calloutBodySuffix')}
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
