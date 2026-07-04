'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

export const dynamic = 'force-dynamic';

type Provider = 'google' | 'github';
type Mode = 'signup' | 'login';
type AuthMethod = 'magic' | 'password';

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="31.4" strokeDashoffset="10" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

const FIELD: React.CSSProperties = {
  width: '100%', height: 46, padding: '0 14px',
  background: 'var(--panel)', color: 'var(--text)',
  border: '1.5px solid var(--border)', borderRadius: 10,
  fontSize: 'var(--t-small-fs)', fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const PRIMARY_BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  width: '100%', height: 46,
  background: 'var(--brand-green)', color: '#fff',
  border: 'none', borderRadius: 10,
  fontSize: 'var(--t-small-fs)', fontWeight: 600,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer', transition: 'background 0.15s, box-shadow 0.15s',
  boxShadow: '0 1px 2px rgba(45,74,43,0.18)',
};

const OAUTH_CONFIG: Record<Provider, { label: string; icon: React.ReactNode; }> = {
  google: { label: 'Continue with Google', icon: <GoogleIcon /> },
  github: { label: 'Continue with GitHub', icon: <GitHubIcon /> },
};

function OAuthButton({ provider, onClick, loading }: { provider: Provider; onClick: () => void; loading: boolean }) {
  const cfg = OAUTH_CONFIG[provider];
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        width: '100%', height: 46,
        background: hovered ? 'var(--subtle)' : 'var(--panel)',
        color: 'var(--text)',
        border: '1.5px solid var(--border)', borderRadius: 10,
        fontSize: 'var(--t-small-fs)', fontWeight: 500,
        fontFamily: 'var(--font-sans)',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {loading ? <Spinner /> : cfg.icon}
      {cfg.label}
    </button>
  );
}

function PasswordStrengthBar({ strength }: { strength: { score: number; label: string; color: string } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: 'var(--subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(strength.score / 5) * 100}%`, background: strength.color, transition: 'width 0.2s, background 0.2s' }} />
      </div>
      <span style={{ fontSize: 11, color: strength.color, minWidth: 40, fontWeight: 600 }}>{strength.label}</span>
    </div>
  );
}

const VALUE_BULLETS = [
  { title: 'Build from your phone', body: 'Real coding sessions on iPad, iPhone, anywhere. Not a watered-down chat.' },
  { title: 'Bring your own keys', body: 'Anthropic, OpenAI, Groq, Mistral — encrypted at rest, never sent to us.' },
  { title: 'Ship to GitHub + Vercel', body: 'One click from chat to a saved version to live preview.' },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('magic');
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) toast.error(decodeURIComponent(error));
    const m = searchParams.get('mode');
    if (m === 'signup') setMode('signup');
  }, [searchParams]);

  const switchMode = (m: Mode) => { setMode(m); setEmailSent(false); setResetSent(false); setPassword(''); setTermsAccepted(false); };
  const switchMethod = (m: AuthMethod) => { setAuthMethod(m); setEmailSent(false); setResetSent(false); setPassword(''); };

  const passwordStrength = (pw: string): { score: number; label: string; color: string } => {
    if (pw.length === 0) return { score: 0, label: '', color: 'transparent' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { score, label: 'Weak', color: 'var(--danger)' };
    if (score <= 3) return { score, label: 'Fair', color: 'var(--gold-700)' };
    return { score, label: 'Strong', color: 'var(--success)' };
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || passwordLoading) return;
    if (mode === 'signup' && !termsAccepted) { toast.error('Please accept the Terms to continue.'); return; }
    if (mode === 'signup' && password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    setPasswordLoading(true);
    try {
      const supabase = createClient();
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setEmailSent(true);
      } else {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

        // 11B-3: account lockout pre-flight.
        try {
          const lockoutResp = await fetch(
            `${apiBase}/api/auth/lockout-check?email=${encodeURIComponent(email.trim())}`,
          );
          const lockout = await lockoutResp.json().catch(() => ({ locked: false }));
          if (lockout.locked) {
            const mins = Math.ceil((lockout.retryAfterSeconds ?? 0) / 60);
            toast.error(`Account vorübergehend gesperrt. Versuche es in ${mins} Min erneut.`);
            return;
          }
        } catch {
          /* lockout-check unavailable — fail-open, attempt sign-in */
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

        // Log the attempt either way (fire-and-forget).
        void fetch(`${apiBase}/api/auth/login-attempt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            success: !error,
            failureReason: error?.message,
          }),
        }).catch(() => undefined);

        if (error) {
          if (error.message.toLowerCase().includes('invalid')) toast.error('Incorrect email or password.');
          else throw error;
          return;
        }
        // 11B-2: if 2FA is enabled for this user, gate at the 2FA step before
        // we drop them into /dashboard. We stay signed-in but the 2FA page
        // signs out if verification fails or is abandoned.
        try {
          const r = await fetch(`${apiBase}/api/auth/2fa/status`, {
            headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
          });
          const s = await r.json().catch(() => ({ enabled: false }));
          if (s.enabled && data.user?.id) {
            router.push(`/login/2fa?userId=${encodeURIComponent(data.user.id)}`);
            return;
          }
        } catch {
          /* if status lookup fails, fall through to dashboard — defence
             still happens at server side for any sensitive endpoints */
        }

        // 11B-4: register the just-issued session so it shows up in Active
        // Sessions and triggers a "new device" email if needed. Fire and
        // forget — never block the redirect.
        void fetch(`${apiBase}/api/account/sessions/register`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        }).catch(() => undefined);

        router.push('/dashboard');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed.');
    } finally { setPasswordLoading(false); }
  };

  const sendPasswordReset = async () => {
    if (!email.trim()) { toast.error('Enter your email first.'); return; }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) toast.error(error.message);
    else setResetSent(true);
  };

  const signInWithOAuth = async (provider: Provider) => {
    if (oauthLoading) return;
    setOauthLoading(provider);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Force the provider's account chooser so a user signed into ONE
          // Google account still gets to pick (or add) an account instead of
          // being silently reused. Covers both "Continue with Google" and
          // "Create account" — they share this single call.
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (err) {
      setOauthLoading(null);
      toast.error(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    }
  };

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || emailLoading) return;
    setEmailLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: mode === 'signup' },
      });
      if (error) {
        if (error.message.toLowerCase().includes('signup') || error.message.toLowerCase().includes('not found')) {
          toast.error('No account found. Switch to "Create account" to sign up.');
        } else throw error;
        return;
      }
      setEmailSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send magic link.');
    } finally { setEmailLoading(false); }
  };

  const SuccessBox = ({ icon, title, body, onBack }: { icon: string; title: string; body: React.ReactNode; onBack: () => void }) => (
    <div style={{
      textAlign: 'center', padding: '24px 20px',
      background: 'rgba(74,124,59,0.06)', border: '1px solid rgba(74,124,59,0.2)',
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--success)', fontWeight: 600, margin: '0 0 4px' }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>{body}</p>
      <button
        onClick={onBack}
        style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--meta)', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
      >
        ← Use a different email
      </button>
    </div>
  );

  return (
    <div style={{
      minHeight: '100dvh', display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      background: 'var(--paper)',
      fontFamily: 'var(--font-sans)',
    }} className="auth-grid">

      <style>{`
        @media (max-width: 900px) {
          .auth-grid { grid-template-columns: 1fr !important; }
          .auth-brand-panel { display: none !important; }
        }
        .auth-grid input::placeholder { color: var(--disabled); }
        .auth-grid input:focus { border-color: var(--brand-green) !important; box-shadow: 0 0 0 3px rgba(45,74,43,0.1) !important; }
      `}</style>

      {/* LEFT — Brand panel */}
      <div
        className="auth-brand-panel"
        style={{
          background: 'linear-gradient(135deg, var(--green-800) 0%, var(--brand-green) 100%)',
          color: '#fff',
          padding: '48px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Dot pattern overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4,
          backgroundImage: 'radial-gradient(circle, rgba(212,169,74,0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />

        {/* Logo + tagline */}
        <Link
          href="/"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            textDecoration: 'none', color: 'inherit', position: 'relative', zIndex: 1,
            width: 'fit-content',
          }}
        >
          <GoblinLogo state="idle" size={28} variant="gold" />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px' }}>
            Goblin<span style={{ color: 'var(--brand-gold)' }}>.</span>
          </span>
        </Link>

        {/* Value props */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 700,
            letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 32,
            maxWidth: 380,
          }}>
            The cloud workshop<br />
            <span style={{ color: 'var(--brand-gold)', fontStyle: 'italic' }}>for builders.</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 380 }}>
            {VALUE_BULLETS.map(b => (
              <div key={b.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, marginTop: 4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'rgba(212,169,74,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--brand-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 'var(--t-small-fs)', fontWeight: 600, marginBottom: 2 }}>{b.title}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{b.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — security badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 'var(--t-caption-fs)', color: 'rgba(255,255,255,0.55)',
          position: 'relative', zIndex: 1, width: 'fit-content',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          AES-256 encrypted · Keys never leave your account
        </div>
      </div>

      {/* RIGHT — Form panel */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', minHeight: '100dvh',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile logo */}
          <Link
            href="/"
            className="mobile-only"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              textDecoration: 'none', marginBottom: 24, justifyContent: 'center',
            }}
          >
            <GoblinLogo state="idle" size={24} variant="gold" />
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: 'var(--brand-green)', fontWeight: 700 }}>
              Goblin<span style={{ color: 'var(--brand-gold)' }}>.</span>
            </span>
          </Link>

          {/* Header */}
          <h1 style={{
            fontFamily: 'var(--font-sans)', fontSize: 28, color: 'var(--brand-green)',
            fontWeight: 700, letterSpacing: '-0.6px', marginBottom: 6,
          }}>
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--meta)', marginBottom: 28, lineHeight: 1.5 }}>
            {mode === 'signup'
              ? <>Free during beta · No credit card</>
              : <>Sign in to continue building.</>}
          </p>

          {/* OAuth first (preferred path) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <OAuthButton provider="google" onClick={() => signInWithOAuth('google')} loading={oauthLoading === 'google'} />
            <OAuthButton provider="github" onClick={() => signInWithOAuth('github')} loading={oauthLoading === 'github'} />
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 18px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--div)' }} />
            <span style={{ fontSize: 11, color: 'var(--meta)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              or with email
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--div)' }} />
          </div>

          {/* Auth method toggle */}
          <div style={{
            display: 'flex', gap: 0,
            background: 'var(--subtle)', border: '1px solid var(--div)',
            borderRadius: 10, padding: 3, marginBottom: 14,
          }}>
            {(['magic', 'password'] as AuthMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMethod(m)}
                style={{
                  flex: 1, height: 32,
                  background: authMethod === m ? 'var(--panel)' : 'none',
                  boxShadow: authMethod === m ? 'var(--shadow-sm)' : 'none',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 500,
                  color: authMethod === m ? 'var(--text)' : 'var(--meta)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'magic' ? 'Magic Link' : 'Password'}
              </button>
            ))}
          </div>

          {/* Magic Link */}
          {authMethod === 'magic' && (emailSent ? (
            <SuccessBox
              icon="📬"
              title="Magic link sent"
              body={<>Check <strong style={{ color: 'var(--text)' }}>{email}</strong> and click the link.</>}
              onBack={() => setEmailSent(false)}
            />
          ) : (
            <form onSubmit={signInWithEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={FIELD}
              />
              <button
                type="submit"
                disabled={emailLoading || !email.trim()}
                style={{
                  ...PRIMARY_BTN,
                  background: email.trim() ? 'var(--brand-green)' : 'var(--subtle)',
                  color: email.trim() ? '#fff' : 'var(--disabled)',
                  boxShadow: email.trim() ? PRIMARY_BTN.boxShadow : 'none',
                  cursor: emailLoading || !email.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {emailLoading ? <Spinner /> : null}
                {emailLoading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          ))}

          {/* Password */}
          {authMethod === 'password' && emailSent && (
            <SuccessBox
              icon="📬"
              title="Verify your email"
              body={<>Check <strong style={{ color: 'var(--text)' }}>{email}</strong> and click the link.</>}
              onBack={() => { setEmailSent(false); setResetSent(false); }}
            />
          )}
          {authMethod === 'password' && !emailSent && resetSent && (
            <SuccessBox
              icon="🔑"
              title="Reset link sent"
              body={<>Check <strong style={{ color: 'var(--text)' }}>{email}</strong>.</>}
              onBack={() => setResetSent(false)}
            />
          )}
          {authMethod === 'password' && !emailSent && !resetSent && (
            <form onSubmit={signInWithPassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                style={FIELD}
              />
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Create password (min. 8 chars)' : 'Password'}
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  style={{ ...FIELD, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--meta)', padding: 4, display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--meta)')}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {mode === 'signup' && password.length > 0 && (
                <PasswordStrengthBar strength={passwordStrength(password)} />
              )}
              {mode === 'signup' && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    style={{ accentColor: 'var(--brand-green)', width: 14, height: 14, marginTop: 2 }}
                  />
                  <span>
                    I agree to the{' '}
                    <a href="/terms" style={{ color: 'var(--brand-green)', textDecoration: 'none' }}>Terms</a>
                    {' '}and{' '}
                    <a href="/privacy" style={{ color: 'var(--brand-green)', textDecoration: 'none' }}>Privacy Policy</a>
                  </span>
                </label>
              )}
              <button
                type="submit"
                disabled={passwordLoading || !email.trim() || !password || (mode === 'signup' && !termsAccepted)}
                style={{
                  ...PRIMARY_BTN,
                  background: (email.trim() && password) ? 'var(--brand-green)' : 'var(--subtle)',
                  color: (email.trim() && password) ? '#fff' : 'var(--disabled)',
                  boxShadow: (email.trim() && password) ? PRIMARY_BTN.boxShadow : 'none',
                  cursor: passwordLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {passwordLoading ? <Spinner /> : null}
                {passwordLoading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={sendPasswordReset}
                  style={{
                    background: 'none', border: 'none', color: 'var(--meta)',
                    fontSize: 'var(--t-caption-fs)', cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'right', padding: 0, marginTop: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-green)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--meta)')}
                >
                  Forgot password?
                </button>
              )}
            </form>
          )}

          {/* Mode switcher */}
          <p style={{
            textAlign: 'center', marginTop: 28, fontSize: 13, color: 'var(--meta)',
            paddingTop: 20, borderTop: '1px solid var(--div)',
          }}>
            {mode === 'signup' ? 'Already have an account? ' : 'New to Goblin? '}
            <button
              onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--brand-green)', fontWeight: 600, fontSize: 13,
                fontFamily: 'inherit', textDecoration: 'none', padding: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {mode === 'signup' ? 'Sign in →' : 'Create an account →'}
            </button>
          </p>

          {/* Footer */}
          <p style={{
            marginTop: 24, fontSize: 11, color: 'var(--disabled)',
            textAlign: 'center', lineHeight: 1.7,
          }}>
            By continuing you agree to our{' '}
            <a href="/terms" style={{ color: 'var(--meta)', textDecoration: 'none' }}>Terms</a>
            {' · '}
            <a href="/privacy" style={{ color: 'var(--meta)', textDecoration: 'none' }}>Privacy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
