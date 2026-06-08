'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { SettingsCard } from '../ui/SettingsCard';
import { IOSToggle } from '../ui/IOSToggle';
import { getModelAccess, ACCESS_COLORS } from '@/lib/model-access';
import { useSheetStack } from '../ui/SheetStack';
import { ProviderKeyForm } from './ProviderKeyForm';

type HealthState = 'degraded' | 'down';

type Tab = 'rankings' | 'keys' | 'advanced';
type TaskType = 'coding' | 'reasoning' | 'speed' | 'cost-efficiency' | 'general';

interface RankingRow {
  rank: number;
  composite_score: number;
  source_count: number;
  ranked_models: {
    id: string;
    provider: string;
    display_name: string;
    family: string;
    context_tokens: number | null;
    pricing_in_per_million: number | null;
    is_open_source: boolean;
  };
}

interface ByokKeyRow { provider: string; key_hint?: string | null; status?: string }

interface ModelAdvanced {
  modelId: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

const TASK_LABELS: Record<TaskType, string> = {
  'coding': 'Coding',
  'reasoning': 'Reasoning',
  'speed': 'Speed',
  'cost-efficiency': 'Kosten',
  'general': 'Allgemein',
};

const PROVIDERS = ['anthropic', 'openai', 'google', 'mistral', 'groq', 'together', 'deepseek', 'fireworks'] as const;
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', mistral: 'Mistral',
  groq: 'Groq', together: 'Together AI', deepseek: 'DeepSeek', fireworks: 'Fireworks AI',
};

const ADV_KEY = 'goblin-model-advanced';
const DEFAULT_KEY = 'goblin-default-model';

export function ModelsPage() {
  const [tab, setTab] = useState<Tab>('rankings');

  return (
    <div className="settings-section" style={{ padding: '0 0 24px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ padding: '4px 20px 12px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-meta)', margin: 0, lineHeight: 1.5 }}>
          Rankings aus 5 öffentlichen Benchmarks. Alle 6 Stunden aktualisiert.
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 4, padding: '0 16px',
        borderBottom: '1px solid var(--border-subtle)', marginBottom: 16,
      }}>
        {([
          { id: 'rankings', label: 'Rankings' },
          { id: 'keys', label: 'Meine Keys' },
          { id: 'advanced', label: 'Erweitert' },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`models-tab-${t.id}`}
            style={{
              padding: '10px 16px',
              background: 'transparent', border: 'none',
              borderBottom: '2px solid',
              borderColor: tab === t.id ? 'var(--brand-green)' : 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-meta)',
              fontSize: 'var(--t-small-fs)', fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              marginBottom: -1,
            }}
          >{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>
        {tab === 'rankings' && <RankingsTab />}
        {tab === 'keys' && <KeysTab />}
        {tab === 'advanced' && <AdvancedTab />}
      </div>
    </div>
  );
}

function RankingsTab() {
  const [task, setTask] = useState<TaskType>('coding');
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  // FIX4: liveness preflight on "Standard setzen" — probe the real model before
  // pinning it, so a dead model (e.g. Gemini-via-BYOK) can't become the default.
  const [probing, setProbing] = useState<string | null>(null);
  const [probeError, setProbeError] = useState<{ id: string; msg: string } | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  // FIX3-1 (V2-P1-1): per-provider liveness from the circuit-breaker. Without this
  // the ranking pushed a high-benchmark-but-dead model (Gemini) as a one-tap
  // "Standard setzen" while "Nur nutzbare" only meant "has a key". Now liveness is
  // real: a 'down' provider can't be set as default and is filtered from usable.
  const [health, setHealth] = useState<Record<string, HealthState>>({});
  // Default ON: a fresh session shows what the user can actually run first.
  const [onlyUsable, setOnlyUsable] = useState(true);

  useEffect(() => {
    // WALKFIX-2.3: read connected keys from the authoritative server source
    // (/api/byok-keys, like the rest of the app) instead of a client-side supabase
    // query against byok_keys. The direct client read was slow AND, when RLS/timing
    // returned nothing, showed "kein Key verbunden" even though Groq IS connected.
    // A stored key = connected here; liveness ("works") is handled separately by the
    // health gate / probe — a connected-but-dead Gemini key still shows connected.
    apiGet<Array<{ provider: string; status?: string }>>('/api/byok-keys')
      .then((rows) => {
        const set = new Set<string>();
        for (const k of rows ?? []) if (k.status !== 'revoked') set.add(k.provider);
        setConnectedProviders(set);
      })
      .catch(() => { /* leave empty — list still renders */ });
    // /api/models/health returns only NOT-healthy providers (empty = all good).
    apiGet<Record<string, HealthState>>('/api/models/health')
      .then((h) => setHealth(h ?? {}))
      .catch(() => { /* breaker unreachable → treat all as healthy */ });
  }, []);

  useEffect(() => {
    setLoading(true);
    // Per-category default ("Standard"): exactly one per task tab.
    setDefaultId(localStorage.getItem(`${DEFAULT_KEY}-${task}`));
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    fetch(`${apiBase}/api/rankings?task=${task}&limit=30`)
      .then(r => r.ok ? r.json() : { rankings: [] })
      .then(d => setRows(d.rankings ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [task]);

  // FIX4: probe the model with a tiny real generation before setting it as default.
  // On failure we refuse + explain, so the user can't one-tap into a dead default.
  async function setDefault(model: { id: string; provider: string }) {
    setProbeError(null);
    setProbing(model.id);
    try {
      const r = await apiPost<{ ok: boolean; error?: string }>('/api/models/probe', { slug: `${model.provider}/${model.id}` });
      if (r?.ok) {
        setDefaultId(model.id);
        localStorage.setItem(`${DEFAULT_KEY}-${task}`, model.id);
      } else {
        setProbeError({ id: model.id, msg: 'Antwortet derzeit nicht — nicht als Standard gesetzt.' });
      }
    } catch {
      setProbeError({ id: model.id, msg: 'Konnte nicht geprüft werden — bitte erneut versuchen.' });
    } finally {
      setProbing(null);
    }
  }

  // Smart-sort: usable models first (keyed > free > free-then-byok > byok), then by rank.
  function usabilityRank(provider: string): number {
    if (connectedProviders.has(provider)) return 0;
    const a = getModelAccess(provider).type;
    if (a === 'free') return 1;
    if (a === 'free-then-byok') return 2;
    return 3;
  }
  function isUsable(provider: string): boolean {
    // A provider the breaker reports 'down' is not usable, even with a key.
    if (health[provider] === 'down') return false;
    return usabilityRank(provider) < 3;
  }

  // Logical order = category rank ascending (#1 best). Usability is a FILTER (the
  // "Nur nutzbare" toggle) + a badge — not a sort key. Previously usability-first
  // sorting scrambled the rank column (#4, #8, #25, then #1), which read as broken.
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.rank - b.rank);
  }, [rows]);

  const filteredRows = useMemo(
    () => onlyUsable ? sortedRows.filter(r => isUsable(r.ranked_models.provider)) : sortedRows,
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortedRows, onlyUsable, connectedProviders],
  );

  const hasNoKeyAccess = connectedProviders.size === 0;

  return (
    <>
      {/* Context banner: no keys yet → suggest free-tier */}
      {hasNoKeyAccess && (
        <div style={{
          background: 'rgba(45,74,43,0.06)',
          border: '1px solid rgba(45,74,43,0.16)',
          borderRadius: 10, padding: '10px 14px',
          fontSize: 13, color: 'var(--text)', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span>Du hast noch keine Keys hinterlegt.</span>
          <a href="/welcome/provider" style={{
            color: 'var(--brand-green)', fontWeight: 600, textDecoration: 'none',
            fontSize: 13, whiteSpace: 'nowrap',
          }}>Free-Tier einrichten →</a>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
        {(Object.keys(TASK_LABELS) as TaskType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTask(t)}
            data-testid={`task-${t}`}
            style={{
              padding: '8px 14px', borderRadius: 999,
              background: task === t ? 'var(--brand-green)' : 'transparent',
              border: '1px solid', borderColor: task === t ? 'var(--brand-green)' : 'var(--border-subtle)',
              color: task === t ? '#fff' : 'var(--text-2)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
              flexShrink: 0,
            }}
          >{TASK_LABELS[t]}</button>
        ))}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, gap: 12,
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-meta)' }}>Nur nutzbare Modelle</span>
        <IOSToggle value={onlyUsable} onChange={setOnlyUsable} ariaLabel="Nur nutzbare Modelle" />
      </div>

      {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-meta)' }}>Lade Rankings…</div>}
      {!loading && filteredRows.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-meta)', fontSize: 'var(--t-small-fs)' }}>
          {onlyUsable
            ? 'Keine nutzbaren Modelle für diesen Task. Toggle „Nur nutzbare" ausschalten oder Free-Tier einrichten.'
            : 'Noch keine Daten für diesen Task. Refresh läuft alle 6h.'}
        </div>
      )}
      {!loading && filteredRows.map((r) => {
        const m = r.ranked_models;
        const isDefault = defaultId === m.id;
        const access = getModelAccess(m.provider);
        const keyed = connectedProviders.has(m.provider);
        const hstate = health[m.provider];
        const down = hstate === 'down';
        const degraded = hstate === 'degraded';
        const colors = down
          ? { bg: 'rgba(160,66,48,0.10)', fg: 'var(--danger, #a04230)', border: 'rgba(160,66,48,0.28)' }
          : keyed
            ? { bg: 'rgba(45,74,43,0.10)', fg: 'var(--brand-green)', border: 'rgba(45,74,43,0.24)' }
            : ACCESS_COLORS[access.type];
        const badgeLabel = down ? 'Nicht verfügbar' : keyed ? 'Mein Key' : access.label;
        return (
          <div key={m.id}>
          <div className="list-item" style={{
            padding: '14px 16px', marginBottom: probeError?.id === m.id ? 0 : 8,
            // Top-3 of each category get a subtle tint to surface the best picks.
            background: r.rank <= 3 ? 'color-mix(in srgb, var(--brand-green) 5%, var(--panel))' : 'var(--panel)',
            border: '1px solid', borderColor: isDefault ? 'var(--brand-green)' : 'var(--border-subtle)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{
              width: 30, fontSize: 13, color: 'var(--text-meta)',
              fontFamily: 'var(--font-mono)', flexShrink: 0,
            }}>#{r.rank}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.display_name}</span>
                <span style={{
                  padding: '1px 7px', borderRadius: 6,
                  background: colors.bg, color: colors.fg,
                  border: `1px solid ${colors.border}`,
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                  textTransform: 'uppercase', flexShrink: 0,
                }}>{badgeLabel}</span>
              </div>
              <div style={{ color: 'var(--text-meta)', fontSize: 'var(--t-caption-fs)', marginTop: 2 }}>
                {m.provider} · Score {(r.composite_score * 100).toFixed(0)} · {r.source_count} {r.source_count === 1 ? 'Quelle' : 'Quellen'}
                {m.context_tokens ? ` · ${(m.context_tokens / 1000).toFixed(0)}k Kontext` : ''}
                {down ? ' · antwortet derzeit nicht' : degraded ? ' · eingeschränkt' : ''}
              </div>
            </div>
            {down ? (
              // Never let a user one-tap themselves into a dead default.
              <span style={{
                padding: '4px 10px', borderRadius: 8,
                background: 'rgba(160,66,48,0.08)', color: 'var(--danger, #a04230)',
                fontSize: 11, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
              }}>Nicht verfügbar</span>
            ) : isDefault ? (
              <span style={{
                padding: '4px 10px', borderRadius: 8,
                background: 'color-mix(in srgb, var(--brand-green) 8%, transparent)', color: 'var(--brand-green)',
                fontSize: 11, fontWeight: 600, flexShrink: 0,
              }}>Standard</span>
            ) : (
              <button
                onClick={() => setDefault({ id: m.id, provider: m.provider })}
                disabled={probing === m.id}
                style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: 'transparent', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-2)', fontSize: 11, fontWeight: 600,
                  cursor: probing === m.id ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)',
                  flexShrink: 0, opacity: probing === m.id ? 0.6 : 1,
                }}
              >{probing === m.id ? 'Prüfe…' : 'Standard setzen'}</button>
            )}
          </div>
          {probeError?.id === m.id && (
            <div style={{ marginTop: -2, marginBottom: 8, fontSize: 'var(--t-caption-fs)', color: 'var(--danger, #a04230)', paddingLeft: 46 }}>
              {probeError.msg}
            </div>
          )}
        </div>
        );
      })}
    </>
  );
}

function KeysTab() {
  const { push, pop } = useSheetStack();
  const [keys, setKeys] = useState<ByokKeyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    // WALKFIX-2.3: authoritative server source (fast, no client RLS round-trip),
    // same as the Modelle tab's connected-state read.
    try {
      const rows = await apiGet<ByokKeyRow[]>('/api/byok-keys');
      setKeys(rows ?? []);
    } catch { /* keep prior/empty — UI still renders the providers list */ }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  function openProvider(p: string, existing?: ByokKeyRow) {
    const labelName = PROVIDER_LABELS[p] ?? p;
    push(
      `key-${p}`,
      <ProviderKeyForm
        provider={p}
        providerLabel={labelName}
        existingHint={existing?.key_hint ?? null}
        onSaved={() => void load()}
        onBack={pop}
      />,
      `${labelName} ${existing ? 'verwalten' : 'verbinden'}`,
    );
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-meta)' }}>Lade Keys…</div>;

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-meta)', marginBottom: 12, lineHeight: 1.5 }}>
        Hinterlege deine eigenen API-Keys. Goblin routet direkt über deinen Provider —
        du zahlst nur das, was du verbrauchst, ohne Goblin-Margen.
      </p>
      <SettingsCard>
        {PROVIDERS.map((p) => {
          const k = keys.find(x => x.provider === p && x.status !== 'revoked');
          return (
            <div key={p} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border-hairline)' }}>
              <span style={{
                width: 32, height: 32, borderRadius: 8, background: 'var(--subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'var(--meta)', fontFamily: 'var(--font-mono)',
              }}>{(PROVIDER_LABELS[p] ?? p)[0]?.toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{PROVIDER_LABELS[p] ?? p}</div>
                <div style={{ fontSize: 13, color: 'var(--text-meta)', marginTop: 2 }}>
                  {/* BUG-24: provider-agnostic mask — not every key is an OpenAI
                      "sk-" key (Google is "AIza…", Anthropic "sk-ant-…"). */}
                  {k ? `…${k.key_hint ?? '****'}` : 'Nicht verbunden'}
                </div>
              </div>
              <button type="button" onClick={() => openProvider(p, k)} style={{
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                background: k ? 'transparent' : 'var(--brand-green)',
                color: k ? 'var(--text-2)' : '#fff',
                border: '1px solid', borderColor: k ? 'var(--border-subtle)' : 'var(--brand-green)',
                fontSize: 'var(--t-caption-fs)', fontWeight: 600,
                fontFamily: 'var(--font-sans)',
              }}>{k ? 'Verwalten' : 'Hinzufügen'}</button>
            </div>
          );
        })}
      </SettingsCard>
    </>
  );
}

function AdvancedTab() {
  const [advanced, setAdvanced] = useState<Record<string, ModelAdvanced>>({});
  const [models, setModels] = useState<{ id: string; display_name: string; provider: string }[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADV_KEY);
      if (raw) setAdvanced(JSON.parse(raw));
    } catch {}
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
    fetch(`${apiBase}/api/rankings?task=coding&limit=10`)
      .then(r => r.ok ? r.json() : { rankings: [] })
      .then(d => setModels(((d.rankings as RankingRow[] | undefined) ?? []).map(r => ({
        id: r.ranked_models.id,
        display_name: r.ranked_models.display_name,
        provider: r.ranked_models.provider,
      }))))
      .catch(() => {});
  }, []);

  function update(modelId: string, patch: Partial<ModelAdvanced>) {
    const next = {
      ...advanced,
      [modelId]: {
        modelId,
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: '',
        ...(advanced[modelId] ?? {}),
        ...patch,
      },
    };
    setAdvanced(next);
    try { localStorage.setItem(ADV_KEY, JSON.stringify(next)); } catch {}
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: 'var(--subtle)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text)', fontSize: 'var(--t-small-fs)',
    fontFamily: 'var(--font-sans)', outline: 'none',
  };

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-meta)', marginBottom: 12, lineHeight: 1.5 }}>
        Standardwerte pro Modell. Gilt für neue Chats.
      </p>
      {models.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-meta)', fontSize: 'var(--t-small-fs)' }}>
          Lade Modelle…
        </div>
      )}
      {models.map((m) => {
        const cfg = advanced[m.id] ?? { modelId: m.id, temperature: 0.7, maxTokens: 4096, systemPrompt: '' };
        const open = openId === m.id;
        return (
          <div key={m.id} style={{
            background: 'var(--panel)', border: '1px solid var(--border-subtle)',
            borderRadius: 12, marginBottom: 8, overflow: 'hidden',
          }}>
            <button onClick={() => setOpenId(open ? null : m.id)} style={{
              width: '100%', padding: 14, background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', textAlign: 'left',
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{m.display_name}</div>
                <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', marginTop: 2 }}>
                  {m.provider} · temp {cfg.temperature.toFixed(1)} · {cfg.maxTokens} tok
                </div>
              </div>
              <span style={{ color: 'var(--text-meta)', fontSize: 'var(--t-body-fs)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
            </button>
            {open && (
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Temperature</span><span>{cfg.temperature.toFixed(1)}</span>
                  </span>
                  <input type="range" min={0} max={1} step={0.1} value={cfg.temperature}
                    onChange={(e) => update(m.id, { temperature: parseFloat(e.target.value) })}
                    style={{ accentColor: 'var(--brand-green)' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)' }}>Max Tokens</span>
                  <input type="number" min={100} max={32000} step={100} value={cfg.maxTokens}
                    onChange={(e) => update(m.id, { maxTokens: parseInt(e.target.value, 10) || 4096 })}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--text-meta)' }}>System Prompt (optional)</span>
                  <textarea value={cfg.systemPrompt}
                    onChange={(e) => update(m.id, { systemPrompt: e.target.value })}
                    placeholder="z.B. Antworte immer auf Deutsch…"
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                    maxLength={1000}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
