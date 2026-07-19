'use client';

// LAUNCH-ASSIST U2: redeem a promo code that was entered at SIGNUP. Signup requires
// email confirmation, so there is no session at that moment — the code is stashed in
// localStorage (PENDING_PROMO_KEY) and this component, mounted on the first
// authenticated landing (/dashboard), redeems it once the session exists, then clears
// it. Renders a brief honest toast; renders nothing when there is no pending code.

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/use-lang';
import { redeemPromoCode, PENDING_PROMO_KEY } from '@/lib/promo-redeem';

export function PendingPromoRedeemer() {
  const lang = useLang();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let pending = '';
    try { pending = localStorage.getItem(PENDING_PROMO_KEY) ?? ''; } catch { /* ignore */ }
    if (!pending) return;
    // Clear immediately so a failed attempt (or a re-mount) never loops.
    try { localStorage.removeItem(PENDING_PROMO_KEY); } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      const res = await redeemPromoCode(pending, lang);
      if (cancelled) return;
      // noSession shouldn't happen here (we're authed), but if it does, re-stash so a
      // later authed load can retry.
      if (res.noSession) {
        try { localStorage.setItem(PENDING_PROMO_KEY, pending); } catch { /* ignore */ }
        return;
      }
      setToast(res.message);
      setTimeout(() => setToast(null), 4000);
    })();
    return () => { cancelled = true; };
  }, [lang]);

  if (!toast) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        maxWidth: 340, textAlign: 'center', zIndex: 60,
        background: 'var(--panel, #fff)', border: '1px solid var(--border)',
        color: 'var(--text)', padding: '12px 16px', borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.18)', fontSize: 13, fontFamily: 'var(--font-sans)',
      }}
    >
      {toast}
    </div>
  );
}
