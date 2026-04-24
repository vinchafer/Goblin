"use client";

import { useState } from "react";
import { KeyRound, Trash2, Plus, Clock } from "lucide-react";
import type { ByokKey } from "@goblin/shared/src/schemas";
import { AddKeyModal } from "./add-key-modal";
import { createClient } from "@/lib/supabase/client";

interface KeysListProps {
  initialKeys: ByokKey[];
}

export function KeysList({ initialKeys }: KeysListProps) {
  const [keys, setKeys] = useState<ByokKey[]>(initialKeys);
  const [modalOpen, setModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const supabase = createClient();

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this key? This cannot be undone.')) return;

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/byok-keys/${keyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      }
    });

    setKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'revoked' as const } : k));
  };

  const handleKeyAdded = (newKey: ByokKey) => {
    setKeys(prev => [newKey, ...prev]);
    setSuccessMessage('Key added — your goblin can now use it');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(74, 124, 59, 0.1)', color: 'var(--goblin-good)' }}>
          {successMessage}
        </div>
      )}

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
                <button onClick={() => handleRevoke(key.id)} className="p-2 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-4 h-4" style={{ color: 'var(--goblin-warn)' }} />
                </button>
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