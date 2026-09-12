import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Callout, Card, PageHeader } from '@/components/ui/Ui';
import { LEGAL_DOCS } from '@/config/legal';
import { getLocale, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, 'legal.index.hero.eyebrow'),
    description: t(locale, 'legal.index.meta.description'),
  };
}

export default async function LegalIndexPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page">
      <PageHeader
        eyebrow={t(locale, 'legal.index.hero.eyebrow')}
        title={t(locale, 'legal.index.hero.title')}
        lead={t(locale, 'legal.index.hero.lead')}
      />
      <Callout tone="warn" title={t(locale, 'legal.index.calloutTitle')}>
        {t(locale, 'legal.index.calloutBody')}
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
