'use client';

// LAUNCH-ASSIST U1: the warm "install Goblin as an app" block on the landing page.
//
// The founder's ask: a fresh visitor currently sees NO install hint on the landing
// page (the existing InstallAppHint lives only inside the authenticated /dashboard).
// This block fixes that — mounted prominently near the top of the landing — and does
// the MAXIMUM each platform honestly allows, REUSING the PR-#41 detection lib
// (apps/web/lib/pwa-install.ts), never duplicating UA logic:
//
//   • Android / Desktop Chromium (Chrome, Edge, Opera): capture `beforeinstallprompt`
//     and offer a REAL "App installieren" button that opens the native install dialog.
//     If the event never fires, an honest fallback line (menu route) — never a dead button.
//   • iOS / iPadOS Safari: programmatic install is IMPOSSIBLE (Apple), so NO button —
//     the two real Share steps with the actual share glyph ARE the affordance.
//   • macOS Safari: the "Ablage → Zum Dock hinzufügen" route.
//   • Firefox / anything with no install path: one honest line — no install, works in the tab.
//   • Already installed (standalone PWA): the whole block hides.
//
// Styled with the landing's own scoped tokens (.landing-root) so it themes in dark+light
// automatically; DE default + EN via useLang/t; laid out mobile-first (375px).

import { useEffect, useState } from 'react';
import { useLang, t } from '@/lib/use-lang';
import {
  detectInstallPlatform,
  browserFamilyFromUA,
  isMacOsUA,
  resolveLandingInstallMode,
  showNativeInstallButton,
  type InstallPlatform,
  type LandingInstallMode,
} from '@/lib/pwa-install';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The real iOS Share glyph (square with an up arrow) — an inline SVG, not a phantom
// character that would render as tofu. Used only in the iOS instruction.
function ShareGlyph() {
  return (
    <svg
      aria-hidden
      width="15"
      height="18"
      viewBox="0 0 15 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: '-3px', margin: '0 1px' }}
    >
      <path d="M7.5 1.5v9" />
      <path d="M4.5 4.5 7.5 1.5 10.5 4.5" />
      <path d="M3.5 7.5H2.5A1.5 1.5 0 0 0 1 9v6a1.5 1.5 0 0 0 1.5 1.5h10A1.5 1.5 0 0 0 14 15V9a1.5 1.5 0 0 0-1.5-1.5h-1" />
    </svg>
  );
}

export function InstallAppBlock() {
  const lang = useLang();
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [mode, setMode] = useState<LandingInstallMode>('unsupported');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    const p = detectInstallPlatform();
    const ua = window.navigator?.userAgent || '';
    setPlatform(p);
    setMode(resolveLandingInstallMode(p, browserFamilyFromUA(ua), isMacOsUA(ua)));

    // Chromium (Android/Desktop) fires this — stash it so we can trigger the real
    // native dialog on click. iOS never fires it, so the iOS branch stays instruction-only.
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    // If the user installs (any route), hide the block immediately.
    const onInstalled = () => setMode('installed');
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    setMode('installed');
  };

  // Client-only detection: render nothing until mounted (no SSR platform flash), and
  // never when already installed.
  if (!mounted || mode === 'installed') return null;

  const showButton = showNativeInstallButton(platform, !!deferred);

  const card: React.CSSProperties = {
    maxWidth: 720,
    margin: '0 auto',
    background: 'var(--surface-elev)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-lg, 14px)',
    padding: '22px 22px',
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 18,
  };
  const iconWrap: React.CSSProperties = {
    width: 44, height: 44, flexShrink: 0, borderRadius: 12,
    background: 'var(--accent-soft)', color: 'var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
  };
  const btn: React.CSSProperties = {
    padding: '11px 18px', borderRadius: 'var(--radius, 10px)', minHeight: 44,
    background: 'var(--green)', color: 'var(--bone)', border: 'none',
    cursor: 'pointer', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap',
  };
  const stepStyle: React.CSSProperties = {
    fontSize: 'var(--small, 13.5px)', color: 'var(--ink-2)', lineHeight: 1.5,
  };

  // The affordance that fills the right-hand side of the block.
  let affordance: React.ReactNode = null;
  if (mode === 'prompt' && showButton) {
    affordance = (
      <button data-testid="install-block-button" onClick={install} style={btn}>
        {t(lang, 'App installieren', 'Install app')}
      </button>
    );
  } else if (mode === 'prompt') {
    // Chromium but the prompt hasn't fired (yet / criteria unmet) — honest menu route,
    // never a dead button.
    affordance = (
      <div data-testid="install-block-fallback" style={stepStyle}>
        {t(
          lang,
          'Öffne das Browser-Menü und wähle „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.',
          'Open the browser menu and choose “Install app” or “Add to Home screen”.',
        )}
      </div>
    );
  } else if (mode === 'ios-share') {
    affordance = (
      <div data-testid="install-block-ios" style={stepStyle}>
        {t(lang, 'Tippe auf Teilen', 'Tap Share')} <ShareGlyph />{' '}
        {t(lang, '→ „Zum Home-Bildschirm“.', '→ “Add to Home Screen”.')}
      </div>
    );
  } else if (mode === 'macos-safari') {
    affordance = (
      <div data-testid="install-block-macos" style={stepStyle}>
        {t(lang, 'In Safari: „Ablage“ → „Zum Dock hinzufügen“.', 'In Safari: “File” → “Add to Dock”.')}
      </div>
    );
  } else {
    // unsupported (Firefox / no install path) — honest one-liner, no affordance.
    affordance = (
      <div data-testid="install-block-unsupported" style={stepStyle}>
        {t(
          lang,
          'Dein Browser unterstützt die Installation nicht — Goblin läuft voll im Tab.',
          'Your browser doesn’t support install — Goblin runs fully in the tab.',
        )}
      </div>
    );
  }

  return (
    <section aria-label={t(lang, 'Goblin als App installieren', 'Install Goblin as an app')} style={{ padding: '28px var(--gutter, 32px)' }}>
      <div data-testid="install-app-block" style={card}>
        <span aria-hidden style={iconWrap}>📲</span>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', lineHeight: 1.3 }}>
            {t(lang, 'Goblin läuft auf jedem Gerät', 'Goblin runs on every device')}
          </div>
          <div style={{ fontSize: 'var(--small, 13.5px)', color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
            {t(
              lang,
              'Als App auf deinem Home-Bildschirm. Kein App Store nötig.',
              'As an app on your home screen. No app store needed.',
            )}
          </div>
        </div>
        <div style={{ flex: '0 1 auto', display: 'flex', alignItems: 'center' }}>{affordance}</div>
      </div>
    </section>
  );
}
