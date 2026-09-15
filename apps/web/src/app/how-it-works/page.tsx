import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { FlowStep, NodeState } from '@/components/graph/Graph';
import { GraphFlow, GraphNode } from '@/components/graph/Graph';
import { PermissionMock } from '@/components/ui/PermissionMock';
import { StepSection } from '@/components/ui/StepSection';
import { ButtonRow, CTA, PageHeader, SourceRef } from '@/components/ui/Ui';
import { componentNode, findComponent } from '@/lib/graph-nodes';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    title: t(locale, 'howItWorks.hero.eyebrow'),
    description: t(locale, 'howItWorks.meta.description'),
    path: '/how-it-works',
  });
}

const READ = componentNode('encastra.file.read');
const PARSE = componentNode('encastra.data.json');
const WRITE = componentNode('encastra.file.write');
const NOTIFY = componentNode('encastra.system.notify');
const RESIZE = componentNode('encastra.image.resize');
const SAVE_CAPABILITY = findComponent('encastra.file.save').capabilities[0];

const CONNECTED_FLOW: readonly FlowStep[] = [
  { node: READ },
  { node: PARSE, wire: { type: 'string', label: 'TEXT → TEXT' } },
  { node: WRITE, wire: { type: 'json', label: 'JSON → TEXT · stringify-json' } },
  { node: NOTIFY, wire: { type: 'bool', label: 'BOOL → TEXT' } },
];

const RUN_STATES: Readonly<Record<string, NodeState>> = {
  [READ.id]: 'ok',
  [PARSE.id]: 'ok',
  [WRITE.id]: 'failed',
  [NOTIFY.id]: 'skipped',
};

const PALETTE_PREVIEW = [
  'encastra.file.watch',
  'encastra.image.resize',
  'encastra.flow.if',
  'encastra.net.http',
  'encastra.data.csv.read',
  'encastra.system.timer',
] as const;

export default async function HowItWorksPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow={t(locale, 'howItWorks.hero.eyebrow')}
          title={t(locale, 'howItWorks.hero.title')}
          lead={t(locale, 'howItWorks.hero.lead')}
        />
      </div>

      <StepSection
        number={1}
        title={t(locale, 'howItWorks.steps.choose.title')}
        visual={
          <ul className={styles.palette}>
            {PALETTE_PREVIEW.map((id) => {
              const node = componentNode(id);
              return (
                <li key={id} className={styles.paletteItem}>
                  <span>{node.name}</span>
                  <span>{node.id.split('.').slice(0, 2).join('.')}</span>
                </li>
              );
            })}
          </ul>
        }
      >
        <p className="lead">
          {t(locale, 'howItWorks.steps.choose.leadPrefix')}{' '}
          <a href="/components">{t(locale, 'howItWorks.steps.choose.leadLinkText')}</a>
          {t(locale, 'howItWorks.steps.choose.leadSuffix')}
        </p>
        <p className="prose">{t(locale, 'howItWorks.steps.choose.body')}</p>
      </StepSection>

      <StepSection
        number={2}
        title={t(locale, 'howItWorks.steps.drag.title')}
        reverse
        visual={
          <div className={styles.canvas}>
            <span className={styles.canvasGhost} aria-hidden="true" />
            <GraphNode node={RESIZE} locale={locale} />
          </div>
        }
      >
        <p className="lead">{t(locale, 'howItWorks.steps.drag.lead')}</p>
        <p className="prose">{t(locale, 'howItWorks.steps.drag.body')}</p>
      </StepSection>

      <StepSection
        number={3}
        title={t(locale, 'howItWorks.steps.connect.title')}
        caption={t(locale, 'howItWorks.steps.connect.caption')}
        visual={<GraphFlow steps={CONNECTED_FLOW} dense locale={locale} />}
      >
        <p className="lead">{t(locale, 'howItWorks.steps.connect.lead')}</p>
        <p className="prose">{t(locale, 'howItWorks.steps.connect.body1')}</p>
        <p className="prose">
          {t(locale, 'howItWorks.steps.connect.body2Prefix')} <code>examples/json-report</code>
          {t(locale, 'howItWorks.steps.connect.body2Suffix')}
        </p>
      </StepSection>

      <StepSection
        number={4}
        title={t(locale, 'howItWorks.steps.permissions.title')}
        reverse
        caption={t(locale, 'howItWorks.steps.permissions.caption')}
        visual={
          <PermissionMock
            kind={SAVE_CAPABILITY?.kind ?? 'fs.write'}
            reason={
              SAVE_CAPABILITY?.reason ?? t(locale, 'howItWorks.steps.permissions.fallbackReason')
            }
            scope={SAVE_CAPABILITY?.scope ?? 'chosen-folder'}
            location="C:\Users\you\out"
            locale={locale}
          />
        }
      >
        <p className="lead">{t(locale, 'howItWorks.steps.permissions.lead')}</p>
        <p className="prose">
          {t(locale, 'howItWorks.steps.permissions.bodyPrefix')} <code>fs.write</code>{' '}
          {t(locale, 'howItWorks.steps.permissions.bodySuffix')}
        </p>
      </StepSection>

      <StepSection
        number={5}
        title={t(locale, 'howItWorks.steps.run.title')}
        caption={t(locale, 'howItWorks.steps.run.caption')}
        visual={
          <GraphFlow
            steps={CONNECTED_FLOW}
            states={RUN_STATES}
            activeIndex={3}
            dense
            locale={locale}
          />
        }
      >
        <p className="lead">{t(locale, 'howItWorks.steps.run.lead')}</p>
        <p className="prose">
          {t(locale, 'howItWorks.steps.run.bodyPrefix')}{' '}
          <code>{t(locale, 'howItWorks.steps.run.bodyWriteFile')}</code>{' '}
          {t(locale, 'howItWorks.steps.run.bodyMiddle')}{' '}
          <code>{t(locale, 'howItWorks.steps.run.bodyNotify')}</code>{' '}
          {t(locale, 'howItWorks.steps.run.bodySuffix')}
        </p>
      </StepSection>

      <StepSection
        number={6}
        title={t(locale, 'howItWorks.steps.inspect.title')}
        reverse
        visual={
          <div className={styles.journalCard}>
            <div className={styles.journalHead}>
              <strong>{t(locale, 'howItWorks.steps.run.bodyWriteFile')}</strong>
              <code>encastra.file.write@1.0.0</code>
            </div>
            <dl className={styles.journalList}>
              <dt>{t(locale, 'howItWorks.steps.inspect.journal.state')}</dt>
              <dd>{t(locale, 'howItWorks.steps.inspect.journal.stateValue')}</dd>
              <dt>{t(locale, 'howItWorks.steps.inspect.journal.input')}</dt>
              <dd>{t(locale, 'howItWorks.steps.inspect.journal.inputValue')}</dd>
              <dt>{t(locale, 'howItWorks.steps.inspect.journal.capability')}</dt>
              <dd>
                <code>fs.write</code> —{' '}
                {t(locale, 'howItWorks.steps.inspect.journal.capabilityRefused')}
              </dd>
              <dt>{t(locale, 'howItWorks.steps.inspect.journal.reason')}</dt>
              <dd>{t(locale, 'howItWorks.steps.inspect.journal.reasonValue')}</dd>
            </dl>
          </div>
        }
      >
        <p className="lead">{t(locale, 'howItWorks.steps.inspect.lead')}</p>
        <p className="prose">{t(locale, 'howItWorks.steps.inspect.body')}</p>
        <SourceRef
          path="crates/encastra-builtins/tests/image_processor.rs"
          note={t(locale, 'howItWorks.steps.inspect.sourceNote')}
          locale={locale}
        />
      </StepSection>

      <section className="section">
        <div className="page">
          <div className="stack">
            <p className="lead">{t(locale, 'howItWorks.closing.lead')}</p>
            <ButtonRow>
              <CTA href="/tutorials">{t(locale, 'howItWorks.closing.buildIt')}</CTA>
              <CTA href="/download" variant="secondary">
                {t(locale, 'howItWorks.closing.download')}
              </CTA>
            </ButtonRow>
          </div>
        </div>
      </section>
    </div>
  );
}
