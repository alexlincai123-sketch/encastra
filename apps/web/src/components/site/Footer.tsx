import Link from 'next/link';
import type { ReactNode } from 'react';

import { FOOTER_NAV } from '@/config/nav';
import { SITE, VERSION } from '@/config/site';

import styles from './Footer.module.css';
import { Logo } from './Logo';

export function Footer(): ReactNode {
  return (
    <footer className={styles.footer}>
      <div className={`page ${styles.inner}`}>
        <div className={styles.brandBlock}>
          <Link className={styles.brand} href="/">
            <Logo size={24} title="Encastra" />
            <span>Encastra</span>
          </Link>
          <p className={styles.blurb}>{SITE.tagline}</p>
          <p className={styles.version}>
            Beta {VERSION} · Windows only · builds are not code-signed
          </p>
        </div>

        <nav className={styles.columns} aria-label="Footer">
          {FOOTER_NAV.map((group) => (
            <div key={group.title}>
              <h2 className={styles.columnTitle}>{group.title}</h2>
              <ul className={styles.columnList}>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link className={styles.columnLink} href={item.href}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className={`page ${styles.legalBar}`}>
        <p>
          Encastra is a working name. The trademark registers have not been searched, so nothing
          here claims the name is legally clear —{' '}
          <Link href="/about#name">why that is written down</Link>.
        </p>
        <p>
          No licence has been chosen for the source. The legal documents on this site are{' '}
          <Link href="/legal">unreviewed drafts</Link>.
        </p>
      </div>
    </footer>
  );
}
