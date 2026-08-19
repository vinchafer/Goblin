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
// automatically; full DE + EN copy via t(); mobile-first (375px).
//
// I18N-LEAK FIX (AKT 1 · FEHLERSTRANG-1 · U4): this block used to take its
// language from useLang() alone. useLang() reads the APP's stored preference
// (localStorage 'goblin:preferred-lang'), which is written during onboarding and
// defaults to 'de' when absent — and a first-time visitor on the marketing
// landing has never been through onboarding, so the key is absent and the block
// rendered GERMAN inside an otherwise fully English page. That was the founder's
// report, and the cause was never a missing key: both locales were always here.
// The cause was the SOURCE of the locale.
//
// The landing is a static English surface with no i18n mechanism of its own (see
// app/page.tsx — every other section is hardcoded English). So the surface now
// DECLARES its language via the `lang` prop, and only app surfaces — which do
// have a real stored preference — fall back to useLang().

import { useEffect, useState } from 'react';
import { useLang, t, type Lang } from '@/lib/use-lang';
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

interface InstallAppBlockProps {
  /** The language of the SURFACE this block sits on. The marketing landing is
   *  English and passes 'en' explicitly. Omitted inside the app, where the
   *  user's stored preference is the right source. */
  lang?: Lang;
}

export function InstallAppBlock({ lang: langProp }: InstallAppBlockProps = {}) {
  const storedLang = useLang();
  const lang = langProp ?? storedLang;
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

        {/* LANDING-MESSAGING v2 · U7 — the negation belongs TO this card.
            It was introduced in U6 as a third centred paragraph stacked under
            the card, which read as a footnote to a footnote: the eye grouped it
            with the store line rather than with the thing it corrects. It now
            sits inside the card, under a hairline, as the card's own closing
            statement — because the claim it answers ("Install Goblin as an
            app") is the card's HEADING, and a correction that floats free of
            the claim is not doing the job it was added for. */}
        <p data-testid="install-app-negation" style={negation}>
          {t(
            lang,
            'Es bleibt eine Webseite — kein Modell, keine Laufzeit, nichts landet auf deinem Gerät.',
            'It stays a website — no model, no runtime, nothing lands on your device.',
          )}
        </p>
      </div>

      {/* U8 — the store line that used to sit here is gone, not reworded.
          It had been through three passes (FOUNDER-WALK-3 store-neutrality, U7's
          contradiction fix) and each pass made it truer without asking whether
          it was needed. It wasn't: the card's own subline already says "On your
          home screen or dock. No store, no detour.", and U7 moved the claim the
          line was really carrying — that nothing is downloaded — INTO the card,
          under the hairline, where it answers the heading. Rewriting it a fourth
          time would have added a third way of saying one thing. */}
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
// U7: a footer row of the card, not a paragraph under it. The hairline and the
// shared left edge are what bind it to the heading it answers; left-aligned like
// the steps above it, so it reads as part of the card's own text rather than as
// centred small print. --ink-3 is already the meta ink, so it stays quieter than
// the steps without a second colour.
const negation: React.CSSProperties = {
  margin: 0,
  paddingTop: 14,
  borderTop: '1px solid var(--line)',
  fontSize: 12.5,
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
