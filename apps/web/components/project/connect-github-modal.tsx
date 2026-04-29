"use client";

import { useState } from "react";
import { X, Github, Loader2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ConnectGitHubModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function ConnectGitHubModal({ open, onClose, onConnected }: ConnectGitHubModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  if (!open) return null;

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBase}/api/github/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to start GitHub connection');
      }

      const data = await response.json();
      
      // Redirect to GitHub OAuth
      window.location.href = data.url;
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to GitHub';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLoading(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full m-4">
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--goblin-light)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--goblin-slate)' }}>Connect GitHub</h2>
          <button onClick={handleClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" style={{ color: 'var(--goblin-gray)' }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-center py-2">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(74, 124, 59, 0.1)' }}>
              <Github className="w-8 h-8" style={{ color: 'var(--goblin-good)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--goblin-slate)' }}>Connect GitHub to push your code</h3>
            <p className="mb-4 text-sm" style={{ color: 'var(--goblin-gray)' }}>
              You need to connect your GitHub account to push your project to a repository.
              This will create a new repository with all your project files.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(184, 92, 60, 0.1)', color: 'var(--goblin-warn)' }}>
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--goblin-slate)', color: 'white' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
              {loading ? 'Connecting...' : 'Connect GitHub'}
            </button>

            <button
              onClick={handleClose}
              className="w-full py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--goblin-light)', color: 'var(--goblin-gray)' }}
            >
              Cancel
            </button>
          </div>

          <div className="text-xs text-center pt-4" style={{ color: 'var(--goblin-gray)' }}>
            <p>You'll be redirected to GitHub to authorize Goblin.</p>
            <p>We only request minimal permissions to create repositories.</p>
          </div>
        </div>
      </div>
    </div>
  );
}