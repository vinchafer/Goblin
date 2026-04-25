"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UsageData {
  plan: 'seed' | 'craft' | 'forge';
  monthly_requests_used: number;
  monthly_limit: number;
  byok_keys: Array<{ provider: string; status: string }>;
}

export function UsageIndicators() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchUsage() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        
        if (!token) return;

        const response = await fetch('/api/usage', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const usageData = await response.json();
          setUsage(usageData);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, [supabase]);

  const hasAnthropicKey = usage?.byok_keys?.some(k => k.provider === 'anthropic' && k.status === 'active');
  const percentage = usage ? Math.min(100, (usage.monthly_requests_used / usage.monthly_limit) * 100) : 0;

  if (loading) {
    return (
      <div className="p-4 border-t" style={{ borderColor: 'var(--goblin-light)' }}>
        <span className="text-xs font-semibold uppercase tracking-wide mb-3 block" style={{ color: 'var(--goblin-gray)' }}>
          Usage
        </span>
        <div className="space-y-3">
          <div className="h-8 bg-gray-100 animate-pulse rounded" />
          <div className="h-8 bg-gray-100 animate-pulse rounded" />
          <div className="h-8 bg-gray-100 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t" style={{ borderColor: 'var(--goblin-light)' }}>
      <span className="text-xs font-semibold uppercase tracking-wide mb-3 block" style={{ color: 'var(--goblin-gray)' }}>
        Usage
      </span>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>Monthly Requests</span>
            <span className="text-xs" style={{ color: 'var(--goblin-gray)' }}>
              {usage?.monthly_requests_used || 0} / {usage?.monthly_limit || 200}
            </span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--goblin-light)' }}>
            <div 
              className="h-full rounded-full transition-all duration-300" 
              style={{ 
                width: `${percentage}%`,
                backgroundColor: percentage > 90 ? 'var(--goblin-warn)' : 'var(--goblin-moss)' 
              }} 
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>Claude (BYOK)</span>
            <span className="text-xs" style={{ color: hasAnthropicKey ? 'var(--goblin-moss)' : 'var(--goblin-gray)' }}>
              {hasAnthropicKey ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--goblin-light)' }}>
            <div 
              className="h-full rounded-full" 
              style={{ 
                width: hasAnthropicKey ? '100%' : '0%',
                backgroundColor: 'var(--goblin-moss)' 
              }} 
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>Goblin Hosted</span>
            <span className="text-xs" style={{ color: 'var(--goblin-gray)' }}>Available Phase 3</span>
          </div>
          <div className="h-1.5 rounded-full opacity-50" style={{ backgroundColor: 'var(--goblin-light)' }} />
        </div>
      </div>
    </div>
  );
}