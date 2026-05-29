'use client';

import { useEffect, useState, useCallback } from 'react';

const ADMIN_BASE = '/api/admin';
const adminHeaders = () => ({ 'Content-Type': 'application/json' });

interface Build {
  id: string;
  user_id: string;
  project_id: string;
  type: string;
  status: string;
  progress_pct: number;
  message: string | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  running:   { bg: 'rgba(212,169,74,0.15)',  fg: '#8B6914' },
  done:      { bg: 'rgba(74,124,59,0.12)',   fg: 'var(--success)' },
  failed:    { bg: 'rgba(184,92,60,0.12)',   fg: 'var(--danger)' },
  cancelled: { bg: 'rgba(107,107,107,0.12)', fg: 'var(--meta)' },
  pending:   { bg: 'rgba(107,107,107,0.1)',  fg: 'var(--meta)' },
};

function durationStr(b: Build): string {
  if (!b.completed_at) return '—';
  const ms = new Date(b.completed_at).getTime() - new Date(b.created_at).getTime();
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m ${s % 60}s`;
}

export default function AdminBuildsPage() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`${ADMIN_BASE}/builds?${params}`, { headers: adminHeaders() });
    if (res.ok) {
      const d = await res.json();
      setBuilds(Array.isArray(d) ? d : (d.builds ?? d));
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    await fetch(`${ADMIN_BASE}/builds/${id}/cancel`, { method: 'POST', headers: adminHeaders() });
    setCancelling(null);
    load();
  };

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.6px', marginBottom: 24 }}>
        Builds
      </h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        {['', 'running', 'done', 'failed', 'cancelled', 'pending'].map(s => (
          <button
            key={s || 'all'}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              border: statusFilter === s ? '2px solid var(--brand-green)' : '1.5px solid var(--border)',
              background: statusFilter === s ? 'rgba(45,74,43,0.08)' : 'transparent',
              color: statusFilter === s ? 'var(--brand-green)' : 'var(--meta)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {s || 'All'}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', background: 'var(--brand-green)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          Refresh
        </button>
      </div>

      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--meta)' }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--div)' }}>
                {['Type', 'Status', 'Progress', 'Duration', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--meta)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {builds.map(b => {
                const sc = STATUS_COLOR[b.status] || STATUS_COLOR['pending']!;
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--div)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500 }}>
                      {b.type}
                      <div style={{ fontSize: 10, color: 'var(--meta)', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>{b.id.slice(0, 8)}…</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.fg, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 4, background: 'var(--subtle)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${b.progress_pct}%`, height: '100%', background: 'var(--brand-green)', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ color: 'var(--meta)' }}>{b.progress_pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--meta)' }}>{durationStr(b)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--meta)' }}>{new Date(b.created_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {b.message && (
                          <button onClick={() => setSelectedBuild(b)}
                            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 9px', fontSize: 11, cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                            Log
                          </button>
                        )}
                        {(b.status === 'running' || b.status === 'pending') && (
                          <button
                            onClick={() => handleCancel(b.id)}
                            disabled={cancelling === b.id}
                            style={{ background: 'transparent', border: '1px solid var(--danger)', borderRadius: 6, padding: '3px 9px', fontSize: 11, cursor: 'pointer', color: 'var(--danger)', fontFamily: 'var(--font-sans)' }}>
                            {cancelling === b.id ? '…' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, alignItems: 'center' }}>
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
          style={{ background: 'var(--subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: page > 1 ? 'pointer' : 'not-allowed', color: 'var(--text)', opacity: page <= 1 ? 0.4 : 1 }}>
          ← Prev
        </button>
        <span style={{ fontSize: 12, color: 'var(--meta)' }}>Page {page}</span>
        <button disabled={builds.length < 25} onClick={() => setPage(p => p + 1)}
          style={{ background: 'var(--subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: builds.length >= 25 ? 'pointer' : 'not-allowed', color: 'var(--text)', opacity: builds.length < 25 ? 0.4 : 1 }}>
          Next →
        </button>
      </div>

      {/* Log modal */}
      {selectedBuild && (
        <div onClick={() => setSelectedBuild(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'overlayIn 0.15s ease-out' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 560, background: 'var(--panel)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', animation: 'modalIn 0.15s ease-out' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--div)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--brand-green)', fontWeight: 700 }}>Build Log — {selectedBuild.id.slice(0, 8)}</h2>
              <button onClick={() => setSelectedBuild(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meta)', fontSize: 18 }}>✕</button>
            </div>
            <pre style={{ padding: '16px 20px', margin: 0, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--code-fg)', background: 'var(--code-bg)', overflowX: 'auto', maxHeight: 300 }}>
              {selectedBuild.message || '(no log)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
