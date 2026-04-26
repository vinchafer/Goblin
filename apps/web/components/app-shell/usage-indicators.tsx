"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ModelStatus {
  byok: Record<string, boolean>;
  freeApi: Record<string, { available: boolean; usedToday: number; limit: number }>;
}

interface UsageData {
  plan: 'seed' | 'craft' | 'forge';
  monthly_requests_used: number;
  monthly_limit: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude (BYOK)",
  openai: "OpenAI (BYOK)",
  google: "Gemini (BYOK)",
  groq: "Groq (BYOK)",
  mistral: "Mistral (BYOK)",
  deepseek: "DeepSeek (BYOK)",
  xai: "xAI (BYOK)",
  together: "Together (BYOK)",
};

const FREE_LABELS: Record<string, string> = {
  gemini: "Gemini (Free)",
  groq: "Groq (Free)",
};

export function UsageIndicators() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        
        if (!token) return;

        // Fetch usage data
        const usageRes = await fetch('/api/usage', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (usageRes.ok) {
          setUsage(await usageRes.json());
        }

        // Fetch model status
        const statusRes = await fetch('/api/models/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (statusRes.ok) {
          setModelStatus(await statusRes.json());
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

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
        {/* Monthly Requests */}
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

        {/* BYOK Providers */}
        {modelStatus?.byok && Object.entries(PROVIDER_LABELS).map(([provider, label]) => {
          const connected = modelStatus.byok[provider] || false;
          return (
            <div key={provider}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>{label}</span>
                <span className="text-xs" style={{ color: connected ? 'var(--goblin-moss)' : 'var(--goblin-gray)' }}>
                  {connected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--goblin-light)' }}>
                <div 
                  className="h-full rounded-full" 
                  style={{ 
                    width: connected ? '100%' : '0%',
                    backgroundColor: 'var(--goblin-moss)' 
                  }} 
                />
              </div>
            </div>
          );
        })}

        {/* Free API Providers */}
        {modelStatus?.freeApi && Object.entries(FREE_LABELS).map(([provider, label]) => {
          const free = modelStatus.freeApi[provider];
          const available = free?.available ?? true;
          const used = free?.usedToday ?? 0;
          const limit = free?.limit ?? 50;
          const freePct = Math.min(100, (used / limit) * 100);
          return (
            <div key={`free-${provider}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm" style={{ color: 'var(--goblin-slate)' }}>{label}</span>
                <span className="text-xs" style={{ color: available ? 'var(--goblin-moss)' : 'var(--goblin-warn)' }}>
                  {used} / {limit}
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--goblin-light)' }}>
                <div 
                  className="h-full rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${freePct}%`,
                    backgroundColor: freePct > 90 ? 'var(--goblin-warn)' : 'var(--goblin-moss)' 
                  }} 
                />
              </div>
            </div>
          );
        })}

        {/* Goblin Hosted */}
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