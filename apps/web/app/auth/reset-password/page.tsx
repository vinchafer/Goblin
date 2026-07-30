'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { t } from '@/lib/use-lang';
import { useAuthLang } from '@/lib/use-auth-lang';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // U3: pre-auth surface — English by default, not German. See lib/use-auth-lang.ts.
  const lang = useAuthLang();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Stored as a KEY, not as finished text: useAuthLang() corrects from the default
  // on mount, so text captured inside the effect could freeze the wrong
  // language. Rendering resolves it with the language in force at paint.
  const [error, setError] = useState<'cross_context' | 'no_token' | null>(null);
  // U2 candidate (c): without this, a remount or an effect replay ran the
  // redemption twice — the second read of a one-time token reports "already
  // used", which is exactly the message the founder saw on fresh links.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    void (async () => {
      // A `code` in the URL is an EXPLICIT instruction about which account is
      // being reset, so it is honoured before any ambient session — otherwise
      // opening account A's link in a browser already signed in as B would
      // silently offer to change B's password instead.
      //
      // Legacy path: a PKCE link already sitting in someone's inbox. It works
      // in the browser that requested the reset; opened anywhere else the
      // code_verifier cookie is missing and the exchange genuinely cannot
      // succeed — so the message for this path is truthful.
      const code = searchParams.get('code');
      if (code) {
        const { error: err } = await supabase.auth.exchangeCodeForSession(code);
        if (err) setError('cross_context'); else setReady(true);
        return;
      }

      // New path: /auth/confirm already redeemed the token_hash with
      // verifyOtp, so a recovery session exists — in ANY browser, because
      // verifyOtp needs no code_verifier cookie. Straight to the form.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { setReady(true); return; }

      setError('no_token');
    })();

    return () => { sub.subscription.unsubscribe(); };
  // Runs once per mount — the `started` ref makes that explicit and the token
  // must never be redeemed a second time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error(t(lang, 'Das Passwort braucht mindestens 8 Zeichen.', 'Password must be at least 8 characters.')); return; }
    if (password !== confirm) { toast.error(t(lang, 'Die Passwörter stimmen nicht überein.', 'Passwords do not match.')); return; }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { toast.error(updateError.message); return; }
    toast.success(t(lang, 'Passwort geändert. Bitte melde dich neu an.', 'Password updated. Please sign in.'));
    router.push('/login');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(255,255,255,0.1)',
    borderRadius: 10, fontSize: 'var(--t-small-fs)', color: '#fff', outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  };

  const errorText = error === 'cross_context'
    ? t(lang,
        'Dieser Link konnte in diesem Browser nicht eingelöst werden. Fordere einen neuen Reset-Link an — der neue funktioniert in jedem Browser.',
        'This link could not be redeemed in this browser. Request a new reset link — the new one works in any browser.')
    : t(lang,
        'Dieser Link enthält keine Bestätigungsdaten. Fordere einen neuen Reset-Link an.',
        'This link carries no confirmation data. Request a new password reset.');

  return (
    <div className="auth-page">
      <div className="auth-logo">Goblin.</div>
      <div className="auth-card-wrapper">
        <h1 className="auth-card-title">{t(lang, 'Neues Passwort setzen', 'Set new password')}</h1>
        <p className="auth-card-subtitle">
          {t(lang, 'Wähle ein starkes Passwort für dein Konto.', 'Choose a strong password for your account.')}
        </p>
        {error ? (
          <div style={{ textAlign: 'center' }}>
            <p data-testid="reset-error" style={{ color: '#ef4444', fontSize: 'var(--t-small-fs)', marginBottom: 16 }}>{errorText}</p>
            <a href="/login" style={{ color: 'var(--brand-green)', fontSize: 'var(--t-small-fs)', textDecoration: 'none' }}>
              {t(lang, '← Zurück zur Anmeldung', '← Back to sign in')}
            </a>
          </div>
        ) : ready ? (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t(lang, 'Neues Passwort (min. 8 Zeichen)', 'New password (min. 8 chars)')}
              data-testid="reset-password-new"
              required
              autoComplete="new-password"
              style={inputStyle}
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={t(lang, 'Passwort bestätigen', 'Confirm password')}
              data-testid="reset-password-confirm"
              required
              autoComplete="new-password"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              style={{
                height: 48,
                background: password && confirm ? 'var(--brand-green)' : 'rgba(255,255,255,0.06)',
                color: password && confirm ? '#fff' : 'rgba(255,255,255,0.2)',
                border: 'none', borderRadius: 10,
                fontSize: 'var(--t-small-fs)', fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? t(lang, 'Wird gespeichert…', 'Updating…') : t(lang, 'Passwort setzen', 'Set password')}
            </button>
          </form>
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 'var(--t-small-fs)', textAlign: 'center' }}>
            {t(lang, 'Reset-Link wird geprüft…', 'Verifying reset link…')}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
