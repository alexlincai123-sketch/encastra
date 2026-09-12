import Link from 'next/link';
import type { ReactNode } from 'react';
import type { BuildState } from '@/config/site';
import { STATE_LABEL } from '@/config/site';
import type { Locale } from '@/lib/i18n/locale';
import { t } from '@/lib/i18n/translate';

import styles from './Ui.module.css';

/* -------------------------------------------------------------------------------------------
 * Status
 *
 * The single most important primitive on this site. Anything the product cannot do yet is
 * labelled with one of these, in the same place, in the same shape, every time — so "not built"
 * reads as a deliberate part of the design rather than as an apology bolted on afterwards.
 * ---------------------------------------------------------------------------------------- */

export function StatusBadge({ state, label }: { state: BuildState; label?: string }): ReactNode {
  return (
    <span className={styles.status} data-state={state}>
      <span className={styles.statusDot} aria-hidden="true" />
      {label ?? STATE_LABEL[state]}
    </span>
  );
}

/**
 * The full treatment for a section of the product that does not exist: states it plainly, says
 * what would have to be true first, and links to where that is written down.
 */
export function NotBuilt({
  state,
  title,
  children,
  blockedBy,
  locale = 'en',
}: {
  state: BuildState;
  title: string;
  children: ReactNode;
  blockedBy?: readonly string[];
  locale?: Locale;
}): ReactNode {
  return (
    <section className={styles.notBuilt} data-state={state} aria-labelledby="not-built-title">
      <div className={styles.notBuiltHead}>
        <StatusBadge state={state} />
        <h2 id="not-built-title" className={styles.notBuiltTitle}>
          {title}
        </h2>
      </div>
      <div className={styles.notBuiltBody}>{children}</div>
      {blockedBy !== undefined && blockedBy.length > 0 ? (
        <div className={styles.notBuiltBlocked}>
          <h3 className={styles.notBuiltBlockedTitle}>{t(locale, 'ui.notBuiltBlockedByTitle')}</h3>
          <ol className={styles.ordered}>
            {blockedBy.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------------------------
 * Buttons and links
 * ---------------------------------------------------------------------------------------- */

export function CTA({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}): ReactNode {
  return (
    <Link className={styles.cta} data-variant={variant} href={href}>
      {children}
    </Link>
  );
}

export function ButtonRow({ children }: { children: ReactNode }): ReactNode {
  return <div className={styles.buttonRow}>{children}</div>;
}

/* -------------------------------------------------------------------------------------------
 * Containers
 * ---------------------------------------------------------------------------------------- */

export function Card({
  children,
  as: Tag = 'div',
}: {
  children: ReactNode;
  as?: 'div' | 'li' | 'article';
}): ReactNode {
  return <Tag className={styles.card}>{children}</Tag>;
}

/** A short, high-contrast aside. `tone` decides the colour, which always carries meaning. */
export function Callout({
  tone = 'note',
  title,
  children,
}: {
  tone?: 'note' | 'warn' | 'danger' | 'ok';
  title?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <aside className={styles.callout} data-tone={tone}>
      {title !== undefined ? <p className={styles.calloutTitle}>{title}</p> : null}
      <div className={styles.calloutBody}>{children}</div>
    </aside>
  );
}

/* -------------------------------------------------------------------------------------------
 * Page furniture
 * ---------------------------------------------------------------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <header className={styles.pageHeader}>
      {eyebrow !== undefined ? <span className="eyebrow">{eyebrow}</span> : null}
      <h1 className={styles.pageTitle}>{title}</h1>
      {lead !== undefined ? <p className="lead">{lead}</p> : null}
      {children}
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  id,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  id?: string;
}): ReactNode {
  return (
    <div className={styles.sectionHeading}>
      {eyebrow !== undefined ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2 className={styles.sectionTitle} {...(id !== undefined ? { id } : {})}>
        {title}
      </h2>
      {lead !== undefined ? <p className="lead">{lead}</p> : null}
    </div>
  );
}

/** A reference to a file in the repository. Never a link — the repository is not public. */
export function SourceRef({
  path,
  note,
  locale = 'en',
}: {
  path: string;
  note?: string;
  locale?: Locale;
}): ReactNode {
  return (
    <p className={styles.sourceRef}>
      <span className={styles.sourceRefLabel}>{t(locale, 'ui.source')}</span>
      <code>{path}</code>
      {note !== undefined ? <span className={styles.sourceRefNote}>{note}</span> : null}
    </p>
  );
}
