'use client';

import { useEffect, useState, useCallback } from 'react';
import { readMutationError } from '@/lib/admin/mutation-error';
import { hasNextPage, hasPrevPage } from '@/lib/admin/pagination';

// Admin calls go through /api/admin proxy (server-side key injection, is_admin check)
const ADMIN_BASE = '/api/admin';
const PAGE_SIZE = 20;

function adminHeaders() {
  return { 'Content-Type': 'application/json' };
}

interface User {
  id: string;
  email: string;
  plan: string;
  created_at: string;
  stripe_subscription_id: string | null;
  is_admin: boolean;
  is_suspended: boolean;
}

interface Stats {
  total_users: number;
  active_7d: number;
  paid_users: number;
  estimated_mrr: number;
}

const CARD_STYLE = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 20,
};

const PLAN_BADGE: Record<string, string> = {
  build: '#92701a', pro: 'var(--brand-green)', power: '#1a2d5a',
};

// U5.1: shared honest-error banner style (danger tint, readable in both themes).
const ERR_BANNER: React.CSSProperties = {
  background: 'rgba(176,67,42,0.10)', border: '1px solid var(--danger)',
  color: 'var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 16,
  fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: 500,
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mutError, setMutError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set('search', search);
    const [usersRes, statsRes] = await Promise.all([
      fetch(`${ADMIN_BASE}/users?${params}`, { headers: adminHeaders() }),
      fetch(`${ADMIN_BASE}/stats`, { headers: adminHeaders() }),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // U5.1: check the response and surface a failure honestly instead of silently
  // closing the modal + reloading as if the mutation succeeded. On error the
  // modal stays open so the founder sees the message in context.
  const handleAction = async (userId: string, action: string, value?: unknown) => {
    setActionLoading(userId + action);
    setMutError(null);
    try {
      let res: Response | null = null;
      if (action === 'delete') {
        res = await fetch(`${ADMIN_BASE}/users/${userId}`, { method: 'DELETE', headers: adminHeaders() });
      } else if (action === 'suspend') {
        res = await fetch(`${ADMIN_BASE}/users/${userId}`, {
          method: 'PATCH', headers: adminHeaders(),
          body: JSON.stringify({ is_suspended: value }),
        });
      } else if (action === 'plan') {
        res = await fetch(`${ADMIN_BASE}/users/${userId}`, {
          method: 'PATCH', headers: adminHeaders(),
          body: JSON.stringify({ plan: value }),
        });
      }
      if (res) {
        const err = await readMutationError(res, 'en');
        if (err) { setMutError(err); return; }
      }
      load();
      setSelectedUser(null);
    } catch {
      setMutError('Action failed — network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // U5.2: the server already applied ?search=, so a second client-side filter
  // was redundant AND broke pagination (it drove "Next" off the re-filtered
  // count). Render the server page as-is; paginate on the raw page fill.
  const nextEnabled = hasNextPage(users.length, PAGE_SIZE);
  const prevEnabled = hasPrevPage(page);

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.6px', marginBottom: 24 }}>
        Users
      </h1>

      {/* U5.1: honest, visible error state — only shown when a mutation fails. */}
      {mutError && !selectedUser && (
        <div role="alert" style={ERR_BANNER}>{mutError}</div>
      )}

      {/* Stats — U4c: responsive stat grid (was fixed repeat(4,1fr) → overflowed at
          375px). auto-fit wraps to 2×2 / 1-col on a phone; MRR is guarded so a
          missing field renders $0 instead of $undefined/$NaN. */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Users', value: stats.total_users ?? 0 },
            { label: 'Active (7d)', value: stats.active_7d ?? 0 },
            { label: 'Paid', value: stats.paid_users ?? 0 },
            { label: 'Est. MRR', value: `$${stats.estimated_mrr ?? 0}` },
          ].map(s => (
            <div key={s.label} style={CARD_STYLE}>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-sans)', color: 'var(--brand-green)' }}>{s.value}</div>
              <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search + table */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email…"
            style={{
              flex: 1, height: 38, padding: '0 12px', borderRadius: 8,
              border: '1.5px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text)', fontSize: 13, outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <button
            onClick={load}
            style={{
              background: 'var(--brand-green)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '0 16px', height: 38, fontSize: 13,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--meta)', padding: '32px 0' }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--div)' }}>
                  {['Email', 'Plan', 'Joined', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--meta)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--div)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        background: PLAN_BADGE[u.plan] || '#666', color: '#fff',
                        padding: '2px 7px', borderRadius: 4,
                      }}>{u.plan}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--meta)' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: u.is_suspended ? 'var(--danger)' : 'var(--success)',
                      }}>
                        {u.is_suspended ? '⏸ Suspended' : '✓ Active'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => { setMutError(null); setSelectedUser(u); }}
                          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleAction(u.id, 'suspend', !u.is_suspended)}
                          disabled={actionLoading === u.id + 'suspend'}
                          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', color: u.is_suspended ? 'var(--success)' : 'var(--warning)', fontFamily: 'var(--font-sans)' }}
                        >
                          {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, alignItems: 'center' }}>
          <button disabled={!prevEnabled} onClick={() => setPage(p => p - 1)}
            style={{ background: 'var(--subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 'var(--t-caption-fs)', cursor: prevEnabled ? 'pointer' : 'not-allowed', color: 'var(--text)', opacity: prevEnabled ? 1 : 0.4 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)' }}>Page {page}</span>
          <button disabled={!nextEnabled} onClick={() => setPage(p => p + 1)}
            style={{ background: 'var(--subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 'var(--t-caption-fs)', cursor: nextEnabled ? 'pointer' : 'not-allowed', color: 'var(--text)', opacity: nextEnabled ? 1 : 0.4 }}>
            Next →
          </button>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div
          onClick={() => { setMutError(null); setSelectedUser(null); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            animation: 'overlayIn 0.15s ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480, background: 'var(--panel)',
              borderRadius: 14, border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
              animation: 'modalIn 0.15s ease-out',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--div)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 17, color: 'var(--brand-green)', fontWeight: 700 }}>User Details</h2>
              <button onClick={() => { setMutError(null); setSelectedUser(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meta)', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {mutError && <div role="alert" style={ERR_BANNER}>{mutError}</div>}
              {[
                { label: 'ID',    value: selectedUser.id },
                { label: 'Email', value: selectedUser.email },
                { label: 'Plan',  value: selectedUser.plan },
                { label: 'Joined', value: new Date(selectedUser.created_at).toLocaleString() },
                { label: 'Stripe', value: selectedUser.stripe_subscription_id || 'none' },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--div)', fontSize: 13 }}>
                  <span style={{ width: 80, color: 'var(--meta)', fontWeight: 500, flexShrink: 0 }}>{f.label}</span>
                  <span style={{ color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--t-caption-fs)' }}>{f.value}</span>
                </div>
              ))}
              <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['build', 'pro', 'power'].map(p => (
                  <button
                    key={p}
                    onClick={() => handleAction(selectedUser.id, 'plan', p)}
                    disabled={selectedUser.plan === p || !!actionLoading}
                    style={{
                      background: selectedUser.plan === p ? 'var(--brand-green)' : 'transparent',
                      color: selectedUser.plan === p ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)', borderRadius: 7,
                      padding: '6px 14px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      opacity: selectedUser.plan === p ? 1 : 0.8,
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => { if (confirm('Delete this user permanently?')) handleAction(selectedUser.id, 'delete'); }}
                  style={{ background: 'transparent', border: '1px solid var(--danger)', borderRadius: 7, padding: '6px 14px', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', color: 'var(--danger)', fontFamily: 'var(--font-sans)', marginLeft: 'auto' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
