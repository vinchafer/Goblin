"use client";

import { useState } from "react";
import { KeyRound, Trash2, Plus, Clock, CheckCircle, X } from "lucide-react";
import type { ByokKey } from "@goblin/shared/src/schemas";
import { AddKeyModal } from "./add-key-modal";
import { createClient } from "@/lib/supabase/client";

interface KeysListProps {
  initialKeys: ByokKey[];
}

const PROVIDER_LIST: Array<{ id: string; label: string; icon: string }> = [
  { id: 'anthropic', label: 'Anthropic', icon: '🔑' },
  { id: 'openai',    label: 'OpenAI',    icon: '🔑' },
  { id: 'google',    label: 'Google',    icon: '🔑' },
  { id: 'groq',      label: 'Groq',      icon: '🔑' },
  { id: 'mistral',   label: 'Mistral',   icon: '🔑' },
  { id: 'deepseek',  label: 'DeepSeek',  icon: '🔑' },
  { id: 'xai',       label: 'xAI',       icon: '🔑' },
  { id: 'together',  label: 'Together',  icon: '🔑' },
];

export function KeysList({ initialKeys }: KeysListProps) {
  const [keys, setKeys] = useState<ByokKey[]>(initialKeys);
  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const supabase = createClient();

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/byok-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'revoked' as const } : k));
    } catch {
      // Silently fail
    } finally {
      setRevokingId(null);
    }
  };

  const handleKeyAdded = (newKey: ByokKey) => {
    setKeys(prev => [newKey, ...prev]);
    setSuccessMessage('Key added — your goblin can now use it');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const activeProviders = new Set(keys.filter(k => k.status === 'active').map(k => k.provider));

  const getKeyHint = (key: ByokKey): string => {
    // The key_hint is stored in the DB — 4 last chars
    return (key as any).key_hint || '····';
  };

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="p-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: 'rgba(74, 124, 59, 0.1)', color: 'var(--goblin-good)' }}>
          <CheckCircle className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {/* Provider Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {PROVIDER_LIST.map(({ id: providerId, label, icon }) => {
          const hasKey = keys.some(k => k.provider === providerId && k.status === 'active');
          return (
            <button
              key={providerId}
              onClick={() => {
                if (!hasKey) setModalOpen(true);
              }}
              className="flex items-center justify-between px-3 py-3 rounded-lg border transition-all"
              style={{
                borderColor: hasKey ? 'rgba(74, 124, 59, 0.3)' : 'var(--goblin-light)',
                backgroundColor: hasKey ? 'rgba(74, 124, 59, 0.05)' : 'white',
              }}
            >
              <span className="text-sm font-medium" style={{ color: hasKey ? 'var(--goblin-moss)' : 'var(--goblin-gray)' }}>
                {label}
              </span>
              {hasKey ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(74, 124, 59, 0.15)', color: 'var(--goblin-good)' }}>
                  ✓
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--goblin-light)', color: 'var(--goblin-gray)' }}>
                  Add Key
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setModalOpen(true)}
        className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium"
        style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
      >
        <Plus className="w-4 h-4" />
        Add New Key
      </button>

      {keys.length === 0 ? (
        <div className="text-center py-12 rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--goblin-light)' }}>
          <KeyRound className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--goblin-gray)' }} />
          <p style={{ color: 'var(--goblin-gray)' }}>No API keys added yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(key => (
            <div key={key.id} className="p-4 rounded-lg border flex items-center justify-between" style={{ borderColor: 'var(--goblin-light)', backgroundColor: 'white' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: key.status === 'active' ? 'rgba(45, 74, 43, 0.1)' : 'rgba(107, 107, 107, 0.1)' }}>
                  <KeyRound className="w-5 h-5" style={{ color: key.status === 'active' ? 'var(--goblin-moss)' : 'var(--goblin-gray)' }} />
                </div>
                <div>
                  <div className="font-medium" style={{ color: 'var(--goblin-slate)' }}>{key.label}</div>
                  <div className="text-sm flex items-center gap-2">
                    <span style={{ color: 'var(--goblin-gray)' }}>{key.provider}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--goblin-gray)' }}>
                      ···· {(key as any).key_hint || ''}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: key.status === 'active' ? 'rgba(74, 124, 59, 0.1)' : 'rgba(107, 107, 107, 0.1)', color: key.status === 'active' ? 'var(--goblin-good)' : 'var(--goblin-gray)' }}>
                      {key.status}
                    </span>
                    {key.last_used && (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--goblin-gray)' }}>
                        <Clock className="w-3 h-3" />
                        Last used {new Date(key.last_used).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {key.status === 'active' && (
                <div className="relative">
                  {revokingId === key.id ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'rgba(184, 92, 60, 0.06)' }}>
                      <span className="text-xs" style={{ color: 'var(--goblin-warn)' }}>Revoke?</span>
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="text-xs px-2 py-1 rounded font-medium"
                        style={{ backgroundColor: 'var(--goblin-warn)', color: 'white' }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setRevokingId(null)}
                        className="text-xs px-2 py-1 rounded"
                        style={{ backgroundColor: 'var(--goblin-light)', color: 'var(--goblin-gray)' }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setRevokingId(key.id)} className="p-2 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" style={{ color: 'var(--goblin-warn)' }} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddKeyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onKeyAdded={handleKeyAdded}
      />
    </div>
  );
}
