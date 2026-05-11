'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAuthHeaders, API_URL } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingState {
  current_step: number;
  completed: boolean;
  goal?: string | null;
  ai_provider_choice?: string | null;
  code_hosting_choice?: string | null;
  deploy_choice?: string | null;
  skipped_steps?: number[];
}

const TOTAL_STEPS = 5;

// ─── Data ─────────────────────────────────────────────────────────────────────

const GOALS = [
  { icon: '🚀', label: 'Landing Page' },
  { icon: '📊', label: 'SaaS Dashboard' },
  { icon: '📱', label: 'Mobile Web App' },
  { icon: '📨', label: 'Newsletter Tool' },
  { icon: '🔧', label: 'Internal Tool' },
  { icon: '🌀', label: 'Just exploring' },
];

const AI_PROVIDERS = [
  {
    id: 'byok',
    label: 'I have an API key',
    description: 'Connect your Anthropic, OpenAI, or other API key. Best performance, you control costs.',
    cta: 'Connect API key',
    ctaHref: '/dashboard/settings/keys',
  },
  {
    id: 'no_key',
    label: "I don't have one yet",
    description: 'Get one in 2 minutes from Anthropic or Google AI Studio — free tiers available.',
    providers: [
      { name: 'Anthropic (Best for code)', href: 'https://console.anthropic.com' },
      { name: 'OpenAI (Most versatile)', href: 'https://platform.openai.com' },
      { name: 'Google AI Studio (Free tier)', href: 'https://aistudio.google.com' },
    ],
  },
  {
    id: 'free_tier',
    label: 'Use the free pool',
    description: 'No setup needed. Limited requests per day — good to get started, upgrade anytime.',
    cta: 'Continue with free',
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 32, justifyContent: 'center' }}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} style={{
          height: 4, flex: 1, maxWidth: 48, borderRadius: 2,
          background: i < step ? '#2D4A2B' : i === step ? 'rgba(45,74,43,0.4)' : '#E8E4DC',
          transition: 'background 0.3s ease',
        }} />
      ))}
    </div>
  );
}

function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      onClick={onSkip}
      style={{
        background: 'none', border: 'none',
        color: '#9B9B9B', fontSize: 13,
        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
        padding: '4px 0',
        textDecoration: 'underline',
        textDecorationColor: 'rgba(0,0,0,0.15)',
      }}
    >
      Skip for now
    </button>
  );
}

function OptionCard({
  selected, onClick, children, disabled,
}: { selected?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', textAlign: 'left',
        background: selected ? 'rgba(45,74,43,0.06)' : '#fff',
        border: `2px solid ${selected ? '#2D4A2B' : '#E8E4DC'}`,
        borderRadius: 12, padding: '14px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'DM Sans, sans-serif',
      }}
      onMouseEnter={e => { if (!selected && !disabled) e.currentTarget.style.borderColor = '#2D4A2B'; }}
      onMouseLeave={e => { if (!selected && !disabled) e.currentTarget.style.borderColor = '#E8E4DC'; }}
    >
      {children}
    </button>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step0Welcome({ onNext, onGoalSelect, selectedGoal }: { onNext: (goal: string) => void; onGoalSelect: (g: string) => void; selectedGoal?: string | null }) {
  return (
    <div>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 700, color: '#2A2A2A', marginBottom: 8, letterSpacing: '-0.5px' }}>
        What do you want to build first?
      </h1>
      <p style={{ fontSize: 14, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', marginBottom: 28, lineHeight: 1.6 }}>
        Pick a starting point — we&apos;ll tailor Goblin to your goal.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24 }}>
        {GOALS.map(g => (
          <button
            key={g.label}
            onClick={() => { onGoalSelect(g.label); onNext(g.label); }}
            style={{
              background: selectedGoal === g.label ? 'rgba(45,74,43,0.08)' : '#fff',
              border: `2px solid ${selectedGoal === g.label ? '#2D4A2B' : '#E8E4DC'}`,
              borderRadius: 12, padding: '16px 14px',
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s',
              fontFamily: 'DM Sans, sans-serif',
            }}
            onMouseEnter={e => { if (selectedGoal !== g.label) e.currentTarget.style.borderColor = '#2D4A2B'; }}
            onMouseLeave={e => { if (selectedGoal !== g.label) e.currentTarget.style.borderColor = '#E8E4DC'; }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>{g.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2A2A' }}>{g.label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <button
          onClick={() => onNext('custom')}
          style={{
            background: 'none', border: 'none', color: '#9B9B9B',
            fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.15)',
          }}
        >
          I have something else in mind →
        </button>

        <Link
          href="/onboarding/chat"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px',
            background: 'rgba(45,74,43,0.06)',
            border: '1px solid rgba(45,74,43,0.2)',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
            color: '#2D4A2B', textDecoration: 'none',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <span>✦</span>
          Chat with Setup Buddy (AI)
        </Link>
      </div>
    </div>
  );
}

function Step1AiProvider({ onNext, onSkip, selected, onSelect }: {
  onNext: (choice: string) => void; onSkip: () => void;
  selected?: string | null; onSelect: (c: string) => void;
}) {
  return (
    <div>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 700, color: '#2A2A2A', marginBottom: 8, letterSpacing: '-0.5px' }}>
        How do you want Goblin to think?
      </h1>
      <p style={{ fontSize: 14, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', marginBottom: 28, lineHeight: 1.6 }}>
        Goblin routes your requests to AI providers. All paths work — pick what fits.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {AI_PROVIDERS.map(p => (
          <OptionCard key={p.id} selected={selected === p.id} onClick={() => onSelect(p.id)}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#2A2A2A', marginBottom: 4 }}>{p.label}</div>
            <div style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.5, marginBottom: p.providers ? 10 : 0 }}>
              {p.description}
            </div>
            {selected === p.id && p.providers && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {p.providers.map(prov => (
                  <a key={prov.name} href={prov.href} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#2D4A2B', textDecoration: 'none', fontWeight: 500 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {prov.name} →
                  </a>
                ))}
              </div>
            )}
          </OptionCard>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <SkipButton onSkip={onSkip} />
        <button
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          style={{
            padding: '10px 24px', background: selected ? '#2D4A2B' : '#E8E4DC',
            color: selected ? '#fff' : '#9B9B9B',
            border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
            cursor: selected ? 'pointer' : 'not-allowed',
            fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function Step2CodeHosting({ onNext, onSkip, selected, onSelect }: {
  onNext: (choice: string) => void; onSkip: () => void;
  selected?: string | null; onSelect: (c: string) => void;
}) {
  return (
    <div>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 700, color: '#2A2A2A', marginBottom: 8, letterSpacing: '-0.5px' }}>
        Where should your code live?
      </h1>
      <p style={{ fontSize: 14, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', marginBottom: 28, lineHeight: 1.6 }}>
        Goblin can push your projects to GitHub automatically.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <OptionCard selected={selected === 'github'} onClick={() => onSelect('github')}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#2A2A2A', marginBottom: 4 }}>
            GitHub <span style={{ fontSize: 10, background: 'rgba(45,74,43,0.1)', color: '#2D4A2B', padding: '1px 6px', borderRadius: 4, fontWeight: 600, marginLeft: 6 }}>Recommended</span>
          </div>
          <div style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.5 }}>
            Connect your GitHub account. Push code with one click, open source or private.
          </div>
          {selected === 'github' && (
            <a
              href="/api/github/connect"
              onClick={e => e.stopPropagation()}
              style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#2D4A2B', fontWeight: 600, textDecoration: 'none' }}
            >
              Connect GitHub →
            </a>
          )}
        </OptionCard>

        <OptionCard selected={selected === 'gitlab'} onClick={() => onSelect('gitlab')} disabled>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#2A2A2A', marginBottom: 4 }}>
            GitLab <span style={{ fontSize: 10, background: '#F0ECE4', color: '#9B9B9B', padding: '1px 6px', borderRadius: 4, fontWeight: 600, marginLeft: 6 }}>Coming soon</span>
          </div>
          <div style={{ fontSize: 12, color: '#9B9B9B', lineHeight: 1.5 }}>
            GitLab support is planned for Phase 2. Use GitHub for now.
          </div>
        </OptionCard>

        <OptionCard selected={selected === 'goblin_cloud'} onClick={() => onSelect('goblin_cloud')}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#2A2A2A', marginBottom: 4 }}>Goblin Cloud only</div>
          <div style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.5 }}>
            Keep everything in Goblin. No GitHub needed. Download as ZIP anytime.
          </div>
        </OptionCard>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <SkipButton onSkip={onSkip} />
        <button
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          style={{
            padding: '10px 24px', background: selected ? '#2D4A2B' : '#E8E4DC',
            color: selected ? '#fff' : '#9B9B9B',
            border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
            cursor: selected ? 'pointer' : 'not-allowed',
            fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function Step3DeployTarget({ onNext, onSkip, selected, onSelect }: {
  onNext: (choice: string) => void; onSkip: () => void;
  selected?: string | null; onSelect: (c: string) => void;
}) {
  return (
    <div>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 700, color: '#2A2A2A', marginBottom: 8, letterSpacing: '-0.5px' }}>
        Where should your app go live?
      </h1>
      <p style={{ fontSize: 14, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', marginBottom: 28, lineHeight: 1.6 }}>
        You can always change this later — or skip it for now.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <OptionCard selected={selected === 'vercel'} onClick={() => onSelect('vercel')}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#2A2A2A', marginBottom: 4 }}>
            Vercel <span style={{ fontSize: 10, background: 'rgba(45,74,43,0.1)', color: '#2D4A2B', padding: '1px 6px', borderRadius: 4, fontWeight: 600, marginLeft: 6 }}>Recommended for web</span>
          </div>
          <div style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.5 }}>
            Deploy in seconds. Free tier available. Best for Next.js, React, and static sites.
          </div>
        </OptionCard>

        <OptionCard selected={selected === 'netlify'} onClick={() => onSelect('netlify')} disabled>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#2A2A2A', marginBottom: 4 }}>
            Netlify <span style={{ fontSize: 10, background: '#F0ECE4', color: '#9B9B9B', padding: '1px 6px', borderRadius: 4, fontWeight: 600, marginLeft: 6 }}>Coming soon</span>
          </div>
          <div style={{ fontSize: 12, color: '#9B9B9B', lineHeight: 1.5 }}>Netlify support is in Phase 2.</div>
        </OptionCard>

        <OptionCard selected={selected === 'preview_only'} onClick={() => onSelect('preview_only')}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#2A2A2A', marginBottom: 4 }}>Just preview in Goblin</div>
          <div style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.5 }}>
            No external deploy. See your app in the Preview tab — good for prototyping.
          </div>
        </OptionCard>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <SkipButton onSkip={onSkip} />
        <button
          onClick={() => selected ? onNext(selected) : onNext('skip')}
          style={{
            padding: '10px 24px', background: '#2D4A2B', color: '#fff',
            border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {selected ? 'Continue →' : 'Skip →'}
        </button>
      </div>
    </div>
  );
}

function Step4Done({ state }: { state: OnboardingState }) {
  const router = useRouter();

  const CHOICE_LABELS: Record<string, string> = {
    github: 'GitHub', goblin_cloud: 'Goblin Cloud', vercel: 'Vercel',
    preview_only: 'In-app preview', skip: 'Not set yet',
    byok: 'Your API key', no_key: 'Get API key', free_tier: 'Free pool',
  };

  const setupDone = [
    state.goal && `Goal: ${state.goal}`,
    state.ai_provider_choice && `AI: ${CHOICE_LABELS[state.ai_provider_choice] ?? state.ai_provider_choice}`,
    state.code_hosting_choice && `Code: ${CHOICE_LABELS[state.code_hosting_choice] ?? state.code_hosting_choice}`,
    state.deploy_choice && `Deploy: ${CHOICE_LABELS[state.deploy_choice] ?? state.deploy_choice}`,
  ].filter(Boolean);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, fontWeight: 700, color: '#2A2A2A', marginBottom: 8, letterSpacing: '-0.5px' }}>
        You&apos;re ready to build.
      </h1>
      <p style={{ fontSize: 14, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif', marginBottom: 28, lineHeight: 1.6 }}>
        Goblin is set up and ready. Start your first project.
      </p>

      {setupDone.length > 0 && (
        <div style={{
          background: 'rgba(45,74,43,0.04)', border: '1px solid rgba(45,74,43,0.12)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 28, textAlign: 'left',
        }}>
          {setupDone.map(item => (
            <div key={item} style={{ fontSize: 12, color: '#2D4A2B', fontFamily: 'DM Sans, sans-serif', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✓</span> {item}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => router.push('/dashboard')}
        style={{
          display: 'block', width: '100%',
          padding: '13px 0', background: '#2D4A2B', color: '#D4A94A',
          border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          marginBottom: 12,
        }}
      >
        Start your first project →
      </button>

      <button
        onClick={() => router.push('/dashboard/settings/keys')}
        style={{
          display: 'block', width: '100%',
          padding: '11px 0', background: 'transparent', color: '#2D4A2B',
          border: '1.5px solid rgba(45,74,43,0.3)', borderRadius: 10, fontSize: 13, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
        }}
      >
        Configure API keys
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resume = searchParams.get('resume') === 'true';

  const [step, setStep] = useState(0);
  const [state, setState] = useState<OnboardingState>({
    current_step: 0, completed: false,
  });
  const [loaded, setLoaded] = useState(false);

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/onboarding/state`, { headers });
        if (res.ok) {
          const data = await res.json() as OnboardingState;
          if (data.current_step !== undefined) {
            setState(data);
            if (resume && !data.completed) {
              setStep(data.current_step);
            }
          }
        }
      } catch { /* Start fresh */ }
      setLoaded(true);
    })();
  }, [resume]);

  const save = useCallback(async (update: Partial<OnboardingState>) => {
    const next = { ...state, ...update };
    setState(next);
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_URL}/api/onboarding/state`, {
        method: 'PUT', headers,
        body: JSON.stringify(next),
      });
    } catch { /* non-fatal */ }
  }, [state]);

  const goNext = (stepUpdate?: Partial<OnboardingState>) => {
    const nextStep = step + 1;
    save({ current_step: nextStep, ...stepUpdate });
    setStep(nextStep);
  };

  const skip = () => {
    const nextStep = step + 1;
    save({ current_step: nextStep, skipped_steps: [...(state.skipped_steps ?? []), step] });
    setStep(nextStep);
  };

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E8E4DC', borderTopColor: '#2D4A2B', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 64px' }}>
      {/* Logo */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#2D4A2B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#D4A94A', fontFamily: 'Fraunces, serif' }}>G</span>
        </div>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 700, color: '#2D4A2B', letterSpacing: '-0.3px' }}>
          Goblin
        </span>
      </div>

      <div style={{ width: '100%', maxWidth: 480 }}>
        <ProgressBar step={step} />

        {step === 0 && (
          <Step0Welcome
            onNext={(goal) => goNext({ goal })}
            onGoalSelect={(goal) => setState(s => ({ ...s, goal }))}
            selectedGoal={state.goal}
          />
        )}
        {step === 1 && (
          <Step1AiProvider
            onNext={(choice) => goNext({ ai_provider_choice: choice })}
            onSkip={skip}
            selected={state.ai_provider_choice}
            onSelect={(c) => setState(s => ({ ...s, ai_provider_choice: c }))}
          />
        )}
        {step === 2 && (
          <Step2CodeHosting
            onNext={(choice) => goNext({ code_hosting_choice: choice })}
            onSkip={skip}
            selected={state.code_hosting_choice}
            onSelect={(c) => setState(s => ({ ...s, code_hosting_choice: c }))}
          />
        )}
        {step === 3 && (
          <Step3DeployTarget
            onNext={(choice) => { goNext({ deploy_choice: choice }); }}
            onSkip={() => goNext({ deploy_choice: 'skip' })}
            selected={state.deploy_choice}
            onSelect={(c) => setState(s => ({ ...s, deploy_choice: c }))}
          />
        )}
        {step >= 4 && (
          <Step4Done state={state} />
        )}

        {step >= 4 && step < TOTAL_STEPS - 1 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={() => router.push('/dashboard')}
              style={{ background: 'none', border: 'none', color: '#9B9B9B', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textDecoration: 'underline' }}
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
