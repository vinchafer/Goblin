'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';

interface Entry {
  id: string;
  provider: string;
  operation: 'decrypt_success' | 'decrypt_fail' | 'reencrypt';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function colorFor(op: Entry['operation']): string {
  if (op === 'decrypt_success') return 'var(--brand-green)';
  if (op === 'decrypt_fail') return 'var(--rust)';
  return 'var(--meta)';
}

export function DecryptLogPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Nicht eingeloggt.');
          return;
        }
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        const r = await fetch(`${apiBase}/api/account/byok-decrypt-log?limit=100`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? 'Konnte Log nicht laden.');
          return;
        }
        setEntries(data.entries ?? []);
      } catch {
        setError('Netzwerk-Fehler.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <p style={{ color: 'var(--meta)', fontSize: 14, margin: '4px 4px 16px' }}>
        Letzte 100 Zugriffe auf deine API-Keys. Verdächtige Aktivität? Rotiere den Key beim
        Provider und ändere dein Goblin-Passwort.
      </p>

      {loading && <p style={{ color: 'var(--meta)' }}>Lade…</p>}
      {error && <p style={{ color: 'var(--rust)', fontSize: 14 }}>{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p style={{ color: 'var(--meta)' }}>Keine Aktivität in den letzten 90 Tagen.</p>
      )}

      {entries.length > 0 && (
        <SettingsGroup label="Aktivität">
          <SettingsCard>
            {entries.map((e, idx) => (
              <div
                key={e.id}
                style={{
                  padding: '12px 20px',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--div)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{e.provider}</span>
                  <span
                    style={{
                      color: colorFor(e.operation),
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                    }}
                  >
                    {e.operation}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--meta)' }}>
                  {new Date(e.created_at).toLocaleString('de-DE')}
                  {e.ip_address ? ` · ${e.ip_address}` : ''}
                </div>
              </div>
            ))}
          </SettingsCard>
        </SettingsGroup>
      )}
    </div>
  );
}
