'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

type Provider = 'google' | 'github' | 'apple';

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

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

const PROVIDER_CONFIG: Record<Provider, {
  label: string;
  icon: React.ReactNode;
  bg: string;
  color: string;
  border: string;
  hoverBg: string;
}> = {
  google: {
    label: 'Sign in with Google',
    icon: <GoogleIcon />,
    bg: '#ffffff',
    color: '#3c4043',
    border: '#dadce0',
    hoverBg: '#f8f9fa',
  },
  github: {
    label: 'Sign in with GitHub',
    icon: <GitHubIcon />,
    bg: '#24292e',
    color: '#ffffff',
    border: '#24292e',
    hoverBg: '#2f363d',
  },
  apple: {
    label: 'Sign in with Apple',
    icon: <AppleIcon />,
    bg: '#000000',
    color: '#ffffff',
    border: '#000000',
    hoverBg: '#1a1a1a',
  },
};

function OAuthButton({ provider, onClick, loading }: {
  provider: Provider;
  onClick: () => void;
  loading: boolean;
}) {
  const cfg = PROVIDER_CONFIG[provider];
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
        width: '100%', height: 48,
        background: hovered ? cfg.hoverBg : cfg.bg,
        color: cfg.color,
        border: `1.5px solid ${cfg.border}`,
        borderRadius: 10,
        fontSize: 15, fontWeight: 500,
        fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'transform 0.15s, background 0.15s',
        transform: hovered && !loading ? 'translateY(-1px)' : 'none',
      }}
    >
      {loading ? <Spinner /> : cfg.icon}
      {cfg.label}
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<Provider | null>(null);
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      toast.error(decodeURIComponent(error));
    }
  }, [searchParams]);

  const signIn = async (provider: Provider) => {
    if (loading) return;
    setLoading(provider);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Browser will redirect — keep spinner active
    } catch (err: unknown) {
      setLoading(null);
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
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setEmailSent(true);
      toast.success('Magic link sent! Check your inbox.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send magic link.');
    } finally {
      setEmailLoading(false);
    }
  };

  const features = [
    { icon: '⚡', text: 'No token panic — ever' },
    { icon: '📱', text: 'Build from your phone' },
    { icon: '🚀', text: 'Ship to GitHub in one tap' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,900;1,900&display=swap');
        .login-left { display: flex; }
        .login-mobile-header { display: none; }
        @media (max-width: 768px) {
          .login-left { display: none !important; }
          .login-mobile-header { display: block !important; }
          .login-right { padding: 32px 24px !important; }
        }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>

        {/* Left — Brand panel */}
        <div
          className="login-left"
          style={{
            width: '44%', background: 'var(--moss)',
            padding: '52px 48px',
            flexDirection: 'column', justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          {/* Logo */}
          <div style={{
            fontFamily: 'Fraunces, serif', fontSize: 26,
            color: 'var(--ochre)', fontWeight: 700, letterSpacing: '-0.5px',
          }}>
            Goblin.
          </div>

          {/* Tagline block */}
          <div>
            <h1 style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 46, fontWeight: 900,
              color: '#ffffff', lineHeight: 1.1,
              letterSpacing: '-2px', marginBottom: 32,
            }}>
              The cloud<br />
              workshop for<br />
              <em style={{ fontStyle: 'italic', color: 'var(--ochre)' }}>builders.</em>
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {features.map(f => (
                <div key={f.text} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  fontSize: 14, color: 'rgba(255,255,255,0.72)',
                  fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(212,169,74,0.12)',
                    border: '1px solid rgba(212,169,74,0.3)',
                    display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 13, flexShrink: 0,
                  }}>
                    {f.icon}
                  </span>
                  {f.text}
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'DM Sans, sans-serif' }}>
            © 2026 Goblin · <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
          </div>
        </div>

        {/* Right — Login form */}
        <div
          className="login-right"
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '48px 40px',
          }}
        >
          {/* Mobile-only mini header */}
          <div className="login-mobile-header" style={{ marginBottom: 32, textAlign: 'center' }}>
            <div style={{
              fontFamily: 'Fraunces, serif', fontSize: 24,
              color: 'var(--moss)', fontWeight: 700,
            }}>
              Goblin.
            </div>
          </div>

          {/* Card */}
          <div style={{
            width: '100%', maxWidth: 400,
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid var(--goblin-border)',
            padding: '40px 36px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{
              fontFamily: 'Fraunces, serif', fontSize: 28,
              color: 'var(--bark)', fontWeight: 700,
              letterSpacing: '-0.8px', marginBottom: 6,
            }}>
              Welcome to Goblin
            </h2>
            <p style={{
              fontSize: 14, color: 'var(--goblin-meta)',
              fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
              marginBottom: 32, lineHeight: 1.5,
            }}>
              Sign in to continue building
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <OAuthButton provider="google" onClick={() => signIn('google')} loading={loading === 'google'} />
              <OAuthButton provider="github" onClick={() => signIn('github')} loading={loading === 'github'} />
              <OAuthButton provider="apple"  onClick={() => signIn('apple')}  loading={loading === 'apple'}  />
            </div>

            {/* Divider */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              margin: '24px 0 20px',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--goblin-border)' }} />
              <span style={{ fontSize: 12, color: 'var(--goblin-meta)', fontFamily: 'DM Sans, sans-serif' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--goblin-border)' }} />
            </div>

            {/* Email — Magic Link */}
            {emailSent ? (
              <div style={{
                textAlign: 'center', padding: '16px 12px',
                background: 'rgba(45,74,43,0.06)', borderRadius: 10,
                border: '1px solid rgba(45,74,43,0.15)',
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📬</div>
                <p style={{ fontSize: 13, color: 'var(--goblin-moss)', fontWeight: 500, margin: 0 }}>
                  Magic link sent to <strong>{email}</strong>
                </p>
                <p style={{ fontSize: 12, color: 'var(--goblin-meta)', margin: '4px 0 0' }}>
                  Check your inbox and click the link to sign in.
                </p>
              </div>
            ) : (
              <form onSubmit={signInWithEmail} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  style={{
                    width: '100%', height: 48, padding: '0 14px',
                    border: '1.5px solid var(--goblin-border)',
                    borderRadius: 10, fontSize: 14,
                    fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
                    color: 'var(--goblin-slate)', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--goblin-moss)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--goblin-border)')}
                />
                <button
                  type="submit"
                  disabled={emailLoading || !email.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', height: 48,
                    background: email.trim() ? 'var(--goblin-moss)' : 'var(--goblin-border)',
                    color: email.trim() ? '#fff' : 'var(--goblin-meta)',
                    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500,
                    fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
                    cursor: emailLoading || !email.trim() ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {emailLoading ? <Spinner /> : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  )}
                  {emailLoading ? 'Sending…' : 'Continue with Email'}
                </button>
              </form>
            )}

            {/* Footer */}
            <p style={{
              marginTop: 24, fontSize: 11,
              color: 'var(--goblin-meta)',
              fontFamily: 'DM Sans, sans-serif',
              textAlign: 'center', lineHeight: 1.6,
            }}>
              By signing in you agree to our{' '}
              <a href="/terms" style={{ color: 'var(--goblin-moss)', textDecoration: 'none' }}>Terms</a>
              {' '}and{' '}
              <a href="/privacy" style={{ color: 'var(--goblin-moss)', textDecoration: 'none' }}>Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
