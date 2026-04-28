'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const COLORS = [
  { name: 'Ochre', hex: '#D4A94A' },
  { name: 'Moss', hex: '#2D4A2B' },
  { name: 'Rust', hex: '#B85C3C' },
  { name: 'Forest', hex: '#4A7C3B' },
  { name: 'Gray', hex: '#6B6B6B' },
  { name: 'Brown', hex: '#3A2E1F' },
];

interface NewProjectModalProps {
  onClose: () => void;
}

export function NewProjectModal({ onClose }: NewProjectModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]?.hex ?? '#c9933a');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBase}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          color: selectedColor,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create project');
      }

      const project = await response.json();
      onClose();
      router.push(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: '#fff', borderRadius: 16, padding: 28, width: 440,
        zIndex: 201, boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: '#1e3a1c', margin: 0 }}>
            New Project
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b6560', padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Project Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e3a1c', marginBottom: 6 }}>
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 50))}
              placeholder="My Awesome Project"
              required
              maxLength={50}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid #e4ddd2', fontSize: 14,
                fontFamily: 'DM Sans, sans-serif', outline: 'none',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
            <div style={{ fontSize: 11, color: '#6b6560', marginTop: 4, textAlign: 'right' }}>
              {name.length}/50
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e3a1c', marginBottom: 6 }}>
              What are you building?
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="Optional — describe your project idea..."
              maxLength={200}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid #e4ddd2', fontSize: 14, resize: 'none',
                fontFamily: 'DM Sans, sans-serif', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 11, color: '#6b6560', marginTop: 4, textAlign: 'right' }}>
              {description.length}/200
            </div>
          </div>

          {/* Color Picker */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e3a1c', marginBottom: 10 }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {COLORS.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c.hex)}
                  title={c.name}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: c.hex, border: selectedColor === c.hex ? '3px solid #1e3a1c' : '3px solid transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                    transform: selectedColor === c.hex ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: '#fef2f2', color: '#b85c3c',
              fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!name.trim() || loading}
            style={{
              width: '100%', padding: '12px 20px', borderRadius: 10,
              background: '#1e3a1c', color: '#c9933a', border: 'none',
              fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
              opacity: !name.trim() ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#2d5229'; }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#1e3a1c'; }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #c9933a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Creating...
              </>
            ) : (
              'Create project →'
            )}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}