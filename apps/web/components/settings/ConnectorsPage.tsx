'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsCard } from '../ui/SettingsCard';
import { SettingsGroup } from '../ui/SettingsGroup';

interface ConnState {
  github?: { connected: boolean; username?: string };
  vercel?: { connected: boolean; team?: string };
}

export function ConnectorsPage() {
  const [conn, setConn] = useState<ConnState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
        const r = await fetch(`${apiBase}/api/connectors/status`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (r.ok) setConn(await r.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 24, color: 'var(--text-meta)', fontFamily: 'var(--font-sans)' }}>Lade Konnektoren...</div>;

  return (
    <div className="settings-section" style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <SettingsGroup label="Integrationen">
        <SettingsCard>
          <ConnectorRow
            name="GitHub"
            initial="GH"
            connected={!!conn.github?.connected}
            detail={conn.github?.connected ? `@${conn.github.username}` : 'Repos pushen, deployen'}
            onConnect={() => { window.location.href = '/dashboard/settings/integrations?service=github'; }}
          />
          <ConnectorRow
            name="Vercel"
            initial="V"
            connected={!!conn.vercel?.connected}
            detail={conn.vercel?.connected ? (conn.vercel.team ?? 'verbunden') : 'Automatisches Deploy'}
            onConnect={() => { window.location.href = '/dashboard/settings/integrations?service=vercel'; }}
          />
          <ConnectorRow
            name="Stripe"
            initial="S"
            connected={false}
            detail="Für Dev-Mode — bald"
            disabled
          />
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}

function ConnectorRow({ name, initial, connected, detail, onConnect, disabled }: {
  name: string; initial: string; connected: boolean; detail: string; onConnect?: () => void; disabled?: boolean;
}) {
  return (
    <div className="list-item" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border-hairline)' }}>
      <span style={{
        width: 36, height: 36, borderRadius: 10, background: 'var(--subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: 'var(--meta)', fontFamily: 'var(--font-mono)',
      }}>{initial}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-meta)', marginTop: 2 }}>{detail}</div>
      </div>
      {connected ? (
        <span style={{ padding: '4px 10px', borderRadius: 12, background: 'color-mix(in srgb, var(--brand-green) 8%, transparent)', color: 'var(--brand-green)', fontSize: 12, fontWeight: 600 }}>
          Verbunden
        </span>
      ) : (
        <button onClick={onConnect} disabled={disabled} style={{
          padding: '6px 12px', borderRadius: 8,
          background: 'transparent', border: '1px solid var(--brand-green)',
          color: 'var(--brand-green)', fontSize: 13, fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontFamily: 'var(--font-sans)',
        }}>
          {disabled ? 'Bald' : 'Verbinden'}
        </button>
      )}
    </div>
  );
}
