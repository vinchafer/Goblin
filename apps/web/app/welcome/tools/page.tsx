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
import { useOnbLang, STR, TOOL_COPY, type Lang } from '../_components/i18n';
import { IOSToggle } from '@/components/ui/IOSToggle';

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
  id: ToolId; Icon: React.ComponentType<{ size?: number }>;
  beta?: boolean;
  // `soon` = capability not wired into the agent yet. We badge it honestly
  // (BALD/SOON) rather than imply it works today (A-S8 honesty pass).
  soon?: boolean;
}

// Honesty audit (Sprint 10.5 A-S8): only tools actually wired today ship
// unbadged. Everything not yet executed by the agent is marked soon. Name +
// desc come from TOOL_COPY keyed by lang (10.10 i18n). Verified against
// apps/api: deploy = Vercel (real), schema/screenshot rely on the model itself
// (real); web/docs/repo search + lint/type/test/PR have no tool registry yet.
const CHAT_TOOLS: ToolDef[] = [
  { id: 'web_search', Icon: ISearch, soon: true },
  { id: 'docs_lookup', Icon: IFolder, soon: true },
  { id: 'repo_search', Icon: ICode, soon: true },
  { id: 'screenshot', Icon: IEye },
  { id: 'design_refs', Icon: ISpark, beta: true },
  { id: 'schema_gen', Icon: IChart },
];

const CODE_TOOLS: ToolDef[] = [
  { id: 'lint_format', Icon: ICheck, soon: true },
  { id: 'type_check', Icon: IShield, soon: true },
  { id: 'test_runner', Icon: IBolt, soon: true },
  { id: 'deploy', Icon: IVercel },
  { id: 'pr_opener', Icon: IGithub, soon: true },
  { id: 'db_migrations', Icon: ICpu, beta: true },
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
  const lang = useOnbLang();
  const t = STR[lang].tools;

  useEffect(() => {
    patchOnboardingState({ current_step: 4 });
  }, []);

  function toggle(id: ToolId) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  const chatOn = CHAT_TOOLS.filter((x) => selected.has(x.id)).length;
  const codeOn = CODE_TOOLS.filter((x) => selected.has(x.id)).length;
  const total = chatOn + codeOn;
  const presetName = preset === 'indie' ? t.presetIndieName : preset === 'starter' ? t.presetStarterName : t.presetAllName;

  return (
    <div className="step4">
      <header className="head">
        <Link href="/welcome/provider" className="back">
          <IArrowL size={12} /> {t.back}
        </Link>
        <div className="eyebrow"><span className="tick" /><span>{t.eyebrow}</span></div>
        <h1>{t.titleA} <span className="gobl-serif">{t.titleB}</span></h1>
        <p className="lead">{t.lead}</p>
      </header>

      <div className="presets">
        <button
          type="button"
          className={`gobl-preset preset ${preset === 'indie' ? 'active' : ''}`}
          onClick={() => setPreset('indie')}
        >
          <span className="l">{t.presetIndieL}</span>
          <span className="name">{t.presetIndieName}</span>
          <span className="desc">{t.presetIndieDesc}</span>
        </button>
        <button
          type="button"
          className={`gobl-preset preset ${preset === 'starter' ? 'active' : ''}`}
          onClick={() => setPreset('starter')}
        >
          <span className="l">{t.presetStarterL}</span>
          <span className="name">{t.presetStarterName}</span>
          <span className="desc">{t.presetStarterDesc}</span>
        </button>
        <button
          type="button"
          className={`gobl-preset preset ${preset === 'all_on' ? 'active' : ''}`}
          onClick={() => setPreset('all_on')}
        >
          <span className="l">{t.presetAllL}</span>
          <span className="name">{t.presetAllName}</span>
          <span className="desc">{t.presetAllDesc}</span>
        </button>
      </div>

      <ToolCategory
        title={t.chatTitle}
        sub={t.chatSub}
        Icon={IChat}
        onCount={chatOn}
        total={CHAT_TOOLS.length}
        tools={CHAT_TOOLS}
        selected={selected}
        onToggle={toggle}
        lang={lang}
        t={t}
      />

      <ToolCategory
        title={t.codeTitle}
        sub={t.codeSub}
        Icon={ICode}
        onCount={codeOn}
        total={CODE_TOOLS.length}
        tools={CODE_TOOLS}
        selected={selected}
        onToggle={toggle}
        lang={lang}
        t={t}
      />

      <div className="recap">
        <div className="body">
          <div className="t">{t.recapEnabled.replace('{n}', String(total)).replace('{preset}', presetName)}</div>
          <div className="s">{t.recapSub}</div>
        </div>
        <div className="count">
          <span className="chip"><span className="v">{chatOn}</span> {t.chat}</span>
          <span className="chip"><span className="v">{codeOn}</span> {t.coding}</span>
        </div>
        <div className="cta">
          <Link href="/welcome/integrations" className="onb-btn-gold">
            {t.continueLabel} <IArrowR size={13} />
          </Link>
        </div>
      </div>

      <div className="footstrip">
        <span className="skip"><IShield size={11} />{t.footChange}</span>
        <span className="gobl-mono">/welcome/tools · {STR[lang].chrome.step} 04 {STR[lang].chrome.of} 06</span>
        <Link href="/welcome/integrations">{t.footSkip}</Link>
      </div>

      <style jsx>{`
        .step4 { padding: 32px 60px 40px; max-width: 1200px; margin: 0 auto; }
        @media (max-width: 880px) { .step4 { padding: 22px 18px 32px; } }
        .head { margin-bottom: 28px; max-width: 760px; }
        .back {
          display: flex; width: fit-content; max-width: 100%;
          align-items: center; gap: 8px;
          font-family: var(--font-mono), monospace;
          font-size: 10.5px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--ink-3); margin-bottom: 18px;
        }
        .back:hover { color: var(--ink-1); }
        .back :global(svg) { flex-shrink: 0; }
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
        .recap .s { font-size: 13px; color: rgba(244,236,216,.88); line-height: 1.45; }
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
        /* 10.7-10: read clearly as a raised button on the dark recap, not a
           highlighted label. Gold fill + ink text + shadow = unmistakable CTA. */
        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--gold); color: var(--green);
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 700; font-size: 14px;
          padding: 13px 20px; border-radius: var(--radius);
          border: 1px solid var(--gold);
          box-shadow: 0 2px 8px rgba(0,0,0,.22);
          cursor: pointer; text-decoration: none;
          transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,0,0,.28);
          background: var(--gold-bright, var(--gold));
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
      `}</style>
    </div>
  );
}

function ToolCategory({
  title, sub, Icon, onCount, total, tools, selected, onToggle, lang, t,
}: {
  title: string; sub: string; Icon: React.ComponentType<{ size?: number }>;
  onCount: number; total: number;
  tools: ToolDef[]; selected: Set<ToolId>;
  onToggle: (id: ToolId) => void;
  lang: Lang;
  t: (typeof STR)['de']['tools'];
}) {
  return (
    <div className="cat">
      <div className="cat-head">
        <span className="ic"><Icon size={16} /></span>
        <div className="body">
          <div className="t">{title}</div>
          <div className="s">{sub}</div>
        </div>
        <span className="meta"><span className="v">{onCount}</span> {t.of} {total} {t.on}</span>
      </div>
      <div className="tools-grid">
        {tools.map((tool) => {
          const on = selected.has(tool.id);
          const Icn = tool.Icon;
          const copy = TOOL_COPY[lang][tool.id];
          return (
            <div key={tool.id} className={`tool-row ${on ? 'on' : ''}`}>
              <span className="glyph"><Icn size={15} /></span>
              <div className="body">
                <div className="name">
                  {copy.name}
                  {tool.beta && <span className="badge">{t.beta}</span>}
                  {tool.soon && <span className="badge badge-soon">{t.soon}</span>}
                </div>
                <div className="desc">{copy.desc}</div>
              </div>
              <IOSToggle value={on} onChange={() => onToggle(tool.id)} ariaLabel={copy.name} />
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
        .badge-soon {
          background: var(--surface);
          color: var(--ink-3);
          border: 1px solid var(--line-strong);
        }
        .tool-row .desc {
          font-size: 12px; color: var(--ink-3);
          line-height: 1.45; margin-top: 2px;
        }
        /* Flat WIDE rectangle toggle (10.7-9, 3rd pass — definitive).
           Track is clearly wider than tall (48×26) and the slider nearly
           fills the track height (22px in 26px), so it reads as a flat
           horizontal rectangle with a sliding block — NOT two nested
           squares (the 10.6 look) and NOT a pill/circle (the 10.5 look).
           "Nur so hoch wie der Schiebebutton." */
        .switch {
          width: 48px; height: 26px;
          background: var(--surface-2);
          border: 1px solid var(--line-strong);
          border-radius: 7px;
          position: relative;
          cursor: pointer; flex-shrink: 0;
          transition: background .15s ease-out, border-color .15s ease-out;
          padding: 0;
        }
        .switch.on { background: var(--green); border-color: var(--green); }
        .knob {
          width: 22px; height: 22px;
          background: #fff; border-radius: 5px;
          position: absolute; top: 1px; left: 1px;
          transition: transform .15s ease-out;
          box-shadow: 0 1px 2px rgba(15,43,30,.22);
        }
        /* 48 − 22 − 1 (left) − 1 (right) = 24 */
        .switch.on .knob { transform: translateX(24px); }
      `}</style>
    </div>
  );
}
