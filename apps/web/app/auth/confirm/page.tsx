'use client';

/**
 * U2 — the auth-link interstitial.
 *
 * Every auth mail (password reset, signup confirmation, email change, magic
 * link, invite) now lands HERE instead of redeeming its one-time token as a
 * side effect of being opened. Two defects motivated this page:
 *
 *  1. Cross-context failure (the founder's confirmed bug). The old reset link
 *     carried a PKCE `?code=` and the reset page called exchangeCodeForSession.
 *     PKCE needs the code_verifier cookie written by the browser that REQUESTED
 *     the reset — request it in the installed PWA, open the mail in Gmail →
 *     Safari, and there is no verifier, so the exchange fails and the page
 *     reported "Reset link expired or already used" about a link that was
 *     neither. verifyOtp({ token_hash, type }) carries no such requirement and
 *     works in ANY browser.
 *
 *  2. Redemption on GET. A mail scanner (or a link preview) that follows the
 *     URL would spend the single-use token before the user ever clicked. Here
 *     the GET renders a page and nothing else — only the button press calls
 *     verifyOtp — so a preflight fetch is harmless.
 *
 * The redemption is additionally guarded against a double run (React 18 effect
 * replay / remount / double tap), which was the third candidate for the
 * "already used" report.
 */

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { t } from '@/lib/use-lang';
import { useAuthLang } from '@/lib/use-auth-lang';

const VALID_TYPES: EmailOtpType[] = ['recovery', 'signup', 'invite', 'magiclink', 'email_change'];

function isValidType(value: string | null): value is EmailOtpType {
  return !!value && (VALID_TYPES as string[]).includes(value);
}

/** Where to land after a successful redemption, when the mail carried no `next`. */
function defaultNext(type: EmailOtpType): string {
  return type === 'recovery' ? '/auth/reset-password' : '/dashboard';
}

/** Only same-origin relative paths are honoured — never an open redirect. */
function safeNext(next: string | null, type: EmailOtpType): string {
  if (next && /^\/(?!\/)/.test(next)) return next;
  return defaultNext(type);
}

function ConfirmInner() {
  const router = useRouter();
  const params = useSearchParams();
  // U3: pre-auth surface — English by default, not German. See lib/use-auth-lang.ts.
  const lang = useAuthLang();

  const tokenHash = params.get('token_hash');
  const rawType = params.get('type');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One redemption per page load, whatever the UI does.
  const redeemed = useRef(false);

  const linkOk = !!tokenHash && isValidType(rawType);

  const headline = (type: EmailOtpType | null) => {
    switch (type) {
      case 'recovery': return t(lang, 'Neues Passwort setzen', 'Set a new password');
      case 'signup': return t(lang, 'E-Mail-Adresse bestätigen', 'Confirm your email address');
      case 'email_change': return t(lang, 'Neue Adresse bestätigen', 'Confirm your new address');
      case 'invite': return t(lang, 'Einladung annehmen', 'Accept your invitation');
      case 'magiclink': return t(lang, 'Bei Goblin anmelden', 'Sign in to Goblin');
      default: return t(lang, 'Link bestätigen', 'Confirm link');
    }
  };

  const lead = (type: EmailOtpType | null) => {
    switch (type) {
      case 'recovery':
        return t(lang,
          'Bestätige mit einem Klick, dass du diesen Link geöffnet hast — danach kannst du dein neues Passwort vergeben.',
          'Confirm with one click that you opened this link — then you can choose your new password.');
      case 'signup':
        return t(lang,
          'Bestätige mit einem Klick, dass diese E-Mail-Adresse dir gehört.',
          'Confirm with one click that this email address is yours.');
      default:
        return t(lang,
          'Bestätige mit einem Klick, dass du diesen Link geöffnet hast.',
          'Confirm with one click that you opened this link.');
    }
  };

  const cta = (type: EmailOtpType | null) => {
    switch (type) {
      case 'recovery': return t(lang, 'Neues Passwort setzen →', 'Set a new password →');
      case 'signup': return t(lang, 'E-Mail bestätigen →', 'Confirm email →');
      case 'email_change': return t(lang, 'Neue Adresse bestätigen →', 'Confirm new address →');
      case 'invite': return t(lang, 'Einladung annehmen →', 'Accept invitation →');
      default: return t(lang, 'Weiter →', 'Continue →');
    }
  };

  const redeem = async () => {
    if (!linkOk || redeemed.current) return;
    redeemed.current = true;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: rawType });

    if (err) {
      // Honest: at this point the token really was rejected — it is expired,
      // already used, or does not belong to this project. Allow another try in
      // case the failure was a network blip, but do not claim a cause we
      // cannot see.
      redeemed.current = false;
      setBusy(false);
      setError(t(lang,
        'Dieser Link ist abgelaufen oder wurde bereits verwendet. Fordere einen neuen an.',
        'This link has expired or has already been used. Request a new one.'));
      return;
    }

    router.replace(safeNext(params.get('next'), rawType));
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">Goblin.</div>
      <div className="auth-card-wrapper">
        {!linkOk ? (
          <>
            <h1 className="auth-card-title">{t(lang, 'Link unvollständig', 'Incomplete link')}</h1>
            <p className="auth-card-subtitle">
              {t(lang,
                'Diesem Link fehlen die Bestätigungsdaten. Das passiert, wenn er beim Weiterleiten gekürzt wurde. Fordere einen neuen an.',
                'This link is missing its confirmation data — which happens when it gets truncated on the way. Request a new one.')}
            </p>
            <p style={{ textAlign: 'center', marginTop: 16 }}>
              <a href="/login" style={{ color: 'var(--brand-green)', fontSize: 'var(--t-small-fs)', textDecoration: 'none' }}>
                {t(lang, '← Zurück zur Anmeldung', '← Back to sign in')}
              </a>
            </p>
          </>
        ) : (
          <>
            <h1 className="auth-card-title">{headline(rawType)}</h1>
            <p className="auth-card-subtitle">{lead(rawType)}</p>

            {error && (
              <p
                data-testid="auth-confirm-error"
                style={{ color: '#ef4444', fontSize: 'var(--t-small-fs)', textAlign: 'center', marginBottom: 14 }}
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={redeem}
              disabled={busy}
              data-testid="auth-confirm-submit"
              style={{
                width: '100%', height: 48,
                background: busy ? 'rgba(255,255,255,0.06)' : 'var(--brand-green)',
                color: busy ? 'rgba(255,255,255,0.35)' : '#fff',
                border: 'none', borderRadius: 10,
                fontSize: 'var(--t-small-fs)', fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? t(lang, 'Wird geprüft…', 'Checking…') : cta(rawType)}
            </button>

            {error && (
              <p style={{ textAlign: 'center', marginTop: 14 }}>
                <a href="/login" style={{ color: 'var(--brand-green)', fontSize: 'var(--t-small-fs)', textDecoration: 'none' }}>
                  {t(lang, '← Zurück zur Anmeldung', '← Back to sign in')}
                </a>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}
