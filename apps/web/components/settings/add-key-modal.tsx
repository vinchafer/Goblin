"use client";

import { useState } from "react";
import { X, Eye, EyeOff, AlertTriangle, Loader2 } from "lucide-react";
import type { ByokKey } from "@goblin/shared/src/schemas";
import { createClient } from "@/lib/supabase/client";

interface AddKeyModalProps {
  open: boolean;
  onClose: () => void;
  onKeyAdded: (key: ByokKey) => void;
}

export function AddKeyModal({ open, onClose, onKeyAdded }: AddKeyModalProps) {
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
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
            <div className="flex gap-2">
              {['anthropic', 'openai'].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p as 'anthropic' | 'openai')}
                  className="flex-1 py-2 px-3 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: provider === p ? 'rgba(45, 74, 43, 0.1)' : 'var(--goblin-light)',
                    color: provider === p ? 'var(--goblin-moss)' : 'var(--goblin-gray)'
                  }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
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