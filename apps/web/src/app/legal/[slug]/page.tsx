import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Callout, PageHeader } from '@/components/ui/Ui';
import { findLegalDoc, LEGAL_DOCS } from '@/config/legal';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

import styles from './page.module.css';

interface RouteParams {
  slug: string;
}

/**
 * The documents in `config/legal.ts` are plain strings. The one kind of link they carry is an
 * absolute `https://` address written out in full, so a reader can see where it goes before
 * following it; this turns those, and only those, into anchors. Trailing sentence punctuation is
 * left outside the link.
 */
const URL_IN_TEXT = /https:\/\/[^\s]+/g;

function withLinks(paragraph: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of paragraph.matchAll(URL_IN_TEXT)) {
    const url = match[0].replace(/[.,;:)]+$/, '');
    const start = match.index;
    if (start > last) parts.push(paragraph.slice(last, start));
    parts.push(
      <a key={start} href={url} rel="noopener noreferrer">
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < paragraph.length) parts.push(paragraph.slice(last));
  return parts;
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
  // `doc.title` is not run through `t()`: `config/legal.ts` holds these documents in English
  // only, and titling a card in a language the document behind it is not written in would be a
  // worse promise than an English title.
  return pageMetadata({
    locale,
    title: doc.title,
    description: t(locale, 'legal.doc.metaDescription', { summary: doc.summary }),
    path: `/legal/${doc.slug}`,
  });
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
              <p key={paragraph.slice(0, 40)}>{withLinks(paragraph)}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
