'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { ComposerPlusPopover, type PlusAction } from './ComposerPlusPopover';

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
            <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}>
              {m.name}
            </span>
            {badge}
            {active && <span style={{ fontSize: 10, background: 'var(--moss)', color: '#fff', padding: '1px 5px', borderRadius: 3, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>✓ ACTIVE</span>}
          </div>
          {m.description && (
            <div style={{ fontSize: 11, color: 'var(--meta)', marginTop: 2, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.4 }}>
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
          textTransform: 'uppercase', color: 'var(--text-faint)',
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
        background: 'var(--panel)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, boxShadow: 'var(--shadow-popover)',
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
            fontFamily: 'DM Sans, sans-serif', background: 'var(--cream)',
            color: 'var(--text)',
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
                borderColor: activeTag === tag ? 'var(--moss)' : 'var(--border)',
                background: activeTag === tag ? 'var(--moss)' : 'transparent',
                color: activeTag === tag ? '#fff' : 'var(--meta)',
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
              badge={<span style={{ fontSize: 10, background: 'var(--success)', color: '#fff', padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>KEY ✓</span>}
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
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}>{m.name}</div>
                {m.description && <div style={{ fontSize: 11, color: 'var(--meta)', fontFamily: 'DM Sans, sans-serif' }}>{m.description}</div>}
              </div>
              <span style={{ fontSize: 10, background: 'var(--text-faint)', color: '#fff', padding: '2px 7px', borderRadius: 4, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>SOON</span>
            </div>
          ))}
        </Section>

        {byokModels.length === 0 && freeModels.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-faint)', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
            Add an API key in Settings → API Keys to unlock models.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Voice Button ─────────────────────────────────────────────────────────────

function VoiceButton({ onTranscript, disabled }: { onTranscript: (t: string) => void; disabled: boolean }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);

  const toggle = async () => {
    if (disabled) return;
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
      setProcessing(true);
      setTimeout(() => setProcessing(false), 1200);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        // Real transcription would go here
      };
    } catch {
      // Mic not available — ignore silently
    }
  };

  const label = processing ? 'Goblin hört zu…' : recording ? 'Aufnehmen…' : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      {label && (
        <span style={{
          fontSize: 11, color: recording ? 'var(--danger)' : 'var(--meta)',
          fontFamily: 'DM Sans, sans-serif',
          animation: 'goblin-pulse 1.2s ease-in-out infinite',
        }}>
          {label}
        </span>
      )}
      <button
        onClick={toggle}
        aria-label={recording ? 'Aufnahme stoppen' : 'Sprachaufnahme'}
        title={recording ? 'Aufnahme stoppen' : 'Sprachaufnahme'}
        style={{
          width: 32, height: 32, borderRadius: '50%', border: 'none',
          background: recording ? 'rgba(184,92,60,0.12)' : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: recording ? 'var(--rust)' : 'var(--text-2)',
          flexShrink: 0,
          boxShadow: recording ? '0 0 0 2px rgba(184,92,60,0.4)' : 'none',
          animation: recording ? 'goblin-pulse 1.2s ease-in-out infinite' : undefined,
          transition: 'all 0.15s',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Module-level model cache (survives re-mounts within same session) ────────
let _cachedModels: ApiModel[] | null = null;
let _cachedKeys: ConnectedKey[] | null = null;
let _cacheTs = 0;
const MODEL_CACHE_TTL = 60_000; // 60 seconds

async function fetchModelsAndKeys(): Promise<{ models: ApiModel[]; keys: ConnectedKey[] }> {
  const now = Date.now();
  if (_cachedModels && _cachedKeys && now - _cacheTs < MODEL_CACHE_TTL) {
    return { models: _cachedModels, keys: _cachedKeys };
  }
  const [ms, keys] = await Promise.all([
    apiGet<ApiModel[]>('/api/models'),
    apiGet<ConnectedKey[]>('/api/byok-keys'),
  ]);
  _cachedModels = ms;
  _cachedKeys = keys;
  _cacheTs = now;
  return { models: ms, keys };
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

  // Load models — uses module-level 60s cache so re-mounts don't refetch
  const openHub = async () => {
    setHubOpen(true);
    if (modelsLoaded) return;
    try {
      const { models: ms, keys } = await fetchModelsAndKeys();
      setModels(ms);
      setConnectedKeys(keys);

      // Auto-select first BYOK model if no preference set
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
      _cachedKeys = null; // invalidate module-level cache
      _cacheTs = 0;
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    // Shift+Enter = newline (default textarea behavior)
  };

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, selectedModel);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const hasInput = input.trim().length > 0;
  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [websearchOn, setWebsearchOn] = useState(false);

  const handlePlusAction = (action: PlusAction) => {
    if (action === 'websearch') {
      setWebsearchOn(v => !v);
      return;
    }
    toast.info(`${action} — kommt in 9E`);
  };

  return (
    <div style={{ padding: '10px 16px 12px', background: 'var(--panel)', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
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
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            border: '1.5px solid var(--border-subtle)', borderRadius: 14,
            background: 'var(--subtle)',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--moss)')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        >
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
              resize: 'none', border: 'none', background: 'transparent',
              outline: 'none', fontSize: 14, color: 'var(--text)',
              fontFamily: 'DM Sans, sans-serif', lineHeight: '22px',
              maxHeight: `${6 * 22 + 20}px`, overflowY: 'auto',
              padding: '12px 14px 6px',
              width: '100%', boxSizing: 'border-box',
            }}
          />

          {/* Bottom row: plus + model pill (left) + hint + send (right) */}
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '4px 8px 8px',
            gap: 6,
          }}>
            <button
              ref={plusBtnRef}
              onClick={() => setPlusOpen(o => !o)}
              data-testid="composer-plus"
              aria-label="Anhang hinzufügen"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '1px solid var(--border-subtle)',
                background: 'var(--panel)',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--meta)', flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <ComposerPlusPopover
              open={plusOpen}
              onClose={() => setPlusOpen(false)}
              anchorRef={plusBtnRef}
              onAction={handlePlusAction}
              websearchOn={websearchOn}
            />

            {/* Model picker pill — left */}
            <button
              onClick={openHub}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: 'none',
                border: '1px solid rgba(45,74,43,0.18)',
                cursor: 'pointer', fontSize: 11, fontWeight: 500,
                color: '#5a7a58', fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.12s', flexShrink: 0,
                maxWidth: 160, overflow: 'hidden',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,74,43,0.07)'; e.currentTarget.style.borderColor = 'rgba(45,74,43,0.35)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'rgba(45,74,43,0.18)'; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedModel.displayName}
              </span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Spacer + hint */}
            <span style={{
              flex: 1, fontSize: 11, color: '#B8B0A8',
              fontFamily: 'DM Sans, sans-serif',
              paddingLeft: 2,
            }}>
              {disabled ? '' : '⇧↵ new line'}
            </span>

            {/* Voice input button */}
            <VoiceButton onTranscript={t => setInput(prev => prev + t)} disabled={disabled} />

            {/* Send button — right */}
            <button
              onClick={submit}
              disabled={!hasInput || disabled}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: hasInput && !disabled ? 'var(--moss)' : 'var(--border)',
                border: 'none', cursor: hasInput && !disabled ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', flexShrink: 0,
                color: hasInput && !disabled ? '#fff' : 'var(--text-faint)',
              }}
              onMouseEnter={e => { if (hasInput && !disabled) e.currentTarget.style.background = '#3A5A37'; }}
              onMouseLeave={e => { if (hasInput && !disabled) e.currentTarget.style.background = 'var(--moss)'; }}
            >
              {disabled ? (
                <svg style={{ animation: 'inputSpin 0.8s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="8" opacity="0.4" />
                  <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 2L11 13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </div>
        </div>
        <style>{`@keyframes inputSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
