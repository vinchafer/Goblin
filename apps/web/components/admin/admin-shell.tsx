"use client";

// FOUNDER-WALK-3 U4 — admin nav, v3: mobile menu-button, not a scroll strip.
//
// History: FW1 replaced a shrunk 220px desktop sidebar with a horizontal tab
// strip; FW2 gave the strip real spacing. The founder's verdict stood: 11 items
// in a horizontal scroll row on a phone is the WRONG pattern — labels still
// collided ("ModelsCatalogTelemetRankings…"), "Catalog Ops" wrapped, and the
// off-screen tabs were undiscoverable. v3 removes the strip entirely:
//   • Phone (<900px): a compact top bar showing the CURRENT section
//     ("Bereich: Insight ▾"). Tap → a clean full-width sheet listing EVERY
//     section as a large row (≥52px, one per line, current highlighted,
//     founder-priority order). No horizontal scrolling, no truncation, no
//     collision possible by construction; "Catalog Ops" lives on one line.
//   • Desktop (≥900px): the left sidebar is UNCHANGED.
//
// Inline styles can't express media queries, so the shell uses scoped styled-jsx.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Founder-priority order (his re-walk names these five first): Insight · Promo ·
// Costs · Users · Health, then the operational rest. Every /admin route is here.
const NAV = [
  { href: '/admin/insight', label: 'Insight' },
  { href: '/admin/promo', label: 'Promo' },
  { href: '/admin/costs', label: 'Costs' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/health', label: 'Health' },
  { href: '/admin/models', label: 'Models' },
  { href: '/admin/catalog', label: 'Catalog Ops' },
  { href: '/admin/telemetry', label: 'Telemetry' },
  { href: '/admin/rankings', label: 'Rankings' },
  { href: '/admin/builds', label: 'Builds' },
  { href: '/admin/status', label: 'Status' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const currentLabel = NAV.find((n) => isActive(n.href))?.label ?? 'Übersicht';

  // Close the sheet on navigation (route change) and on Escape.
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="gobl-admin">
      {/* ── Desktop sidebar (≥900px) — UNCHANGED ── */}
      <aside className="gobl-admin-nav">
        <div className="gobl-admin-brand">
          <span className="gobl-admin-lockup">
            <span className="gobl-admin-wordmark">GOBLIN</span>
            <span className="gobl-admin-kicker">Admin</span>
          </span>
          <Link href="/dashboard" className="gobl-admin-back">← App</Link>
        </div>
        <nav className="gobl-admin-links" aria-label="Admin sections">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`gobl-admin-link${isActive(item.href) ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* ── Phone top bar (<900px) — the menu-button pattern ── */}
      <div className="gobl-admin-mobilebar">
        <span className="gobl-admin-lockup">
          <span className="gobl-admin-wordmark">GOBLIN</span>
          <span className="gobl-admin-kicker">Admin</span>
        </span>
        <button
          type="button"
          className="gobl-admin-menubtn"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="gobl-admin-sheet"
        >
          <span className="gobl-admin-menubtn-eyebrow">Bereich</span>
          <span className="gobl-admin-menubtn-label">{currentLabel}</span>
          <span className="gobl-admin-menubtn-caret" aria-hidden>▾</span>
        </button>
      </div>

      {/* ── Phone section sheet — every section, one row each, no scroll strip ── */}
      {menuOpen && (
        <div className="gobl-admin-sheet-root" role="dialog" aria-modal="true" aria-label="Admin-Bereich wählen">
          <div className="gobl-admin-sheet-backdrop" onClick={() => setMenuOpen(false)} />
          <nav id="gobl-admin-sheet" className="gobl-admin-sheet" aria-label="Admin sections">
            <div className="gobl-admin-sheet-head">
              <span className="gobl-admin-sheet-title">Bereich wählen</span>
              <button type="button" className="gobl-admin-sheet-close" onClick={() => setMenuOpen(false)} aria-label="Schließen">✕</button>
            </div>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`gobl-admin-sheet-row${isActive(item.href) ? ' active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="gobl-admin-sheet-label">{item.label}</span>
                {isActive(item.href) && <span className="gobl-admin-sheet-check" aria-hidden>✓</span>}
              </Link>
            ))}
            <Link href="/dashboard" className="gobl-admin-sheet-row gobl-admin-sheet-appback" onClick={() => setMenuOpen(false)}>
              <span className="gobl-admin-sheet-label">← Zur App</span>
            </Link>
          </nav>
        </div>
      )}

      <main className="gobl-admin-main">{children}</main>

      <style jsx>{`
        .gobl-admin {
          display: flex;
          min-height: 100dvh;
          background: var(--paper);
        }
        /* ── Desktop sidebar (≥900px) — UNCHANGED from FW1/FW2 ── */
        .gobl-admin-nav {
          flex-shrink: 0;
          width: 220px;
          background: var(--brand-green);
          color: #fff;
          display: flex;
          flex-direction: column;
          padding: 20px 0;
          position: sticky;
          top: 0;
          height: 100dvh;
          overflow-y: auto;
        }
        .gobl-admin-brand {
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding: 0 20px 18px;
          margin-bottom: 6px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }
        .gobl-admin-lockup {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
        }
        .gobl-admin-wordmark {
          font-family: var(--font-sans);
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: #fff;
        }
        .gobl-admin-kicker {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--brand-gold);
        }
        .gobl-admin-links {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 10px 8px;
          flex: 1;
        }
        .gobl-admin-link {
          display: flex;
          align-items: center;
          min-height: 44px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: var(--t-small-fs, 13px);
          font-family: var(--font-sans);
          color: rgba(255, 255, 255, 0.66);
          text-decoration: none;
          font-weight: 400;
          white-space: nowrap;
          transition: background 0.1s, color 0.1s;
        }
        .gobl-admin-link:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }
        .gobl-admin-link.active {
          color: #fff;
          background: rgba(255, 255, 255, 0.14);
          font-weight: 600;
        }
        .gobl-admin-back {
          display: flex;
          align-items: center;
          min-height: 44px;
          padding: 8px 20px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }
        .gobl-admin-back:hover {
          color: #fff;
        }
        .gobl-admin-main {
          flex: 1;
          min-width: 0;
          overflow-x: hidden;
          padding: 32px;
        }

        /* ── Phone bar + sheet are desktop-hidden ── */
        .gobl-admin-mobilebar { display: none; }
        .gobl-admin-sheet-root { display: none; }

        /* ── Phone (<900px): sidebar hidden, menu-button bar + sheet ── */
        @media (max-width: 899px) {
          .gobl-admin {
            flex-direction: column;
          }
          .gobl-admin-nav {
            display: none;
          }
          .gobl-admin-mobilebar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            background: var(--brand-green);
            color: #fff;
            position: sticky;
            top: 0;
            z-index: 30;
            padding: 10px 16px;
            padding-top: calc(10px + env(safe-area-inset-top));
            padding-left: max(16px, env(safe-area-inset-left));
            padding-right: max(16px, env(safe-area-inset-right));
          }
          .gobl-admin-menubtn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 44px;
            max-width: 62%;
            padding: 7px 14px;
            background: rgba(255, 255, 255, 0.12);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.24);
            border-radius: 10px;
            font-family: var(--font-sans);
            cursor: pointer;
          }
          .gobl-admin-menubtn-eyebrow {
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--brand-gold);
            flex-shrink: 0;
          }
          .gobl-admin-menubtn-label {
            font-size: 14.5px;
            font-weight: 700;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .gobl-admin-menubtn-caret {
            font-size: 11px;
            opacity: 0.85;
            flex-shrink: 0;
          }

          .gobl-admin-sheet-root {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 100;
          }
          .gobl-admin-sheet-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.45);
          }
          .gobl-admin-sheet {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            display: flex;
            flex-direction: column;
            background: var(--brand-green);
            color: #fff;
            padding: 6px 8px 10px;
            padding-top: calc(8px + env(safe-area-inset-top));
            padding-left: max(8px, env(safe-area-inset-left));
            padding-right: max(8px, env(safe-area-inset-right));
            max-height: 100dvh;
            overflow-y: auto;
            box-shadow: 0 10px 34px rgba(0, 0, 0, 0.34);
          }
          .gobl-admin-sheet-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 12px 10px;
          }
          .gobl-admin-sheet-title {
            font-family: var(--font-sans);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--brand-gold);
          }
          .gobl-admin-sheet-close {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: #fff;
            font-size: 16px;
            cursor: pointer;
          }
          .gobl-admin-sheet-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            min-height: 52px;
            padding: 12px 16px;
            color: rgba(255, 255, 255, 0.82);
            text-decoration: none;
            font-family: var(--font-sans);
            border-radius: 10px;
          }
          .gobl-admin-sheet-label {
            font-size: 16px;
            font-weight: 500;
            white-space: nowrap; /* multi-word ("Catalog Ops") on ONE line, never truncated */
          }
          .gobl-admin-sheet-row.active {
            background: rgba(255, 255, 255, 0.16);
            color: #fff;
          }
          .gobl-admin-sheet-row.active .gobl-admin-sheet-label {
            font-weight: 700;
          }
          .gobl-admin-sheet-check {
            color: var(--brand-gold);
            font-size: 15px;
            flex-shrink: 0;
          }
          .gobl-admin-sheet-appback {
            margin-top: 6px;
            border-top: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 0;
            color: rgba(255, 255, 255, 0.6);
          }
          .gobl-admin-main {
            padding: 20px 16px;
            padding-left: max(16px, env(safe-area-inset-left));
            padding-right: max(16px, env(safe-area-inset-right));
            padding-bottom: max(24px, env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </div>
  );
}
