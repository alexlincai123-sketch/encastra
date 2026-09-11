import type { ReactNode } from 'react';

import styles from './StepSection.module.css';

/**
 * A numbered step: prose on one side, a real, built visual on the other. Used by `/how-it-works`
 * and `/tutorials`, which both walk through the product step by step and both promised never to
 * fake a screenshot of the app — this is the shared shape that promise takes.
 */
export function StepSection({
  number,
  title,
  reverse = false,
  children,
  visual,
  caption,
}: {
  number: number | string;
  title: string;
  reverse?: boolean;
  children: ReactNode;
  visual: ReactNode;
  caption?: string;
}): ReactNode {
  return (
    <section className="section section--tight">
      <div className="page">
        <div className={styles.step} data-reverse={reverse ? 'true' : 'false'}>
          <div className={styles.stepBody}>
            <span className={styles.stepNumber} aria-hidden="true">
              {number}
            </span>
            <h2 className={styles.stepTitle}>{title}</h2>
            {children}
          </div>
          <div className={styles.stepVisual}>{visual}</div>
        </div>
        {caption !== undefined ? <p className={styles.caption}>{caption}</p> : null}
      </div>
    </section>
  );
}
