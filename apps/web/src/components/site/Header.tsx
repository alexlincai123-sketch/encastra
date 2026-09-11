'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { PRIMARY_NAV } from '@/config/nav';
import { VERSION } from '@/config/site';
import type { Locale } from '@/lib/i18n/locale';
import { t } from '@/lib/i18n/translate';
import styles from './Header.module.css';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

export function Header({ locale }: { locale: Locale }): ReactNode {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  // Route change closes the menu. Without this, navigating on a phone leaves the panel open
  // over the page it just moved to.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, not a value read here.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes it and returns focus to the control that opened it, which is what a keyboard
  // user expects and what makes the panel escapable at all.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={`page ${styles.bar}`}>
        <Link className={styles.brand} href="/">
          <Logo size={26} title="Encastra" />
          <span className={styles.brandName}>Encastra</span>
          <span className={styles.brandVersion}>{VERSION}</span>
        </Link>

        <button
          ref={toggleRef}
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="visually-hidden">
            {open ? t(locale, 'header.closeMenu') : t(locale, 'header.openMenu')}
          </span>
          <span className={styles.menuIcon} data-open={open} aria-hidden="true">
            <span />
            <span />
          </span>
        </button>

        <div ref={panelRef} id={menuId} className={styles.panel} data-open={open}>
          <nav aria-label={t(locale, 'header.navAriaLabel')}>
            <ul className={styles.nav}>
              {PRIMARY_NAV.map((item) => {
                const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      className={styles.navLink}
                      href={item.href}
                      {...(current ? { 'aria-current': 'page' } : {})}
                    >
                      {t(locale, `nav.primary.${item.id}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={styles.actions}>
            <ThemeToggle locale={locale} />
            <LanguageSwitcher locale={locale} path={pathname} />
            <Link className={styles.download} href="/download">
              {t(locale, 'header.download')}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
