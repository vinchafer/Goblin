"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Bot, Zap, Key, ExternalLink } from "lucide-react";
import { useApp, type AppModel, type ModelTier } from "@/contexts/app-context";
import { createClient } from "@/lib/supabase/client";

const MODELS: AppModel[] = [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", tier: "byok", icon: "🔑", available: true },
  { id: "claude-opus-4-7", name: "Claude Opus 4.7", tier: "byok", icon: "🔑", available: true },
  { id: "gpt-4o", name: "GPT-4o", tier: "byok", icon: "🔑", available: true },
  { id: "qwen-coder-32b", name: "Qwen Coder 32B", tier: "hosted", icon: "🤖", available: false, badge: "Phase 3" },
  { id: "qwen-coder-14b", name: "Qwen Coder 14B (fast)", tier: "hosted", icon: "🤖", available: false, badge: "Phase 3" },
  { id: "gemini-2-flash", name: "Gemini 2.0 Flash", tier: "free", icon: "⚡", available: false, badge: "Phase 2" },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B (Groq)", tier: "free", icon: "🦙", available: false, badge: "Phase 2" },
];

const TIER_LABELS: Record<ModelTier, string> = {
  hosted: "Goblin Hosted",
  free: "Free API",
  byok: "BYOK"
};

const TIER_COLORS: Record<ModelTier, string> = {
  hosted: 'var(--goblin-moss)',
  free: 'var(--goblin-ochre)',
  byok: 'var(--goblin-gray)'
};

// Map model IDs to their BYOK provider
const MODEL_PROVIDER_MAP: Record<string, string> = {
  "claude-sonnet-4-6": "anthropic",
  "claude-opus-4-7": "anthropic",
  "gpt-4o": "openai",
};

interface CreditInfo {
  supported: boolean;
  remaining?: string;
  link?: string;
}

export function ModelSwitcher() {
  const { activeModel, setActiveModel } = useApp();
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState<Record<string, CreditInfo>>({});
  const supabase = createClient();

  // Fetch credit info for BYOK models
  useEffect(() => {
    async function fetchCredits() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const providers = new Set<string>();
        for (const model of MODELS) {
          const provider = MODEL_PROVIDER_MAP[model.id];
          if (model.tier === 'byok' && provider) {
            providers.add(provider);
          }
        }

        const creditMap: Record<string, CreditInfo> = {};
        for (const provider of providers) {
          try {
            const res = await fetch(`/api/models/${provider}/credits`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
              creditMap[provider] = await res.json();
            }
          } catch {
            // Silently fail
          }
        }
        setCredits(creditMap);
      } catch {
        // Silently fail
      }
    }

    fetchCredits();
  }, [supabase]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium"
        style={{
          backgroundColor: 'white',
          borderColor: 'var(--goblin-light)',
          color: 'var(--goblin-slate)'
        }}
      >
        <span>{activeModel.icon}</span>
        <span>{activeModel.name}</span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--goblin-gray)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-lg border shadow-lg py-2 z-50"
          style={{
            backgroundColor: 'white',
            borderColor: 'var(--goblin-light)'
          }}
        >
          {Object.entries(TIER_LABELS).map(([tier, label]) => (
            <div key={tier}>
              <div className="px-3 py-1.5 text-xs font-medium uppercase" style={{ color: 'var(--goblin-gray)' }}>
                {label}
              </div>
              {MODELS.filter(m => m.tier === tier).map(model => {
                const provider = MODEL_PROVIDER_MAP[model.id];
                const creditInfo = provider ? credits[provider] : null;
                
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (model.available) {
                        setActiveModel(model);
                        localStorage.setItem('goblin_active_model', JSON.stringify(model));
                        setOpen(false);
                      }
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${model.available ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'} ${activeModel.id === model.id ? 'bg-gray-50' : ''}`}
                  >
                    <span>{model.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span style={{ color: model.available ? 'var(--goblin-slate)' : 'var(--goblin-gray)' }}>{model.name}</span>
                      
                      {/* Credit info for BYOK models */}
                      {creditInfo?.supported && creditInfo.remaining && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--goblin-moss)' }}>
                          {creditInfo.remaining}
                        </div>
                      )}
                      {creditInfo?.link && !creditInfo.supported && (
                        <a
                          href={creditInfo.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs mt-0.5 flex items-center gap-1 hover:underline"
                          style={{ color: 'var(--goblin-gray)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Add credits
                        </a>
                      )}
                    </div>
                    
                    {model.badge && (
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: 'var(--goblin-light)', color: 'var(--goblin-gray)' }}>
                        {model.badge}
                      </span>
                    )}
                    
                    {activeModel.id === model.id && !model.badge && (
                      <span className="ml-auto w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TIER_COLORS[tier as ModelTier] }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}