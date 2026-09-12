import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { FlowStep } from '@/components/graph/Graph';
import { GraphFlow, GraphNode } from '@/components/graph/Graph';
import { PermissionMock } from '@/components/ui/PermissionMock';
import { StepSection } from '@/components/ui/StepSection';
import { ButtonRow, Callout, Card, CTA, PageHeader, SectionHeading } from '@/components/ui/Ui';
import type { ConfigRecord } from '@/lib/components.types';
import { componentNode, findComponent } from '@/lib/graph-nodes';
import { getLocale, type Locale, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, 'tutorials.meta.title'),
    description: t(locale, 'tutorials.meta.description'),
  };
}

const WATCH = componentNode('encastra.file.watch');
const RESIZE = componentNode('encastra.image.resize');
const SAVE = componentNode('encastra.file.save');

const WATCH_CAP = findComponent('encastra.file.watch').capabilities[0];
const SAVE_CAP = findComponent('encastra.file.save').capabilities[0];

const CONNECT_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: RESIZE, wire: { type: 'file', label: 'FILE → IMAGE · decode-image' } },
];

const FULL_FLOW: readonly FlowStep[] = [
  { node: WATCH },
  { node: RESIZE, wire: { type: 'file', label: 'FILE → IMAGE · decode-image' } },
  { node: SAVE, wire: { type: 'image', label: 'IMAGE → FILE' } },
];

function SettingsTable({
  config,
  locale,
}: {
  config: readonly ConfigRecord[];
  locale: Locale;
}): ReactNode {
  return (
    <div className={`table-scroll ${styles.settings}`}>
      <table className="data">
        <thead>
          <tr>
            <th>{t(locale, 'tutorials.settingsTable.setting')}</th>
            <th>{t(locale, 'tutorials.settingsTable.notes')}</th>
          </tr>
        </thead>
        <tbody>
          {config.map((field) => (
            <tr key={field.key}>
              <td>
                <strong>{field.label}</strong>
                {field.required ? ` ${t(locale, 'tutorials.settingsTable.required')}` : ''}
              </td>
              <td>{field.doc ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TutorialsPage(): Promise<ReactNode> {
  const locale = await getLocale();
  const watchConfig = findComponent('encastra.file.watch').config;
  const resizeConfig = findComponent('encastra.image.resize').config;
  const saveConfig = findComponent('encastra.file.save').config;

  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow={t(locale, 'tutorials.hero.eyebrow')}
          title={t(locale, 'tutorials.hero.title')}
          lead={t(locale, 'tutorials.hero.lead')}
        />
        <dl className={styles.meta}>
          <div>
            <dt>{t(locale, 'tutorials.hero.time')}</dt>
            <dd>{t(locale, 'tutorials.hero.timeValue')}</dd>
          </div>
          <div>
            <dt>{t(locale, 'tutorials.hero.needs')}</dt>
            <dd>{t(locale, 'tutorials.hero.needsValue')}</dd>
          </div>
        </dl>

        <SectionHeading
          eyebrow={t(locale, 'tutorials.beforeStart.eyebrow')}
          title={t(locale, 'tutorials.beforeStart.title')}
        />
        <p className="prose">{t(locale, 'tutorials.beforeStart.body')}</p>
        <div className={`grid ${styles.folders}`}>
          <Card>
            <div className={styles.folder}>
              <strong>{t(locale, 'tutorials.beforeStart.inbox.name')}</strong>
              <p>{t(locale, 'tutorials.beforeStart.inbox.body')}</p>
              <code>./inbox</code>
            </div>
          </Card>
          <Card>
            <div className={styles.folder}>
              <strong>{t(locale, 'tutorials.beforeStart.out.name')}</strong>
              <p>{t(locale, 'tutorials.beforeStart.out.body')}</p>
              <code>./out</code>
            </div>
          </Card>
        </div>
      </div>

      <StepSection
        number={1}
        title={t(locale, 'tutorials.steps.1.title')}
        visual={
          <p className="prose">
            {t(locale, 'tutorials.steps.1.visualPrefix')}{' '}
            <strong>{t(locale, 'tutorials.steps.1.home')}</strong>
            {t(locale, 'tutorials.steps.1.visualMiddle1')}{' '}
            <strong>{t(locale, 'tutorials.steps.1.builder')}</strong>
            {t(locale, 'tutorials.steps.1.visualMiddle2')}{' '}
            <strong>{t(locale, 'tutorials.steps.1.palette')}</strong>{' '}
            {t(locale, 'tutorials.steps.1.visualMiddle3')}{' '}
            <strong>{t(locale, 'tutorials.steps.1.canvas')}</strong>{' '}
            {t(locale, 'tutorials.steps.1.visualMiddle4')}{' '}
            <strong>{t(locale, 'tutorials.steps.1.inspector')}</strong>{' '}
            {t(locale, 'tutorials.steps.1.visualSuffix')}
          </p>
        }
      >
        <p className="lead">{t(locale, 'tutorials.steps.1.lead')}</p>
      </StepSection>

      <StepSection
        number={2}
        title={t(locale, 'tutorials.steps.2.title')}
        reverse
        visual={<GraphNode node={WATCH} highlighted locale={locale} />}
      >
        <p className="lead">
          {t(locale, 'tutorials.steps.2.leadPrefix')}{' '}
          <strong>{t(locale, 'tutorials.steps.2.watchFolder')}</strong>{' '}
          {t(locale, 'tutorials.steps.2.leadSuffix')}
        </p>
        <p className="prose">
          {t(locale, 'tutorials.steps.2.bodyPrefix')}{' '}
          <strong>{t(locale, 'tutorials.steps.2.trigger')}</strong>
          {t(locale, 'tutorials.steps.2.bodySuffix')} <code>file</code>{' '}
          {t(locale, 'tutorials.steps.2.bodyEnd')}
        </p>
        <SettingsTable config={watchConfig} locale={locale} />
      </StepSection>

      <StepSection
        number={3}
        title={t(locale, 'tutorials.steps.3.title')}
        visual={<GraphNode node={RESIZE} highlighted locale={locale} />}
      >
        <p className="lead">
          {t(locale, 'tutorials.steps.3.leadPrefix')}{' '}
          <strong>{t(locale, 'tutorials.steps.3.resizeImage')}</strong>{' '}
          {t(locale, 'tutorials.steps.3.leadSuffix')}
        </p>
        <SettingsTable config={resizeConfig} locale={locale} />
      </StepSection>

      <StepSection
        number={4}
        title={t(locale, 'tutorials.steps.4.title')}
        reverse
        caption={t(locale, 'tutorials.steps.4.caption')}
        visual={<GraphFlow steps={CONNECT_FLOW} dense locale={locale} />}
      >
        <p className="lead">
          {t(locale, 'tutorials.steps.4.leadPrefix')} <code>file</code>{' '}
          {t(locale, 'tutorials.steps.4.leadMiddle')} <code>image</code>{' '}
          {t(locale, 'tutorials.steps.4.leadSuffix')}
        </p>
        <p className="prose">
          {t(locale, 'tutorials.steps.4.body1Prefix')} <code>file</code>{' '}
          {t(locale, 'tutorials.steps.4.body1Middle')} <code>image</code>{' '}
          {t(locale, 'tutorials.steps.4.body1Suffix')} <code>decode-image</code>{' '}
          {t(locale, 'tutorials.steps.4.body1End')}
        </p>
        <p className="prose">
          {t(locale, 'tutorials.steps.4.body2Prefix')}{' '}
          <strong>{t(locale, 'tutorials.steps.4.handle')}</strong>{' '}
          {t(locale, 'tutorials.steps.4.body2Suffix')}
        </p>
      </StepSection>

      <StepSection
        number={5}
        title={t(locale, 'tutorials.steps.5.title')}
        caption={t(locale, 'tutorials.steps.5.caption')}
        visual={<GraphFlow steps={FULL_FLOW} dense locale={locale} />}
      >
        <p className="lead">
          {t(locale, 'tutorials.steps.5.leadPrefix')}{' '}
          <strong>{t(locale, 'tutorials.steps.5.saveFile')}</strong>{' '}
          {t(locale, 'tutorials.steps.5.leadMiddle')} <code>image</code>{' '}
          {t(locale, 'tutorials.steps.5.leadEnd')} <code>file</code>{' '}
          {t(locale, 'tutorials.steps.5.leadSuffix')}{' '}
          <em>{t(locale, 'tutorials.steps.5.widening')}</em>
          {t(locale, 'tutorials.steps.5.leadFinal')}
        </p>
        <p className="prose">
          {t(locale, 'tutorials.steps.5.bodyPrefix')} <em>{t(locale, 'tutorials.steps.5.can')}</em>{' '}
          {t(locale, 'tutorials.steps.5.bodySuffix')}
        </p>
        <SettingsTable config={saveConfig} locale={locale} />
      </StepSection>

      <StepSection
        number={6}
        title={t(locale, 'tutorials.steps.6.title')}
        reverse
        visual={
          <div className={styles.permissions}>
            <PermissionMock
              kind={WATCH_CAP?.kind ?? 'fs.read'}
              reason={WATCH_CAP?.reason ?? t(locale, 'tutorials.steps.6.watchReason')}
              scope={WATCH_CAP?.scope ?? 'watched-folder'}
              location="C:\Users\you\inbox"
              locale={locale}
            />
            <PermissionMock
              kind={SAVE_CAP?.kind ?? 'fs.write'}
              reason={SAVE_CAP?.reason ?? t(locale, 'tutorials.steps.6.saveReason')}
              scope={SAVE_CAP?.scope ?? 'chosen-folder'}
              location="C:\Users\you\out"
              locale={locale}
            />
          </div>
        }
      >
        <p className="lead">
          {t(locale, 'tutorials.steps.6.leadPrefix')}{' '}
          <strong>{t(locale, 'tutorials.steps.6.permissionsSection')}</strong>
          {t(locale, 'tutorials.steps.6.leadMiddle')}{' '}
          <strong>{t(locale, 'tutorials.steps.6.allowThisFolder')}</strong>{' '}
          {t(locale, 'tutorials.steps.6.leadSuffix')}
        </p>
        <p className="prose">{t(locale, 'tutorials.steps.6.body1')}</p>
        <p className="prose">
          {t(locale, 'tutorials.steps.6.body2Prefix')} <em>{t(locale, 'tutorials.steps.6.not')}</em>{' '}
          {t(locale, 'tutorials.steps.6.body2Suffix')}
        </p>
        <Callout tone="note">{t(locale, 'tutorials.steps.6.callout')}</Callout>
      </StepSection>

      <StepSection
        number={7}
        title={t(locale, 'tutorials.steps.7.title')}
        visual={
          <div className="prose">
            <p>
              {t(locale, 'tutorials.steps.7.visual1Prefix')}{' '}
              <em>{t(locale, 'tutorials.steps.7.run')}</em>
              {t(locale, 'tutorials.steps.7.visual1Middle')}{' '}
              <strong>{t(locale, 'tutorials.steps.7.startWatching')}</strong>
              {t(locale, 'tutorials.steps.7.visual1Suffix')}
            </p>
            <p>
              {t(locale, 'tutorials.steps.7.visual2Prefix')} <code>inbox</code>
              {t(locale, 'tutorials.steps.7.visual2Suffix')} <code>out</code>
              {t(locale, 'tutorials.steps.7.visual2End')}
            </p>
          </div>
        }
      >
        <p className="lead">
          {t(locale, 'tutorials.steps.7.leadPrefix')}{' '}
          <strong>{t(locale, 'tutorials.steps.7.ctrl')}</strong>
          {t(locale, 'tutorials.steps.7.leadMiddle')}{' '}
          <strong>{t(locale, 'tutorials.steps.7.enter')}</strong>
          {t(locale, 'tutorials.steps.7.leadSuffix')}
        </p>
        <p className="prose">{t(locale, 'tutorials.steps.7.body')}</p>
      </StepSection>

      <StepSection
        number={8}
        title={t(locale, 'tutorials.steps.8.title')}
        reverse
        visual={
          <Card>
            <strong>{t(locale, 'tutorials.steps.8.cardTitle')}</strong>
            <p className="prose">{t(locale, 'tutorials.steps.8.cardLine1')}</p>
            <p className="prose">{t(locale, 'tutorials.steps.8.cardLine2')}</p>
            <p className="prose">{t(locale, 'tutorials.steps.8.cardLine3')}</p>
          </Card>
        }
      >
        <p className="lead">
          {t(locale, 'tutorials.steps.8.leadPrefix')}{' '}
          <strong>{t(locale, 'tutorials.steps.8.journal')}</strong>
          {t(locale, 'tutorials.steps.8.leadSuffix')}
        </p>
        <p className="prose">{t(locale, 'tutorials.steps.8.body')}</p>
      </StepSection>

      <StepSection
        number={9}
        title={t(locale, 'tutorials.steps.9.title')}
        visual={
          <p className="prose">
            {t(locale, 'tutorials.steps.9.visualPrefix')} <code>.encastra</code>{' '}
            {t(locale, 'tutorials.steps.9.visualSuffix')}
          </p>
        }
      >
        <p className="lead">{t(locale, 'tutorials.steps.9.lead')}</p>
      </StepSection>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow={t(locale, 'tutorials.refusal.eyebrow')}
            title={t(locale, 'tutorials.refusal.title')}
          />
          <p className="prose">{t(locale, 'tutorials.refusal.body1')}</p>
          <p className={styles.refusal}>{t(locale, 'tutorials.refusal.transcript')}</p>
          <p className="prose">{t(locale, 'tutorials.refusal.body2')}</p>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <SectionHeading
            eyebrow={t(locale, 'tutorials.tryBreaking.eyebrow')}
            title={t(locale, 'tutorials.tryBreaking.title')}
          />
          <div className={`grid ${styles.changeGrid}`}>
            <Card>
              <h3>{t(locale, 'tutorials.tryBreaking.swapResizer.title')}</h3>
              <p>{t(locale, 'tutorials.tryBreaking.swapResizer.body')}</p>
            </Card>
            <Card>
              <h3>{t(locale, 'tutorials.tryBreaking.addNotification.title')}</h3>
              <p>{t(locale, 'tutorials.tryBreaking.addNotification.body')}</p>
            </Card>
            <Card>
              <h3>{t(locale, 'tutorials.tryBreaking.forceFormat.title')}</h3>
              <p>{t(locale, 'tutorials.tryBreaking.forceFormat.body')}</p>
            </Card>
            <Card>
              <h3>{t(locale, 'tutorials.tryBreaking.removePermission.title')}</h3>
              <p>{t(locale, 'tutorials.tryBreaking.removePermission.body')}</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <div className="stack">
            <p className="lead">{t(locale, 'tutorials.closing.lead')}</p>
            <ButtonRow>
              <CTA href="/templates">{t(locale, 'tutorials.closing.templates')}</CTA>
              <CTA href="/download" variant="secondary">
                {t(locale, 'tutorials.closing.download')}
              </CTA>
            </ButtonRow>
          </div>
        </div>
      </section>
    </div>
  );
}
