import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { FlowStep, GraphNodeSpec } from '@/components/graph/Graph';
import { GraphBranch, GraphFlow } from '@/components/graph/Graph';
import { PageHeader, SectionHeading, StatusBadge } from '@/components/ui/Ui';
import { componentNode } from '@/lib/graph-nodes';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    title: t(locale, 'nav.primary.templates'),
    description: t(locale, 'templates.meta.description'),
    path: '/templates',
  });
}

const WATCH = componentNode('encastra.file.watch');
const RESIZE = componentNode('encastra.image.resize');
const SAVE = componentNode('encastra.file.save');
const THUMBNAIL = componentNode('encastra.image.thumbnail');
const SWITCH = componentNode('encastra.flow.switch');
const MOVE = componentNode('encastra.file.move');

const IMAGES_ARM: GraphNodeSpec = {
  ...MOVE,
  id: 'file-organiser-images',
  name: 'Move File → images',
};
const DOCUMENTS_ARM: GraphNodeSpec = {
  ...MOVE,
  id: 'file-organiser-documents',
  name: 'Move File → documents',
};

const IMAGE_PROCESSOR_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: RESIZE, wire: { type: 'file', label: 'FILE → IMAGE · decode-image' } },
  { node: SAVE, wire: { type: 'image', label: 'IMAGE → FILE' } },
];

const THUMBNAILS_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: THUMBNAIL, wire: { type: 'file', label: 'FILE → IMAGE · decode-image' } },
  { node: SAVE, wire: { type: 'image', label: 'IMAGE → FILE' } },
];

const ORGANISER_TRUNK: readonly FlowStep[] = [
  { node: WATCH },
  { node: SWITCH, wire: { type: 'string', label: 'EXTENSION → MATCH' } },
];

const ORGANISER_ARMS: readonly FlowStep[] = [{ node: IMAGES_ARM }, { node: DOCUMENTS_ARM }];

export default async function TemplatesPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page">
      <PageHeader
        eyebrow={t(locale, 'templates.hero.eyebrow')}
        title={t(locale, 'templates.hero.title')}
        lead={t(locale, 'templates.hero.lead')}
      />

      <div className={styles.template}>
        <div className={styles.head}>
          <h2>Image Processor</h2>
          <StatusBadge state="built" />
        </div>
        <p className={styles.summary}>
          {t(locale, 'templates.imageProcessor.summaryPrefix')}{' '}
          <a href="/tutorials">{t(locale, 'templates.imageProcessor.tutorialLinkText')}</a>{' '}
          {t(locale, 'templates.imageProcessor.summarySuffix')}
        </p>
        <div className={styles.needs}>
          <span className={styles.needsItem}>
            {t(locale, 'templates.imageProcessor.needsWatch')}
          </span>
          <span className={styles.needsItem}>
            {t(locale, 'templates.imageProcessor.needsSave')}
          </span>
        </div>
        <div className={styles.diagram}>
          <GraphFlow steps={IMAGE_PROCESSOR_FLOW} dense locale={locale} />
        </div>
      </div>

      <div className={styles.template}>
        <div className={styles.head}>
          <h2>File Organiser</h2>
          <StatusBadge state="built" />
        </div>
        <p className={styles.summary}>{t(locale, 'templates.fileOrganiser.summary')}</p>
        <div className={styles.needs}>
          <span className={styles.needsItem}>
            {t(locale, 'templates.fileOrganiser.needsWatch')}
          </span>
          <span className={styles.needsItem}>
            {t(locale, 'templates.fileOrganiser.needsImages')}
          </span>
          <span className={styles.needsItem}>
            {t(locale, 'templates.fileOrganiser.needsDocuments')}
          </span>
        </div>
        <div className={styles.diagram}>
          <GraphBranch
            trunk={ORGANISER_TRUNK}
            arms={ORGANISER_ARMS}
            caption={t(locale, 'templates.fileOrganiser.caption')}
            locale={locale}
          />
        </div>
      </div>

      <div className={styles.template}>
        <div className={styles.head}>
          <h2>Thumbnails</h2>
          <StatusBadge state="built" />
        </div>
        <p className={styles.summary}>{t(locale, 'templates.thumbnails.summary')}</p>
        <div className={styles.needs}>
          <span className={styles.needsItem}>{t(locale, 'templates.thumbnails.needsWatch')}</span>
          <span className={styles.needsItem}>{t(locale, 'templates.thumbnails.needsSave')}</span>
        </div>
        <div className={styles.diagram}>
          <GraphFlow steps={THUMBNAILS_FLOW} dense locale={locale} />
        </div>
      </div>

      <section className="section">
        <SectionHeading
          eyebrow={t(locale, 'templates.rule.eyebrow')}
          title={t(locale, 'templates.rule.title')}
          lead={t(locale, 'templates.rule.lead')}
        />
      </section>
    </div>
  );
}
