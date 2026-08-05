'use client';

/**
 * FINAL-POLISH · U7.4 — the legal footer spoke two languages at once.
 *
 * It rendered a fixed row: "Terms · Nutzung · Privacy · Imprint" — three English labels
 * and one German one, to every visitor regardless of language. On the legal pages, of all
 * places, that reads as carelessness.
 *
 * The legal routes are PUBLIC (middleware.ts `isPublic`), so the labels resolve through
 * the public/pre-auth binding — the same rule `/help` uses. The destinations are
 * unchanged; only the labels are.
 */

import Link from 'next/link';
import { t } from '@/lib/use-lang';
import { useAuthLang } from '@/lib/use-auth-lang';

const LINK_STYLE: React.CSSProperties = {
  fontSize: 'var(--t-caption-fs)',
  color: 'rgba(255,255,255,0.72)',
  textDecoration: 'none',
  fontFamily: 'var(--font-sans)',
  transition: 'color 0.15s',
};

export function LegalFooterNav() {
  const lang = useAuthLang();

  const links: Array<{ href: string; label: string }> = [
    { href: '/terms', label: t(lang, 'Nutzungsbedingungen', 'Terms') },
    { href: '/acceptable-use', label: t(lang, 'Nutzungsrichtlinien', 'Acceptable Use') },
    { href: '/privacy', label: t(lang, 'Datenschutz', 'Privacy') },
    { href: '/imprint', label: t(lang, 'Impressum', 'Imprint') },
  ];

  return (
    <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {links.map(({ href, label }) => (
        <Link key={href} href={href} style={LINK_STYLE}>
          {label}
        </Link>
      ))}
      {/* AKT 2 · U-B4(a): the abuse route has to be reachable, not just written down in
          the AUP. Lightest honest option — a mailto, no phantom form. A report form and a
          per-hosted-app footer link are Phase-3 items. */}
      <a href="mailto:support@justgoblin.com" style={LINK_STYLE}>
        {t(lang, 'Missbrauch melden', 'Abuse')}
      </a>
    </nav>
  );
}
