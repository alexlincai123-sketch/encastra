import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  ButtonRow,
  Callout,
  Card,
  CTA,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from '@/components/ui/Ui';
import { STATUS } from '@/config/site';
import type { Locale } from '@/lib/i18n';
import { getLocale, pageMetadata, t } from '@/lib/i18n';

/**
 * The ecosystem page.
 *
 * Two pages on this site used to end in a full stop: `/marketplace` and `/community` each said
 * "not built" and left it there, which is honest and tells a visitor nothing about what the
 * product is actually trying to become. This page is where the whole loop is laid out — what
 * exists, what is designed, and the order the rest has to happen in — so that the two empty
 * pages lead somewhere instead of stopping.
 *
 * Every state on it comes from `STATUS` in `config/site.ts`, so a step cannot quietly describe
 * itself as working. There are no listings, no counts, no names of people: there is no registry,
 * so there is nothing to count, and inventing any of it is the one thing this site must not do.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({
    locale,
    title: t(locale, 'ecosystem.hero.eyebrow'),
    description: t(locale, 'ecosystem.meta.description'),
    path: '/ecosystem',
  });
}

/** The five moments of the loop, each with the state it is actually in. */
const LOOP = [
  { id: 'build', state: STATUS.desktopApp },
  { id: 'publish', state: STATUS.publishPreparation },
  { id: 'discover', state: STATUS.registry },
  { id: 'install', state: STATUS.registry },
  { id: 'reuse', state: STATUS.projectFormat },
] as const;

/** What the check refuses before a publication can exist. Each one is a test in the runtime. */
const REFUSALS = ['secret', 'path', 'unknown', 'changed', 'licence'] as const;

/** What a registry would have to guarantee before anybody installs anything from it. */
const GUARANTEES = ['immutable', 'disclosure', 'namespace', 'noScripts', 'verified'] as const;

/** The order from `docs/PLATFORM-ARCHITECTURE.md` §6. It is a sequence, not a list. */
const ORDER = ['review', 'sandbox', 'signing', 'licence', 'registry', 'legal', 'money'] as const;

function Steps({ locale }: { locale: Locale }): ReactNode {
  return (
    <div className="grid--2">
      {LOOP.map((step) => (
        <Card key={step.id}>
          <StatusBadge state={step.state} label={t(locale, `status.${step.state}`)} />
          <h3>{t(locale, `ecosystem.loop.${step.id}.title`)}</h3>
          <p>{t(locale, `ecosystem.loop.${step.id}.body`)}</p>
        </Card>
      ))}
    </div>
  );
}

export default async function EcosystemPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div className="page">
      <PageHeader
        eyebrow={t(locale, 'ecosystem.hero.eyebrow')}
        title={t(locale, 'ecosystem.hero.title')}
        lead={t(locale, 'ecosystem.hero.lead')}
      />

      <div className="stack-lg">
        <section className="section">
          <SectionHeading
            eyebrow={t(locale, 'ecosystem.loop.eyebrow')}
            title={t(locale, 'ecosystem.loop.title')}
            lead={t(locale, 'ecosystem.loop.lead')}
          />
          <Steps locale={locale} />
        </section>

        <section className="section">
          <SectionHeading
            eyebrow={t(locale, 'ecosystem.today.eyebrow')}
            title={t(locale, 'ecosystem.today.title')}
            lead={t(locale, 'ecosystem.today.lead')}
          />
          <div className="prose">
            <p>{t(locale, 'ecosystem.today.body')}</p>
            <ul>
              {REFUSALS.map((refusal) => (
                <li key={refusal}>{t(locale, `ecosystem.today.refuses.${refusal}`)}</li>
              ))}
            </ul>
            <p>{t(locale, 'ecosystem.today.folder')}</p>
          </div>
          <Callout tone="note" title={t(locale, 'ecosystem.today.notAnAudit.title')}>
            <p>{t(locale, 'ecosystem.today.notAnAudit.body')}</p>
          </Callout>
        </section>

        <section className="section">
          <SectionHeading
            eyebrow={t(locale, 'ecosystem.registry.eyebrow')}
            title={t(locale, 'ecosystem.registry.title')}
            lead={t(locale, 'ecosystem.registry.lead')}
          />
          <div className="prose">
            <ul>
              {GUARANTEES.map((guarantee) => (
                <li key={guarantee}>{t(locale, `ecosystem.registry.guarantees.${guarantee}`)}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section">
          <SectionHeading
            eyebrow={t(locale, 'ecosystem.order.eyebrow')}
            title={t(locale, 'ecosystem.order.title')}
            lead={t(locale, 'ecosystem.order.lead')}
          />
          <div className="prose">
            <ol>
              {ORDER.map((step) => (
                <li key={step}>{t(locale, `ecosystem.order.steps.${step}`)}</li>
              ))}
            </ol>
            <p>{t(locale, 'ecosystem.order.why')}</p>
          </div>
        </section>

        <section className="section">
          <SectionHeading
            eyebrow={t(locale, 'ecosystem.money.eyebrow')}
            title={t(locale, 'ecosystem.money.title')}
            lead={t(locale, 'ecosystem.money.lead')}
          />
          <div className="prose">
            <p>{t(locale, 'ecosystem.money.body')}</p>
            <p>{t(locale, 'ecosystem.money.rule')}</p>
          </div>
        </section>

        <ButtonRow>
          <CTA href="/download">{t(locale, 'ecosystem.cta.download')}</CTA>
          <CTA href="/components" variant="secondary">
            {t(locale, 'ecosystem.cta.components')}
          </CTA>
        </ButtonRow>
      </div>
    </div>
  );
}
