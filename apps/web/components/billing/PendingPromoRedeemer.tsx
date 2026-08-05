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

      // FINAL-POLISH · U2 — never lose a code to a transient failure.
      //
      // This used to re-stash ONLY on `noSession`. Every other non-verdict — a dropped
      // network, a 5xx, the API not reachable from a cold landing — cleared the code
      // above and then dropped it on the floor, silently. The user's next stop is the
      // trial gate, which asks for a code again; they paste the same one, it works, and
      // it looks as though single-use is broken when in truth the first attempt never
      // reached the server. Re-stash unless the server actually returned a verdict.
      //
      // `status` is present iff the API answered (`ok`, `invalid`, `already_redeemed`, …).
      // Its absence means we never got an answer, so the code is still unspent.
      const gotVerdict = typeof res.status === 'string' && res.status.length > 0;
      if (!gotVerdict) {
        try { localStorage.setItem(PENDING_PROMO_KEY, pending); } catch { /* ignore */ }
        return;
      }

      // The redemption itself already happened server-side; only the toast is ours to
      // skip once this component is gone (the trial-gate redirect unmounts us).
      if (cancelled) return;
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
