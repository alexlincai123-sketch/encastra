import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PageHeader, SourceRef } from '@/components/ui/Ui';
import { COMPONENT_COUNT, COMPONENTS, TRIGGER_COUNT } from '@/lib/components.data';
import type { ComponentRecord, PortRecord } from '@/lib/components.types';
import { getLocale, type Locale, t } from '@/lib/i18n';

import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(locale, 'nav.primary.components'),
    description: t(locale, 'components.meta.description', {
      count: String(COMPONENT_COUNT),
      triggers: String(TRIGGER_COUNT),
    }),
  };
}

function categoriesOf(components: readonly ComponentRecord[]): readonly string[] {
  const seen = new Set<string>();
  for (const c of components) seen.add(c.category);
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

const CATEGORIES = categoriesOf(COMPONENTS);

function PortList({
  title,
  ports,
  locale,
}: {
  title: string;
  ports: readonly PortRecord[];
  locale: Locale;
}): ReactNode {
  if (ports.length === 0) {
    return (
      <div className={styles.detailBlock}>
        <h3>{title}</h3>
        <p className={styles.noCapability}>{t(locale, 'components.none')}</p>
      </div>
    );
  }
  return (
    <div className={styles.detailBlock}>
      <h3>{title}</h3>
      {ports.map((port) => (
        <div className={styles.portRow} key={port.key}>
          <span className={styles.portName}>
            {port.label}
            {port.required === true ? <span className={styles.required}> *</span> : null}
          </span>
          <span className={styles.portType}>{port.type}</span>
        </div>
      ))}
    </div>
  );
}

function ComponentCard({
  component,
  locale,
}: {
  component: ComponentRecord;
  locale: Locale;
}): ReactNode {
  return (
    <details className={styles.card} id={component.id}>
      <summary className={styles.summary}>
        <span className={styles.summaryName}>{component.name}</span>
        <span className={styles.summaryDescription}>{component.description}</span>
        {component.isTrigger ? (
          <span className={styles.badge} data-tone="trigger">
            {t(locale, 'components.trigger')}
          </span>
        ) : null}
        <span className={styles.badge} data-tone="version">
          v{component.version}
        </span>
      </summary>
      <div className={styles.detail}>
        <PortList title={t(locale, 'components.inputs')} ports={component.inputs} locale={locale} />
        <PortList
          title={t(locale, 'components.outputs')}
          ports={component.outputs}
          locale={locale}
        />

        {component.config.length > 0 ? (
          <div className={styles.detailBlock}>
            <h3>{t(locale, 'components.configuration')}</h3>
            {component.config.map((field) => (
              <div className={styles.portRow} key={field.key}>
                <span className={styles.portName}>
                  {field.label}
                  {field.required ? <span className={styles.required}> *</span> : null}
                  {field.doc !== null ? (
                    <>
                      {' — '}
                      {field.doc}
                    </>
                  ) : null}
                </span>
                <span className={styles.portType}>{field.type}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className={styles.detailBlock}>
          <h3>{t(locale, 'components.capabilities')}</h3>
          {component.capabilities.length === 0 ? (
            <p className={styles.noCapability}>{t(locale, 'components.declaresNothing')}</p>
          ) : (
            component.capabilities.map((cap) => (
              <div className={styles.capability} key={`${cap.kind}-${cap.scope}`}>
                <span className={styles.capabilityKind}>
                  {cap.kind} · {cap.scope}
                </span>
                <p className={styles.capabilityReason}>{cap.reason}</p>
              </div>
            ))
          )}
        </div>

        <div className={styles.meta}>
          <span>{component.platforms.join(', ')}</span>
        </div>
        <SourceRef path={component.sourceFile} locale={locale} />
      </div>
    </details>
  );
}

export default async function ComponentsPage(): Promise<ReactNode> {
  const locale = await getLocale();

  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow={t(locale, 'components.hero.eyebrow', {
            count: String(COMPONENT_COUNT),
            triggers: String(TRIGGER_COUNT),
          })}
          title={t(locale, 'components.hero.title')}
          lead={t(locale, 'components.hero.lead')}
        />
        <nav className={styles.toc} aria-label={t(locale, 'components.jumpToCategory')}>
          {CATEGORIES.map((category) => (
            <a key={category} className={styles.tocLink} href={`#category-${category}`}>
              {category}
            </a>
          ))}
        </nav>
      </div>

      <div className="page">
        {CATEGORIES.map((category) => {
          const items = COMPONENTS.filter((c) => c.category === category);
          const countLabel =
            items.length === 1
              ? t(locale, 'components.component')
              : t(locale, 'components.componentsPlural');
          return (
            <section key={category} id={`category-${category}`} className={styles.category}>
              <div className={styles.categoryHead}>
                <h2 className={styles.categoryTitle}>{category}</h2>
                <span className={styles.categoryCount}>
                  {items.length} {countLabel}
                </span>
              </div>
              <div className={styles.list}>
                {items.map((component) => (
                  <ComponentCard key={component.id} component={component} locale={locale} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
