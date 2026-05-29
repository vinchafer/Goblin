"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface GitHubConnectButtonProps {
  connected: boolean;
  username?: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://goblinapi-production.up.railway.app';

export function GitHubConnectButton({ connected, username }: GitHubConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleConnect() {
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) return;

      const response = await fetch(`${API_URL}/api/github/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        window.location.href = result.url;
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) return;

      await fetch(`${API_URL}/api/github/disconnect`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ color: 'var(--brand-green)' }}>
          ✓ Connected as @{username}
        </span>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--surface-3)', color: 'var(--danger)' }}
        >
          {loading ? 'Disconnecting...' : 'Disconnect'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="px-4 py-2 rounded-lg text-sm font-medium text-white"
      style={{ backgroundColor: 'var(--ink-1)' }}
    >
      {loading ? 'Connecting...' : 'Connect GitHub'}
    </button>
  );
}