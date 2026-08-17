// TESTER-FEEDBACK WAVE — the evidence mount.
//
// Two things need to be SEEN rather than asserted, and both are rendered here from the
// real production components and the real token files:
//
//   TABS      — the workspace header and the mobile bottom bar, to show that the
//               Preview tab is gone and the toolbars close up naturally (U2).
//   CONTRAST  — the dark-theme pairs the audit fixed, as real swatches painted by the
//               real tokens, so "5.79:1" is something a reviewer can also look at (U3).
//
// It runs inside the product's own demo choke point (`setDemoActive`), which is what
// makes mounting the real Header possible without credentials: every inline
// `createClient()` resolves to the demo stub (docs/DEMO_MODE_ARCHITECTURE.md §B.1).
//
// Honest scope: this renders REAL components with REAL tokens. It is not a walk of the
// running product — no server, no session, no data. What it can prove is markup and
// colour; what it cannot prove is behaviour.

import { createRoot } from 'react-dom/client';
import { setDemoActive } from '../../lib/demo/demo-flag';
import { DemoModeContext } from '../../lib/demo/demo-mode-context';
import { AppProvider } from '../../contexts/app-context';
import { Header } from '../../components/layout/Header';
import { BottomTabBar } from '../../components/app-shell/bottom-tab-bar';
import { truncatedNotice, continueLabel } from '../../lib/truncation-copy';

declare global {
  interface Window {
    __EVIDENCE_VIEW__: 'tabs' | 'contrast';
    __EVIDENCE_LANG__: 'de' | 'en';
  }
}

setDemoActive(true);

// ─── U2: the toolbars, with no preview ─────────────────────────────────────────

function TabsEvidence() {
  const lang = window.__EVIDENCE_LANG__ ?? 'de';
  return (
    <AppProvider>
      <DemoModeContext.Provider value={false}>
        <div style={{ background: 'var(--surface-page)', minHeight: '100vh' }}>
          <Header projectName="Portfolio" activeTab="chat" showTabs hasProject onTabChange={() => {}} />

          <div style={{ padding: '24px 16px', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
            <p style={{ fontSize: 13, color: 'var(--meta)', margin: '0 0 20px' }}>
              {lang === 'de'
                ? 'Kopfzeile oben: nur noch Chat und Code. Unten die mobile Leiste.'
                : 'Header above: Chat and Code only. The mobile bar is below.'}
            </p>

            {/* The truncation notice, in the real copy and the real tokens (U1). */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '10px 16px', borderRadius: 10,
                background: 'var(--warning-soft)', border: '1px solid var(--border)',
                fontSize: 13, color: 'var(--text)', maxWidth: 720,
              }}
            >
              <span>{truncatedNotice(lang)}</span>
              <button
                style={{
                  flexShrink: 0, background: 'none', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '4px 12px', fontSize: 13, color: 'var(--brand-fg)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {continueLabel(lang)}
              </button>
            </div>
          </div>

          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
            <BottomTabBar hasProject />
          </div>
        </div>
      </DemoModeContext.Provider>
    </AppProvider>
  );
}

// ─── U3: the contrast pairs, as swatches ───────────────────────────────────────

/** Each row is one audited pair. `before` is the value the token had pre-fix. */
const PAIRS: Array<{ ink: string; surface: string; label: string; beforeInk?: string; beforeSurface?: string }> = [
  { ink: '--meta', surface: '--surface-page', label: 'Zeitstempel · Captions · Sidebar-Meta', beforeInk: '#968768' },
  { ink: '--danger', surface: '--surface-page', label: 'Fehlermeldung (47 Fundstellen)', beforeInk: '#a04230' },
  { ink: '--success', surface: '--surface-page', label: 'Gesichert ✓ · BYOK-Badge', beforeInk: '#3D7A4F' },
  { ink: '--info', surface: '--surface-page', label: 'Hinweis-Text', beforeInk: '#355B7A' },
  { ink: '--warning', surface: '--surface-page', label: 'Warnung', beforeInk: '#C7901A' },
  { ink: '--ink-4', surface: '--surface-1', label: '.gobl-dash tertiäre Meta', beforeInk: '#7a8a80' },
  { ink: '--text', surface: '--warning-soft', label: 'Abbruch-Hinweis (Banner)', beforeSurface: '#F7E8C2' },
  { ink: '--text', surface: '--success-soft', label: 'Erfolgs-Tint', beforeSurface: '#E1EDDE' },
  { ink: '--text', surface: '--info-soft', label: 'Info-Tint', beforeSurface: '#DCE6F0' },
  { ink: '--danger', surface: '--danger-soft', label: 'Fehler-Block', beforeInk: '#a04230', beforeSurface: '#F0DACF' },
];

function Swatch({ ink, surface, label, before }: { ink: string; surface: string; label: string; before: boolean }) {
  return (
    <div
      style={{
        background: surface,
        color: ink,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        lineHeight: 1.5,
        minHeight: 64,
      }}
      data-kind={before ? 'before' : 'after'}
    >
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 12, opacity: 0.95 }}>
        {before ? 'vorher' : 'nachher'} — Beispieltext, wie ihn ein Nutzer liest
      </div>
    </div>
  );
}

function ContrastEvidence() {
  return (
    <div
      style={{
        background: 'var(--surface-page)',
        minHeight: '100vh',
        padding: 24,
        fontFamily: 'var(--font-sans)',
        color: 'var(--text)',
      }}
    >
      <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>Dark-Kontrast — vorher / nachher</h1>
      <p style={{ fontSize: 13, color: 'var(--meta)', margin: '0 0 20px' }}>
        Links die Token-Werte vor dieser Welle, rechts danach. Beide Spalten benutzen dieselben
        Flächen — nur die Tokens unterscheiden sich.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 900 }}>
        {PAIRS.map((p) => (
          <>
            <Swatch
              key={`${p.ink}-b`}
              label={p.label}
              ink={p.beforeInk ?? `var(${p.ink})`}
              surface={p.beforeSurface ?? `var(${p.surface})`}
              before
            />
            <Swatch
              key={`${p.ink}-a`}
              label={p.label}
              ink={`var(${p.ink})`}
              surface={`var(${p.surface})`}
              before={false}
            />
          </>
        ))}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(window.__EVIDENCE_VIEW__ === 'contrast' ? <ContrastEvidence /> : <TabsEvidence />);
