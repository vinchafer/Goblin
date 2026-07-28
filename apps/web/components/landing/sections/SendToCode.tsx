'use client';

import { useEffect, useRef } from 'react';
import { SectionHead } from '@/components/landing/ui/SectionHead';

// §03 fidelity: this mock mirrors the REAL product surfaces verbatim — the chat
// code block (dark chrome, "Kopieren" + gold "An Code senden" actions), the
// "Goblin Swift · INKLUSIVE" model chip, and the code tab's draft file cards
// (NEU / GEÄNDERT +n −m badges on the light editor paper). German UI text inside
// the mock is CORRECT: it depicts the product, whose UI is German. Sources
// mirrored: components/workspace/CodeBlock.tsx, components/workspace/ChatMessage.tsx,
// components/app-shell/model-switcher.tsx, components/code/FileCardList.tsx,
// styles/design-tokens.css (--brand-green #1A3A2A, --brand-gold #D4A737,
// --success #3D7A4F, --warning #C7901A, --ed-canvas #FBF7EC).
//
// Optional real-screenshot upgrade path: set either constant to a public asset
// path (e.g. '/brand/landing/stc-chat.png') and that panel renders the real
// capture instead of the CSS mock — a drop-in fidelity upgrade with the mock as
// the graceful fallback when the constant is null.
const CHAT_SHOT: string | null = null;
const CODE_SHOT: string | null = null;

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// I18N-LEAK FIX (AKT 1 · FEHLERSTRANG-1 · U4): the mock chat/code cards below
// mirror the real product surface, and their labels were hardcoded GERMAN on a
// fully English marketing page — nine of the founder-reported leaks came from
// here and from InstallAppBlock. The product itself is bilingual (useLang), so
// an English visitor really does see these controls in English; rendering the
// mock in English is accurate, not a dressed-up screenshot.
//
// Same convention as AgentFlow.tsx: the landing RENDERS `.en`, and the German
// the founder authored is preserved in `.de` so it is ready the day the landing
// is localized. Localizing the whole landing is separate, larger work.
const MOCK = {
  en: {
    tier: '· INCLUDED',
    userMsg: 'Add a dark-mode toggle to the navbar',
    aiLead: 'Here is your updated component:',
    copy: 'Copy',
    sendToCode: 'Send to Code',
    draftPill: 'Draft · 2 files',
    lines: (n: number) => `${n} lines`,
    changed: 'CHANGED',
    isNew: 'NEW',
  },
  de: {
    tier: '· INKLUSIVE',
    userMsg: 'Füg der Navbar einen Dark-Mode-Umschalter hinzu',
    aiLead: 'Hier ist deine aktualisierte Komponente:',
    copy: 'Kopieren',
    sendToCode: 'An Code senden',
    draftPill: 'Entwurf · 2 Dateien',
    lines: (n: number) => `${n} Zeilen`,
    changed: 'GEÄNDERT',
    isNew: 'NEU',
  },
} as const;

// Rendered language for the landing (see note above).
const M = MOCK.en;

export function SendToCode() {
  const illustRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = illustRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      el?.classList.add('is-active');
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) el.classList.add('is-active');
          else if (e.intersectionRatio === 0) el.classList.remove('is-active');
        });
      },
      { threshold: [0, 0.35] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="stc">
      <div className="container">
        <SectionHead
          num="03"
          total="05"
          label="Core feature"
          heading={
            <>
              One tap. <span className="serif-italic">Code lands in your editor.</span>
            </>
          }
          lead="No clipboard. No tab juggling. AI writes — you review the draft, you ship."
        />

        <div className="stc-illust" ref={illustRef}>
          {/* Chat — mirrors the real chat surface */}
          {CHAT_SHOT ? (
            <img className="stc-shot" src={CHAT_SHOT} alt="Goblin Chat — Send to Code" />
          ) : (
            <div className="stc-card-chat">
              <div className="stc-chat-head">
                <span className="mark-tag" aria-hidden="true">
                  <svg><use href="#goblin-mark" /></svg>
                </span>
                <span className="name">Goblin</span>
                <span className="model-chip">
                  Goblin Swift <span className="tier">{M.tier}</span>
                  <span className="caret" aria-hidden="true">▾</span>
                </span>
              </div>
              <div className="stc-body">
                <div className="msg-user">{M.userMsg}</div>
                <div className="msg-row">
                  <span className="msg-avatar" aria-hidden="true">
                    <svg><use href="#goblin-mark" /></svg>
                  </span>
                  <div className="msg-ai">
                    <p>{M.aiLead}</p>
                    {/* Dark code block — mirrors CodeBlock.tsx verbatim */}
                    <div className="stc-codeblock">
                      <div className="cb-head"><span className="cb-lang">tsx</span></div>
                      <div className="cb-body">
                        <pre>{`export function Navbar() {
  const [dark, setDark] = useState(false)
  return <nav>…</nav>
}`}</pre>
                      </div>
                      <div className="cb-actions">
                        <span className="cb-btn cb-copy"><CopyIcon /> {M.copy}</span>
                        <span className="cb-btn cb-send"><CodeIcon /> {M.sendToCode}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Arrow */}
          <div className="stc-arrow" aria-hidden="true">
            <div className="stc-arrow-line" />
            <div className="stc-arrow-mark">→</div>
          </div>

          {/* Code tab — mirrors FileCardList.tsx (light editor paper, draft badges) */}
          {CODE_SHOT ? (
            <img className="stc-shot" src={CODE_SHOT} alt="Goblin code tab — draft files" />
          ) : (
            <div className="stc-card-code">
              <div className="stc-code-head">
                <span className="tab">Code</span>
                <span className="draft-pill">{M.draftPill}</span>
              </div>
              <div className="stc-code-body">
                <div className="file-card">
                  <span className="fc-icon" aria-hidden="true"><FileIcon /></span>
                  <span className="fc-meta">
                    <span className="fc-name">Navbar.tsx</span>
                    <span className="fc-sub">TSX · {M.lines(12)}</span>
                  </span>
                  <span className="fc-badge badge-changed">
                    {M.changed} <span className="delta">+6 −2</span>
                  </span>
                  <span className="fc-chevron" aria-hidden="true"><Chevron /></span>
                </div>
                <div className="file-card">
                  <span className="fc-icon" aria-hidden="true"><FileIcon /></span>
                  <span className="fc-meta">
                    <span className="fc-name">theme.css</span>
                    <span className="fc-sub">CSS · {M.lines(8)}</span>
                  </span>
                  <span className="fc-badge badge-new">{M.isNew}</span>
                  <span className="fc-chevron" aria-hidden="true"><Chevron /></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
