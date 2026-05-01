"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ByokKey } from "@goblin/shared/src/schemas";
import { Eye, EyeOff, Check, Trash2, ChevronDown, ChevronUp, Key, Zap, Cpu, Bot, Code, Globe, Layers } from "lucide-react";

interface KeysListProps {
  initialKeys: ByokKey[];
}

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic',     icon: Key, model: 'Claude Sonnet 4.6',  dashboard: 'https://console.anthropic.com/settings/keys', desc: 'Best for coding — powers Claude Sonnet' },
  { id: 'google',    label: 'Google AI Studio', icon: Zap, model: 'Gemini 2.0 Flash', dashboard: 'https://aistudio.google.com/app/apikey', desc: 'Gemini 2.0 Flash — fast, generous free tier' },
  { id: 'groq',      label: 'Groq',           icon: Cpu, model: 'Llama 3.3 70B',       dashboard: 'https://console.groq.com/keys',         desc: 'Llama 3.3 70B — fastest inference' },
  { id: 'openai',    label: 'OpenAI',         icon: Bot, model: 'GPT-4o',              dashboard: 'https://platform.openai.com/api-keys',  desc: 'GPT-4o and o1 models' },
  { id: 'deepseek',  label: 'DeepSeek',       icon: Code, model: 'DeepSeek V3',         dashboard: 'https://platform.deepseek.com/api_keys', desc: 'DeepSeek V3 — best price/performance' },
  { id: 'mistral',   label: 'Mistral',        icon: Globe, model: 'Mistral Large',      dashboard: 'https://console.mistral.ai/api-keys/',  desc: 'European AI, GDPR-friendly' },
  { id: 'xai',       label: 'xAI (Grok)',     icon: Zap, model: 'Grok 2',             dashboard: 'https://console.x.ai/',                desc: 'Grok 2 — real-time knowledge' },
  { id: 'together',  label: 'Together AI',    icon: Layers, model: 'Llama 3 70B',        dashboard: 'https://api.together.xyz/settings/api-keys', desc: '100+ open source models' },
  { id: 'fireworks', label: 'Fireworks AI',   icon: Zap,    model: 'Llama 3.1 405B',     dashboard: 'https://fireworks.ai/account/api-keys',       desc: 'Fast inference, open source models' },
  { id: 'custom',    label: 'Custom Endpoint', icon: Globe, model: 'OpenAI-compatible',  dashboard: '',                                             desc: 'Any OpenAI-compatible API endpoint' },
];

export function KeysList({ initialKeys }: KeysListProps) {
  const [keys, setKeys] = useState<ByokKey[]>(initialKeys);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<Record<string, { baseUrl: string; model: string; timeout: string }>>({});
  const supabase = createClient();

  const activeForProvider = (provider: string) =>
    keys.find(k => k.provider === provider && k.status === 'active');

  const handleSave = async (provider: string) => {
    const rawKey = keyInput[provider]?.trim();
    if (!rawKey) return;

    setSavingKey(provider);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const body: Record<string, any> = { provider, key: rawKey };
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

      const newKey = await response.json();
      setKeys(prev => [newKey, ...prev]);
      setKeyInput(prev => ({ ...prev, [provider]: '' }));
      setConnecting(null);
      setSuccess(`${PROVIDERS.find(p => p.id === provider)?.label} key connected!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect key');
      setTimeout(() => setError(null), 4000);
    } finally {
      setSavingKey(null);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/byok-keys/${keyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      setKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'revoked' as const } : k));
    } catch {
      // ignore
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div>
      {/* Success Banner */}
      {success && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(74,124,59,0.1)', color: '#4a7c3b', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#b85c3c', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Provider Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 12,
      }}>
        {PROVIDERS.map(p => {
          const activeKey = activeForProvider(p.id);
          const isConnecting = connecting === p.id;

          return (
            <div key={p.id}>
              {/* Provider card */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '18px 20px',
                background: activeKey ? 'rgba(74,124,59,0.04)' : '#FFFFFF',
                border: activeKey ? '1px solid rgba(74,124,59,0.25)' : '1px solid #EDE8DC',
                borderRadius: 10, minHeight: 72,
                transition: 'border-color 0.15s',
              }}>
                <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: activeKey ? 'rgba(74,124,59,0.1)' : 'rgba(212,169,74,0.1)', borderRadius: 8, flexShrink: 0, marginTop: 2 }}>
                  {React.createElement(p.icon, { size: 18, color: activeKey ? '#4a7c3b' : '#D4A94A' })}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#2A2A2A', fontFamily: 'DM Sans, sans-serif' }}>{p.label}</span>
                    {activeKey && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#4a7c3b', fontWeight: 500 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a7c3b', display: 'inline-block' }} />
                        Connected
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B6B6B', marginBottom: activeKey ? 6 : 0 }}>
                    {p.desc}
                  </div>
                  {activeKey && (
                    <div style={{ fontSize: 11, color: '#6b6560', fontFamily: 'JetBrains Mono, monospace' }}>
                      sk-···· {(activeKey as any).key_hint?.slice(-4) || '····'}
                      {activeKey.created_at && (
                        <span style={{ marginLeft: 8, fontFamily: 'DM Sans, sans-serif', color: '#9b9691' }}>
                          since {new Date(activeKey.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Status & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {activeKey ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a7c3b' }} />
                        <span style={{ fontSize: 12, color: '#4a7c3b', fontWeight: 500 }}>
                          Connected ···· {(activeKey as any).key_hint?.slice(-4) || '4Xk2'}
                        </span>
                      </div>
                      <button
                        onClick={() => setRevokingId(activeKey.id)}
                        style={{ 
                          background: 'none', 
                          border: '1px solid #EDE8DC', 
                          borderRadius: 6, 
                          padding: '6px 12px', 
                          fontSize: 12, 
                          fontWeight: 600,
                          color: '#B85C3C', 
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(184, 92, 60, 0.05)'; e.currentTarget.style.borderColor = '#B85C3C'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#EDE8DC'; }}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setConnecting(p.id); setError(null); }}
                      style={{ 
                        background: '#D4A94A', 
                        border: 'none', 
                        borderRadius: 6, 
                        padding: '8px 16px', 
                        fontSize: 12, 
                        fontWeight: 600,
                        color: '#2A1F0F', 
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#E8B05A'}
                      onMouseLeave={e => e.currentTarget.style.background = '#D4A94A'}
                    >
                      Add →
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Connect Panel */}
              {isConnecting && (
                <div style={{
                  marginTop: 8,
                  padding: '16px 14px',
                  background: '#f7f3ec', border: '1px solid #e4ddd2',
                  borderRadius: 8,
                }}>
                  <p style={{ fontSize: 12, color: '#6b6560', marginBottom: 10, lineHeight: 1.5 }}>
                    {p.desc} Model: <strong style={{ color: '#1e3a1c' }}>{p.model}</strong>.
                    <br />
                    <a href={p.dashboard} target="_blank" rel="noopener noreferrer" style={{ color: '#c9933a', textDecoration: 'underline' }}>
                      Get your key →
                    </a>
                  </p>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type={showKey[p.id] ? 'text' : 'password'}
                        value={keyInput[p.id] || ''}
                        onChange={e => setKeyInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="Paste your API key"
                        style={{
                          width: '100%', padding: '9px 36px 9px 12px',
                          borderRadius: 6, border: '1px solid #e4ddd2',
                          fontSize: 13, fontFamily: 'monospace',
                          background: '#fff', outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        onClick={() => setShowKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b6560', padding: 4 }}
                      >
                        {showKey[p.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleSave(p.id)}
                      disabled={!keyInput[p.id]?.trim() || savingKey === p.id}
                      style={{
                        padding: '9px 18px', borderRadius: 6, border: 'none',
                        fontSize: 13, fontWeight: 600, cursor: savingKey === p.id ? 'wait' : 'pointer',
                        background: '#1e3a1c', color: '#c9933a',
                        opacity: !keyInput[p.id]?.trim() ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {savingKey === p.id ? 'Saving...' : 'Save key'}
                    </button>
                    <button
                      onClick={() => { setConnecting(null); setError(null); setKeyInput(prev => ({ ...prev, [p.id]: '' })); }}
                      style={{ background: 'none', border: 'none', color: '#6b6560', cursor: 'pointer', fontSize: 13, padding: '9px 8px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Advanced Toggle */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          style={{ background: 'none', border: 'none', color: '#6b6560', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {advancedOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {advancedOpen ? 'Hide Advanced' : 'Advanced'}
        </button>
      </div>

      {/* Advanced Settings Panel */}
      {advancedOpen && (
        <div style={{ marginTop: 12, padding: 16, background: '#f7f3ec', border: '1px solid #e4ddd2', borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: '#6b6560', marginBottom: 12 }}>
            Override API endpoints for self-hosted or OpenAI-compatible providers.
            Leave blank to use defaults.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PROVIDERS.map(p => {
              const adv = advancedSettings[p.id] || { baseUrl: '', model: '', timeout: '' };
              return (
                <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                  <span style={{ width: 100, color: '#1e3a1c', fontWeight: 500, flexShrink: 0 }}>{p.label}</span>
                  <input
                    placeholder="Custom Base URL"
                    value={adv.baseUrl}
                    onChange={e => setAdvancedSettings(prev => ({ ...prev, [p.id]: { ...prev[p.id], baseUrl: e.target.value, model: prev[p.id]?.model || '', timeout: prev[p.id]?.timeout || '' } }))}
                    style={{ flex: 2, padding: '6px 8px', borderRadius: 4, border: '1px solid #e4ddd2', fontSize: 12, fontFamily: 'monospace', background: '#fff' }}
                  />
                  <input
                    placeholder="Model override"
                    value={adv.model}
                    onChange={e => setAdvancedSettings(prev => ({ ...prev, [p.id]: { ...prev[p.id], model: e.target.value, baseUrl: prev[p.id]?.baseUrl || '', timeout: prev[p.id]?.timeout || '' } }))}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid #e4ddd2', fontSize: 12, fontFamily: 'monospace', background: '#fff' }}
                  />
                  <input
                    placeholder="Timeout ms"
                    value={adv.timeout}
                    onChange={e => setAdvancedSettings(prev => ({ ...prev, [p.id]: { ...prev[p.id], timeout: e.target.value, baseUrl: prev[p.id]?.baseUrl || '', model: prev[p.id]?.model || '' } }))}
                    style={{ width: 90, padding: '6px 8px', borderRadius: 4, border: '1px solid #e4ddd2', fontSize: 12, fontFamily: 'monospace', background: '#fff' }}
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