"use client";

// FOUNDER-WALK-1 U4 — admin shell, rebuilt mobile-first.
//
// Founder verdict: the old mobile admin was "extrem schlicht — worst case". The
// cause was a desktop layout shrunk onto a phone — a FIXED 220px sidebar inside a
// horizontal flex on a 100dvh row, so at 375px the nav ate ~59% of the width and
// left a ~155px content column (the "Desktop-IDE auf Handy geschrumpft" anti-pattern).
// He runs the console MOSTLY from an iPhone, and it must also work on desktop.
//
// This rebuild:
//   • Phone (<900px): a compact top bar (brand WORDMARK — the old 👺 goblin-face
//     logo is gone) + a horizontally scrollable tab strip; content gets the FULL
//     width below it. Safe-area insets (env()) so the bar clears the notch and the
//     tabs clear the home indicator. Every tab ≥44px tall.
//   • Desktop (≥900px): the left sidebar returns and pages breathe at width.
//   • One nav list drives both layouts, and it now includes EVERY /admin route
//     (Costs + Rankings were missing before, unreachable from the nav).
//
// Inline styles can't express media queries, so the shell uses a scoped styled-jsx
// block (classes + breakpoints) — same mechanism the onboarding chrome already uses.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Every /admin route, in a sensible operator order. Costs + Rankings were absent
// from the old nav though the pages exist — added so every tab is reachable.
const NAV = [
  { href: '/admin/health', label: 'Health' },
  { href: '/admin/insight', label: 'Insight' },
  { href: '/admin/costs', label: 'Costs' },
  { href: '/admin/promo', label: 'Promo' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/models', label: 'Models' },
  { href: '/admin/catalog', label: 'Catalog Ops' },
  { href: '/admin/telemetry', label: 'Telemetry' },
  { href: '/admin/rankings', label: 'Rankings' },
  { href: '/admin/builds', label: 'Builds' },
  { href: '/admin/status', label: 'Status' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="gobl-admin">
      {/* Sidebar (desktop) / top bar (mobile) share one brand + nav list. */}
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

      <main className="gobl-admin-main">{children}</main>

      <style jsx>{`
        .gobl-admin {
          display: flex;
          min-height: 100dvh;
          background: var(--paper);
        }
        .gobl-admin-nav {
          flex-shrink: 0;
          width: 220px;
          background: var(--brand-green);
          color: #fff;
          display: flex;
          flex-direction: column;
          padding: 20px 0;
          /* Desktop sidebar scrolls independently. */
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
          min-width: 0; /* let children shrink / scroll instead of overflowing the row */
          overflow-x: hidden;
          padding: 32px;
        }

        /* ── Phone: sidebar becomes a top bar + horizontal-scroll tabs ── */
        @media (max-width: 899px) {
          .gobl-admin {
            flex-direction: column;
          }
          .gobl-admin-nav {
            width: 100%;
            height: auto;
            position: sticky;
            top: 0;
            z-index: 20;
            padding: 0;
            padding-top: env(safe-area-inset-top);
            flex-direction: column;
          }
          .gobl-admin-brand {
            padding: 12px 16px;
            padding-left: max(16px, env(safe-area-inset-left));
            margin-bottom: 0;
          }
          .gobl-admin-links {
            flex-direction: row;
            gap: 4px;
            padding: 8px;
            padding-left: max(8px, env(safe-area-inset-left));
            padding-right: max(8px, env(safe-area-inset-right));
            overflow-x: auto;
            flex: 0 0 auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .gobl-admin-links::-webkit-scrollbar {
            display: none;
          }
          .gobl-admin-link {
            flex: 0 0 auto;
          }
          /* The "back to app" link would clutter the phone strip — hide it there;
             the brand wordmark links nowhere, so keep it in the scroll row is noisy.
             Instead show it as a compact trailing tab. */
          .gobl-admin-back {
            display: none;
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
