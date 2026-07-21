'use client';

// FOUNDER-WALK-1 U3: the "install Goblin as an app" block, rebuilt as FOUR tabs.
//
// Founder verdict on v1: too iOS-only, and the phone-symbol icons looked bad. This
// is a PRESENTATION change — the detection + beforeinstallprompt logic from
// LAUNCH-ASSIST U1 (apps/web/lib/pwa-install.ts) is kept 1:1:
//
//   • Four always-selectable tabs: iOS · Android · Mac · Windows. The DETECTED
//     platform sets the default-active tab (detection still earns its keep), but
//     all four are clickable so anyone can read any platform's steps.
//   • Each tab shows a short numbered instruction (2–3 steps). Where a REAL install
//     is possible (Chromium fired beforeinstallprompt) the active/detected tab
//     offers the native "App installieren" button; otherwise an honest step — never
//     a dead button. iOS has NO button (Apple allows none) — the Share steps ARE
//     the affordance, with the real inline Share glyph.
//   • NO pictographic device icons — typography + the design system's text
//     hierarchy only. The □↑ Share glyph in the iOS step is kept (it names a real
//     iOS UI element, not decoration).
//   • Already installed (standalone PWA): the whole block hides.
//
// Styled with the landing's scoped tokens (.landing-root) so it themes dark+light
// automatically; DE default + EN via useLang/t; mobile-first (375px).

import { useEffect, useState } from 'react';
import { useLang, t } from '@/lib/use-lang';
import {
  detectInstallPlatform,
  isMacOsUA,
  defaultInstallTab,
  showNativeInstallButton,
  INSTALL_TABS,
  type InstallPlatform,
  type InstallTab,
} from '@/lib/pwa-install';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The real iOS Share glyph (square with an up arrow) — an inline SVG, not a phantom
// character that would render as tofu. Names the actual iOS control in the step.
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

const TAB_LABEL: Record<InstallTab, string> = {
  ios: 'iOS',
  android: 'Android',
  mac: 'Mac',
  windows: 'Windows',
};

export function InstallAppBlock() {
  const lang = useLang();
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [detectedTab, setDetectedTab] = useState<InstallTab>('windows');
  const [activeTab, setActiveTab] = useState<InstallTab>('windows');
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);
    const p = detectInstallPlatform();
    const ua = window.navigator?.userAgent || '';
    setPlatform(p);
    if (p === 'installed') {
      setInstalled(true);
      return;
    }
    const tab = defaultInstallTab(p, isMacOsUA(ua));
    setDetectedTab(tab);
    setActiveTab(tab); // detection sets the DEFAULT tab; the user can switch freely

    // Chromium (Android/Desktop) fires this — stash it so the real native dialog
    // can be triggered on click. iOS never fires it, so iOS stays instruction-only.
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    const onInstalled = () => setInstalled(true);
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
    setInstalled(true);
  };

  // Client-only detection: render nothing until mounted (no SSR platform flash), and
  // never when already installed.
  if (!mounted || installed) return null;

  // The real button appears ONLY on the user's actual environment (the detected
  // tab) and ONLY when the browser genuinely fired beforeinstallprompt — no phantom
  // button on a tab the visitor is merely previewing. showNativeInstallButton keeps
  // the iOS-never-gets-a-button invariant.
  const canPrompt =
    activeTab === detectedTab && showNativeInstallButton(platform, !!deferred);

  // ── Per-tab numbered steps (DE default, EN via t). 2–3 steps, no icons. ──
  const stepsByTab: Record<InstallTab, React.ReactNode[]> = {
    ios: [
      <>
        {t(lang, 'Tippe unten auf Teilen', 'Tap Share at the bottom')} <ShareGlyph />
      </>,
      t(lang, 'Wähle „Zum Home-Bildschirm“.', 'Choose “Add to Home Screen”.'),
    ],
    android: [
      t(lang, 'Öffne das Browser-Menü (⋮).', 'Open the browser menu (⋮).'),
      t(lang, 'Wähle „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.', 'Choose “Install app” or “Add to Home screen”.'),
    ],
    mac: [
      t(lang, 'Öffne Goblin in Safari.', 'Open Goblin in Safari.'),
      t(lang, 'Menü „Ablage“ → „Zum Dock hinzufügen“.', 'Menu “File” → “Add to Dock”.'),
    ],
    windows: [
      t(lang, 'Öffne Goblin in Chrome oder Edge.', 'Open Goblin in Chrome or Edge.'),
      t(lang, 'Klicke das Installations-Symbol in der Adressleiste — oder Menü → „App installieren“.', 'Click the install icon in the address bar — or Menu → “Install app”.'),
    ],
  };

  const steps = stepsByTab[activeTab];

  return (
    <section
      aria-label={t(lang, 'Goblin als App installieren', 'Install Goblin as an app')}
      style={{ padding: '28px var(--gutter, 32px)' }}
    >
      <div data-testid="install-app-block" style={card}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', lineHeight: 1.3 }}>
            {t(lang, 'Goblin als App installieren', 'Install Goblin as an app')}
          </div>
          <div style={{ fontSize: 'var(--small, 13.5px)', color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
            {t(
              lang,
              'Auf deinem Home-Bildschirm oder Dock. Ohne Store, ohne Umweg.',
              'On your home screen or dock. No store, no detour.',
            )}
          </div>
        </div>

        {/* Four always-clickable platform tabs. Detection sets the default active. */}
        <div role="tablist" aria-label={t(lang, 'Plattform wählen', 'Choose platform')} style={tabRow}>
          {INSTALL_TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                role="tab"
                type="button"
                aria-selected={isActive}
                data-testid={`install-tab-${tab}`}
                data-active={isActive ? 'true' : 'false'}
                onClick={() => setActiveTab(tab)}
                style={{ ...tabBtn, ...(isActive ? tabBtnActive : null) }}
              >
                {TAB_LABEL[tab]}
              </button>
            );
          })}
        </div>

        {/* The active tab's numbered instruction (2–3 steps). */}
        <ol data-testid={`install-steps-${activeTab}`} style={stepList}>
          {steps.map((node, i) => (
            <li key={i} style={stepItem}>
              <span aria-hidden style={stepNum}>{i + 1}</span>
              <span style={{ flex: 1 }}>{node}</span>
            </li>
          ))}
        </ol>

        {/* Real install button — only on the detected tab when the prompt fired. */}
        {canPrompt && (
          <button data-testid="install-block-button" onClick={install} style={btn}>
            {t(lang, 'App installieren', 'Install app')}
          </button>
        )}
      </div>

      {/* FOUNDER-WALK-3 U6 — store-NEUTRAL line. The FW2 line read Apple-specific
          ("App Store") and as if Goblin never wants any store; this covers Apple/
          Google/Microsoft implicitly, frames it as a benefit (no store, no
          download detour), never names a store, never sounds apologetic. --ink-3
          meta ink, no icons. DE default + EN. */}
      <p data-testid="install-app-note" style={note}>
        {t(
          lang,
          'Kein Store, kein Download-Umweg — Goblin kommt direkt aufs Gerät.',
          'No store, no detour — Goblin goes straight to your device.',
        )}
      </p>
    </section>
  );
}

// ── Styles (design-system tokens; scoped .landing-root themes them light+dark) ──
const card: React.CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  background: 'var(--surface-elev)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg, 14px)',
  padding: '22px 22px',
  boxShadow: 'var(--shadow-card)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};
const tabRow: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
};
const tabBtn: React.CSSProperties = {
  flex: '1 1 auto',
  minWidth: 72,
  minHeight: 44,
  padding: '10px 14px',
  borderRadius: 'var(--radius, 10px)',
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--ink-2)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const tabBtnActive: React.CSSProperties = {
  background: 'var(--accent-soft)',
  color: 'var(--ink-1)',
  borderColor: 'var(--accent)',
};
const stepList: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};
const stepItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  fontSize: 'var(--small, 13.5px)',
  color: 'var(--ink-2)',
  lineHeight: 1.5,
};
const stepNum: React.CSSProperties = {
  flexShrink: 0,
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};
const note: React.CSSProperties = {
  maxWidth: 560,
  margin: '12px auto 0',
  textAlign: 'center',
  fontSize: 'var(--small, 13.5px)',
  color: 'var(--ink-3)',
  lineHeight: 1.5,
};
const btn: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '11px 18px',
  borderRadius: 'var(--radius, 10px)',
  minHeight: 44,
  background: 'var(--green)',
  color: 'var(--bone)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
};
