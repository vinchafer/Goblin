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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      if (res.ok) {
        const project = await res.json();
        router.push(`/dashboard/project/${project.id}`);
      } else {
        setError('Failed to create project. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '64px auto', padding: '0 24px' }}>
      <button
        onClick={() => router.back()}
        style={{ background: 'none', border: 'none', color: 'var(--meta)', fontSize: 13, cursor: 'pointer', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif' }}
      >
        ← Back
      </button>
      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 36, color: 'var(--moss)', fontWeight: 700, marginBottom: 8, letterSpacing: '-1px' }}>
        New project
      </h1>
      <p style={{ fontSize: 15, color: 'var(--meta)', marginBottom: 36, fontWeight: 300 }}>
        Give your goblin a mission.
      </p>
      <form onSubmit={handleSubmit} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>Project name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My SaaS App"
            required
            style={{ width: '100%', height: 48, padding: '0 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: 15, fontFamily: 'DM Sans, sans-serif', outline: 'none' }}
            onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="A newsletter platform for indie hackers..."
            rows={3}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 9, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: 14, fontFamily: 'DM Sans, sans-serif', outline: 'none', resize: 'vertical' }}
            onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          style={{
            background: 'var(--moss)', color: '#fff', border: 'none', borderRadius: 9,
            padding: '12px', fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading || !name.trim() ? 0.6 : 1, fontFamily: 'DM Sans, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? 'Creating…' : 'Create project →'}
        </button>
      </form>
    </div>
  );
}
