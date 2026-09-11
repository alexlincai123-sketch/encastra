import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PageHeader, SourceRef } from '@/components/ui/Ui';
import { COMPONENT_COUNT, COMPONENTS, TRIGGER_COUNT } from '@/lib/components.data';
import type { ComponentRecord, PortRecord } from '@/lib/components.types';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Components',
  description: `Every component in this build — ${COMPONENT_COUNT} plus ${TRIGGER_COUNT} triggers — with its real ports, configuration and capabilities, generated from the manifests the runtime parses.`,
};

function categoriesOf(components: readonly ComponentRecord[]): readonly string[] {
  const seen = new Set<string>();
  for (const c of components) seen.add(c.category);
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

const CATEGORIES = categoriesOf(COMPONENTS);

function PortList({ title, ports }: { title: string; ports: readonly PortRecord[] }): ReactNode {
  if (ports.length === 0) {
    return (
      <div className={styles.detailBlock}>
        <h3>{title}</h3>
        <p className={styles.noCapability}>None.</p>
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

function ComponentCard({ component }: { component: ComponentRecord }): ReactNode {
  return (
    <details className={styles.card} id={component.id}>
      <summary className={styles.summary}>
        <span className={styles.summaryName}>{component.name}</span>
        <span className={styles.summaryDescription}>{component.description}</span>
        {component.isTrigger ? (
          <span className={styles.badge} data-tone="trigger">
            Trigger
          </span>
        ) : null}
        <span className={styles.badge} data-tone="version">
          v{component.version}
        </span>
      </summary>
      <div className={styles.detail}>
        <PortList title="Inputs" ports={component.inputs} />
        <PortList title="Outputs" ports={component.outputs} />

        {component.config.length > 0 ? (
          <div className={styles.detailBlock}>
            <h3>Configuration</h3>
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
          <h3>Capabilities</h3>
          {component.capabilities.length === 0 ? (
            <p className={styles.noCapability}>
              Declares nothing. It cannot reach the filesystem, the network, the clipboard, or a
              notification.
            </p>
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
        <SourceRef path={component.sourceFile} />
      </div>
    </details>
  );
}

export default function ComponentsPage(): ReactNode {
  return (
    <div>
      <div className="page">
        <PageHeader
          eyebrow={`${COMPONENT_COUNT} components + ${TRIGGER_COUNT} triggers`}
          title="Every component in this build"
          lead="Generated from crates/encastra-builtins/src/*.rs — the manifests the runtime actually parses, not a document that can drift from them. Nothing here can install a new component; there is no marketplace or registry yet, so this is the whole set."
        />
        <nav className={styles.toc} aria-label="Jump to category">
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
          return (
            <section key={category} id={`category-${category}`} className={styles.category}>
              <div className={styles.categoryHead}>
                <h2 className={styles.categoryTitle}>{category}</h2>
                <span className={styles.categoryCount}>
                  {items.length} component{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className={styles.list}>
                {items.map((component) => (
                  <ComponentCard key={component.id} component={component} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
