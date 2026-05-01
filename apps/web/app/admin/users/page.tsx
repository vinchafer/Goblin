'use client';

import { useEffect, useState, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

function adminHeaders() {
  return { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' };
}

interface User {
  id: string;
  email: string;
  plan: string;
  monthly_requests_used: number;
  monthly_limit: number;
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
  seed: '#92701a', craft: '#2D4A2B', forge: '#1a2d5a',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    const [usersRes, statsRes] = await Promise.all([
      fetch(`${API}/api/admin/users?${params}`, { headers: adminHeaders() }),
      fetch(`${API}/api/admin/stats`, { headers: adminHeaders() }),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (statsRes.ok) setStats(await statsRes.json());
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (userId: string, action: string, value?: unknown) => {
    setActionLoading(userId + action);
    try {
      if (action === 'delete') {
        await fetch(`${API}/api/admin/users/${userId}`, { method: 'DELETE', headers: adminHeaders() });
      } else if (action === 'suspend') {
        await fetch(`${API}/api/admin/users/${userId}`, {
          method: 'PATCH', headers: adminHeaders(),
          body: JSON.stringify({ is_suspended: value }),
        });
      } else if (action === 'plan') {
        await fetch(`${API}/api/admin/users/${userId}`, {
          method: 'PATCH', headers: adminHeaders(),
          body: JSON.stringify({ plan: value }),
        });
      }
      load();
    } finally {
      setActionLoading(null);
      setSelectedUser(null);
    }
  };

  const filteredUsers = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 26, color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.6px', marginBottom: 24 }}>
        Users
      </h1>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Users', value: stats.total_users },
            { label: 'Active (7d)', value: stats.active_7d },
            { label: 'Paid', value: stats.paid_users },
            { label: 'Est. MRR', value: `$${stats.estimated_mrr}` },
          ].map(s => (
            <div key={s.label} style={CARD_STYLE}>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Fraunces, serif', color: 'var(--moss)' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--meta)', marginTop: 2 }}>{s.label}</div>
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
              fontFamily: 'DM Sans, sans-serif',
            }}
          />
          <button
            onClick={load}
            style={{
              background: 'var(--moss)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '0 16px', height: 38, fontSize: 13,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--meta)', padding: '32px 0' }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--div)' }}>
                  {['Email', 'Plan', 'Requests', 'Joined', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--meta)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
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
                      {u.monthly_requests_used}/{u.monthly_limit}
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
                          onClick={() => setSelectedUser(u)}
                          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleAction(u.id, 'suspend', !u.is_suspended)}
                          disabled={actionLoading === u.id + 'suspend'}
                          style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: u.is_suspended ? 'var(--success)' : 'var(--warning)', fontFamily: 'DM Sans, sans-serif' }}
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
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ background: 'var(--subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: page > 1 ? 'pointer' : 'not-allowed', color: 'var(--text)', opacity: page <= 1 ? 0.4 : 1 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--meta)' }}>Page {page}</span>
          <button disabled={filteredUsers.length < 20} onClick={() => setPage(p => p + 1)}
            style={{ background: 'var(--subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: filteredUsers.length >= 20 ? 'pointer' : 'not-allowed', color: 'var(--text)', opacity: filteredUsers.length < 20 ? 0.4 : 1 }}>
            Next →
          </button>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div
          onClick={() => setSelectedUser(null)}
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
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 17, color: 'var(--moss)', fontWeight: 700 }}>User Details</h2>
              <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meta)', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {[
                { label: 'ID',    value: selectedUser.id },
                { label: 'Email', value: selectedUser.email },
                { label: 'Plan',  value: selectedUser.plan },
                { label: 'Usage', value: `${selectedUser.monthly_requests_used} / ${selectedUser.monthly_limit}` },
                { label: 'Joined', value: new Date(selectedUser.created_at).toLocaleString() },
                { label: 'Stripe', value: selectedUser.stripe_subscription_id || 'none' },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid var(--div)', fontSize: 13 }}>
                  <span style={{ width: 80, color: 'var(--meta)', fontWeight: 500, flexShrink: 0 }}>{f.label}</span>
                  <span style={{ color: 'var(--text)', wordBreak: 'break-all', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{f.value}</span>
                </div>
              ))}
              <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['seed', 'craft', 'forge'].map(p => (
                  <button
                    key={p}
                    onClick={() => handleAction(selectedUser.id, 'plan', p)}
                    disabled={selectedUser.plan === p || !!actionLoading}
                    style={{
                      background: selectedUser.plan === p ? 'var(--moss)' : 'transparent',
                      color: selectedUser.plan === p ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)', borderRadius: 7,
                      padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif',
                      opacity: selectedUser.plan === p ? 1 : 0.8,
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => { if (confirm('Delete this user permanently?')) handleAction(selectedUser.id, 'delete'); }}
                  style={{ background: 'transparent', border: '1px solid var(--danger)', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif', marginLeft: 'auto' }}
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
