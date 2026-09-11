import type { ReactNode } from 'react';

import styles from './Scenes.module.css';

/**
 * A compact card for density scenes (4 and 6): the real name and category id a manifest gives a
 * component, none of the port detail `GraphNode` shows when there is room to teach it.
 */
export function MiniNode({ name, category }: { name: string; category: string }): ReactNode {
  return (
    <div className={styles.miniNode}>
      <span className={styles.miniNodeName}>{name}</span>
      <span className={styles.miniNodeCategory}>{category}</span>
    </div>
  );
}
