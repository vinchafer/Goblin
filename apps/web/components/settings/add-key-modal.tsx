"use client";

import { useState } from "react";
import { X, Eye, EyeOff, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import type { ByokKey } from "@goblin/shared/src/schemas";
import { createClient } from "@/lib/supabase/client";

const PROVIDER_KEY_URLS: Record<string, { url: string; label: string }> = {
  anthropic: { url: 'https://console.anthropic.com/settings/keys', label: 'Anthropic Console' },
  openai: { url: 'https://platform.openai.com/api-keys', label: 'OpenAI Platform' },
  google: { url: 'https://aistudio.google.com/app/apikey', label: 'Google AI Studio' },
  groq: { url: 'https://console.groq.com/keys', label: 'Groq Console' },
  mistral: { url: 'https://console.mistral.ai/api-keys/', label: 'Mistral Console' },
  deepseek: { url: 'https://platform.deepseek.com/api_keys', label: 'DeepSeek Platform' },
  xai: { url: 'https://console.x.ai/', label: 'xAI Console' },
  together: { url: 'https://api.together.xyz/settings/api-keys', label: 'Together AI' },
};

interface AddKeyModalProps {
  open: boolean;
  onClose: () => void;
  onKeyAdded: (key: ByokKey) => void;
}

type ByokProviderKey = 'anthropic' | 'openai' | 'google' | 'groq' | 'mistral' | 'deepseek' | 'xai' | 'together';

const PROVIDERS: { id: ByokProviderKey; label: string }[] = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai',    label: 'OpenAI' },
  { id: 'google',    label: 'Google' },
  { id: 'groq',      label: 'Groq' },
  { id: 'mistral',   label: 'Mistral' },
  { id: 'deepseek',  label: 'DeepSeek' },
  { id: 'xai',       label: 'xAI' },
  { id: 'together',  label: 'Together' },
];

export function AddKeyModal({ open, onClose, onKeyAdded }: AddKeyModalProps) {
  const [provider, setProvider] = useState<ByokProviderKey>('anthropic');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/byok-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ provider, label, key })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add key');
      }

      const newKey = await response.json();
      onKeyAdded(newKey);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setProvider('anthropic');
    setLabel('');
    setKey('');
    setShowKey(false);
    setError(null);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full m-4">
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--goblin-light)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--goblin-slate)' }}>Add API Key</h2>
          <button onClick={handleClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" style={{ color: 'var(--goblin-gray)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--goblin-slate)' }}>Provider</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className="py-1.5 px-2 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: provider === p.id ? 'rgba(45, 74, 43, 0.1)' : 'var(--goblin-light)',
                    color: provider === p.id ? 'var(--goblin-moss)' : 'var(--goblin-gray)',
                    border: provider === p.id ? '1px solid rgba(45,74,43,0.3)' : '1px solid transparent',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--goblin-slate)' }}>Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., My Anthropic key"
              className="w-full px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--goblin-light)' }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--goblin-slate)' }}>API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={`${provider} API Key`}
                className="w-full px-3 py-2 pr-10 rounded-lg border font-mono text-sm"
                style={{ borderColor: 'var(--goblin-light)' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showKey
                  ? <EyeOff className="w-4 h-4" style={{ color: 'var(--goblin-gray)' }} />
                  : <Eye className="w-4 h-4" style={{ color: 'var(--goblin-gray)' }} />
                }
              </button>
            </div>

            <div className="flex items-start gap-2 mt-3 text-xs" style={{ color: 'var(--goblin-gray)' }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--goblin-warn)' }} />
              <p>
                Your key is encrypted at rest. It's used only to call {provider}'s API on your behalf.
                Never share this key publicly.
              </p>
            </div>

            {PROVIDER_KEY_URLS[provider] && (
              <div className="mt-2 text-xs">
                <span style={{ color: 'var(--goblin-gray)' }}>Don't have a key? Get one at </span>
                <a
                  href={PROVIDER_KEY_URLS[provider].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                  style={{ color: 'var(--goblin-moss)' }}
                >
                  {PROVIDER_KEY_URLS[provider].label} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(184, 92, 60, 0.1)', color: 'var(--goblin-warn)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !label || !key}
            className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add key'}
          </button>
        </form>
      </div>
    </div>
  );
}