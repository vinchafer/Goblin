"use client";

import { useState } from "react";
import { X, Github, Loader2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PushToGitHubModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultName: string;
}

export function PushToGitHubModal({ open, onClose, projectId, defaultName }: PushToGitHubModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const supabase = createClient();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      const response = await fetch(`/api/github/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          projectId,
          name,
          description,
          isPrivate
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to push to GitHub');
      }

      const result = await response.json();
      setSuccessUrl(result.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName(defaultName);
    setDescription('');
    setIsPrivate(true);
    setLoading(false);
    setError(null);
    setSuccessUrl(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full m-4">
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--goblin-light)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--goblin-slate)' }}>Push to GitHub</h2>
          <button onClick={handleClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" style={{ color: 'var(--goblin-gray)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {successUrl ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(74, 124, 59, 0.1)' }}>
                <Github className="w-8 h-8" style={{ color: 'var(--goblin-good)' }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--goblin-slate)' }}>Success!</h3>
              <p className="mb-4" style={{ color: 'var(--goblin-gray)' }}>Your project was pushed to GitHub</p>
              <a
                href={successUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
                style={{ backgroundColor: 'var(--goblin-moss)', color: 'white' }}
              >
                View Repository <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--goblin-slate)' }}>Repository Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  pattern="[a-zA-Z0-9-_]+"
                  placeholder="my-awesome-project"
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--goblin-light)' }}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--goblin-slate)' }}>Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short project description"
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ borderColor: 'var(--goblin-light)' }}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                <label htmlFor="private" className="text-sm" style={{ color: 'var(--goblin-slate)' }}>Private repository</label>
              </div>

              {error && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(184, 92, 60, 0.1)', color: 'var(--goblin-warn)' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !name}
                className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--goblin-slate)', color: 'white' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                {loading ? 'Pushing...' : 'Push to GitHub'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}