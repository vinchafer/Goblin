'use client';

// Step 6 of 6 — Integrations. Final step. (Sprint 10.5 A-S9 re-skin.)
//
// Honesty (verified against apps/api): only GitHub + Vercel are wired today.
// Everything else is shown as the roadmap, badged BALD, with a non-actionable
// CTA so nothing implies it connects yet.
//
// Re-skin also fixes the real "badly formatted" cause: the card styles used to
// live in a sibling component (IntegrationStyles), so styled-jsx scoped them to
// nothing and the cards rendered unstyled. Styles are now inline in the card.
//
// "Start building" / "Skip all" mark onboarding complete and route to the
// project-create landing (A-S11), not chat.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders, API_URL } from '@/lib/api';
import {
  IArrowL, IArrowR, IBell, ICard, IGlobe, IShield, ISpark,
} from '../_components/icons';
import { ProviderLogo } from '@/components/onboarding/ProviderLogo';
import { patchOnboardingState } from '../_components/onboarding-state';

// Where onboarding hands off. Project-create landing, not chat (A-S11).
const NEXT_DEST = '/dashboard?start=1';

export default function IntegrationsStepPage() {
  const router = useRouter();
  const [githubLoading, setGithubLoading] = useState(false);
  const [showMobileHint, setShowMobileHint] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    patchOnboardingState({ current_step: 5 });
    // Desktop-only nudge: Goblin ships from the phone too.
    if (typeof window !== 'undefined' && window.innerWidth > 820) {
      setShowMobileHint(true);
    }
  }, []);

  async function connectGithub() {
    setGithubLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/github/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ returnTo: '/welcome/integrations' }),
      });
      if (res.ok) {
        const result = await res.json() as { url?: string };
        if (result.url) window.location.href = result.url;
      }
    } finally {
      setGithubLoading(false);
    }
  }

  async function finish(skip: boolean) {
    await patchOnboardingState({
      completed: true,
      current_step: 5,
      ...(skip ? { skipped_steps: [5] } : {}),
    });
    router.push(NEXT_DEST);
  }

  function copyUrl() {
    try {
      navigator.clipboard?.writeText('https://justgoblin.com');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <div className="step5">
      <header className="head">
        <Link href="/welcome/tools" className="back">
          <IArrowL size={12} /> <span>Back to tools</span>
        </Link>
        <div className="eyebrow"><span className="tick" /><span>Step 05 of 06 — Integrations</span></div>
        <h1>Plug Goblin into your <span className="gobl-serif">stack.</span></h1>
        <p className="lead">
          Goblin pushes code, runs builds, and pings the right people — everywhere
          you already work. Skip anything you don&apos;t use; add it later from
          Settings. Every line here is optional.
        </p>
      </header>

      <Section
        num="/01 — Live now"
        title="Source & deploy"
        desc='The two integrations behind Goblin&apos;s "prompt-to-live-URL" loop.'
      >
        <Integration
          name="GitHub"
          req="RECOMMENDED"
          logoId="github" logoBg="#0F0F0F"
          desc="Auto-commit & push straight from chat — the source-of-truth for every Goblin project."
          onClick={connectGithub}
          ctaLabel={githubLoading ? 'Connecting…' : 'Connect GitHub'}
          primary
        />
        <Integration
          name="Vercel"
          req="RECOMMENDED"
          logoId="vercel" logoBg="#000"
          desc="One-click deploy + a live URL. Add your Vercel token in Settings → Connectors."
          href="/dashboard/settings/keys"
          ctaLabel="Add token in Settings"
          primary
        />
      </Section>

      <Section
        num="/02 — Infrastructure"
        title="Backend & hosting"
        desc="For projects that outgrow a static deploy. Connectable from Settings as these land."
      >
        <Integration name="Supabase" logoId="supabase" logoBg="#1F1F1F"
          desc="Postgres, auth & storage — migrations straight from chat." soon />
        <Integration name="Railway" logoId="railway" logoBg="#0B0D0E"
          desc="API hosting for non-Next.js stacks — an alternative to Vercel." soon />
      </Section>

      <Section num="/03 — Planned" title="Payments, productivity & alerts">
        <Integration name="Stripe" Logo={ICard} logoBg="#635BFF"
          desc="Scaffold Checkout, webhooks & pricing tables." soon />
        <Integration name="Resend" Logo={IBell} logoBg="#111111"
          desc="Transactional & magic-link email." soon />
        <Integration name="Linear" letter="L" logoBg="#5E6AD2"
          desc='Turn "this should be a feature" into an issue, mid-chat.' soon />
        <Integration name="Notion" letter="N" logoBg="#111111"
          desc="Sync product specs into your Notion workspace." soon />
        <Integration name="Discord" Logo={IBell} logoBg="#5865F2"
          desc='Ship pings to a channel — "Newsletter Tool deployed in 28s".' soon />
        <Integration name="Cloudflare" Logo={IGlobe} logoBg="#F38020"
          desc="DNS + Workers / KV / R2 for edge stacks." soon />
      </Section>

      {showMobileHint && (
        <div className="mobile-hint">
          <span className="ic"><ISpark size={16} /></span>
          <div className="mh-body">
            <b>Du bist am Desktop.</b> Goblin läuft auch am Handy — von überall
            arbeiten, von überall shippen.
          </div>
          <button type="button" className="mh-btn" onClick={copyUrl}>
            {copied ? 'Link kopiert ✓' : 'Link kopieren'}
          </button>
        </div>
      )}

      <div className="summary">
        <div className="body">
          <div className="eyebrow on-dark"><span className="tick" /><span className="gobl-mono">YOU&apos;RE READY · 5 MIN TOTAL</span></div>
          <h2>Provider, routing, tools, integrations — <span className="gobl-serif">done.</span></h2>
          <p>Goblin&apos;s got everything queued. Let&apos;s build your first project.</p>
        </div>
        <div className="cta">
          <button type="button" className="btn-primary-light" onClick={() => finish(false)}>
            Start building <IArrowR size={13} />
          </button>
          <button type="button" className="btn-secondary-light" onClick={() => finish(true)}>
            Skip all
          </button>
        </div>
      </div>

      <div className="footstrip">
        <span className="skip"><IShield size={11} />ADD INTEGRATIONS ANY TIME · SETTINGS / CONNECTORS</span>
        <span className="gobl-mono">/welcome/integrations · STEP 05 OF 06</span>
        <button type="button" className="finish" onClick={() => finish(true)}>FINISH →</button>
      </div>

      <style jsx>{`
        .step5 { padding: 32px 60px 40px; max-width: 1200px; margin: 0 auto; }
        @media (max-width: 880px) { .step5 { padding: 22px 18px 32px; } }
        .head { margin-bottom: 28px; max-width: 760px; }
        .back {
          display: flex; width: fit-content; max-width: 100%;
          align-items: center; gap: 8px;
          font-family: var(--font-mono), monospace;
          font-size: 10.5px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--ink-3); margin-bottom: 18px;
        }
        .back :global(svg) { flex-shrink: 0; }
        .back:hover { color: var(--ink-1); }
        .eyebrow {
          font-family: var(--font-mono), monospace; font-size: 10.5px;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-3);
          display: inline-flex; align-items: center; gap: 10px; margin-bottom: 14px;
        }
        .eyebrow.on-dark { color: rgba(244,236,216,.62); }
        .eyebrow.on-dark :global(.gobl-mono) { color: var(--bone); }
        .tick {
          width: 5px; height: 5px; background: var(--accent);
          transform: rotate(45deg); display: inline-block; flex-shrink: 0;
        }
        h1 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: clamp(36px, 4.4vw, 56px);
          letter-spacing: -0.034em; line-height: 1.06;
          color: var(--ink-1); margin-bottom: 12px;
        }
        .lead { font-size: 16.5px; color: var(--ink-2); line-height: 1.5; max-width: 64ch; }

        .mobile-hint {
          display: flex; align-items: center; gap: 14px;
          background: var(--surface-2); border: 1px solid var(--line);
          border-radius: var(--radius-lg); padding: 14px 18px; margin-bottom: 18px;
        }
        .mobile-hint .ic { color: var(--accent); flex-shrink: 0; display: inline-flex; }
        .mobile-hint .mh-body { flex: 1; font-size: 13.5px; color: var(--ink-2); line-height: 1.5; }
        .mobile-hint .mh-body b { color: var(--ink-1); }
        .mobile-hint .mh-btn {
          flex-shrink: 0;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 12.5px;
          padding: 8px 14px; border-radius: var(--radius);
          background: transparent; color: var(--ink-1);
          border: 1px solid var(--line-strong); cursor: pointer;
        }
        .mobile-hint .mh-btn:hover { border-color: var(--ink-1); }

        .summary {
          background: var(--surface-deep); color: var(--bone);
          border-radius: var(--radius-lg);
          padding: 28px 32px; margin-top: 8px;
          display: flex; align-items: center; gap: 24px;
          border: 1px solid var(--green);
          position: relative; overflow: hidden;
        }
        @media (max-width: 880px) {
          .summary { flex-direction: column; align-items: stretch; padding: 22px; gap: 16px; }
        }
        .summary .body { flex: 1; }
        .summary h2 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: clamp(22px, 2.4vw, 32px);
          color: var(--bone); letter-spacing: -0.024em;
          line-height: 1.1; margin-bottom: 6px;
        }
        .summary p {
          font-size: 14px; color: rgba(244,236,216,.88);
          line-height: 1.5; max-width: 56ch;
        }
        .summary .cta { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn-primary-light, .btn-secondary-light {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 14px;
          padding: 12px 18px; border-radius: var(--radius);
          cursor: pointer; border: 1px solid transparent;
        }
        .btn-primary-light { background: var(--gold); color: var(--green); }
        .btn-primary-light:hover { background: #E8C572; }
        .btn-secondary-light {
          background: transparent; color: rgba(244,236,216,.88);
          border-color: rgba(244,236,216,.28);
        }
        .btn-secondary-light:hover { color: var(--bone); border-color: var(--bone); }

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
        .footstrip .skip { display: inline-flex; align-items: center; gap: 6px; }
        .footstrip .skip :global(svg) { color: var(--accent); }
        .finish { background: none; border: none; font: inherit; color: var(--ink-2); cursor: pointer; }
        .finish:hover { color: var(--ink-1); }
        @media (max-width: 600px) {
          .footstrip { flex-wrap: wrap; gap: 8px; font-size: 10px; }
        }
      `}</style>
    </div>
  );
}

function Section({
  num, title, desc, children,
}: {
  num: string; title: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <div className="int-section">
      <h2><span className="num">{num}</span>{title}</h2>
      {desc && <p className="desc">{desc}</p>}
      <div className="int-grid">{children}</div>
      <style jsx>{`
        .int-section { margin-bottom: 26px; }
        h2 {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 14px;
          color: var(--ink-1); letter-spacing: -0.012em;
          margin-bottom: 12px;
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .num {
          font-family: var(--font-mono), monospace;
          font-size: 10px; letter-spacing: 0.18em;
          color: var(--accent); font-weight: 600; text-transform: uppercase;
        }
        .desc {
          font-size: 13px; color: var(--ink-3);
          margin-bottom: 14px; line-height: 1.5; max-width: 64ch;
        }
        .int-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (max-width: 820px) { .int-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function Integration({
  name, req, Logo, logoId, letter, logoBg, desc, href, onClick, ctaLabel, primary, soon,
}: {
  name: string;
  req?: string;
  Logo?: React.ComponentType<{ size?: number }>;
  logoId?: string;
  letter?: string;
  logoBg: string;
  desc: string;
  href?: string;
  onClick?: () => void;
  ctaLabel?: string;
  primary?: boolean;
  soon?: boolean;
}) {
  const label = soon ? 'Bald' : (ctaLabel ?? 'Connect');
  // Dynamic wrapper tag — div (soon, non-actionable) / button (onClick) / a (href).
  // Elements + <style jsx> live in ONE return expression so styled-jsx scopes
  // the whole card under one id (extracting them into consts broke scoping).
  const Tag = (soon ? 'div' : onClick ? 'button' : 'a') as 'div';
  const className = `int-card ${primary && !soon ? 'required' : ''} ${soon ? 'soon' : ''}`;
  const tagProps: Record<string, unknown> = { className };
  if (!soon && onClick) { tagProps.type = 'button'; tagProps.onClick = onClick; }
  if (!soon && !onClick) { tagProps.href = href ?? '#'; }

  return (
    <Tag {...tagProps}>
      <span className="logo" style={{ background: logoBg }}>
        {logoId ? <ProviderLogo id={logoId} size={20} tone="light" fallbackLabel={name[0]} />
          : Logo ? <Logo size={20} /> : letter}
      </span>
      <div className="ibody">
        <div className="itop">
          <span className="iname">{name}</span>
          {req && !soon && <span className="req">{req}</span>}
          {soon && <span className="soon">BALD</span>}
        </div>
        <div className="idesc">{desc}</div>
      </div>
      <div className="ctrl">
        <span className={soon ? 'cta-soon' : primary ? 'btn-primary' : 'btn-secondary'}>
          {label}{primary && !soon && <IArrowR size={12} />}
        </span>
      </div>
      <style jsx>{`
      .int-card {
        background: var(--surface-elev);
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        padding: 18px;
        display: flex; align-items: center; gap: 14px;
        color: var(--ink-1); text-decoration: none;
        width: 100%; text-align: left; font: inherit;
        transition: border-color .15s, box-shadow .15s;
      }
      .int-card.required { border-color: var(--accent-rule); box-shadow: 0 0 0 1px var(--accent-rule); }
      .int-card.soon { opacity: .82; }
      a.int-card:hover, button.int-card:hover { border-color: var(--line-strong); }
      @media (max-width: 600px) { .int-card { flex-wrap: wrap; } .int-card .ctrl { width: 100%; } }
      .logo {
        width: 44px; height: 44px; border-radius: 10px;
        display: inline-flex; align-items: center; justify-content: center;
        flex-shrink: 0; color: #fff;
        font-family: var(--font-onb-display), Manrope, sans-serif;
        font-weight: 700; font-size: 18px;
      }
      .ibody { flex: 1; min-width: 0; }
      .itop { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .iname {
        font-family: var(--font-onb-display), Manrope, sans-serif;
        font-weight: 600; font-size: 14.5px;
        color: var(--ink-1); letter-spacing: -0.014em;
      }
      .req {
        font-family: var(--font-mono), monospace;
        font-size: 9px; letter-spacing: 0.18em;
        padding: 2px 6px; border-radius: 3px;
        background: var(--accent-bright); color: var(--green); font-weight: 600;
      }
      .soon {
        font-family: var(--font-mono), monospace;
        font-size: 9px; letter-spacing: 0.16em;
        padding: 2px 6px; border-radius: 3px;
        background: var(--surface); color: var(--ink-3);
        border: 1px solid var(--line-strong); font-weight: 600;
      }
      .idesc { font-size: 12.5px; color: var(--ink-3); line-height: 1.45; margin-top: 3px; }
      .ctrl { flex-shrink: 0; }
      .btn-primary, .btn-secondary {
        display: inline-flex; align-items: center; gap: 8px;
        font-family: var(--font-onb-display), Manrope, sans-serif;
        font-weight: 600; font-size: 12.5px;
        padding: 8px 12px; border-radius: 6px;
        border: 1px solid transparent;
      }
      .btn-primary { background: var(--green); color: var(--bone); }
      .btn-secondary { background: transparent; color: var(--ink-1); border-color: var(--line-strong); }
      .cta-soon {
        font-family: var(--font-mono), monospace;
        font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase;
        color: var(--ink-3);
      }
    `}</style>
    </Tag>
  );
}
