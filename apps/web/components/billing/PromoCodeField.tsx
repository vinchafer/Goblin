'use client';

// LAUNCH-ASSIST U2: the "Ich habe einen Code" redemption field for settings/billing.
// Distinct from the invite-code field (which grants a permanent comp) — this redeems a
// promo code for 30 days of the top plan. On success it reloads so the new plan shows.

import { useState } from 'react';
import { useLang, t } from '@/lib/use-lang';
import { redeemPromoCode } from '@/lib/promo-redeem';

export function PromoCodeField() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await redeemPromoCode(code, lang);
    setMsg({ ok: res.ok, text: res.message });
    setBusy(false);
    if (res.ok) setTimeout(() => window.location.reload(), 1400);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: 8, background: 'none', border: 'none', color: 'var(--text-meta)',
          fontSize: 13, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {t(lang, 'Hast du einen Goblin-Code?', 'Have a Goblin code?')}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, padding: 16, border: '1px solid var(--rule, rgba(0,0,0,0.1))', borderRadius: 10, background: 'var(--surface)' }}>
      <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4, fontWeight: 600 }}>
        {t(lang, 'Code einlösen', 'Redeem a code')}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-meta)', marginBottom: 8 }}>
        {t(lang, '30 Tage die beste Version — einmalig einlösbar.', '30 days of the top plan — one-time redemption.')}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="GOBLIN-XXXX-XXXX"
          autoFocus
          style={{
            flex: 1, padding: '8px 12px', border: '1px solid var(--rule, rgba(0,0,0,0.15))',
            borderRadius: 8, background: 'var(--bg)', color: 'var(--text)',
            fontSize: 'var(--t-small-fs)', fontFamily: 'var(--font-mono, monospace)', textTransform: 'uppercase',
          }}
        />
        <button
          onClick={submit}
          disabled={busy || code.trim().length < 3}
          style={{
            padding: '8px 16px', borderRadius: 8, minHeight: 40, border: 'none',
            background: 'var(--brand-green)', color: 'var(--bone, #F4ECD8)',
            fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
            opacity: busy || code.trim().length < 3 ? 0.6 : 1, fontFamily: 'var(--font-sans)',
          }}
        >
          {busy ? '…' : t(lang, 'Einlösen', 'Redeem')}
        </button>
      </div>
      {msg && (
        <div style={{ marginTop: 8, fontSize: 'var(--t-caption-fs)', color: msg.ok ? 'var(--brand-green)' : 'var(--danger, #c64a4a)' }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
