"use client";

import { useState, useEffect, useRef } from "react";
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

// Free-tier capable providers — surfaces a badge in the picker and gets
// sorted ahead of paid-only providers inside the BYOK group.
const PROVIDER_FREE_TIER: Record<string, { limits: string }> = {
  google: { limits: '15 req/min, 1500 req/Tag' },
  groq: { limits: '30 req/min' },
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
  const [recommendedTokens, setRecommendedTokens] = useState<string[]>([]);
  // 10.9-3 — provider → 'degraded'|'down' (only unhealthy providers present).
  const [health, setHealth] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
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

        const modelsArray = Array.isArray(modelsData) ? modelsData : [];
        const keysArray = Array.isArray(keysData) ? keysData : [];

        setModels(modelsArray);
        setByokKeys(keysArray);

        // Default model selection logic
        const activeProviders = keysArray
          .filter(k => k.status === 'active')
          .map(k => k.provider);

        // 1. Check localStorage
        const storedModel = localStorage.getItem('goblin:selectedModel');
        if (storedModel) {
          try {
            const parsed = JSON.parse(storedModel);
            const foundModel = modelsArray.find(m => m.id === parsed.id);
            if (foundModel && foundModel.available) {
              // Check if BYOK model has key
              if (foundModel.layer === 'byok' && !activeProviders.includes(foundModel.provider)) {
                // Don't select BYOK model without key
              } else {
                handleModelSelect(foundModel);
                return;
              }
            }
          } catch {
            // Invalid JSON, continue
          }
        }

        // 2. A BYOK model with a connected key — but prefer the PROVEN-WORKING
        // Groq Llama over a blind "first BYOK". WALKFIX-4.2: the old first-match
        // defaulted a Gemini-key account to Gemini (dead on prod) with no user
        // choice. Prefer Groq Llama 3.3 70B → any Groq → then first BYOK.
        const byokWithKey = modelsArray.filter(m =>
          m.layer === 'byok' && m.available && activeProviders.includes(m.provider)
        );
        const preferredByok =
          byokWithKey.find(m => /groq/i.test(m.provider) && /llama\s*3\.?3\s*70b/i.test(m.name)) ??
          byokWithKey.find(m => /groq/i.test(m.provider) && /llama/i.test(m.name)) ??
          byokWithKey.find(m => /groq/i.test(m.provider)) ??
          byokWithKey[0];
        if (preferredByok) {
          handleModelSelect(preferredByok);
          return;
        }

        // 3. Goblin Swift (goblin_hosted) — the keyless default once the pool is live.
        // F5-1 (DD §C): prefer the available Goblin-bundled Swift tier (the live wedge)
        // over the free_api fallback, which is gated off while the free pool is empty.
        const goblinSwift =
          modelsArray.find(m => m.layer === 'goblin_hosted' && m.available && m.id === 'goblin/efficient') ??
          modelsArray.find(m => m.layer === 'goblin_hosted' && m.available);
        if (goblinSwift) {
          handleModelSelect(goblinSwift);
          return;
        }

        // 4. Gemini Flash (free_api) — only reachable when the free pool is live.
        const geminiFlash = modelsArray.find(m =>
          m.layer === 'free_api' &&
          m.available &&
          m.name.includes('Gemini')
        );
        if (geminiFlash) {
          handleModelSelect(geminiFlash);
          return;
        }

        // 5. First free_api model
        const firstFree = modelsArray.find(m =>
          m.layer === 'free_api' &&
          m.available
        );
        if (firstFree) {
          handleModelSelect(firstFree);
          return;
        }

        // 6. No model available
        setActiveModel({
          id: '',
          name: 'Add model →',
          slug: '',
          provider: '',
          tier: 'byok',
          icon: 'key',
          available: false,
        });
      } catch {
        // Silently fail — fallback to empty state
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [supabase]);

  // 10.9-3: poll provider health so a degraded provider gets a picker badge.
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    let cancelled = false;
    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch(`${apiBase}/api/models/health`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok && !cancelled) setHealth(await res.json());
      } catch { /* picker works without health */ }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [supabase]);

  // 9R: fetch top-3 recommended for coding (public endpoint, no auth)
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiBase}/api/rankings?task=coding&limit=3`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        type RankRow = {
          ranked_models?: { id?: string; display_name?: string };
        };
        const rows = (data?.rankings ?? []) as RankRow[];
        const tokens: string[] = [];
        for (const row of rows) {
          const id = row.ranked_models?.id ?? '';
          const name = (row.ranked_models?.display_name ?? '').toLowerCase();
          if (id) tokens.push(id.toLowerCase());
          if (name) tokens.push(name);
        }
        setRecommendedTokens(tokens);
      })
      .catch(() => {
        // fail silently — picker works without recommendations
      });
  }, []);

  function isRecommended(model: ModelFromAPI): boolean {
    if (recommendedTokens.length === 0) return false;
    const slug = (model.slug || model.id || '').toLowerCase();
    const name = (model.name || '').toLowerCase();
    return recommendedTokens.some(
      (t) => t.includes(slug) || slug.includes(t) || t.includes(name) || name.includes(t),
    );
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const getActiveProviders = (): string[] => {
    return byokKeys
      .filter(k => k.status === 'active')
      .map(k => k.provider);
  };

  const activeProviders = getActiveProviders();

  const getBadge = (model: ModelFromAPI) => {
    if (model.layer === 'byok') {
      if (activeProviders.includes(model.provider)) {
        return { text: 'BYOK ✓', color: 'var(--success)' }; // green
      } else {
        return { text: 'Add key →', color: 'var(--danger)' }; // red
      }
    }
    if (model.layer === 'free_api') {
      return { text: 'FREE', color: 'var(--success)' }; // green
    }
    if (model.layer === 'goblin_hosted') {
      // SESSION 5: the badge follows the live `available` flag, never a hard-coded
      // "SOON". A Goblin-bundled model is only returned by /api/models when the
      // server flag is on, so an available one is live → show it as the included,
      // no-key option. The neutral "soon" state is kept only as a defensive
      // fallback for a genuinely unavailable entry (should not occur in practice).
      return model.available
        ? { text: 'INKLUSIVE · KEIN KEY', color: 'var(--success)' } // green — live
        : { text: 'SOON', color: '#6b6560' }; // gray — defensive
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
      icon: model.requires_key ? 'key' : model.layer === 'goblin_hosted' ? 'bot' : 'zap',
      available: model.available,
    };
    setActiveModel(appModel);
    localStorage.setItem('goblin:selectedModel', JSON.stringify(appModel));
    setOpen(false);
  };

  // Group models by layer (tier)
  const groupedModels: Record<string, ModelFromAPI[]> = {};
  for (const model of models) {
    const tier = model.layer === 'free_api' ? 'free' : model.layer === 'goblin_hosted' ? 'hosted' : 'byok';
    if (!groupedModels[tier]) groupedModels[tier] = [];
    groupedModels[tier].push(model);
  }

  // Within BYOK, free-tier-capable providers go first so new users see the
  // cheapest setup path at the top of the list.
  if (groupedModels.byok) {
    groupedModels.byok.sort((a, b) => {
      const aFree = PROVIDER_FREE_TIER[a.provider] ? 0 : 1;
      const bFree = PROVIDER_FREE_TIER[b.provider] ? 0 : 1;
      return aFree - bFree;
    });
  }

  // SESSION 5: the Goblin group header follows the live availability of its
  // models. When the Goblin-bundled models are live (the normal case once the
  // server flag is on) it reads as the included, no-key tier — never "COMING SOON".
  const hostedLive = (groupedModels.hosted ?? []).some((m) => m.available);
  const TIER_LABELS: Record<string, string> = {
    byok: "BYOK — YOUR KEYS",
    free: "FREE — NO KEY NEEDED",
    hosted: hostedLive ? "GOBLIN — INKLUSIVE · KEIN KEY" : "GOBLIN — COMING SOON",
  };

  // Canonical layer order (user-facing): Goblin's own models (default) → free
  // third-party → BYOK. Matches the onboarding "How Goblin works" layers.
  const TIER_ORDER = ['hosted', 'free', 'byok'];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', minWidth: 140, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease infinite' }}>
        <div style={{ width: 16, height: 12, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ width: 80, height: 12, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }} />
      </div>
    );
  }

  const isNoModel = activeModel.name === 'Add model →';
  const tierLabel = activeModel.tier === 'byok' ? 'BYOK' : activeModel.tier === 'free' ? 'FREE' : 'INKLUSIVE';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          border: `1px solid ${isNoModel ? 'var(--brand-gold)' : 'rgba(255,255,255,0.2)'}`,
          background: 'rgba(255,255,255,0.06)',
          color: isNoModel ? 'var(--brand-gold)' : 'rgba(255,255,255,0.85)',
          fontSize: 13, fontWeight: 500, cursor: 'pointer', lineHeight: 1,
          fontFamily: 'var(--font-sans)', transition: 'background 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      >
        {/* F-13: tight line-heights + an SVG chevron (baseline-neutral, unlike the raw
            "▾" glyph whose asymmetric metrics made "Goblin Swift" read off-centre). */}
        <span style={{ lineHeight: 1 }}>{activeModel.name}</span>
        {!isNoModel && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1 }}>· {tierLabel}</span>}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'block', marginLeft: 2 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          width: 300, background: 'var(--panel)', border: '1px solid var(--div)',
          borderRadius: 10, padding: '4px 0', zIndex: 50,
          boxShadow: 'var(--shadow-lg)',
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
        }}>
          {models.length === 0 || byokKeys.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--meta)', marginBottom: 10 }}>
                Noch keine API-Keys konfiguriert.
              </p>
              <a
                href="/welcome/provider"
                style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  background: 'var(--brand-green)',
                  color: 'var(--paper)',
                  borderRadius: 6,
                  fontSize: 'var(--t-caption-fs)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Free-Tier in 60 Sekunden setup →
              </a>
            </div>
          ) : (
            <>
            {TIER_ORDER.map(tier => {
              const tierModels = groupedModels[tier];
              if (!tierModels?.length) return null;
              return (
                <div key={tier}>
                  <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--meta)' }}>
                    {TIER_LABELS[tier]}
                  </div>
                  {tierModels.map(model => {
                    const badge = getBadge(model);
                    const isActive = activeModel.id === model.id;
                    return (
                      <button
                        key={model.id}
                        onClick={() => model.available && handleModelSelect(model)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '8px 12px',
                          background: isActive ? 'rgba(212,169,74,0.06)' : 'none',
                          border: 'none', cursor: model.available ? 'pointer' : 'default',
                          opacity: model.available ? 1 : 0.45,
                          textAlign: 'left', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (model.available) (e.currentTarget.style.background = 'var(--subtle)'); }}
                        onMouseLeave={e => { (e.currentTarget.style.background = isActive ? 'rgba(212,169,74,0.06)' : 'none'); }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {model.name}
                            {isRecommended(model) && (
                              <span
                                title="Empfohlen für Coding-Tasks (basierend auf 5 Public Benchmarks)"
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: '0.5px',
                                  padding: '2px 5px',
                                  borderRadius: 3,
                                  background: 'color-mix(in srgb, var(--brand-green) 8%, transparent)',
                                  color: 'var(--brand-green)',
                                  lineHeight: 1,
                                }}
                              >
                                EMPFOHLEN
                              </span>
                            )}
                            {health[model.provider] && (
                              <span
                                title="Provider temporär instabil — Routing zu Fallback"
                                style={{
                                  fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
                                  padding: '2px 5px', borderRadius: 3,
                                  background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                                  color: 'var(--danger)', lineHeight: 1,
                                }}
                              >
                                INSTABIL
                              </span>
                            )}
                            {PROVIDER_FREE_TIER[model.provider] && (
                              <span
                                title={`Free-Tier: ${PROVIDER_FREE_TIER[model.provider]!.limits}`}
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: '0.5px',
                                  padding: '2px 5px',
                                  borderRadius: 3,
                                  background: 'var(--brand-green)',
                                  color: 'var(--paper)',
                                  lineHeight: 1,
                                }}
                              >
                                FREE
                              </span>
                            )}
                            {model.provider && PROVIDER_URLS[model.provider] && model.requires_key && (
                              <span
                                onClick={e => { e.stopPropagation(); window.open(PROVIDER_URLS[model.provider], '_blank', 'noopener,noreferrer'); }}
                                title={`Get ${model.provider} key`}
                                style={{ fontSize: 10, color: 'var(--meta)', cursor: 'pointer', lineHeight: 1 }}
                              >
                                ↗
                              </span>
                            )}
                          </div>
                          {badge && (
                            <div style={{ fontSize: 10, color: badge.color, marginTop: 1, fontFamily: 'var(--font-sans)' }}>
                              {badge.text}
                            </div>
                          )}
                        </div>
                        {!model.available && model.phase && (
                          <span style={{ fontSize: 10, color: 'var(--meta)', background: 'var(--subtle)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
                            Phase {model.phase}
                          </span>
                        )}
                        {isActive && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-gold)', flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid var(--div)', marginTop: 4, padding: '8px 12px', textAlign: 'center' }}>
              <a href="/models" style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--brand-green)', fontWeight: 600, textDecoration: 'none' }}>
                Alle Modelle anzeigen →
              </a>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}