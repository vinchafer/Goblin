'use client';

// Step 2 of 5 — Pick a provider + inline key panel + Test connection.
// Faithful port of 02_onboarding_choose_provider_new.html.
//
// Path is read from ?path=a|b — defaults to 'b' (guided).
// Path B pre-expands the Gemini hero card with its mini-guide open.
// One card open at a time within this page.
//
// "Test connection" hits POST /api/byok-keys/test (added in PORT 7) —
// validates the key without persisting. On success the user can Continue,
// which triggers POST /api/byok-keys/ (real create) then advances to /welcome/routing.
//
// "Another provider" (custom) is rendered as a dashed card. Its provider id
// 'custom' is NOT yet in ByokProviderSchema — backend will reject. Flagged
// as TODO in PORT_REPORT (RECON_REPORT open Q10).

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuthHeaders, API_URL } from '@/lib/api';
import {
  IArrowR, ICheck, IEye, IEyeOff, ILink, IShield,
} from '../_components/icons';
import { ProviderLogo } from '@/components/onboarding/ProviderLogo';
import { patchOnboardingState } from '../_components/onboarding-state';

// Turn bare domains / URLs inside guide copy into real, clickable links.
// (A-S4: the console.groq.com link — and every other — must be tappable.)
const URL_RE = /((?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)/gi;
function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const href = part.startsWith('http') ? part : `https://${part}`;
          return (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="guide-link">
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// Provider catalog — matches mockup. `id` aligns with ByokProviderSchema
// except `custom` (see TODO above).
type ProviderId = 'google' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'mistral' | 'custom';

interface Provider {
  id: ProviderId;
  name: string;
  sub: string;
  pill: 'free' | 'paid' | 'fast';
  pillLabel: string;
  hero?: boolean;
  brand: { glyph: string; bg: string };
  pros: string[];
  copy?: string;
  price: string;
  placeholder: string;
  guide: string[];
}

const PROVIDERS: Provider[] = [
  {
    id: 'groq', name: 'Groq', sub: 'LLAMA 3.3 70B · KOSTENLOS', hero: true,
    pill: 'fast', pillLabel: 'FREE · FAST',
    brand: { glyph: 'q', bg: '#F55036' },
    copy: 'Der einfachste Start: schnell, kostenlos, und sofort einsatzbereit. Läuft heute schon zuverlässig in Goblin — perfekt für deinen ersten Build.',
    pros: [
      'Groq · schnell, kostenlos, ~14400 req/day',
      '3–5× schneller als die Standard-API',
      "Läuft über Goblins verschlüsselten Proxy",
    ],
    price: 'KOSTENLOS · KEINE KARTE · ~ 60 SEK',
    placeholder: 'gsk_…',
    guide: [
      'Geh auf console.groq.com/keys',
      'Mit Google/GitHub anmelden',
      'Auf "Create API Key" klicken',
      'Schlüssel kopieren, unten einfügen',
    ],
  },
  {
    id: 'google', name: 'Google Gemini', sub: 'GEMINI 2.5 PRO · FREE TIER',
    pill: 'free', pillLabel: 'FREE',
    brand: { glyph: 'G', bg: 'linear-gradient(135deg, #4285F4 0%, #9B72CB 50%, #D96570 100%)' },
    pros: [
      '1,500 requests/day on the free tier — no card',
      'Strong coding, image + audio, 1M-token context',
      "Auto-routes through Goblin's encrypted proxy",
    ],
    price: 'FREE · NO CARD · ~ 60 SEC SETUP',
    placeholder: 'AIza…',
    guide: [
      'Go to aistudio.google.com',
      'Sign in with your Google account',
      'Click "Get API key" → "Create"',
      'Copy the key, paste it below',
    ],
  },
  {
    id: 'openai', name: 'OpenAI', sub: 'GPT-5 FAMILY',
    pill: 'paid', pillLabel: 'USAGE',
    brand: { glyph: '○', bg: '#0F0F0F' },
    pros: ['Frontier reasoning, deepest model bench', 'Pay-as-you-go, no subscription', 'Image, audio, structured outputs'],
    price: 'FROM ~$0.01 / CHAT',
    placeholder: 'sk-…',
    guide: [
      'Go to platform.openai.com/api-keys',
      'Sign in, click "Create new secret key"',
      'Copy the key (shown only once)',
      'Paste below',
    ],
  },
  {
    id: 'anthropic', name: 'Anthropic', sub: 'CLAUDE SONNET 4.6',
    pill: 'paid', pillLabel: 'USAGE',
    // Anthropic brand clay — see notes in mockup _new.html
    brand: { glyph: 'A', bg: '#D97757' },
    pros: ['Best-in-class code generation', '200k context, long-running edits', 'What most Goblin users end on'],
    price: 'FROM ~$0.02 / CHAT',
    placeholder: 'sk-ant-…',
    guide: [
      'Go to console.anthropic.com',
      'Sign in, open "API Keys"',
      'Click "Create key"',
      'Copy, paste below',
    ],
  },
  {
    id: 'deepseek', name: 'DeepSeek', sub: 'V3 · CODER V3',
    pill: 'paid', pillLabel: 'USAGE',
    brand: { glyph: 'D', bg: '#1E40AF' },
    pros: ['Cheapest frontier-class coder — ~$0.14/M tokens', 'Specialised Coder V3 for code generation'],
    price: 'FROM ~$0.003 / CHAT',
    placeholder: 'sk-…',
    guide: [
      'Go to platform.deepseek.com',
      'Sign in, open "API keys"',
      'Create + copy',
      'Paste below',
    ],
  },
  {
    id: 'mistral', name: 'Mistral', sub: 'LARGE 2 · CODESTRAL · EU-HOSTED',
    pill: 'paid', pillLabel: 'USAGE',
    brand: { glyph: 'M', bg: 'linear-gradient(180deg, #FF9D33 0%, #F54B16 100%)' },
    pros: ['EU-hosted, GDPR-ready — for teams that need data residency', 'Codestral — specialised code-completion model'],
    price: 'FROM ~$0.008 / CHAT',
    placeholder: '…',
    guide: [
      'Go to console.mistral.ai',
      'Sign in, open "API Keys"',
      'Create + copy',
      'Paste below',
    ],
  },
];

type CardState = {
  open: boolean;
  shown: boolean;        // password reveal
  guideOpen: boolean;
  testing: boolean;
  connected: boolean;
  error?: string;
  keyValue: string;
  baseURL?: string;      // custom only
};

const emptyCard: CardState = {
  open: false, shown: false, guideOpen: false,
  testing: false, connected: false, keyValue: '',
};

function Step2Inner() {
  const search = useSearchParams();
  const router = useRouter();
  const path = (search?.get('path') === 'a' ? 'a' : 'b') as 'a' | 'b';

  const [cards, setCards] = useState<Record<string, CardState>>(() => {
    const init: Record<string, CardState> = {};
    PROVIDERS.forEach((p) => {
      const hero = p.hero === true;
      init[p.id] = {
        open: path === 'b' && hero,
        shown: false,
        guideOpen: path === 'b' && hero,
        testing: false,
        connected: false,
        keyValue: '',
      };
    });
    init['custom'] = { ...emptyCard };
    return init;
  });

  // Track that the user entered step 2
  useEffect(() => {
    patchOnboardingState({ current_step: 2 });
  }, []);

  function openCard(id: string) {
    setCards((prev) => {
      const next: Record<string, CardState> = {};
      Object.keys(prev).forEach((k) => {
        const existing = prev[k] ?? emptyCard;
        next[k] = { ...existing, open: false };
      });
      const target = prev[id] ?? emptyCard;
      next[id] = { ...target, open: !target.open };
      return next;
    });
  }

  function patchCard(id: string, p: Partial<CardState>) {
    setCards((prev) => {
      const existing = prev[id] ?? emptyCard;
      return { ...prev, [id]: { ...existing, ...p } };
    });
  }

  async function testConnection(id: string) {
    const card = cards[id] ?? emptyCard;
    if (!card.keyValue) {
      patchCard(id, { error: 'Paste a key first' });
      return;
    }
    if (id === 'custom' && !card.baseURL) {
      patchCard(id, { error: 'Base URL required for a custom provider' });
      return;
    }
    patchCard(id, { testing: true, error: undefined });
    try {
      const headers = await getAuthHeaders();
      const payload: { provider: string; key: string; baseURL?: string } = {
        provider: id,
        key: card.keyValue,
      };
      if (id === 'custom' && card.baseURL) payload.baseURL = card.baseURL;
      const res = await fetch(`${API_URL}/api/byok-keys/test`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({ valid: false, error: 'Network error' }));
      if (body?.valid) {
        patchCard(id, { testing: false, connected: true, error: undefined });
      } else {
        patchCard(id, { testing: false, error: body?.error || 'Invalid key' });
      }
    } catch (e) {
      patchCard(id, { testing: false, error: e instanceof Error ? e.message : 'Test failed' });
    }
  }

  async function continueAfterTest(id: string) {
    // Persist the validated key, then advance to step 3.
    // POST /api/byok-keys/ re-runs testKey server-side — safe + idempotent.
    try {
      const headers = await getAuthHeaders();
      const card = cards[id] ?? emptyCard;
      const body: { provider: string; key: string; baseURL?: string } = {
        provider: id,
        key: card.keyValue,
      };
      if (id === 'custom' && card.baseURL) body.baseURL = card.baseURL;
      await fetch(`${API_URL}/api/byok-keys/`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      });
    } catch {
      // Non-blocking — user can retry from settings if creation fails.
    }
    await patchOnboardingState({ ai_provider_choice: 'byok', current_step: 3 });
    router.push('/welcome/routing');
  }

  const heroOnly = PROVIDERS.filter((p) => p.hero);
  const rest = PROVIDERS.filter((p) => !p.hero);

  return (
    <div className="step2" data-path={path}>
      <header className="head">
        <div className="eyebrow"><span className="tick" />Step 02 of 06 — Pick a provider</div>
        <h1>Pick your AI <span className="gobl-serif">provider.</span></h1>
        <p className="lead">
          Six providers, three patterns: <b>free tier</b>, <b>pay-as-you-go</b>,
          and <b>fast inference</b>. Start with Groq — Goblin handles the rest.
        </p>
      </header>

      <div className="fallback-call">
        <span className="ic"><ILink size={18} /></span>
        <div className="body">
          <div className="t">Pick one. Get all six.</div>
          <div className="s">When your provider hits a rate limit or errors, Goblin swaps to the next one in your chain — silently, instantly, no dropped messages.</div>
        </div>
        <span className="tag">AUTO-FALLBACK · TUNED IN STEP 03</span>
      </div>

      <div className="hero-row">
        {heroOnly.map((p) => (
          <ProviderCard
            key={p.id}
            p={p}
            state={cards[p.id] ?? emptyCard}
            path={path}
            onOpen={() => openCard(p.id)}
            onChange={(patch) => patchCard(p.id, patch)}
            onTest={() => testConnection(p.id)}
            onContinue={() => continueAfterTest(p.id)}
          />
        ))}
      </div>

      <div className="rest-grid">
        {rest.map((p) => (
          <ProviderCard
            key={p.id}
            p={p}
            state={cards[p.id] ?? emptyCard}
            path={path}
            onOpen={() => openCard(p.id)}
            onChange={(patch) => patchCard(p.id, patch)}
            onTest={() => testConnection(p.id)}
            onContinue={() => continueAfterTest(p.id)}
          />
        ))}
      </div>

      <div className="pro-note">
        <span className="ic"><IShield size={16} /></span>
        <p>
          <b>Claude Pro oder ChatGPT Plus?</b> Dein Abo gilt nur für die
          Anbieter-Webseite — hier brauchst du den API-Schlüssel der Firma, den
          holst du dir separat. Oft günstiger als ein Pro-Abo, vor allem wenn du
          Goblin nur ab und zu nutzt.
        </p>
      </div>

      <CustomProviderCard
        state={cards['custom'] ?? emptyCard}
        onOpen={() => openCard('custom')}
        onChange={(patch) => patchCard('custom', patch)}
        onTest={() => testConnection('custom')}
        onContinue={() => continueAfterTest('custom')}
      />

      <div className="footstrip">
        <span className="skip"><IShield size={11} />KEYS ENCRYPTED · CHANGE OR REVOKE ANY TIME</span>
        <span className="gobl-mono">/welcome/provider · STEP 02 OF 06</span>
        <Link href="/welcome/routing">SKIP — DECIDE LATER →</Link>
      </div>

      <style jsx>{`
        .step2 { padding: 28px 80px 40px; max-width: 1280px; margin: 0 auto; }
        @media (max-width: 880px) { .step2 { padding: 22px 18px 32px; } }
        .head { margin-bottom: 24px; max-width: 720px; }
        .eyebrow {
          font-family: var(--font-mono), monospace; font-size: 10.5px;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
          display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
        }
        .tick {
          width: 5px; height: 5px; background: var(--accent);
          transform: rotate(45deg); display: inline-block;
        }
        h1 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: clamp(34px, 4.4vw, 60px);
          letter-spacing: -0.036em; line-height: 1.04;
          color: var(--ink-1); margin-bottom: 12px;
        }
        .lead {
          font-size: 16.5px; color: var(--ink-2);
          line-height: 1.5; max-width: 56ch;
        }
        .lead b { color: var(--ink-1); }
        @media (max-width: 880px) { h1 { font-size: 30px; } }

        .fallback-call {
          display: flex; align-items: center; gap: 14px;
          background: var(--surface-deep); color: var(--bone);
          border-radius: var(--radius-lg);
          padding: 14px 18px; margin-bottom: 24px;
          border: 1px solid var(--green);
        }
        @media (max-width: 600px) {
          .fallback-call { padding: 12px 14px; gap: 10px; flex-wrap: wrap; }
        }
        .fallback-call .ic {
          width: 36px; height: 36px; border-radius: 8px;
          background: rgba(212,167,55,.18); color: var(--gold);
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .fallback-call .body { flex: 1; }
        .fallback-call .t {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 14px; color: var(--bone);
        }
        .fallback-call .s {
          font-size: 12.5px; color: rgba(244,236,216,.88);
          margin-top: 2px; line-height: 1.45;
        }
        .fallback-call .tag {
          font-family: var(--font-mono), monospace;
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          padding: 4px 8px; border-radius: 6px;
          background: rgba(244,236,216,.10);
          border: 1px solid rgba(244,236,216,.22);
          color: rgba(244,236,216,.88);
        }

        .hero-row {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 14px; margin-bottom: 14px;
        }
        @media (max-width: 880px) {
          .hero-row { grid-template-columns: 1fr; }
        }
        .rest-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px; margin-bottom: 14px;
        }
        @media (max-width: 880px) {
          .rest-grid { grid-template-columns: 1fr; }
        }

        .footstrip {
          margin-top: 24px;
          border-top: 1px solid var(--line);
          padding: 14px 0;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
          font-family: var(--font-mono), monospace;
          font-size: 11px; letter-spacing: 0.10em;
          text-transform: uppercase; color: var(--ink-3);
        }
        .footstrip .skip {
          display: inline-flex; align-items: center; gap: 6px;
        }
        .footstrip .skip :global(svg) { color: var(--accent); }
        .footstrip a { color: var(--ink-2); }
        .footstrip a:hover { color: var(--ink-1); }
        @media (max-width: 600px) {
          .footstrip { flex-wrap: wrap; gap: 8px; font-size: 10px; }
        }

        .pro-note {
          margin-top: 14px;
          display: flex; align-items: flex-start; gap: 12px;
          background: var(--surface-2);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 14px 18px;
        }
        .pro-note .ic {
          color: var(--accent); margin-top: 2px; flex-shrink: 0;
          display: inline-flex;
        }
        .pro-note p {
          font-size: 13px; color: var(--ink-2); line-height: 1.55; margin: 0;
        }
        .pro-note b { color: var(--ink-1); font-weight: 600; }
      `}</style>
    </div>
  );
}

// ── Provider card ──────────────────────────────────────────────────────
function ProviderCard({
  p, state, path, onOpen, onChange, onTest, onContinue,
}: {
  p: Provider; state: CardState; path: 'a' | 'b';
  onOpen: () => void;
  onChange: (patch: Partial<CardState>) => void;
  onTest: () => void;
  onContinue: () => void;
}) {
  const dim = path === 'b' && !p.hero && !state.open;
  return (
    <article
      className={`gobl-prov-card prov ${p.hero ? 'hero' : ''} ${state.open ? 'open' : ''} ${dim ? 'dim' : ''}`}
    >
      {p.hero && <span className="ribbon">RECOMMENDED · FREE TIER</span>}
      <div className="prov-head">
        <span className={`brand ${p.hero ? 'brand-lg' : ''}`} style={{ background: p.brand.bg }}>
          <ProviderLogo id={p.id} size={p.hero ? 40 : 22} tone="light" fallbackLabel={p.name[0]} />
        </span>
        <div className="prov-name">
          <h3>{p.name}</h3>
          <span className="sub">{p.sub}</span>
        </div>
        <span className={`pill pill-${p.pill}`}>{p.pillLabel}</span>
      </div>
      {p.copy && <p className="copy">{p.copy}</p>}
      <div className="pros">
        {p.pros.map((pro) => (
          <div key={pro} className="pro">
            <span className="ic"><ICheck size={14} /></span>{pro}
          </div>
        ))}
      </div>
      <div className="prov-foot">
        <span className="price">{p.price}</span>
        <button
          type="button"
          className={`btn ${p.hero ? 'btn-primary btn-lg' : 'btn-secondary btn-sm'}`}
          onClick={onOpen}
        >
          {p.hero ? 'Start setup' : 'Connect'} <IArrowR size={p.hero ? 13 : 11} />
        </button>
      </div>

      {state.open && (
        <KeyPanel
          providerLabel={p.name}
          placeholder={p.placeholder}
          guide={p.guide}
          state={state}
          onChange={onChange}
          onTest={onTest}
          onContinue={onContinue}
        />
      )}

      <style jsx>{`
        .prov {
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 22px;
          display: flex; flex-direction: column; gap: 14px;
          position: relative;
          transition: border-color .15s, box-shadow .15s, transform .15s, opacity .15s;
        }
        .prov:hover {
          border-color: var(--line-strong);
          box-shadow: var(--shadow-card);
          transform: translateY(-1px);
        }
        .prov.dim { opacity: 0.82; }
        .prov.dim:hover { opacity: 1; transform: none; }
        .prov.hero {
          grid-row: span 2;
          background: linear-gradient(180deg, var(--surface-elev) 0%, var(--bone-warm) 100%);
          border-color: var(--accent-rule);
          box-shadow: 0 0 0 1px var(--accent-rule), var(--shadow-card);
          padding: 28px;
        }
        .prov.open {
          box-shadow: 0 0 0 1px var(--ink-1), var(--shadow-pop);
          border-color: var(--ink-1);
        }
        .prov.hero.open {
          box-shadow: 0 0 0 1px var(--accent-bright), var(--shadow-pop);
        }
        .ribbon {
          position: absolute; top: -10px; left: 24px;
          font-family: var(--font-mono), monospace;
          font-size: 10px; font-weight: 600; letter-spacing: 0.18em;
          padding: 4px 10px; border-radius: var(--radius-xs);
          background: var(--accent-bright); color: var(--green);
        }
        .prov-head { display: flex; align-items: center; gap: 14px; }
        .brand {
          width: 44px; height: 44px; border-radius: 10px;
          display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 700; font-size: 18px;
          color: #fff; flex-shrink: 0; letter-spacing: -0.02em;
        }
        .brand-lg { width: 80px; height: 80px; font-size: 32px; border-radius: 16px; }
        .prov-name { flex: 1; }
        .prov-name h3 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 18px;
          letter-spacing: -0.018em; line-height: 1.2;
        }
        .prov.hero .prov-name h3 { font-size: 26px; letter-spacing: -0.024em; }
        .prov-name .sub {
          font-family: var(--font-mono), monospace;
          font-size: 10.5px; letter-spacing: 0.10em;
          text-transform: uppercase; color: var(--ink-3);
          margin-top: 3px; display: block;
        }
        .pill {
          flex-shrink: 0; padding: 4px 8px; border-radius: var(--radius-xs);
          font-family: var(--font-mono), monospace;
          font-size: 9.5px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
        }
        .pill-free { background: var(--ok-soft); color: var(--ok); border: 1px solid rgba(47,106,71,.32); }
        .pill-paid { background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--line-strong); }
        .pill-fast { background: var(--accent-soft); color: var(--gold-deep); border: 1px solid var(--accent-rule); }
        .copy {
          font-size: 15px; color: var(--ink-1);
          line-height: 1.55; max-width: 44ch;
        }
        .pros { display: flex; flex-direction: column; gap: 7px; }
        .pro {
          display: flex; align-items: flex-start; gap: 8px;
          font-size: 13px; color: var(--ink-1); line-height: 1.45;
        }
        .pro .ic { color: var(--ok); margin-top: 2px; flex-shrink: 0; display: inline-flex; }
        .prov-foot {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: auto;
          padding-top: 14px; border-top: 1px solid var(--line);
        }
        .price {
          font-family: var(--font-mono), monospace;
          font-size: 11px; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--ink-3);
        }
        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 13.5px;
          padding: 10px 16px; border-radius: var(--radius);
          border: 1px solid transparent; cursor: pointer;
          transition: background-color .15s, border-color .15s, color .15s;
          line-height: 1; white-space: nowrap;
        }
        .btn-primary { background: var(--green); color: var(--bone); }
        .btn-primary:hover { background: #081710; }
        .btn-secondary {
          background: transparent; color: var(--ink-1);
          border-color: var(--line-strong);
        }
        .btn-secondary:hover { border-color: var(--ink-1); }
        .btn-lg { font-size: 14.5px; padding: 14px 20px; }
        .btn-sm { font-size: 12.5px; padding: 8px 12px; border-radius: 6px; }
      `}</style>
    </article>
  );
}

// ── Custom-provider card (dashed) ──────────────────────────────────────
function CustomProviderCard({
  state, onOpen, onChange, onTest, onContinue,
}: {
  state: CardState;
  onOpen: () => void;
  onChange: (patch: Partial<CardState>) => void;
  onTest: () => void;
  onContinue: () => void;
}) {
  return (
    <div className={`prov-more gobl-prov-card ${state.open ? 'open' : ''}`}>
      <div className="more-head">
        <span className="power-badge">POWER USER · ALL FRONTIER MODELS</span>
        <span className="more-logos" aria-hidden>
          <span className="lchip"><ProviderLogo id="fireworks" size={16} tone="ink" /></span>
          <span className="lchip"><ProviderLogo id="together" size={16} tone="ink" /></span>
          <span className="lchip"><ProviderLogo id="openrouter" size={16} tone="ink" /></span>
        </span>
        <div className="more-name">
          <h3>One key, every model</h3>
          <span className="sub">
            Fireworks, Together, OpenRouter, Perplexity — or any OpenAI-compatible
            endpoint. Pay-as-you-go. Get Llama, Mixtral, Qwen, DeepSeek and more
            with a single key.
          </span>
        </div>
        <div className="more-foot">
          <span className="more-price">FROM ~$0.10 / M TOKENS</span>
          <button type="button" className="btn-secondary" onClick={onOpen}>
            Add endpoint <IArrowR size={12} />
          </button>
        </div>
      </div>

      {state.open && (
        <KeyPanel
          providerLabel="Custom endpoint"
          placeholder="key…"
          guide={[
            "The provider's base URL — e.g. https://api.together.xyz/v1",
            "An API key from that provider's dashboard",
            'Paste both below — Goblin routes through its OpenAI-compatible adapter',
          ]}
          state={state}
          onChange={onChange}
          onTest={onTest}
          onContinue={onContinue}
          baseUrlField
        />
      )}

      <style jsx>{`
        .prov-more {
          margin-top: 14px;
          background:
            radial-gradient(120% 140% at 100% 0%, var(--accent-soft) 0%, transparent 55%),
            var(--surface-elev);
          border: 1px solid var(--accent-rule);
          box-shadow: 0 0 0 1px var(--accent-rule), var(--shadow-card);
          border-radius: var(--radius-lg);
          padding: 22px 24px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .more-head {
          display: grid;
          grid-template-columns: 1fr auto;
          grid-template-areas:
            'badge logos'
            'name name'
            'foot foot';
          gap: 12px; align-items: start;
        }
        @media (max-width: 600px) {
          .more-head {
            grid-template-columns: 1fr;
            grid-template-areas: 'badge' 'logos' 'name' 'foot';
          }
        }
        .power-badge {
          grid-area: badge; align-self: center;
          display: inline-flex; align-items: center; width: fit-content;
          font-family: var(--font-mono), monospace;
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--gold-deep);
          background: var(--accent-soft);
          border: 1px solid var(--accent-rule);
          padding: 4px 9px; border-radius: var(--radius-xs);
        }
        .more-logos { grid-area: logos; display: inline-flex; gap: 6px; }
        .more-logos .lchip {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--surface-2);
          border: 1px solid var(--line-strong); color: var(--ink-1);
        }
        .more-name { grid-area: name; }
        .more-name h3 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 19px;
          letter-spacing: -0.018em; color: var(--ink-1);
        }
        .more-name .sub {
          font-size: 13px; color: var(--ink-2);
          line-height: 1.5; margin-top: 4px; display: block; max-width: 64ch;
        }
        .more-foot {
          grid-area: foot;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: 4px;
          padding-top: 14px; border-top: 1px solid var(--line);
        }
        @media (max-width: 600px) { .more-foot { flex-wrap: wrap; } }
        .more-price {
          font-family: var(--font-mono), monospace;
          font-size: 11px; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--ink-3);
        }
        .btn-secondary {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--green); color: var(--bone);
          border: 1px solid var(--green);
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 12.5px;
          padding: 9px 14px; border-radius: 6px; cursor: pointer;
        }
        .btn-secondary:hover { background: #081710; }
      `}</style>
    </div>
  );
}

// ── Key panel (inline) ─────────────────────────────────────────────────
function KeyPanel({
  providerLabel, placeholder, guide, state, onChange, onTest, onContinue, baseUrlField,
}: {
  providerLabel: string;
  placeholder: string;
  guide: string[];
  state: CardState;
  onChange: (patch: Partial<CardState>) => void;
  onTest: () => void;
  onContinue: () => void;
  baseUrlField?: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = state.guideOpen;
    }
  }, [state.guideOpen]);

  return (
    <div className="key-panel">
      <details
        ref={detailsRef}
        className="key-guide"
        onToggle={(e) => onChange({ guideOpen: (e.target as HTMLDetailsElement).open })}
      >
        <summary>
          <span className="chev"><IArrowR size={12} /></span>
          Where do I get this key?
        </summary>
        <ol>
          {guide.map((step, i) => (
            <li key={i} data-num={`/0${i + 1}`}><Linkify text={step} /></li>
          ))}
        </ol>
      </details>

      {baseUrlField && (
        <div>
          <label className="field-label">Base URL</label>
          <div className="key-input-wrap">
            <input
              type="text"
              className="input input-mono"
              placeholder="https://api.together.xyz/v1"
              value={state.baseURL ?? ''}
              onChange={(e) => onChange({ baseURL: e.target.value })}
            />
          </div>
        </div>
      )}

      <div>
        <label className="field-label">Paste your API key</label>
        <div className="key-input-wrap">
          <input
            type={state.shown ? 'text' : 'password'}
            className="input input-mono"
            placeholder={placeholder}
            value={state.keyValue}
            onChange={(e) => onChange({ keyValue: e.target.value, error: undefined })}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="reveal"
            aria-label={state.shown ? 'Hide key' : 'Show key'}
            onClick={() => onChange({ shown: !state.shown })}
          >
            {state.shown ? <IEyeOff size={14} /> : <IEye size={14} />}
          </button>
        </div>
        <p className="security-note">
          <span className="ic"><IShield size={12} /></span>
          Encrypted the moment you paste. Goblin never logs it, never shows it in chat.
        </p>
      </div>

      <div className="key-actions">
        {!state.connected && (
          <button type="button" className="btn-primary" onClick={onTest} disabled={state.testing}>
            {state.testing ? 'Testing…' : 'Test connection'}
          </button>
        )}
        {state.error && <span className="error">{state.error}</span>}
      </div>

      {state.connected && (
        <div className="key-success">
          <span className="check"><ICheck size={14} /></span>
          <span className="msg">Connected. {providerLabel} is ready.</span>
          <button type="button" className="continue" onClick={onContinue}>
            Continue <IArrowR size={12} />
          </button>
        </div>
      )}

      <style jsx>{`
        .key-panel {
          margin-top: 4px;
          padding-top: 14px;
          border-top: 1px dashed var(--line-strong);
          display: flex; flex-direction: column; gap: 12px;
        }
        .key-guide {
          background: var(--surface-2);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 12px 14px;
        }
        .key-guide summary {
          font-family: var(--font-mono), monospace;
          font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--ink-2); cursor: pointer; list-style: none;
          display: flex; align-items: center; gap: 8px;
        }
        .key-guide summary::-webkit-details-marker { display: none; }
        .chev {
          display: inline-flex; transition: transform .15s; color: var(--ink-3);
        }
        .key-guide[open] .chev { transform: rotate(90deg); }
        .key-guide ol {
          list-style: none; margin-top: 12px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .key-guide li {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 13px; color: var(--ink-1); line-height: 1.45;
          padding-left: 0;
        }
        .key-guide li::before {
          content: attr(data-num);
          font-family: var(--font-mono), monospace;
          font-size: 10px; font-weight: 600;
          color: var(--accent); letter-spacing: 0.12em;
          flex-shrink: 0; margin-top: 3px;
        }
        .key-guide :global(.guide-link) {
          color: var(--gold-deep); font-weight: 600;
          text-decoration: underline;
          text-decoration-color: var(--accent-rule);
          text-underline-offset: 2px;
          word-break: break-all;
        }
        .key-guide :global(.guide-link:hover) { text-decoration-color: var(--gold-deep); }
        .field-label {
          display: block;
          font-family: var(--font-mono), monospace;
          font-size: 10.5px; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--ink-3);
          margin-bottom: 8px; font-weight: 500;
        }
        .key-input-wrap { position: relative; }
        .input {
          width: 100%;
          background: var(--surface-elev);
          border: 1px solid var(--line-strong);
          border-radius: var(--radius);
          padding: 12px 14px;
          padding-right: 42px;
          font-size: 14px; color: var(--ink-1);
          font-family: var(--font-onb-display), Manrope, sans-serif;
          transition: border-color .15s, background .15s;
        }
        .input:focus { outline: none; border-color: var(--ink-1); background: #fff; }
        .input-mono {
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          font-size: 13px;
        }
        .reveal {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          width: 28px; height: 28px; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--ink-3); border: none; background: transparent;
          border-radius: var(--radius-xs);
        }
        .reveal:hover { color: var(--ink-1); background: var(--surface-2); }
        .security-note {
          font-size: 12px; color: var(--ink-3);
          line-height: 1.5; margin-top: 6px;
          display: flex; align-items: flex-start; gap: 8px;
        }
        .security-note .ic { color: var(--accent); margin-top: 3px; flex-shrink: 0; display: inline-flex; }
        .key-actions {
          display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
        }
        .btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: var(--green); color: var(--bone);
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 13.5px;
          padding: 10px 16px; border-radius: var(--radius);
          border: none; cursor: pointer;
        }
        .btn-primary:disabled { opacity: 0.6; cursor: default; }
        .error {
          font-size: 12.5px; color: #a04230;
          font-family: var(--font-mono), monospace;
          letter-spacing: 0.04em;
        }
        .key-success {
          display: flex; gap: 12px; align-items: center;
          padding: 12px 14px;
          background: var(--ok-soft);
          border: 1px solid rgba(47,106,71,.30);
          border-radius: var(--radius);
        }
        .check {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--ok); color: #fff; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .msg { flex: 1; font-size: 13.5px; color: var(--ok); font-weight: 600; }
        .continue {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 13px;
          color: var(--green); background: var(--bone-warm);
          border: 1px solid var(--green);
          padding: 8px 14px; border-radius: var(--radius); cursor: pointer;
        }
      `}</style>
    </div>
  );
}

export default function ProviderStepPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }} />}>
      <Step2Inner />
    </Suspense>
  );
}
