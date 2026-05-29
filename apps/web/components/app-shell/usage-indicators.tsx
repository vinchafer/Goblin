"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UsageData {
  plan: "build" | "pro" | "power";
  monthly_requests_used: number;
  monthly_limit: number;
}

function UsageBar({ label, used, total, color }: {
  label: string;
  used: number;
  total: number;
  color: 'ochre' | 'green' | 'grey';
}) {
  const pct = Math.min((used / total) * 100, 100);
  const barColor = color === 'ochre' ? 'var(--brand-gold)'
                 : color === 'green' ? 'var(--success)'
                 : '#ccc';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--meta)', marginBottom: 3 }}>
        <span>{label}</span>
        <span>{used}/{total}</span>
      </div>
      <div style={{ height: 3, background: 'var(--div)', borderRadius: 2 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barColor,
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

function StatusRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>{label}</span>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: active ? 'var(--success)' : 'var(--div)',
        boxShadow: active ? '0 0 4px var(--success)' : 'none',
      }} />
    </div>
  );
}

export function UsageIndicators() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('users')
          .select('plan, monthly_requests_used, monthly_limit')
          .eq('id', user.id)
          .single();

        if (data) setUsage(data as UsageData);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '8px 12px 12px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 12, borderRadius: 4, background: 'var(--div)', marginBottom: 8 }} className="skeleton" />
        ))}
      </div>
    );
  }

  if (!usage) {
    return (
      <div style={{ padding: '8px 12px 12px', fontSize: 11, color: 'var(--meta)', fontStyle: 'italic' }}>
        Connect a model to see usage
      </div>
    );
  }

  const pct = Math.min(100, (usage.monthly_requests_used / usage.monthly_limit) * 100);

  return (
    <div style={{ padding: '8px 12px 12px' }}>
      <UsageBar
        label="Monthly requests"
        used={usage.monthly_requests_used}
        total={usage.monthly_limit}
        color={pct > 85 ? 'ochre' : 'green'}
      />
      <StatusRow label="Free-API Pool" active={true} />
      <StatusRow label="BYOK · Anthropic" active={false} />
      <StatusRow label="BYOK · OpenAI" active={false} />
    </div>
  );
}
