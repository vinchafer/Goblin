"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ByokKey } from "@goblin/shared/src/schemas";

interface KeysListProps {
  initialKeys: ByokKey[];
}

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic',      initial: 'An', model: 'Claude Sonnet 4.6',  dashboard: 'https://console.anthropic.com/settings/keys',   desc: 'Best for coding — powers Claude Sonnet',        hasCreditsLink: false },
  { id: 'openai',    label: 'OpenAI',          initial: 'Ai', model: 'GPT-4o',             dashboard: 'https://platform.openai.com/api-keys',           desc: 'GPT-4o and o1 models',                          hasCreditsLink: true,  creditsUrl: 'https://platform.openai.com/usage' },
  { id: 'google',    label: 'Google AI',       initial: 'G',  model: 'Gemini 2.0 Flash',   dashboard: 'https://aistudio.google.com/app/apikey',         desc: 'Gemini 2.0 Flash — fast, generous free tier',   hasCreditsLink: false },
  { id: 'groq',      label: 'Groq',            initial: 'Gq', model: 'Llama 3.3 70B',      dashboard: 'https://console.groq.com/keys',                  desc: 'Llama 3.3 70B — fastest inference',             hasCreditsLink: false },
  { id: 'deepseek',  label: 'DeepSeek',        initial: 'Ds', model: 'DeepSeek V3',        dashboard: 'https://platform.deepseek.com/api_keys',         desc: 'DeepSeek V3 — best price/performance',          hasCreditsLink: true,  creditsUrl: 'https://platform.deepseek.com' },
  { id: 'mistral',   label: 'Mistral',         initial: 'Mi', model: 'Mistral Large',      dashboard: 'https://console.mistral.ai/api-keys/',           desc: 'European AI, GDPR-friendly',                    hasCreditsLink: true,  creditsUrl: 'https://console.mistral.ai/billing' },
  { id: 'xai',       label: 'xAI',             initial: 'X',  model: 'Grok 3',             dashboard: 'https://console.x.ai/',                          desc: 'Grok 3 — powerful reasoning',                   hasCreditsLink: false },
  { id: 'together',  label: 'Together AI',     initial: 'To', model: 'Llama 3.3 70B',      dashboard: 'https://api.together.xyz/settings/api-keys',     desc: '100+ open source models',                       hasCreditsLink: true,  creditsUrl: 'https://api.together.xyz/settings/billing' },
  { id: 'fireworks', label: 'Fireworks AI',    initial: 'Fw', model: 'Llama 3.3 70B',      dashboard: 'https://fireworks.ai/account/api-keys',          desc: 'Fast inference, open source models',            hasCreditsLink: false },
  { id: 'custom',    label: 'Custom Endpoint', initial: '∞',  model: 'OpenAI-compatible',  dashboard: '',                                               desc: 'Any OpenAI-compatible API endpoint',            hasCreditsLink: false },
];

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg style={{ animation: 'spin 0.7s linear infinite' }} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="8" opacity="0.3" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function KeysList({ initialKeys }: KeysListProps) {
  const [keys, setKeys] = useState<ByokKey[]>(initialKeys);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [saveError, setSaveError] = useState<Record<string, string>>({});
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<Record<string, { baseUrl: string; model: string; timeout: string }>>({});
  const supabase = createClient();

  const activeForProvider = (provider: string) =>
    keys.find(k => k.provider === provider && k.status === 'active');

  const handleSave = async (provider: string) => {
    const rawKey = keyInput[provider]?.trim();
    if (!rawKey) return;

    const providerMeta = PROVIDERS.find(p => p.id === provider);
    setSaveStatus(prev => ({ ...prev, [provider]: 'saving' }));
    setSaveError(prev => ({ ...prev, [provider]: '' }));

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const body: Record<string, unknown> = {
        provider,
        label: providerMeta?.label ?? provider,
        key: rawKey,
      };
      const adv = advancedSettings[provider];
      if (adv?.baseUrl) body.baseUrl = adv.baseUrl;
      if (adv?.model) body.model = adv.model;
      if (adv?.timeout) body.timeout = parseInt(adv.timeout, 10);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/byok-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save key');
      }

      const newKey = await response.json() as ByokKey;
      setKeys(prev => [newKey, ...prev.filter(k => !(k.provider === provider && k.status === 'active'))]);
      setKeyInput(prev => ({ ...prev, [provider]: '' }));
      setSaveStatus(prev => ({ ...prev, [provider]: 'success' }));
      // Collapse the inline panel after a brief success flash
      setTimeout(() => {
        setConnecting(null);
        setSaveStatus(prev => ({ ...prev, [provider]: 'idle' }));
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect key';
      setSaveError(prev => ({ ...prev, [provider]: msg }));
      setSaveStatus(prev => ({ ...prev, [provider]: 'error' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [provider]: 'idle' })), 4000);
    }
  };

  const handleRevoke = async (keyId: string, provider: string) => {
    setRevokingId(keyId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/byok-keys/${keyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setKeys(prev => prev.filter(k => k.id !== keyId));
    } catch {
      // ignore
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {PROVIDERS.map(p => {
          const activeKey = activeForProvider(p.id);
          const isConnecting = connecting === p.id;
          const status = saveStatus[p.id] ?? 'idle';
          const errMsg = saveError[p.id];

          return (
            <div key={p.id}>
              {/* ── Provider row ── */}
              <div className={`keys-provider-row${activeKey ? ' connected' : ''}${isConnecting ? ' open' : ''}`}>
                {/* Initial badge */}
                <div className={`keys-provider-badge ${activeKey ? 'connected' : 'idle'}`}>
                  {p.initial}
                </div>

                {/* Label + hint */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 'var(--t-small-fs)', fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
                      {p.label}
                    </span>
                    {activeKey && activeKey.last_validation_result === 'invalid' ? (
                      // 10.9-2 — the daily refresh found this key no longer valid.
                      // We never delete it; we surface it so the user can re-enter.
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11, color: 'var(--danger)', fontWeight: 600,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
                        Key ungültig — bitte prüfen
                      </span>
                    ) : activeKey && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11, color: 'var(--brand-green)', fontWeight: 500,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-green)', display: 'inline-block' }} />
                        Connected
                      </span>
                    )}
                  </div>
                  {activeKey ? (
                    <div style={{
                      fontSize: 11, color: 'var(--meta)', marginTop: 2,
                      fontFamily: 'JetBrains Mono, monospace',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span>····{activeKey.key_hint ?? '····'}</span>
                      {p.hasCreditsLink && p.creditsUrl && (
                        <a
                          href={p.creditsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: 'var(--brand-gold)', fontFamily: 'var(--font-sans)', textDecoration: 'none', fontWeight: 500 }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          Check credits →
                        </a>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', marginTop: 1, fontFamily: 'var(--font-sans)' }}>
                      {p.desc}
                    </div>
                  )}
                </div>

                {/* Action */}
                {activeKey ? (
                  <button
                    onClick={() => handleRevoke(activeKey.id, p.id)}
                    disabled={revokingId === activeKey.id}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '6px 14px',
                      fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--danger)',
                      cursor: revokingId === activeKey.id ? 'not-allowed' : 'pointer',
                      opacity: revokingId === activeKey.id ? 0.5 : 1,
                      transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(184,92,60,0.05)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    {revokingId === activeKey.id ? '...' : 'Remove'}
                  </button>
                ) : (
                  <button
                    onClick={() => { setConnecting(isConnecting ? null : p.id); setSaveError(prev => ({ ...prev, [p.id]: '' })); }}
                    style={{
                      background: isConnecting ? 'transparent' : 'var(--brand-gold)',
                      border: isConnecting ? '1px solid var(--border)' : 'none',
                      borderRadius: 6, padding: '7px 16px',
                      fontSize: 'var(--t-caption-fs)', fontWeight: 600,
                      color: isConnecting ? 'var(--meta)' : '#2A1F0F',
                      cursor: 'pointer', transition: 'background 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (!isConnecting) e.currentTarget.style.background = '#E8B05A'; }}
                    onMouseLeave={e => { if (!isConnecting) e.currentTarget.style.background = 'var(--brand-gold)'; }}
                  >
                    {isConnecting ? 'Cancel' : 'Add key →'}
                  </button>
                )}
              </div>

              {/* ── Inline input panel ── */}
              {isConnecting && (
                <div className="keys-input-panel">
                  <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', marginBottom: 10, lineHeight: 1.5 }}>
                    {p.desc} — model: <strong style={{ color: 'var(--text)' }}>{p.model}</strong>
                    {p.dashboard && (
                      <>
                        {' · '}
                        <a href={p.dashboard} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-gold)', textDecoration: 'underline' }}>
                          Get API key →
                        </a>
                      </>
                    )}
                  </p>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type={showKey[p.id] ? 'text' : 'password'}
                        value={keyInput[p.id] || ''}
                        onChange={e => setKeyInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(p.id); }}
                        placeholder="Paste your API key"
                        style={{
                          width: '100%', padding: '9px 36px 9px 12px',
                          borderRadius: 8, fontSize: 13,
                          border: `1.5px solid ${errMsg ? 'var(--danger)' : 'var(--border)'}`,
                          fontFamily: 'JetBrains Mono, monospace',
                          background: 'var(--panel)', color: 'var(--text)',
                          outline: 'none', boxSizing: 'border-box',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={e => { if (!errMsg) e.target.style.borderColor = 'var(--brand-green)'; }}
                        onBlur={e => { e.target.style.borderColor = errMsg ? 'var(--danger)' : 'var(--border)'; }}
                      />
                      <button
                        onClick={() => setShowKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meta)', padding: 2, display: 'flex', alignItems: 'center' }}
                      >
                        {showKey[p.id]
                          ? <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2.5"/><line x1="3" y1="3" x2="17" y2="17"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2.5"/></svg>
                        }
                      </button>
                    </div>

                    <button
                      onClick={() => handleSave(p.id)}
                      disabled={!keyInput[p.id]?.trim() || status === 'saving'}
                      style={{
                        padding: '9px 20px', borderRadius: 8, border: 'none',
                        fontSize: 13, fontWeight: 600,
                        cursor: status === 'saving' ? 'wait' : (!keyInput[p.id]?.trim() ? 'not-allowed' : 'pointer'),
                        background: status === 'success' ? 'var(--brand-green)' : status === 'error' ? 'var(--danger)' : 'var(--brand-green)',
                        color: '#fff',
                        opacity: !keyInput[p.id]?.trim() && status === 'idle' ? 0.45 : 1,
                        whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: 7,
                        transition: 'background 0.2s',
                        minWidth: 96,
                        justifyContent: 'center',
                      }}
                    >
                      {status === 'saving' && <Spinner />}
                      {status === 'saving' ? 'Validating…'
                        : status === 'success' ? '✓ Connected'
                        : status === 'error'   ? '✗ Invalid'
                        : 'Save key'}
                    </button>
                  </div>

                  {errMsg && (
                    <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--danger)', marginTop: 7, fontFamily: 'var(--font-sans)' }}>
                      {errMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Advanced Toggle */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          style={{ background: 'none', border: 'none', color: 'var(--meta)', fontSize: 'var(--t-caption-fs)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {advancedOpen ? '▲ Hide Advanced' : '▼ Advanced (custom endpoints)'}
        </button>
      </div>

      {advancedOpen && (
        <div className="keys-advanced-panel">
          <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', marginBottom: 12 }}>
            Override base URLs for self-hosted or OpenAI-compatible providers.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PROVIDERS.filter(p => p.id !== 'custom').map(p => {
              const adv = advancedSettings[p.id] || { baseUrl: '', model: '', timeout: '' };
              return (
                <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--t-caption-fs)' }}>
                  <span style={{ width: 96, color: 'var(--text)', fontWeight: 500, flexShrink: 0, fontFamily: 'var(--font-sans)' }}>{p.label}</span>
                  <input
                    placeholder="Custom base URL"
                    value={adv.baseUrl}
                    onChange={e => setAdvancedSettings(prev => ({ ...prev, [p.id]: { ...adv, baseUrl: e.target.value } }))}
                    style={{ flex: 2, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 'var(--t-caption-fs)', fontFamily: 'JetBrains Mono, monospace', background: 'var(--panel)', color: 'var(--text)' }}
                  />
                  <input
                    placeholder="Model override"
                    value={adv.model}
                    onChange={e => setAdvancedSettings(prev => ({ ...prev, [p.id]: { ...adv, model: e.target.value } }))}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 'var(--t-caption-fs)', fontFamily: 'JetBrains Mono, monospace', background: 'var(--panel)', color: 'var(--text)' }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
