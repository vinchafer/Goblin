'use client';

// LAUNCH-ASSIST U2 — founder promo-code console. Same gate as every /admin page
// (the layout founder-check + the /api/admin/[...path] proxy inject the admin key;
// a non-founder never reaches the data). Mobile-first (the founder runs this from an
// iPhone): a single narrow column, wrapping rows, touch-sized controls, no terminal.

import { useEffect, useState, useCallback } from 'react';
import { readMutationError } from '@/lib/admin/mutation-error';

const ADMIN_BASE = '/api/admin';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface PromoRow {
  code: string;
  tier: string;
  duration_days: number;
  created_batch: string;
  label: string | null;
  redeemed: boolean;
  redeemed_at: string | null;
  revoked: boolean;
  redeemer_email: string | null;
  created_at: string;
}

const card: React.CSSProperties = {
  background: 'var(--panel)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 16, marginBottom: 14,
};
const input: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)',
};
const btn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, minHeight: 40, border: 'none', cursor: 'pointer',
  background: 'var(--brand-green)', color: 'var(--bone, #F4ECD8)', fontSize: 13, fontWeight: 600,
};
const ghostBtn: React.CSSProperties = {
  ...btn, background: 'transparent', color: 'var(--brand-green)', border: '1px solid var(--border)',
};

export default function AdminPromoPage() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // new-batch form (sensible defaults: 10 / power / 30)
  const [count, setCount] = useState(10);
  const [tier, setTier] = useState('power');
  const [days, setDays] = useState(30);
  const [batchLabel, setBatchLabel] = useState('');
  const [genBusy, setGenBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${ADMIN_BASE}/promo`, { headers: JSON_HEADERS });
    if (r.ok) {
      const d = await r.json();
      setRows(d.codes ?? []);
      setAvailable(d.available !== false);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(`${label} kopiert`);
    } catch {
      flash('Kopieren nicht möglich — bitte manuell markieren');
    }
  }

  async function saveLabel(code: string, label: string) {
    // U5.1: only claim success when the save actually succeeded — this used to
    // flash "Label gespeichert" unconditionally, even on a failed request.
    try {
      const res = await fetch(`${ADMIN_BASE}/promo/${encodeURIComponent(code)}`, {
        method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ label }),
      });
      const err = await readMutationError(res, 'de');
      flash(err ?? 'Label gespeichert');
    } catch {
      flash('Label speichern fehlgeschlagen — Netzwerkfehler.');
    }
  }

  async function generate() {
    setGenBusy(true);
    const r = await fetch(`${ADMIN_BASE}/promo/batch`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ count, tier, days, batch: batchLabel.trim() || undefined }),
    });
    setGenBusy(false);
    if (r.ok) {
      const d = await r.json();
      flash(`${d.created} Codes erstellt (${d.batch})`);
      setBatchLabel('');
      await load();
    } else {
      const d = await r.json().catch(() => ({}));
      flash(d.error ?? 'Erstellen fehlgeschlagen');
    }
  }

  // group by batch, newest first (rows already come newest-first)
  const batches = Array.from(new Set(rows.map((r) => r.created_batch)));

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 2px' }}>Promo-Codes</h1>
      <p style={{ fontSize: 12.5, color: 'var(--meta)', marginBottom: 16 }}>
        30 Tage beste Version, einmalig einlösbar. Labels & neue Batches direkt vom iPhone — kein Terminal.
      </p>

      {!available && (
        <div style={{ ...card, borderColor: 'var(--warning, #b8860b)' }}>
          <b>Migration 0098 noch nicht angewendet.</b> Wende sie im Supabase-Studio an — danach erscheinen
          hier die 30 „launch-1“-Codes.
        </div>
      )}

      {/* New batch */}
      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Neue Batch generieren</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--meta)' }}>Anzahl
            <input type="number" min={1} max={200} value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
              style={{ ...input, width: 72, marginLeft: 6 }} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--meta)' }}>Tier
            <select value={tier} onChange={(e) => setTier(e.target.value)} style={{ ...input, marginLeft: 6 }}>
              <option value="power">power (Top)</option>
              <option value="pro">pro</option>
              <option value="build">build</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--meta)' }}>Tage
            <input type="number" min={1} max={365} value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10) || 30)}
              style={{ ...input, width: 64, marginLeft: 6 }} />
          </label>
          <input placeholder="Batch-Name (optional)" value={batchLabel}
            onChange={(e) => setBatchLabel(e.target.value)} style={{ ...input, flex: '1 1 140px' }} />
          <button onClick={generate} disabled={genBusy} style={btn}>
            {genBusy ? '…' : 'Generieren'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--meta)' }}>Lädt…</div>
      ) : (
        batches.map((batch) => {
          const list = rows.filter((r) => r.created_batch === batch);
          const unredeemed = list.filter((r) => !r.redeemed && !r.revoked);
          return (
            <div key={batch} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{batch}</span>
                <span style={{ fontSize: 11.5, color: 'var(--meta)' }}>
                  {list.length} Codes · {unredeemed.length} offen
                </span>
                <button
                  onClick={() => copyText(unredeemed.map((r) => r.code).join('\n'), `${unredeemed.length} offene Codes`)}
                  disabled={unredeemed.length === 0}
                  style={{ ...ghostBtn, marginLeft: 'auto', minHeight: 34, padding: '6px 12px' }}>
                  Liste kopieren
                </button>
              </div>

              {list.map((r) => (
                <div key={r.code} style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  padding: '8px 0', borderTop: '1px solid var(--border)',
                }}>
                  <code style={{
                    fontFamily: 'var(--font-mono, monospace)', fontSize: 12.5,
                    textDecoration: r.revoked ? 'line-through' : 'none',
                    opacity: r.revoked ? 0.5 : 1, flex: '0 0 auto',
                  }}>{r.code}</code>
                  <span style={{
                    fontSize: 10.5, padding: '1px 6px', borderRadius: 999,
                    background: r.redeemed ? 'var(--brand-green)' : 'var(--bg-subtle, rgba(0,0,0,0.06))',
                    color: r.redeemed ? 'var(--bone, #F4ECD8)' : 'var(--meta)',
                  }}>
                    {r.redeemed ? 'eingelöst' : 'offen'}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--meta)' }}>{r.tier}/{r.duration_days}T</span>
                  {r.redeemed && (
                    <span style={{ fontSize: 10.5, color: 'var(--meta)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.redeemer_email ?? '—'}{r.redeemed_at ? ` · ${new Date(r.redeemed_at).toLocaleDateString('de-DE')}` : ''}
                    </span>
                  )}
                  <input
                    defaultValue={r.label ?? ''}
                    placeholder="wem gegeben…"
                    onBlur={(e) => { if ((e.target.value ?? '') !== (r.label ?? '')) saveLabel(r.code, e.target.value); }}
                    style={{ ...input, flex: '1 1 120px', fontSize: 12, minHeight: 34 }}
                  />
                </div>
              ))}
            </div>
          );
        })
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--brand-green)', color: 'var(--bone, #F4ECD8)',
          padding: '10px 16px', borderRadius: 10, fontSize: 13, boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
        }}>{toast}</div>
      )}
    </div>
  );
}
