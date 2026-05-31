'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SettingsGroup } from '../ui/SettingsGroup';
import { SettingsCard } from '../ui/SettingsCard';

interface ProviderInfo {
  key: string;
  name: string;
  hasKey: boolean;
  keyHint?: string | null;
  usage?: {
    tokens_total: number;
    requests: number;
    last_used_at: string | null;
  };
}

const PROVIDERS = ['anthropic', 'openai', 'google', 'mistral', 'groq', 'together', 'deepseek', 'fireworks'] as const;

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  mistral: 'Mistral',
  groq: 'Groq',
  together: 'Together AI',
  deepseek: 'DeepSeek',
  fireworks: 'Fireworks AI',
};

interface ByokKeyRow { provider: string; key_hint?: string | null; status?: string }
interface ByokUsageRow { provider: string; tokens_in: number; tokens_out: number; requests: number; last_used_at: string | null }

export function ApiKeysPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const [keysRes, usageRes] = await Promise.all([
      supabase.from('byok_keys').select('provider, key_hint, status').eq('user_id', session.user.id),
      supabase
        .from('byok_key_usage')
        .select('provider, tokens_in, tokens_out, requests, last_used_at')
        .eq('user_id', session.user.id)
        .gte('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
    ]);

    const keys = (keysRes.data ?? []) as ByokKeyRow[];
    const usages = (usageRes.data ?? []) as ByokUsageRow[];

    const merged: ProviderInfo[] = PROVIDERS.map((p) => {
      const stored = keys.find((k) => k.provider === p && k.status !== 'revoked');
      const u = usages.find((x) => x.provider === p);
      return {
        key: p,
        name: PROVIDER_LABELS[p] ?? p,
        hasKey: !!stored,
        keyHint: stored?.key_hint,
        usage: u ? {
          tokens_total: (u.tokens_in ?? 0) + (u.tokens_out ?? 0),
          requests: u.requests ?? 0,
          last_used_at: u.last_used_at,
        } : undefined,
      };
    });
    setProviders(merged);
    setLoading(false);
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-meta)', fontFamily: 'var(--font-sans)' }}>Lade Schlüssel...</div>;
  }

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: 'var(--font-sans)' }}>
      <p style={{ fontSize: 'var(--t-small-fs)', color: 'var(--text-meta)', padding: '0 4px 12px', lineHeight: 1.5 }}>
        Verbinde deine eigenen API-Schlüssel. Goblin nutzt sie direkt, ohne sie weiterzuverkaufen.
      </p>

      <SettingsGroup label="Provider">
        <SettingsCard>
          {providers.map((p) => (
            <ProviderRow key={p.key} provider={p} />
          ))}
        </SettingsCard>
      </SettingsGroup>

      <div style={{ marginTop: 16 }}>
        <a
          href="/dashboard/settings/keys"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: 14,
            background: 'color-mix(in srgb, var(--brand-green) 8%, transparent)',
            color: 'var(--brand-green)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Schlüssel verwalten →
        </a>
      </div>
    </div>
  );
}

function ProviderRow({ provider }: { provider: ProviderInfo }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} data-testid={`provider-${provider.key}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--meta)',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}>{provider.name[0]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{provider.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-meta)', marginTop: 2 }}>
            {provider.hasKey ? `sk-...${provider.keyHint ?? '****'}` : 'Nicht verbunden'}
          </div>
        </div>
        <span style={{
          padding: '4px 10px',
          borderRadius: 12,
          background: provider.hasKey ? 'color-mix(in srgb, var(--brand-green) 8%, transparent)' : 'var(--subtle)',
          color: provider.hasKey ? 'var(--brand-green)' : 'var(--meta)',
          fontSize: 'var(--t-caption-fs)',
          fontWeight: 600,
          flexShrink: 0,
        }}>{provider.hasKey ? 'Aktiv' : 'Aus'}</span>
      </div>

      {provider.hasKey && provider.usage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ProgressBar value={provider.usage.tokens_total} max={1_000_000} testId={`usage-bar-${provider.key}`} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)' }}>
            <span>{formatNumber(provider.usage.tokens_total)} Tokens diesen Monat</span>
            <span>{provider.usage.requests} Anfragen</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, max, testId }: { value: number; max: number; testId?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div data-testid={testId} style={{
      height: 6,
      borderRadius: 3,
      background: 'var(--subtle)',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        background: 'var(--brand-green)',
        transition: 'width 300ms ease',
      }} />
    </div>
  );
}

function formatNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
