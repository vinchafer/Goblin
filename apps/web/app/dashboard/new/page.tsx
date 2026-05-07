'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      if (res.ok) {
        const project = await res.json();
        router.push(`/dashboard/project/${project.id}`);
      } else {
        let msg = `Server error (${res.status})`;
        try { const body = await res.json(); if (body.error) msg = body.error; } catch {}
        setError(msg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — check connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100%', padding: '0 var(--space-6) var(--space-12)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 'var(--space-12)' }}>

        <button onClick={() => router.back()} className="btn btn-ghost btn-sm" style={{ marginBottom: 28 }}>
          ← Back
        </button>

        <h1 className="page-hero-title">New project</h1>
        <p className="page-hero-sub">Give your goblin a mission.</p>

        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div className="field-group">
            <label className="field-label">
              Project name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My SaaS App"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label">
              Description <span style={{ color: 'var(--meta)', fontWeight: 300 }}>(optional)</span>
            </label>
            <textarea
              className="textarea-field"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A newsletter platform for indie hackers…"
              rows={3}
            />
          </div>

          {error && <p className="banner-error" style={{ margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            {loading ? 'Creating…' : 'Create project →'}
          </button>
        </form>
      </div>
    </div>
  );
}
