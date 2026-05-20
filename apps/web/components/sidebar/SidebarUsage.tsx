'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { Icon } from '@/components/ui/icon';

interface KeyUsage {
  provider: string;
  providerLabel: string;
  requestsThisMonth: number;
  isFreeTier: boolean;
}

export function SidebarUsage() {
  const [keys, setKeys] = useState<KeyUsage[] | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<{ keys: KeyUsage[] }>('/api/account/key-usage-summary')
      .then((d) => { if (alive) setKeys(d.keys ?? []); })
      .catch(() => { if (alive) setKeys([]); });
    return () => { alive = false; };
  }, []);

  if (keys === null) {
    return (
      <div style={{
        margin: '0 12px 8px',
        height: 56,
        borderRadius: 8,
        background: 'rgba(45,74,43,0.04)',
      }} />
    );
  }

  if (keys.length === 0) {
    return (
      <Link
        href="/onboarding/choose-provider"
        style={{
          margin: '0 12px 8px',
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(45,74,43,0.06)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
          color: 'var(--text)',
          fontSize: 12,
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        <Icon name="apiKey" size={14} color="var(--moss)" />
        <span>Key hinzufügen</span>
      </Link>
    );
  }

  return (
    <div style={{
      margin: '0 12px 8px',
      padding: '10px 12px',
      borderRadius: 8,
      background: 'rgba(45,74,43,0.06)',
      border: '1px solid var(--border)',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '1.2px',
        color: 'var(--text-faint)',
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <Icon name="usage" size={11} />
        Verbrauch
      </div>
      {keys.map((k) => (
        <div key={k.provider} style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          padding: '2px 0',
          color: 'var(--text)',
        }}>
          <span>{k.providerLabel}</span>
          <span style={{ color: 'var(--text-meta)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
            {k.requestsThisMonth} req{k.isFreeTier ? '' : ''}
          </span>
        </div>
      ))}
      <Link
        href="/dashboard/settings/usage"
        style={{
          display: 'block',
          marginTop: 6,
          fontSize: 11,
          color: 'var(--moss)',
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Details →
      </Link>
    </div>
  );
}
