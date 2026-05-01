'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiModel {
  id: string;
  name: string;
  slug: string;
  provider: string;
  layer: 'byok' | 'free_api' | 'goblin_hosted';
  description: string | null;
  tags: string[];
  requires_key: boolean;
  available: boolean;
  phase: number;
}

interface ConnectedKey {
  id: string;
  provider: string;
  key_hint: string | null;
}

export interface SelectedModel {
  slug: string;
  name: string;
  provider: string;
  layer: 'byok' | 'free_api' | 'goblin_hosted';
  displayName: string;
}

interface ChatInputProps {
  onSubmit: (message: string, model: SelectedModel) => void;
  disabled?: boolean;
  selectedModel: SelectedModel;
  onModelChange: (model: SelectedModel) => void;
}

// ─── Provider Icons ───────────────────────────────────────────────────────────

const PROVIDER_ICON: Record<string, string> = {
  anthropic: '🟠',
  openai: '⚫',
  google: '🔵',
  groq: '🟢',
  mistral: '🔶',
  deepseek: '🐳',
  xai: '𝕏',
  together: '🤝',
  fireworks: '🎆',
  goblin: '👺',
};

function getProviderIcon(provider: string): string {
  return PROVIDER_ICON[provider.toLowerCase()] ?? '🤖';
}

function shortModelName(name: string): string {
  return name
    .replace(/claude-/i, '')
    .replace(/-\d{8}$/i, '')
    .replace(/gpt-/i, '')
    .replace(/gemini-/i, '')
    .replace(/llama-/i, 'Llama ')
    .replace(/-/g, ' ')
    .replace(/\b(\w)/g, c => c.toUpperCase())
    .trim()
    .slice(0, 22);
}

// ─── Model Hub Dropdown ───────────────────────────────────────────────────────

function ModelHub({
  models,
  connectedKeys,
  selectedSlug,
  onSelect,
  onClose,
}: {
  models: ApiModel[];
  connectedKeys: ConnectedKey[];
  selectedSlug: string;
  onSelect: (m: ApiModel) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const connectedProviders = new Set(connectedKeys.map(k => k.provider));

  const filter = (list: ApiModel[]) =>
    list.filter(m => {
      if (!m.available) return false;
      if (query && !m.name.toLowerCase().includes(query.toLowerCase()) && !m.provider.toLowerCase().includes(query.toLowerCase())) return false;
      if (activeTag && !m.tags.includes(activeTag)) return false;
      return true;
    });

  const byokModels   = filter(models.filter(m => m.layer === 'byok' && connectedProviders.has(m.provider)));
  const freeModels   = filter(models.filter(m => m.layer === 'free_api'));
  const hostedModels = models.filter(m => m.layer === 'goblin_hosted');
  const allTags      = [...new Set(models.flatMap(m => m.tags))].slice(0, 6);

  function ModelRow({ m, badge }: { m: ApiModel; badge?: React.ReactNode }) {
    const active = m.slug === selectedSlug;
    return (
      <button
        onClick={() => { onSelect(m); onClose(); }}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          width: '100%', padding: '10px 14px',
          background: active ? 'rgba(212,169,74,0.12)' : 'none',
          border: 'none', borderRadius: 8, cursor: 'pointer',
          textAlign: 'left', transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none'; }}
      >
        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{getProviderIcon(m.provider)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: '#2A2A2A', fontFamily: 'DM Sans, sans-serif' }}>
              {m.name}
            </span>
            {badge}
            {active && <span style={{ fontSize: 10, background: '#2D4A2B', color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>✓ ACTIVE</span>}
          </div>
          {m.description && (
            <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4 }}>
              {m.description}
            </div>
          )}
        </div>
      </button>
    );
  }

  function Section({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
    if (count === 0) return null;
    return (
      <div>
        <div style={{
          padding: '6px 14px 4px',
          fontSize: 10, fontWeight: 700, letterSpacing: '1.2px',
          textTransform: 'uppercase', color: '#9C9589',
          fontFamily: 'DM Sans, sans-serif',
        }}>{title}</div>
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
        background: '#fff', border: '1px solid #EDE8DC',
        borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        zIndex: 200, overflow: 'hidden',
        maxHeight: 480, display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #F4F0E8', flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search models…"
          style={{
            width: '100%', border: '1px solid #EDE8DC', borderRadius: 8,
            padding: '7px 12px', fontSize: 13, outline: 'none',
            fontFamily: 'DM Sans, sans-serif', background: '#F7F4ED',
            color: '#2A2A2A',
          }}
        />
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', flexShrink: 0, flexWrap: 'wrap', borderBottom: '1px solid #F4F0E8' }}>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                border: '1px solid',
                borderColor: activeTag === tag ? '#2D4A2B' : '#DDD7CC',
                background: activeTag === tag ? '#2D4A2B' : 'transparent',
                color: activeTag === tag ? '#fff' : '#6B6B6B',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.1s',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Model list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <Section title="Your Keys" count={byokModels.length}>
          {byokModels.map(m => (
            <ModelRow
              key={m.slug}
              m={m}
              badge={<span style={{ fontSize: 10, background: '#4A7C3B', color: '#fff', padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>KEY ✓</span>}
            />
          ))}
        </Section>

        <Section title="Free" count={freeModels.length}>
          {freeModels.map(m => (
            <ModelRow
              key={m.slug}
              m={m}
              badge={<span style={{ fontSize: 10, background: '#4A7A7A', color: '#fff', padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>FREE</span>}
            />
          ))}
        </Section>

        <Section title="Goblin Hosted" count={hostedModels.length}>
          {hostedModels.map(m => (
            <div key={m.slug} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5 }}>
              <span style={{ fontSize: 18 }}>👺</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#2A2A2A', fontFamily: 'DM Sans, sans-serif' }}>{m.name}</div>
                {m.description && <div style={{ fontSize: 11, color: '#6B6B6B', fontFamily: 'DM Sans, sans-serif' }}>{m.description}</div>}
              </div>
              <span style={{ fontSize: 10, background: '#9C9589', color: '#fff', padding: '2px 7px', borderRadius: 4, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>SOON</span>
            </div>
          ))}
        </Section>

        {byokModels.length === 0 && freeModels.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#9C9589', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
            Add an API key in Settings → API Keys to unlock models.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ChatInput ────────────────────────────────────────────────────────────────

const MODEL_STORAGE_KEY = 'goblin:last-model';

export const DEFAULT_MODEL: SelectedModel = {
  slug: 'free/gemini-flash',
  name: 'Gemini Flash',
  provider: 'google',
  layer: 'free_api',
  displayName: 'Gemini Flash',
};

export function useChatModel() {
  const [selectedModel, setSelectedModel] = useState<SelectedModel>(DEFAULT_MODEL);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODEL_STORAGE_KEY);
      if (stored) setSelectedModel(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const changeModel = useCallback((m: ApiModel) => {
    const sel: SelectedModel = {
      slug: m.slug,
      name: m.name,
      provider: m.provider,
      layer: m.layer,
      displayName: shortModelName(m.name),
    };
    setSelectedModel(sel);
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(sel));
  }, []);

  return { selectedModel, changeModel, setSelectedModel };
}

export function ChatInput({ onSubmit, disabled = false, selectedModel, onModelChange }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const [hubOpen, setHubOpen] = useState(false);
  const [models, setModels] = useState<ApiModel[]>([]);
  const [connectedKeys, setConnectedKeys] = useState<ConnectedKey[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const hubRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    const maxH = 6 * 24 + 24; // ~6 lines
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxH)}px`;
  }, [input]);

  // Load models on first open
  const openHub = async () => {
    setHubOpen(true);
    if (modelsLoaded) return;
    try {
      const [ms, keys] = await Promise.all([
        apiGet<ApiModel[]>('/api/models'),
        apiGet<ConnectedKey[]>('/api/byok-keys'),
      ]);
      setModels(ms);
      setConnectedKeys(keys);

      // Auto-select first BYOK key if no preference set
      const firstByok = ms.find(m => m.layer === 'byok' && keys.some(k => k.provider === m.provider));
      if (firstByok && selectedModel.slug === DEFAULT_MODEL.slug) {
        onModelChange({
          slug: firstByok.slug, name: firstByok.name,
          provider: firstByok.provider, layer: firstByok.layer,
          displayName: shortModelName(firstByok.name),
        });
      }
    } catch { /* silently fail — user sees empty hub */ }
    setModelsLoaded(true);
  };

  const refetchKeys = useCallback(async () => {
    try {
      const keys = await apiGet<ConnectedKey[]>('/api/byok-keys');
      setConnectedKeys(keys);
      setModelsLoaded(false); // force full reload next time hub opens
    } catch { /* silent */ }
  }, []);

  // Realtime: refresh keys when byok_keys table changes for this user
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('byok_keys_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'byok_keys' }, () => {
        refetchKeys();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchKeys]);

  // Close hub on outside click
  useEffect(() => {
    if (!hubOpen) return;
    const handler = (e: MouseEvent) => {
      if (hubRef.current && !hubRef.current.contains(e.target as Node)) {
        setHubOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [hubOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
      return;
    }
    // plain Enter = newline (default textarea behavior)
  };

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, selectedModel);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const hasInput = input.trim().length > 0;

  return (
    <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #EDE8DC', flexShrink: 0 }}>
      <div ref={hubRef} style={{ position: 'relative' }}>
        {hubOpen && (
          <ModelHub
            models={models}
            connectedKeys={connectedKeys}
            selectedSlug={selectedModel.slug}
            onSelect={m => onModelChange({
              slug: m.slug, name: m.name, provider: m.provider,
              layer: m.layer, displayName: shortModelName(m.name),
            })}
            onClose={() => setHubOpen(false)}
          />
        )}

        {/* Input container */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          border: '1.5px solid #DDD7CC', borderRadius: 12,
          background: '#F7F4ED',
          transition: 'border-color 0.15s',
        }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = '#2D4A2B')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = '#DDD7CC')}
        >
          {/* Textarea row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', padding: '10px 12px', gap: 8 }}>
            {/* Left icons */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginBottom: 2 }}>
              <button
                disabled
                title="File attach (coming soon)"
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: 'none', border: 'none', cursor: 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0.35, color: '#6B6B6B',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <button
                disabled
                title="Voice input (coming soon)"
                style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: 'none', border: 'none', cursor: 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0.35, color: '#6B6B6B',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build, or ask anything…"
              disabled={disabled}
              rows={1}
              style={{
                flex: 1, resize: 'none', border: 'none', background: 'transparent',
                outline: 'none', fontSize: 14, color: '#2A2A2A',
                fontFamily: 'DM Sans, sans-serif', lineHeight: '22px',
                maxHeight: `${6 * 22 + 20}px`, overflowY: 'auto',
                padding: '2px 0',
              }}
            />

            {/* Right: Model Pill + Send */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginBottom: 2 }}>
              {/* Model picker pill */}
              <button
                onClick={openHub}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px', borderRadius: 20,
                  background: 'rgba(45,74,43,0.08)',
                  border: '1px solid rgba(45,74,43,0.15)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  color: '#2D4A2B', fontFamily: 'DM Sans, sans-serif',
                  transition: 'background 0.15s', flexShrink: 0,
                  maxWidth: 140, overflow: 'hidden',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.13)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(45,74,43,0.08)')}
              >
                <span style={{ fontSize: 13 }}>{getProviderIcon(selectedModel.provider)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedModel.displayName}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {/* Send button */}
              <button
                onClick={submit}
                disabled={!hasInput || disabled}
                style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: hasInput && !disabled ? '#2D4A2B' : '#DDD7CC',
                  border: 'none', cursor: hasInput && !disabled ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0,
                  color: hasInput && !disabled ? '#fff' : '#9C9589',
                }}
                onMouseEnter={e => { if (hasInput && !disabled) (e.currentTarget.style.background = '#3A5A37'); }}
                onMouseLeave={e => { if (hasInput && !disabled) (e.currentTarget.style.background = '#2D4A2B'); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 2L11 13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Hint row */}
          <div style={{
            padding: '0 12px 8px',
            fontSize: 11, color: '#9C9589', fontFamily: 'DM Sans, sans-serif',
          }}>
            {disabled ? 'Goblin is thinking…' : '⌘↵ to send · ↵ for newline'}
          </div>
        </div>
      </div>
    </div>
  );
}
