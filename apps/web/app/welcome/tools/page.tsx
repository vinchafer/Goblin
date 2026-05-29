'use client';

// Step 4 of 5 — Tools / capabilities picker.
//
// Selection persists server-side via PUT/GET /api/onboarding/state
// (`tools_selection` column, migration 0051). localStorage is kept as an
// offline cache to avoid a blank-flash on slow networks.
//
// SCOPE NOTE: only the *preference* is stored. Nothing in chat/run today
// consumes `tools_selection`. Acting on the preference is future work.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IArrowL, IArrowR, IChat, ICheck, ICode, ICpu, IEye, IFolder, IGithub, ISearch, IShield, ISpark, IBolt, IChart, IVercel } from '../_components/icons';
import { patchOnboardingState, getOnboardingState } from '../_components/onboarding-state';

const LS_KEY = 'goblin:onboarding:tools';

type ToolId =
  | 'web_search' | 'docs_lookup' | 'repo_search' | 'screenshot'
  | 'design_refs' | 'schema_gen'
  | 'lint_format' | 'type_check' | 'test_runner' | 'deploy'
  | 'pr_opener' | 'db_migrations';

type Preset = 'indie' | 'starter' | 'all_on';

const PRESETS: Record<Preset, ToolId[]> = {
  indie: ['web_search', 'docs_lookup', 'repo_search', 'screenshot', 'lint_format', 'type_check', 'test_runner', 'deploy'],
  starter: ['docs_lookup', 'lint_format'],
  all_on: ['web_search', 'docs_lookup', 'repo_search', 'screenshot', 'design_refs', 'schema_gen', 'lint_format', 'type_check', 'test_runner', 'deploy', 'pr_opener', 'db_migrations'],
};

interface ToolDef {
  id: ToolId; name: string; desc: string; Icon: React.ComponentType<{ size?: number }>;
  beta?: boolean;
}

const CHAT_TOOLS: ToolDef[] = [
  { id: 'web_search', name: 'Web search', desc: 'Cited, live web search.', Icon: ISearch },
  { id: 'docs_lookup', name: 'Documentation lookup', desc: 'MDN, npm, official docs.', Icon: IFolder },
  { id: 'repo_search', name: 'Repo search', desc: 'Searches your linked GitHub repos.', Icon: ICode },
  { id: 'screenshot', name: 'Screenshot understanding', desc: 'Drop a screenshot, Goblin reads it.', Icon: IEye },
  { id: 'design_refs', name: 'Design references', desc: 'Browses Dribbble & Behance.', Icon: ISpark, beta: true },
  { id: 'schema_gen', name: 'Schema generator', desc: 'Plain-English → SQL / Prisma / Zod.', Icon: IChart },
];

const CODE_TOOLS: ToolDef[] = [
  { id: 'lint_format', name: 'Lint & format', desc: 'Prettier · ESLint. Auto-fixes before diff.', Icon: ICheck },
  { id: 'type_check', name: 'Type check', desc: "tsc · pyright. Won't propose type-failing code.", Icon: IShield },
  { id: 'test_runner', name: 'Test runner', desc: 'Vitest · Jest · Playwright.', Icon: IBolt },
  { id: 'deploy', name: 'Deploy', desc: 'Vercel · Netlify · Cloudflare Pages.', Icon: IVercel },
  { id: 'pr_opener', name: 'PR opener', desc: 'Opens a draft PR instead of pushing direct.', Icon: IGithub },
  { id: 'db_migrations', name: 'Database migrations', desc: 'Generates & runs Prisma / Drizzle migrations.', Icon: ICpu, beta: true },
];

function usePersistedTools(): [Set<ToolId>, Preset, (next: Set<ToolId>) => void, (p: Preset) => void] {
  // Initial state from localStorage cache (avoids blank flash); server state
  // loads next and overrides if different.
  const [selected, setSelected] = useState<Set<ToolId>>(() => {
    if (typeof window === 'undefined') return new Set(PRESETS.indie);
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { tools: ToolId[]; preset: Preset };
        if (Array.isArray(parsed.tools)) return new Set(parsed.tools);
      }
    } catch {/* ignore */}
    return new Set(PRESETS.indie);
  });
  const [preset, setPreset] = useState<Preset>(() => {
    if (typeof window === 'undefined') return 'indie';
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { tools: ToolId[]; preset: Preset };
        if (parsed.preset) return parsed.preset;
      }
    } catch {/* ignore */}
    return 'indie';
  });

  // Hydrate from server once; server state wins on initial mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await getOnboardingState();
      if (cancelled || !state?.tools_selection) return;
      const sel = state.tools_selection;
      setSelected(new Set(sel.tools as ToolId[]));
      setPreset(sel.preset as Preset);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ tools: sel.tools, preset: sel.preset }));
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, []);

  function persist(nextTools: Set<ToolId>, nextPreset: Preset) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ tools: [...nextTools], preset: nextPreset }));
    } catch {/* ignore */}
    // Fire-and-forget — patch is non-blocking.
    patchOnboardingState({
      tools_selection: { preset: nextPreset, tools: [...nextTools] },
    });
  }

  return [
    selected, preset,
    (next: Set<ToolId>) => { setSelected(next); persist(next, preset); },
    (p: Preset) => { setPreset(p); const next = new Set(PRESETS[p]); setSelected(next); persist(next, p); },
  ];
}

export default function ToolsStepPage() {
  const [selected, preset, setSelected, setPreset] = usePersistedTools();

  useEffect(() => {
    patchOnboardingState({ current_step: 4 });
  }, []);

  function toggle(id: ToolId) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  const chatOn = CHAT_TOOLS.filter((t) => selected.has(t.id)).length;
  const codeOn = CODE_TOOLS.filter((t) => selected.has(t.id)).length;
  const total = chatOn + codeOn;

  return (
    <div className="step4">
      <header className="head">
        <Link href="/welcome/routing" className="back">
          <IArrowL size={12} /> Back to your build team
        </Link>
        <div className="eyebrow"><span className="tick" />Step 04 of 05 — Tools</div>
        <h1>Give Goblin the right <span className="gobl-serif">tools.</span></h1>
        <p className="lead">
          Two toolkits, separately tuned. <b>Chat &amp; architecture</b> for the
          thinking — web search, docs, your own repo. <b>Coding &amp; shipping</b>
          for the doing — lint, type-check, tests, deploy. Pick a preset or
          curate by hand.
        </p>
      </header>

      <div className="presets">
        <button
          type="button"
          className={`gobl-preset preset ${preset === 'indie' ? 'active' : ''}`}
          onClick={() => setPreset('indie')}
        >
          <span className="l">RECOMMENDED · MOST POPULAR</span>
          <span className="name">Indie builder</span>
          <span className="desc">The 8 tools 84% of Goblin users keep on. Balanced cost vs. capability.</span>
        </button>
        <button
          type="button"
          className={`gobl-preset preset ${preset === 'starter' ? 'active' : ''}`}
          onClick={() => setPreset('starter')}
        >
          <span className="l">MIN · FREE TIER FRIENDLY</span>
          <span className="name">Starter</span>
          <span className="desc">Only docs lookup + lint. No web calls.</span>
        </button>
        <button
          type="button"
          className={`gobl-preset preset ${preset === 'all_on' ? 'active' : ''}`}
          onClick={() => setPreset('all_on')}
        >
          <span className="l">MAX · POWER USER</span>
          <span className="name">All on, all the time</span>
          <span className="desc">Every tool below. Best on Sonnet 4.6 or GPT-5.</span>
        </button>
      </div>

      <ToolCategory
        title="Chat & architecture tools"
        sub="Goblin reaches for these when you're specifying, planning, or asking questions."
        Icon={IChat}
        onCount={chatOn}
        total={CHAT_TOOLS.length}
        tools={CHAT_TOOLS}
        selected={selected}
        onToggle={toggle}
      />

      <ToolCategory
        title="Coding & shipping tools"
        sub="Used by Goblin while writing, testing, and pushing code."
        Icon={ICode}
        onCount={codeOn}
        total={CODE_TOOLS.length}
        tools={CODE_TOOLS}
        selected={selected}
        onToggle={toggle}
      />

      <div className="recap">
        <div className="body">
          <div className="t">{total} tools enabled — {preset === 'indie' ? 'Indie builder' : preset === 'starter' ? 'Starter' : 'All-on'} preset.</div>
          <div className="s">Skip and Goblin keeps this preset — change tools any time in Settings.</div>
        </div>
        <div className="count">
          <span className="chip"><span className="v">{chatOn}</span> CHAT</span>
          <span className="chip"><span className="v">{codeOn}</span> CODING</span>
        </div>
        <div className="cta">
          <Link href="/welcome/integrations" className="btn-primary">
            Continue → Integrations <IArrowR size={13} />
          </Link>
        </div>
      </div>

      <div className="footstrip">
        <span className="skip"><IShield size={11} />CHANGE ANY TIME · SETTINGS / TOOLS</span>
        <span className="gobl-mono">/welcome/tools · STEP 04 OF 05</span>
        <Link href="/welcome/integrations">SKIP — USE THE DEFAULTS →</Link>
      </div>

      <style jsx>{`
        .step4 { padding: 32px 60px 40px; max-width: 1200px; margin: 0 auto; }
        @media (max-width: 880px) { .step4 { padding: 22px 18px 32px; } }
        .head { margin-bottom: 28px; max-width: 760px; }
        .back {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-mono), monospace;
          font-size: 10.5px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--ink-3); margin-bottom: 18px;
        }
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
          font-weight: 600; font-size: clamp(36px, 4.4vw, 56px);
          letter-spacing: -0.034em; line-height: 1.06;
          color: var(--ink-1); margin-bottom: 12px;
        }
        .lead { font-size: 16.5px; color: var(--ink-2); line-height: 1.5; max-width: 64ch; }
        .lead b { color: var(--ink-1); }

        .presets {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px; margin-bottom: 28px;
        }
        @media (max-width: 880px) { .presets { grid-template-columns: 1fr; } }
        .preset {
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 16px 18px;
          cursor: pointer; text-align: left;
          display: flex; flex-direction: column; gap: 4px;
          transition: border-color .15s, box-shadow .15s;
          font-family: inherit;
        }
        .preset:hover { border-color: var(--line-strong); }
        .preset.active {
          border-color: var(--ink-1);
          box-shadow: 0 0 0 1px var(--ink-1);
          background: var(--bone-warm);
        }
        .preset .l {
          font-family: var(--font-mono), monospace;
          font-size: 9.5px; letter-spacing: 0.16em;
          color: var(--accent); text-transform: uppercase;
        }
        .preset.active .l { color: var(--accent-bright); }
        .preset .name {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 16px;
          color: var(--ink-1); letter-spacing: -0.016em;
        }
        .preset .desc {
          font-size: 12.5px; color: var(--ink-3);
          line-height: 1.5; margin-top: 2px;
        }

        .recap {
          background: var(--surface-deep); color: var(--bone);
          border-radius: var(--radius-lg);
          padding: 24px 28px;
          display: flex; align-items: center; gap: 20px;
          margin-top: 8px;
          border: 1px solid var(--green);
          position: relative; overflow: hidden;
        }
        @media (max-width: 880px) {
          .recap { flex-direction: column; align-items: stretch; padding: 20px; gap: 14px; }
        }
        .recap .body { flex: 1; }
        .recap .t {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 17px;
          color: var(--bone); margin-bottom: 4px; letter-spacing: -0.016em;
        }
        .recap .s { font-size: 13px; color: rgba(244,236,216,.78); line-height: 1.45; }
        .recap .count { display: flex; gap: 8px; flex-wrap: wrap; }
        .recap .chip {
          font-family: var(--font-mono), monospace;
          font-size: 10.5px; letter-spacing: 0.10em;
          text-transform: uppercase;
          background: rgba(244,236,216,.06);
          border: 1px solid rgba(244,236,216,.14);
          color: var(--bone);
          padding: 5px 10px; border-radius: 999px;
        }
        .recap .chip .v { color: var(--gold); font-weight: 600; }
        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--bone); color: var(--green);
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 13.5px;
          padding: 10px 16px; border-radius: var(--radius);
          border: 1px solid transparent;
        }
        .btn-primary:hover { background: #fff; }

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
      `}</style>
    </div>
  );
}

function ToolCategory({
  title, sub, Icon, onCount, total, tools, selected, onToggle,
}: {
  title: string; sub: string; Icon: React.ComponentType<{ size?: number }>;
  onCount: number; total: number;
  tools: ToolDef[]; selected: Set<ToolId>;
  onToggle: (id: ToolId) => void;
}) {
  return (
    <div className="cat">
      <div className="cat-head">
        <span className="ic"><Icon size={16} /></span>
        <div className="body">
          <div className="t">{title}</div>
          <div className="s">{sub}</div>
        </div>
        <span className="meta"><span className="v">{onCount}</span> OF {total} ON</span>
      </div>
      <div className="tools-grid">
        {tools.map((t) => {
          const on = selected.has(t.id);
          const Icn = t.Icon;
          return (
            <div key={t.id} className={`tool-row ${on ? 'on' : ''}`}>
              <span className="glyph"><Icn size={15} /></span>
              <div className="body">
                <div className="name">
                  {t.name}{t.beta && <span className="badge">BETA</span>}
                </div>
                <div className="desc">{t.desc}</div>
              </div>
              <button
                type="button"
                className={`switch ${on ? 'on' : ''}`}
                onClick={() => onToggle(t.id)}
                aria-pressed={on}
                aria-label={t.name}
              >
                <span className="knob" />
              </button>
            </div>
          );
        })}
      </div>
      <style jsx>{`
        .cat {
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          overflow: hidden; margin-bottom: 16px;
        }
        .cat-head {
          padding: 18px 22px;
          display: flex; align-items: center; gap: 14px;
          border-bottom: 1px solid var(--line);
          background: var(--surface-2);
        }
        .ic {
          width: 34px; height: 34px; border-radius: 8px;
          background: var(--green); color: var(--gold);
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .cat-head .body { flex: 1; }
        .cat-head .t {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 16px;
          color: var(--ink-1); letter-spacing: -0.014em;
        }
        .cat-head .s { font-size: 13px; color: var(--ink-3); line-height: 1.45; margin-top: 2px; }
        .meta {
          font-family: var(--font-mono), monospace; font-size: 10.5px;
          letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3);
        }
        .meta .v { color: var(--ink-1); font-weight: 600; }

        .tools-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (max-width: 600px) { .tools-grid { grid-template-columns: 1fr; } }
        .tool-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 22px;
          border-bottom: 1px solid var(--line);
          border-right: 1px solid var(--line);
        }
        .tool-row:nth-child(2n) { border-right: none; }
        @media (max-width: 600px) { .tool-row { border-right: none; } }
        .glyph {
          width: 32px; height: 32px; border-radius: 8px;
          background: var(--surface); color: var(--ink-2);
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0; border: 1px solid var(--line);
        }
        .tool-row.on .glyph {
          background: var(--green); color: var(--gold);
          border-color: var(--green);
        }
        .tool-row .body { flex: 1; min-width: 0; }
        .tool-row .name {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 13.5px;
          color: var(--ink-1); letter-spacing: -0.012em;
        }
        .badge {
          display: inline-block;
          font-family: var(--font-mono), monospace;
          font-size: 9px; padding: 1px 5px;
          border-radius: 3px;
          background: var(--accent-soft); color: var(--gold-deep);
          letter-spacing: 0.08em; margin-left: 6px;
        }
        .tool-row .desc {
          font-size: 12px; color: var(--ink-3);
          line-height: 1.45; margin-top: 2px;
        }
        .switch {
          width: 36px; height: 20px;
          background: var(--line-strong);
          border-radius: 999px;
          position: relative;
          cursor: pointer; flex-shrink: 0;
          transition: background .15s;
          border: none; padding: 0;
        }
        .switch.on { background: var(--green); }
        .knob {
          width: 14px; height: 14px;
          background: #fff; border-radius: 50%;
          position: absolute; top: 3px; left: 3px;
          transition: transform .15s;
          box-shadow: 0 1px 2px rgba(0,0,0,.2);
        }
        .switch.on .knob { transform: translateX(16px); }
      `}</style>
    </div>
  );
}
