'use client';

// Sprint 10.9-5 — /admin/catalog ops dashboard (OPTION B, branch-aware).
// Gated by the admin layout (session is_admin / ADMIN_EMAIL fallback) and the
// /api/admin proxy. Reads GET /api/admin/catalog; triggers POST endpoints.

import { useCallback, useEffect, useState } from 'react';

const ADMIN_BASE = '/api/admin';

interface SyncRow {
  synced_at: string;
  source: string;
  added: number | null;
  updated: number | null;
  deactivated: number | null;
}
interface ProviderHealth {
  provider: string;
  state: string;
  errorRate: number;
  volume: number;
}
interface HealthEvent {
  provider: string;
  state: string;
  error_rate: number | null;
  ts: string;
}
interface SuspectSlug {
  slug: string;
  count: number;
}
interface CatalogData {
  source: { mode: string; label: string };
  lastSyncAt: string | null;
  stats: { models: number; available: number; providers: number };
  recentSyncLog: SyncRow[];
  providerHealth: ProviderHealth[];
  healthEvents24h: HealthEvent[];
  suspectSlugs: SuspectSlug[];
}

const STATE_COLOR: Record<string, string> = {
  healthy: 'var(--success)',
  degraded: 'var(--brand-gold)',
  down: 'var(--danger)',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700, color: 'var(--meta)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

export default function AdminCatalogPage() {
  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ADMIN_BASE}/catalog`, { headers: { 'Content-Type': 'application/json' } });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const trigger = async (path: string, label: string) => {
    setBusy(label);
    setToast(null);
    try {
      const res = await fetch(`${ADMIN_BASE}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const body = await res.json().catch(() => ({}));
      setToast(`${label}: ${res.ok ? 'OK' : 'Fehler'} — ${JSON.stringify(body).slice(0, 160)}`);
      await load();
    } catch {
      setToast(`${label}: Netzwerkfehler`);
    } finally {
      setBusy(null);
    }
  };

  const btn = (label: string, path: string) => (
    <button
      onClick={() => trigger(path, label)}
      disabled={!!busy}
      style={{
        background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 8,
        padding: '9px 16px', fontSize: 13, fontWeight: 600,
        cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'var(--font-sans)',
      }}
    >
      {busy === label ? '…' : label}
    </button>
  );

  if (loading) return <div style={{ color: 'var(--meta)' }}>Loading…</div>;
  if (!data) return <div style={{ color: 'var(--danger)' }}>Konnte Katalog-Daten nicht laden.</div>;

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.6px', marginBottom: 24 }}>
        Catalog Ops
      </h1>

      <Card title="Quelle">
        <div style={{ fontSize: 14, color: 'var(--text)' }}>
          <strong>{data.source.mode}</strong> — {data.source.label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--meta)', marginTop: 6 }}>
          Letzter Sync: {data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('de-DE') : '—'}
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13, color: 'var(--meta)' }}>
          <span><strong style={{ color: 'var(--text)' }}>{data.stats.models}</strong> Modelle</span>
          <span><strong style={{ color: 'var(--text)' }}>{data.stats.available}</strong> aktiv</span>
          <span><strong style={{ color: 'var(--text)' }}>{data.stats.providers}</strong> Provider</span>
        </div>
      </Card>

      <Card title="Manuelle Trigger">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {btn('Refresh now', 'catalog/refresh?source=manual')}
          {btn('Send test digest', 'digest/send?test=1')}
        </div>
        {toast && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--meta)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>{toast}</div>}
      </Card>

      <Card title="Provider-Health (live)">
        {data.providerHealth.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--meta)' }}>Noch keine Routing-Daten in diesem Prozess.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.providerHealth.map((h) => (
              <div key={h.provider} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_COLOR[h.state] ?? 'var(--meta)' }} />
                <strong style={{ color: 'var(--text)', minWidth: 90 }}>{h.provider}</strong>
                <span style={{ color: STATE_COLOR[h.state] ?? 'var(--meta)', fontWeight: 600 }}>{h.state}</span>
                <span style={{ color: 'var(--meta)' }}>· err {((h.errorRate ?? 0) * 100).toFixed(0)}% · n={h.volume}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.suspectSlugs.length > 0 && (
        <Card title="⚠️ Slug-Failures (Discovery-Slug vom Provider abgelehnt)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.suspectSlugs.map((s) => (
              <div key={s.slug} style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)' }}>
                <span style={{ color: 'var(--danger)' }}>{s.count}×</span> {s.slug}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Sync-Log (letzte 10)">
        {data.recentSyncLog.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--meta)' }}>Noch keine Einträge.</div>
        ) : (
          // U4c: overflow-x auto so the 5-col sync-log scrolls on a phone.
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--div)' }}>
                {['Zeit', 'Quelle', 'Neu', 'Validiert', 'Ungültig'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--meta)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentSyncLog.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--div)' }}>
                  <td style={{ padding: '6px 10px', color: 'var(--meta)' }}>{new Date(r.synced_at).toLocaleString('de-DE')}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text)' }}>{r.source}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text)' }}>{r.added ?? 0}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text)' }}>{r.updated ?? 0}</td>
                  <td style={{ padding: '6px 10px', color: r.deactivated ? 'var(--danger)' : 'var(--text)' }}>{r.deactivated ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}
