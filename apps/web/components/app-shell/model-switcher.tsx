"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Bot, Zap, Key, ExternalLink, Info } from "lucide-react";
import { useApp, type AppModel } from "@/contexts/app-context";
import { createClient } from "@/lib/supabase/client";

const PROVIDER_URLS: Record<string, string> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  google: 'https://aistudio.google.com/app/apikey',
  groq: 'https://console.groq.com/keys',
  mistral: 'https://console.mistral.ai/api-keys/',
  deepseek: 'https://platform.deepseek.com/api_keys',
  xai: 'https://console.x.ai/',
  together: 'https://api.together.xyz/settings/api-keys',
};

interface ModelFromAPI {
  id: string;
  name: string;
  slug: string;
  provider: string;
  layer: string;
  description: string;
  tags: string[];
  requires_key: boolean;
  available: boolean;
  phase: number;
}

interface ByokKeyInfo {
  id: string;
  provider: string;
  status: string;
}

export function ModelSwitcher() {
  const { activeModel, setActiveModel } = useApp();
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelFromAPI[]>([]);
  const [byokKeys, setByokKeys] = useState<ByokKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setLoading(false);
          return;
        }

        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

        const [modelsRes, keysRes] = await Promise.all([
          fetch(`${apiBase}/api/models`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${apiBase}/api/byok-keys`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
        ]);

        const modelsData = await modelsRes.json();
        const keysData = await keysRes.json();

        setModels(Array.isArray(modelsData) ? modelsData : []);
        setByokKeys(Array.isArray(keysData) ? keysData : []);
      } catch {
        // Silently fail — fallback to empty state
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  const getActiveProviders = (): string[] => {
    return byokKeys
      .filter(k => k.status === 'active')
      .map(k => k.provider);
  };

  const activeProviders = getActiveProviders();

  const getBadge = (model: ModelFromAPI) => {
    if (activeProviders.includes(model.provider)) {
      return { text: "KEY CONNECTED ✓", color: 'var(--goblin-good)' };
    }
    if (model.requires_key && !activeProviders.includes(model.provider)) {
      return { text: "BYOK REQUIRED", color: 'var(--goblin-gray)' };
    }
    if (model.layer === 'free_api') {
      return { text: "FREE", color: 'var(--goblin-ochre)' };
    }
    if (model.layer === 'goblin_hosted') {
      return { text: "GOBLIN HOSTED", color: 'var(--goblin-moss)' };
    }
    return null;
  };

  const handleModelSelect = (model: ModelFromAPI) => {
    const appModel: AppModel = {
      id: model.id,
      name: model.name,
      slug: model.slug || model.id,
      provider: model.provider,
      tier: model.layer === 'free_api' ? 'free' : model.layer === 'goblin_hosted' ? 'hosted' : 'byok',
      icon: model.requires_key ? '🔑' : model.layer === 'goblin_hosted' ? '🤖' : '⚡',
      available: model.available,
    };
    setActiveModel(appModel);
    localStorage.setItem('goblin_active_model', JSON.stringify(appModel));
    setOpen(false);
  };

  // Group models by layer (tier)
  const groupedModels: Record<string, ModelFromAPI[]> = {};
  for (const model of models) {
    const tier = model.layer === 'free_api' ? 'free' : model.layer === 'goblin_hosted' ? 'hosted' : 'byok';
    if (!groupedModels[tier]) groupedModels[tier] = [];
    groupedModels[tier].push(model);
  }

  const TIER_LABELS: Record<string, string> = {
    hosted: "Goblin Hosted",
    free: "Free API",
    byok: "BYOK"
  };

  const TIER_ORDER = ['byok', 'hosted', 'free'];

  // Loading state: skeleton
  if (loading) {
    return (
      <div className="relative">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border animate-pulse"
          style={{
            backgroundColor: 'white',
            borderColor: 'var(--goblin-light)',
            minWidth: '140px',
          }}
        >
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'var(--goblin-light)' }} />
          <div className="w-24 h-4 rounded" style={{ backgroundColor: 'var(--goblin-light)' }} />
        </div>
      </div>
    );
  }

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
          className="absolute right-0 top-full mt-2 w-80 rounded-lg border shadow-lg py-2 z-50"
          style={{
            backgroundColor: 'white',
            borderColor: 'var(--goblin-light)',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto'
          }}
        >
          {models.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm" style={{ color: 'var(--goblin-gray)' }}>
                No models available
              </p>
              <button
                className="mt-3 text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
                onClick={() => window.location.href = '/settings?tab=api-keys'}
              >
                Add API Key
              </button>
            </div>
          ) : (
            TIER_ORDER.map(tier => {
              const tierModels = groupedModels[tier];
              if (!tierModels || tierModels.length === 0) return null;

              return (
                <div key={tier}>
                  <div className="px-3 py-1.5 text-xs font-medium uppercase" style={{ color: 'var(--goblin-gray)' }}>
                    {TIER_LABELS[tier]}
                  </div>
                  {tierModels.map(model => {
                    const badge = getBadge(model);
                    const isActive = activeModel.id === model.id;

                    return (
                      <button
                        key={model.id}
                        onClick={() => {
                          if (model.available) {
                            handleModelSelect(model);
                          }
                        }}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                          model.available ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
                        } ${isActive ? 'bg-gray-50' : ''}`}
                      >
                        <span>{model.requires_key ? '🔑' : model.layer === 'goblin_hosted' ? '🤖' : '⚡'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span style={{ color: model.available ? 'var(--goblin-slate)' : 'var(--goblin-gray)' }}>
                              {model.name}
                            </span>
                            {model.provider && PROVIDER_URLS[model.provider] && model.requires_key && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(PROVIDER_URLS[model.provider], '_blank', 'noopener,noreferrer');
                                }}
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full cursor-pointer hover:opacity-70 flex-shrink-0"
                                style={{ color: 'var(--goblin-gray)' }}
                                title={`Get ${model.provider} API key`}
                              >
                                <Info className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          {badge && (
                            <div className="text-xs mt-0.5" style={{ color: badge.color }}>
                              {badge.text}
                            </div>
                          )}
                        </div>

                        {!model.available && model.phase && (
                          <span className="ml-auto text-xs px-1.5 py-0.5 rounded flex-shrink-0" 
                            style={{ backgroundColor: 'var(--goblin-light)', color: 'var(--goblin-gray)' }}>
                            Phase {model.phase}
                          </span>
                        )}

                        {isActive && !model.requires_key && (
                          <span className="ml-auto w-2 h-2 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: model.layer === 'goblin_hosted' ? 'var(--goblin-moss)' : 'var(--goblin-ochre)' }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}