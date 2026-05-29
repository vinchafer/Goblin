'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';

interface Session {
  id: string;
  device_label: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
  isCurrent: boolean;
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await authedFetch('/api/account/sessions');
      const data = await r.json().catch(() => ({ sessions: [] }));
      setSessions(data.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const revoke = async (id: string) => {
    if (!confirm('Diese Sitzung wirklich beenden?')) return;
    await authedFetch(`/api/account/sessions/${id}/revoke`, { method: 'POST' });
    void load();
  };

  const revokeOthers = async () => {
    if (!confirm('Alle anderen Sitzungen beenden? Du bleibst auf diesem Gerät eingeloggt.')) return;
    await authedFetch('/api/account/sessions/revoke-others', { method: 'POST' });
    void load();
  };

  const others = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <p style={{ color: 'var(--meta)', fontSize: 14, margin: '4px 4px 16px' }}>
        Hier siehst du alle Geräte, auf denen du gerade eingeloggt bist. Beende Sitzungen, die
        du nicht erkennst.
      </p>

      {loading && <p style={{ color: 'var(--meta)' }}>Lade…</p>}

      {!loading && others.length >= 1 && (
        <button
          onClick={revokeOthers}
          style={{
            width: '100%',
            padding: 14,
            marginBottom: 12,
            background: 'var(--rust)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Alle anderen Sitzungen beenden
        </button>
      )}

      <SettingsGroup label="Aktive Sitzungen">
        <SettingsCard>
          {sessions.length === 0 && !loading && (
            <div style={{ padding: '14px 20px', color: 'var(--meta)', fontSize: 14 }}>
              Keine aktiven Sitzungen.
            </div>
          )}
          {sessions.map((s, idx) => (
            <div
              key={s.id}
              className="list-item"
              style={{
                padding: '14px 20px',
                borderTop: idx === 0 ? 'none' : '1px solid var(--div)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
                  {s.device_label ?? 'Unknown Device'}
                  {s.isCurrent && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        background: 'var(--brand-green)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: 4,
                        verticalAlign: 'middle',
                      }}
                    >
                      Diese Sitzung
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--meta)', marginTop: 4 }}>
                  {s.ip_address ? `${s.ip_address} · ` : ''}
                  Aktiv: {new Date(s.last_active_at).toLocaleString('de-DE')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--meta)' }}>
                  Angemeldet seit {new Date(s.created_at).toLocaleDateString('de-DE')}
                </div>
              </div>
              {!s.isCurrent && (
                <button
                  onClick={() => revoke(s.id)}
                  style={{
                    padding: '6px 12px',
                    background: 'transparent',
                    color: 'var(--rust)',
                    border: '1px solid var(--rust)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Beenden
                </button>
              )}
            </div>
          ))}
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}
