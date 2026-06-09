'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { isDemoActive } from '@/lib/demo/demo-flag';
import { useLang } from '@/lib/use-lang';
import { ComposerPlusPopover, type PlusAction } from './ComposerPlusPopover';
import { Icon } from '@/components/ui/icon';
import { GoblinLogo } from '@/components/brand/GoblinLogo';

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
  /** "hero" sits the same shared composer on the dark 03 hero card.
      Same component, dark-surface styling — NOT a fork. */
  variant?: 'default' | 'hero';
  /** Optional placeholder override (hero uses a build-focused prompt). */
  placeholder?: string;
  /** Push text into the composer from outside (e.g. 03 quick-prompt chips).
      Changing this value sets the input; clearing it ('') is ignored. */
  prefill?: string;
  /** True while an assistant reply streams — swaps Send for Stop. */
  isStreaming?: boolean;
  /** Abort the in-flight stream (Stop button). */
  onStop?: () => void;
}

// ─── Provider Icons ───────────────────────────────────────────────────────────

// §A6: no emoji in product UI. Providers render as a clean, consistent
// monochrome lettermark badge (currentColor) — goblin-hosted uses the brand
// mark. No toy glyphs.
function ProviderIcon({ provider, size = 20 }: { provider: string; size?: number }) {
  if (provider.toLowerCase() === 'goblin') {
    return <GoblinLogo size={size} variant="green" aria-label="Goblin" />;
  }
  const letter = (provider.trim()[0] ?? '?').toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: 6,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '1.5px solid currentColor', opacity: 0.85,
        fontFamily: 'var(--font-sans)', fontWeight: 700,
        fontSize: 'var(--t-eyebrow-fs)', lineHeight: 1,
      }}
    >
      {letter}
    </span>
  );
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
  openDown = false,
}: {
  models: ApiModel[];
  connectedKeys: ConnectedKey[];
  selectedSlug: string;
  onSelect: (m: ApiModel) => void;
  onClose: () => void;
  /** Open below the composer (hero variant has room below; chat-bottom doesn't). */
  openDown?: boolean;
}) {
  const lang = useLang();
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
        <span style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--ink-2)' }}><ProviderIcon provider={m.provider} size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--t-small-fs)', fontWeight: active ? 600 : 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
              {m.name}
            </span>
            {badge}
            {active && <span style={{ fontSize: 'var(--t-eyebrow-fs)', background: 'var(--brand-green)', color: '#fff', padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontFamily: 'var(--font-sans)', letterSpacing: '0.04em' }}>ACTIVE</span>}
          </div>
          {m.description && (
            <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', marginTop: 2, fontFamily: 'var(--font-sans)', lineHeight: 1.4 }}>
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
          fontSize: 'var(--t-eyebrow-fs)', fontWeight: 700, letterSpacing: '1.2px',
          textTransform: 'uppercase', color: 'var(--text-faint)',
          fontFamily: 'var(--font-sans)',
        }}>{title}</div>
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: openDown ? 'auto' : 'calc(100% + 8px)',
        top: openDown ? 'calc(100% + 8px)' : 'auto',
        left: 0, right: 0,
        background: 'var(--panel)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, boxShadow: 'var(--shadow-popover)',
        zIndex: 200, overflow: 'hidden',
        maxHeight: 'min(70vh, 480px)', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #F4F0E8', flexShrink: 0 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={lang === 'en' ? 'Search models…' : 'Modelle suchen …'}
          style={{
            width: '100%', border: '1px solid var(--rule-soft)', borderRadius: 8,
            padding: '7px 12px', fontSize: 'var(--t-small-fs)', outline: 'none',
            fontFamily: 'var(--font-sans)', background: 'var(--paper)',
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
                padding: '3px 10px', borderRadius: 20, fontSize: 'var(--t-caption-fs)', fontWeight: 500,
                border: '1px solid',
                borderColor: activeTag === tag ? 'var(--brand-green)' : 'var(--border)',
                background: activeTag === tag ? 'var(--brand-green)' : 'transparent',
                color: activeTag === tag ? '#fff' : 'var(--meta)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
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
              badge={<span style={{ fontSize: 'var(--t-eyebrow-fs)', background: 'var(--success)', color: '#fff', padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontFamily: 'var(--font-sans)', letterSpacing: '0.04em' }}>KEY</span>}
            />
          ))}
        </Section>

        <Section title="Free" count={freeModels.length}>
          {freeModels.map(m => (
            <ModelRow
              key={m.slug}
              m={m}
              badge={<span style={{ fontSize: 'var(--t-eyebrow-fs)', background: '#4A7A7A', color: '#fff', padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>FREE</span>}
            />
          ))}
        </Section>

        <Section title="Goblin Hosted" count={hostedModels.length}>
          {hostedModels.map(m => (
            <div key={m.slug} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5 }}>
              <span style={{ display: 'inline-flex', flexShrink: 0 }}><GoblinLogo size={20} variant="green" /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--t-small-fs)', fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>{m.name}</div>
                {m.description && <div style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--meta)', fontFamily: 'var(--font-sans)' }}>{m.description}</div>}
              </div>
              <span style={{ fontSize: 'var(--t-eyebrow-fs)', background: 'var(--text-faint)', color: '#fff', padding: '2px 7px', borderRadius: 4, fontWeight: 600, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>SOON</span>
            </div>
          ))}
        </Section>

        {byokModels.length === 0 && freeModels.length === 0 && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)' }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center', color: 'var(--brand-green)' }}>
              <Icon name="apiKey" size={28} strokeWidth={1.5} />
            </div>
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
          fontSize: 'var(--t-caption-fs)', color: recording ? 'var(--danger)' : 'var(--meta)',
          fontFamily: 'var(--font-sans)',
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

// Sprint 9.5: default new users to the working Groq model. The free Gemini model
// is broken in the prod LiteLLM proxy; Groq Llama 3.3 70B works end-to-end and is
// now the onboarding-recommended provider. The first-BYOK auto-select below still
// applies once the user connects any key.
export const DEFAULT_MODEL: SelectedModel = {
  slug: 'groq/llama-3.3-70b-versatile',
  name: 'Llama 3.3 70B',
  provider: 'groq',
  layer: 'byok',
  displayName: 'Llama 3.3 70B',
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

export function ChatInput({ onSubmit, disabled = false, selectedModel, onModelChange, variant = 'default', placeholder, prefill, isStreaming = false, onStop }: ChatInputProps) {
  const hero = variant === 'hero';
  const lang = useLang();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');

  // Outside-driven prefill (03 quick-prompt chips). Focus after filling.
  useEffect(() => {
    if (prefill && prefill.length > 0) {
      setInput(prefill);
      textareaRef.current?.focus();
    }
  }, [prefill]);
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

      // WALKFIX-4.2: do NOT auto-switch the active model just because the hub was
      // opened. The old "select first BYOK" silently flipped a Gemini-key account
      // to Gemini (proven dead on prod) the moment the picker opened — without the
      // user choosing anything. Keep the current/last selection (DEFAULT_MODEL =
      // Groq Llama, the working default) until the user actually taps a model.
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
    if (isDemoActive()) return; // Sprint 10 §6: no realtime subscription in demo.
    const supabase = createClient();
    const channel = supabase
      .channel('byok_keys_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'byok_keys' }, () => {
        refetchKeys();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchKeys]);

  // Close hub on outside tap (CLEANUP-1: pointerdown, not mousedown, so a touch
  // tap on the backdrop dismisses on iOS — mousedown is unreliable on touch) and
  // on Escape. Selection + pill re-tap close it directly (below).
  useEffect(() => {
    if (!hubOpen) return;
    const onPointer = (e: Event) => {
      if (hubRef.current && !hubRef.current.contains(e.target as Node)) {
        setHubOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setHubOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
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
    if (!trimmed || disabled || isStreaming) return;
    onSubmit(trimmed, selectedModel);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const hasInput = input.trim().length > 0;
  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [websearchOn, setWebsearchOn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePlusAction = async (action: PlusAction) => {
    if (action === 'websearch') {
      setWebsearchOn(v => !v);
      try {
        localStorage.setItem('goblin-websearch-on', String(!websearchOn));
      } catch {/* ignore */}
      return;
    }
    if (action === 'upload-file' || action === 'screenshot') {
      fileInputRef.current?.click();
      return;
    }
    if (action === 'research') {
      // Inject a research-prompt prefix so the model knows the user wants
      // a deep, sourced answer. Cheap UX, no extra service to wire up.
      setInput(prev => {
        const prefix = 'Bitte recherchiere gründlich und gib Quellen an:\n\n';
        return prev.startsWith(prefix) ? prev : prefix + prev;
      });
      toast.success('Recherche-Modus aktiv im Prompt');
      return;
    }
    if (action === 'github') {
      // GitHub-Connect flow lebt in /dashboard/settings/integrations — route
      // user there. No popup-attach for now to avoid OAuth-in-popup edge cases.
      toast.info('GitHub-Connect → Einstellungen → Konnektoren');
      return;
    }
    if (action === 'paste-chat') {
      // Open native paste prompt — user pastes a past conversation (from
      // Goblin / ChatGPT / Claude / notes). It is appended to the input
      // as plain text inside a fenced block so the model can see it as
      // prior context. There is no real "session import" backend.
      const pasted = window.prompt(
        'Vergangene Konversation oder Notiz einfügen (Strg+V):',
        '',
      );
      if (pasted && pasted.trim()) {
        setInput(prev => {
          const block = `\n\n--- Vorheriger Chat / Notiz ---\n${pasted.trim()}\n--- Ende ---\n\n`;
          return prev ? prev + block : block.trimStart();
        });
        toast.success('Eingefügt als Kontext');
      }
      return;
    }
  };

  const handleFilesPicked = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Append a marker to the prompt so the user sees what they attached.
    // Real upload-to-storage happens in the chat-message-send path (out of
    // scope for this row — backend supports image+pdf attachments already).
    const names = Array.from(files).map(f => f.name).join(', ');
    setInput(prev => {
      const tag = `\n\n[Anhang: ${names}]`;
      return prev.endsWith(tag) ? prev : prev + tag;
    });
    toast.success(`${files.length} Datei(en) angehängt`);
  };

  return (
    <div style={hero
      ? { padding: 0, background: 'transparent', flexShrink: 0 }
      : { padding: '10px 16px 12px', background: 'var(--panel)', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
      <div ref={hubRef} style={{ position: 'relative' }}>
        {hubOpen && (
          <ModelHub
            models={models}
            connectedKeys={connectedKeys}
            selectedSlug={selectedModel.slug}
            onSelect={m => {
              onModelChange({
                slug: m.slug, name: m.name, provider: m.provider,
                layer: m.layer, displayName: shortModelName(m.name),
              });
              setHubOpen(false); // CLEANUP-1: selection always closes the hub
            }}
            onClose={() => setHubOpen(false)}
            openDown={hero}
          />
        )}

        {/* Input container */}
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            border: hero ? '1px solid rgba(244,236,216,.16)' : '1.5px solid var(--border-subtle)',
            borderRadius: 14,
            background: hero ? 'rgba(244,236,216,.05)' : 'var(--subtle)',
            transition: 'border-color 0.15s',
          }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = hero ? 'rgba(244,236,216,.34)' : 'var(--brand-green)')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = hero ? 'rgba(244,236,216,.16)' : 'var(--border-subtle)')}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? (lang === 'en' ? 'Describe what you want to build, or ask anything…' : 'Beschreibe, was du bauen willst — oder frag einfach …')}
            disabled={disabled}
            rows={hero ? 2 : 1}
            data-chat-input
            className={hero ? 'gobl-hero-textarea' : undefined}
            style={{
              resize: 'none', border: 'none', background: 'transparent',
              outline: 'none', fontSize: hero ? 'var(--t-body-fs)' : 'var(--t-small-fs)',
              color: hero ? 'var(--bone)' : 'var(--text)',
              fontFamily: hero ? 'var(--font-dash-display), Manrope, sans-serif' : 'var(--font-sans)',
              lineHeight: hero ? '24px' : '22px',
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
              onClick={() => { if (!disabled) setPlusOpen(o => !o); }}
              disabled={disabled}
              data-testid="composer-plus"
              aria-label="Anhang hinzufügen"
              style={{
                width: 28, height: 28, borderRadius: '50%',
                border: hero ? '1px solid rgba(244,236,216,.20)' : '1px solid var(--border-subtle)',
                background: hero ? 'transparent' : 'var(--panel)',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: hero ? 'rgba(244,236,216,.72)' : 'var(--meta)', flexShrink: 0,
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

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,text/*"
              multiple
              onChange={(e) => {
                handleFilesPicked(e.target.files);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />

            {/* Model picker pill — left. CLEANUP-1: re-tap toggles (closes if open). */}
            <button
              onClick={() => { if (disabled) return; if (hubOpen) setHubOpen(false); else void openHub(); }}
              disabled={disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: 'none',
                border: hero ? '1px solid rgba(244,236,216,.20)' : '1px solid rgba(45,74,43,0.18)',
                cursor: 'pointer', fontSize: 'var(--t-caption-fs)', fontWeight: 500,
                color: hero ? 'rgba(244,236,216,.72)' : '#5a7a58',
                fontFamily: hero ? 'var(--font-dash-display), Manrope, sans-serif' : 'var(--font-sans)',
                transition: 'all 0.12s', flexShrink: 0,
                maxWidth: 160, overflow: 'hidden',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = hero ? 'rgba(244,236,216,.08)' : 'rgba(45,74,43,0.07)'; e.currentTarget.style.borderColor = hero ? 'rgba(244,236,216,.34)' : 'rgba(45,74,43,0.35)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = hero ? 'rgba(244,236,216,.20)' : 'rgba(45,74,43,0.18)'; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedModel.displayName}
              </span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Spacer + hint. BUG-16: nowrap + ellipsis so the hint never wraps to
                two cramped lines next to the model pill at 390. */}
            <span style={{
              flex: 1, minWidth: 0, fontSize: 'var(--t-caption-fs)', color: hero ? 'rgba(244,236,216,.5)' : '#B8B0A8',
              fontFamily: hero ? 'var(--font-dash-display), Manrope, sans-serif' : 'var(--font-sans)',
              paddingLeft: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {disabled ? '' : (lang === 'en' ? '⇧↵ new line' : '⇧↵ neue Zeile')}
            </span>

            {/* Voice input button */}
            <VoiceButton onTranscript={t => setInput(prev => prev + t)} disabled={disabled} />

            {/* Send / Stop button — right. Streaming → Stop (abrupt abort). */}
            {isStreaming ? (
              <button
                onClick={onStop}
                aria-label="Stopp"
                title="Stopp"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--rule-strong)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0, color: 'var(--ink-deep)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!hasInput}
                aria-label="Senden"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: hasInput
                    ? 'var(--brand-gold)'
                    : (hero ? 'rgba(244,236,216,.16)' : 'var(--surface-3)'),
                  border: 'none', cursor: hasInput ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0,
                  color: hasInput
                    ? 'var(--ink-deep)'
                    : (hero ? 'rgba(244,236,216,.45)' : 'var(--ink-3)'),
                }}
                onMouseEnter={e => { if (hasInput) e.currentTarget.style.background = 'var(--gold-400)'; }}
                onMouseLeave={e => { if (hasInput) e.currentTarget.style.background = 'var(--brand-gold)'; }}
              >
                {/* Icon-only up-arrow — no text label. Shared across 03/05/06. */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        <style>{`@keyframes inputSpin{to{transform:rotate(360deg)}}.gobl-hero-textarea::placeholder{color:rgba(244,236,216,.45)}`}</style>
      </div>
    </div>
  );
}
