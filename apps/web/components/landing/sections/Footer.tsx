import { Lockup } from '@/components/landing/brand/Lockup';

// FOUNDER-WALK-1 U3: the legacy device table (macOS/Windows/Linux/iPhone/iPad/
// Android tiles with phone-symbol icons) was removed here. The four-tab install
// block near the top of the landing (InstallAppBlock) is now the single platform
// story — this bottom-of-page table duplicated it iconically and listed platforms
// (Linux) the block intentionally doesn't. Nothing anchors to it.

export function Footer() {
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
            <div className="header">Product</div>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="/changelog">Changelog</a>
          </div>
          <div className="footer-col">
            <div className="header">Company</div>
            <a href="/about">About</a>
            <a href="/manifesto">Manifesto</a>
          </div>
          <div className="footer-col">
            <div className="header">Legal</div>
            <a href="/terms">Terms</a>
            <a href="/acceptable-use">Acceptable Use</a>
            <a href="/privacy">Privacy</a>
            <a href="/imprint">Imprint</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 · Goblin Inc. · Made in Switzerland</span>
          <span className="end">
            <span className="dot" aria-hidden="true" /> Build anywhere · Code anything
          </span>
        </div>
      </div>
    </footer>
  );
}
