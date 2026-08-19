import { Lockup } from '@/components/landing/brand/Lockup';
import { LangToggle } from '@/components/i18n/LangToggle';
import { copy } from '@/components/landing/copy';
import type { Lang } from '@/lib/locale';

// FOUNDER-WALK-1 U3: the legacy device table (macOS/Windows/Linux/iPhone/iPad/
// Android tiles with phone-symbol icons) was removed here. The four-tab install
// block near the top of the landing (InstallAppBlock) is now the single platform
// story — this bottom-of-page table duplicated it iconically and listed platforms
// (Linux) the block intentionally doesn't. Nothing anchors to it.
//
// U6 — the link LABELS are translated; the destinations are not. /about,
// /manifesto, /changelog and the legal pages are English-only documents, and a
// German label pointing at an English page is honest (it says where you land)
// where a fabricated /de/terms would not be. Declared in the PR's limitations.

export function Footer({ lang }: { lang: Lang }) {
  const c = copy(lang).footer;
  return (
    <footer className="lp-footer">
      <div className="container" style={{ padding: 0 }}>
        <div className="footer-grid">
          <div className="footer-brand">
            <Lockup size="md" onDeep ariaLabel="Goblin" />
            <div className="footer-socials">
              <a href="https://github.com/vinchafer/Goblin" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
          </div>

          <div className="footer-col">
            <div className="header">{c.product}</div>
            <a href="#pricing">{c.pricing}</a>
            <a href="#faq">{c.faq}</a>
            <a href="/changelog">{c.changelog}</a>
          </div>
          <div className="footer-col">
            <div className="header">{c.company}</div>
            <a href="/about">{c.about}</a>
            <a href="/manifesto">{c.manifesto}</a>
          </div>
          <div className="footer-col">
            <div className="header">{c.legal}</div>
            <a href="/terms">{c.terms}</a>
            <a href="/acceptable-use">{c.acceptableUse}</a>
            <a href="/privacy">{c.privacy}</a>
            <a href="/imprint">{c.imprint}</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>{c.copyright}</span>
          {/* WAVE-KORREKTUR-1 · U2: mobile placement of the DE · EN switcher.
              ≤860px the nav has no room for it (see styles/landing.css); here it
              is its own item in a wrapping flex row, so at 320px it takes its own
              line rather than crowding the tagline, and it inherits the footer's
              bottom safe-area inset from U1. */}
          <LangToggle className="lang-toggle--footer" landingHrefs />
          <span className="end">
            <span className="dot" aria-hidden="true" /> {c.end}
          </span>
        </div>
      </div>
    </footer>
  );
}
