'use client';

// Step 5 of 5 — Integrations. Final step.
// Faithful port of 02d_onboarding_integrations_new.html.
//
// GitHub + Vercel have real backends (recon §5.6). For the port, "Connect"
// triggers an OAuth redirect via the existing routes; if those routes don't
// exist client-side, the buttons are non-functional + clearly marked TODO.
//
// "Start building" / "Skip all" both mark onboarding complete and land at
// /dashboard/chat.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders, API_URL } from '@/lib/api';
import {
  IArrowL, IArrowR, IBell, ICard, IGithub, IGlobe, IShield, IVercel,
} from '../_components/icons';
import { patchOnboardingState } from '../_components/onboarding-state';

const NEXT_DEST = '/dashboard/chat';

export default function IntegrationsStepPage() {
  const router = useRouter();
  const [githubLoading, setGithubLoading] = useState(false);

  useEffect(() => {
    patchOnboardingState({ current_step: 5 });
  }, []);

  // Proven pattern from apps/web/app/dashboard/settings/integrations/github-connect-button.tsx,
  // extended with returnTo so the OAuth callback drops the user back here
  // instead of the dashboard (TASK C).
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

  return (
    <div className="step5">
      <header className="head">
        <Link href="/welcome/tools" className="back">
          <IArrowL size={12} /> Back to tools
        </Link>
        <div className="eyebrow"><span className="tick" />Step 05 of 05 — Integrations</div>
        <h1>Plug Goblin into your <span className="gobl-serif">stack.</span></h1>
        <p className="lead">
          Goblin pushes code, runs builds, and pings the right people — everywhere
          you already work. Skip anything you don&apos;t use; add it later from
          Settings. Every line here is optional.
        </p>
      </header>

      <Section
        num="/01 — RECOMMENDED"
        title="Source & deploy"
        desc='The two minimum integrations for Goblin&apos;s "prompt-to-live-URL" loop.'
      >
        {/* GitHub: real OAuth start via POST /api/github/connect (proven pattern
            from dashboard/settings/integrations/github-connect-button.tsx). */}
        <Integration
          name="GitHub"
          req="RECOMMENDED"
          Logo={IGithub}
          logoClass="github"
          desc="Auto-commits, draft PRs, repo search. The default source-of-truth for every Goblin project."
          onClick={connectGithub}
          ctaLabel={githubLoading ? 'Connecting…' : 'Connect GitHub'}
          primary
        />
        {/* Vercel: NO OAuth flow exists. Token is pasted into Settings → API Keys
            and stored as byok_keys.provider='vercel' (see services/vercel-service.ts).
            Honest: a Link to the keys page with clear microcopy. */}
        <Integration
          name="Vercel"
          req="RECOMMENDED"
          Logo={IVercel}
          logoClass="vercel"
          desc="Auto-deploy on merge, preview URLs per PR. Add your Vercel token in Settings → API Keys."
          href="/dashboard/settings/keys"
          ctaLabel="Add token in Settings"
          primary
        />
      </Section>

      <Section num="/02 — OPTIONAL" title="Payments & email">
        <Integration name="Stripe" Logo={ICard} logoClass="stripe"
          desc="Goblin scaffolds Checkout, webhooks, and pricing tables." href="/dashboard/settings/integrations" />
        <Integration name="Resend" Logo={IBell} logoClass="resend"
          desc="Transactional & magic-link email." href="/dashboard/settings/integrations" />
      </Section>

      <Section num="/03 — OPTIONAL" title="Productivity & alerts">
        <Integration name="Linear" letter="L" logoClass="linear"
          desc='Convert "this should be a feature" into an issue, mid-chat.' href="/dashboard/settings/integrations" />
        <Integration name="Notion" letter="N" logoClass="notion"
          desc="Sync product specs into your Notion workspace as Goblin writes them." href="/dashboard/settings/integrations" />
        <Integration name="Discord" Logo={IBell} logoClass="discord"
          desc='Ship pings to a channel — "Newsletter Tool deployed in 28s".' href="/dashboard/settings/integrations" />
        <Integration name="Cloudflare" Logo={IGlobe} logoClass="cf"
          desc="Alternative deploy + DNS. For Workers / KV / R2 stacks." href="/dashboard/settings/integrations" />
      </Section>

      <div className="summary">
        <div className="body">
          <div className="eyebrow on-dark"><span className="tick" /><span className="gobl-mono">YOU&apos;RE READY · 5 MIN TOTAL</span></div>
          <h2>Provider, routing, tools, integrations — <span className="gobl-serif">done.</span></h2>
          <p>Goblin&apos;s got everything queued. The first prompt is waiting.</p>
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
        <span className="skip"><IShield size={11} />ADD INTEGRATIONS ANY TIME · SETTINGS / INTEGRATIONS</span>
        <span className="gobl-mono">/welcome/integrations · STEP 05 OF 05</span>
        <button type="button" className="finish" onClick={() => finish(true)}>FINISH →</button>
      </div>

      <style jsx>{`
        .step5 { padding: 32px 60px 40px; max-width: 1200px; margin: 0 auto; }
        @media (max-width: 880px) { .step5 { padding: 22px 18px 32px; } }
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
        .eyebrow.on-dark { color: rgba(244,236,216,.62); }
        .eyebrow.on-dark :global(.gobl-mono) { color: var(--bone); }
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
          font-size: 14px; color: rgba(244,236,216,.78);
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
          background: transparent; color: rgba(244,236,216,.78);
          border-color: rgba(244,236,216,.18);
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
        .footstrip .skip {
          display: inline-flex; align-items: center; gap: 6px;
        }
        .footstrip .skip :global(svg) { color: var(--accent); }
        .finish {
          background: none; border: none;
          font: inherit; color: var(--ink-2); cursor: pointer;
        }
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
        .int-section { margin-bottom: 28px; }
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
          color: var(--accent); font-weight: 600;
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
        @media (max-width: 600px) { .int-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function Integration({
  name, req, Logo, letter, logoClass, desc, href, onClick, ctaLabel, primary,
}: {
  name: string;
  req?: string;
  Logo?: React.ComponentType<{ size?: number }>;
  letter?: string;
  logoClass: string;
  desc: string;
  href?: string;
  onClick?: () => void;
  ctaLabel?: string;
  primary?: boolean;
}) {
  const label = ctaLabel ?? 'Connect';
  const inner = (
    <>
      <span className={`logo logo-${logoClass}`}>
        {Logo ? <Logo size={20} /> : letter}
      </span>
      <div className="body">
        <div className="top">
          <span className="name">{name}</span>
          {req && <span className="req">{req}</span>}
        </div>
        <div className="desc">{desc}</div>
      </div>
      <div className="ctrl">
        <span className={primary ? 'btn-primary' : 'btn-secondary'}>
          {label}{primary && <IArrowR size={12} />}
        </span>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`int-card int-card-btn ${primary ? 'required' : ''}`} onClick={onClick}>
        {inner}
        <IntegrationStyles />
      </button>
    );
  }
  return (
    <a className={`int-card ${primary ? 'required' : ''}`} href={href ?? '#'}>
      {inner}
      <IntegrationStyles />
    </a>
  );
}

function IntegrationStyles() {
  return (
      <style jsx>{`
        .int-card {
          background: var(--surface-elev);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 18px;
          display: flex; align-items: center; gap: 14px;
          color: var(--ink-1); text-decoration: none;
        }
        .int-card.required {
          border-color: var(--accent-rule);
          box-shadow: 0 0 0 1px var(--accent-rule);
        }
        .logo {
          width: 44px; height: 44px; border-radius: 10px;
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: #fff;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 700; font-size: 18px;
        }
        .logo-github { background: #0F0F0F; }
        .logo-vercel { background: #000; }
        .logo-stripe { background: #635BFF; }
        .logo-linear { background: #5E6AD2; }
        .logo-notion { background: #fff; color: #0F0F0F; border: 1px solid var(--line); }
        .logo-discord { background: #5865F2; }
        .logo-resend { background: #000; color: #D4A737; }
        .logo-cf { background: #F38020; }
        .body { flex: 1; min-width: 0; }
        .top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .name {
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 14.5px;
          color: var(--ink-1); letter-spacing: -0.014em;
        }
        .req {
          font-family: var(--font-mono), monospace;
          font-size: 9px; letter-spacing: 0.18em;
          padding: 2px 6px; border-radius: 3px;
          background: var(--accent-bright); color: var(--green);
          font-weight: 600;
        }
        .desc {
          font-size: 12.5px; color: var(--ink-3);
          line-height: 1.45; margin-top: 3px;
        }
        .ctrl { flex-shrink: 0; }
        .btn-primary, .btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-onb-display), Manrope, sans-serif;
          font-weight: 600; font-size: 12.5px;
          padding: 8px 12px; border-radius: 6px;
          border: 1px solid transparent;
        }
        .btn-primary { background: var(--green); color: var(--bone); }
        .btn-secondary {
          background: transparent; color: var(--ink-1);
          border-color: var(--line-strong);
        }
        .int-card-btn {
          font: inherit; text-align: left; cursor: pointer;
          width: 100%;
        }
      `}</style>
  );
}
