import type { ReactNode } from 'react';

import styles from './PermissionMock.module.css';

/**
 * A static reconstruction of the permission block the desktop inspector shows for a step that
 * declares a capability — built from the component's real manifest, never a screenshot, and
 * never an interactive control. `docs/UX.md` §4 is the source for the shape: the reason is a
 * sentence for the person deciding, and the scope is named next to the button.
 */
export function PermissionMock({
  kind,
  reason,
  scope,
  location,
  granted = false,
}: {
  kind: string;
  reason: string;
  scope: string;
  /** The folder or host shown next to the button. Omit for a plain yes/no capability. */
  location?: string;
  granted?: boolean;
}): ReactNode {
  return (
    <div className={styles.panel}>
      <p className={styles.kind}>{kind}</p>
      <p className={styles.reason}>{reason}</p>
      {location !== undefined ? (
        <div>
          <span className={styles.scope}>{scope}</span>
          <code className={styles.location}>{location}</code>
        </div>
      ) : (
        <span className={styles.scope}>{scope}</span>
      )}
      <span className={styles.button} data-granted={granted ? 'true' : 'false'}>
        {granted ? 'Allowed' : location !== undefined ? 'Allow this folder' : 'Allow'}
      </span>
    </div>
  );
}
