'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const INPUT_STYLE = {
  width: '100%',
  padding: '0 16px',
  borderRadius: 9,
  border: '1.5px solid var(--border)',
  background: '#fff',
  color: 'var(--text)',
  fontSize: 16,
  fontFamily: 'DM Sans, sans-serif',
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box' as const,
};

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
        setError('Failed to create project. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100%', padding: '0 24px 48px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 48 }}>
        {/* Back link */}
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none',
            color: 'var(--meta)', fontSize: 13, cursor: 'pointer',
            marginBottom: 28, display: 'flex', alignItems: 'center',
            gap: 6, fontFamily: 'DM Sans, sans-serif',
            padding: '4px 0', minHeight: 36,
          }}
        >
          ← Back
        </button>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'Fraunces, serif', fontSize: 'clamp(28px, 5vw, 36px)',
          color: 'var(--moss)', fontWeight: 700,
          marginBottom: 8, letterSpacing: '-1px',
        }}>
          New project
        </h1>
        <p style={{ fontSize: 15, color: 'var(--meta)', marginBottom: 36, fontWeight: 300 }}>
          Give your goblin a mission.
        </p>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 14, padding: 28,
            display: 'flex', flexDirection: 'column', gap: 20,
          }}
        >
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 7, color: 'var(--text)' }}>
              Project name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My SaaS App"
              required
              style={{ ...INPUT_STYLE, height: 48 }}
              onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 7, color: 'var(--text)' }}>
              Description <span style={{ color: 'var(--meta)', fontWeight: 300 }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A newsletter platform for indie hackers…"
              rows={3}
              style={{
                ...INPUT_STYLE,
                height: 'auto', padding: '12px 16px',
                resize: 'vertical', lineHeight: 1.5,
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Error */}
          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            style={{
              width: '100%', background: 'var(--moss)', color: '#fff',
              border: 'none', borderRadius: 9,
              padding: '14px', fontSize: 15, fontWeight: 500,
              cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !name.trim() ? 0.55 : 1,
              fontFamily: 'DM Sans, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s', minHeight: 48,
            }}
            onMouseEnter={e => { if (!loading && name.trim()) (e.currentTarget as HTMLElement).style.background = 'var(--moss2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--moss)'; }}
          >
            {loading ? 'Creating…' : 'Create project →'}
          </button>
        </form>
      </div>
    </div>
  );
}
