"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, CircleNotch } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@goblin/shared/src/schemas";

const COLOR_PRESETS = [
  { hex: 'var(--ochre)', label: 'Ochre' },
  { hex: 'var(--moss)', label: 'Moss' },
  { hex: 'var(--danger)', label: 'Rust' },
  { hex: 'var(--text)', label: 'Slate' },
  { hex: '#7A4A8A', label: 'Purple' },
  { hex: '#4A7A7A', label: 'Teal' },
  { hex: '#8A3A5A', label: 'Pink' },
];

interface NewProjectModalProps {
  onClose: () => void;
  onProjectCreated?: (project: Project) => void;
}

export function NewProjectModal({ onClose, onProjectCreated }: NewProjectModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]!.hex);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    dialogRef.current?.showModal();
    // Pick up prefill prompt set by dashboard starter cards
    const prefill = typeof window !== 'undefined' ? sessionStorage.getItem('goblin_prefill_prompt') : null;
    if (prefill) {
      setDescription(prefill);
      sessionStorage.removeItem('goblin_prefill_prompt');
    }
  }, []);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
      onProjectCreated?.(project);
      dialogRef.current?.close();
      router.push(`/dashboard/project/${project.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      console.error('Project creation failed:', {
        message: msg,
        apiUrl: process.env.NEXT_PUBLIC_API_URL,
      });
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      style={{
        backgroundColor: '#fff',
        border: '1px solid var(--div)',
        borderRadius: 18,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        padding: 0,
        maxWidth: 460,
        width: '100%',
      }}
      onClick={(e) => e.target === dialogRef.current && handleClose()}
    >
      <form onSubmit={handleSubmit} style={{ padding: 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: 'var(--moss)', fontWeight: 700, letterSpacing: '-0.4px' }}>
            New Project
          </h2>
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--meta)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Name */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                Project Name <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: name.length > 40 ? 'var(--error)' : 'var(--meta)' }}>
                {name.length}/50
              </span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              required
              autoFocus
              placeholder="My Awesome Project"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 9,
                border: '1.5px solid var(--div)', fontSize: 14,
                fontFamily: 'DM Sans, sans-serif', color: 'var(--text)',
                outline: 'none', boxSizing: 'border-box', background: '#fff',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
              onBlur={e => (e.target.style.borderColor = 'var(--div)')}
            />
          </div>

          {/* Description */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                What are you building?
              </label>
              <span style={{ fontSize: 11, color: description.length > 180 ? 'var(--error)' : 'var(--meta)' }}>
                {description.length}/200
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="A SaaS app, landing page, API..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 9,
                border: '1.5px solid var(--div)', fontSize: 13,
                fontFamily: 'DM Sans, sans-serif', color: 'var(--text)',
                outline: 'none', resize: 'none', boxSizing: 'border-box',
                lineHeight: 1.5, background: '#fff',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--moss)')}
              onBlur={e => (e.target.style.borderColor = 'var(--div)')}
            />
          </div>

          {/* Color picker */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLOR_PRESETS.map(({ hex, label }) => (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  onClick={() => setSelectedColor(hex)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: hex, border: 'none', cursor: 'pointer',
                    outline: selectedColor === hex ? `3px solid ${hex}` : 'none',
                    outlineOffset: 2,
                    transform: selectedColor === hex ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 0.15s, outline 0.15s',
                    boxShadow: selectedColor === hex ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                  }}
                  aria-label={label}
                  aria-pressed={selectedColor === hex}
                />
              ))}
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--error)', background: 'rgba(184,92,60,0.08)', padding: '10px 14px', borderRadius: 8 }}>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid var(--div)',
              background: 'transparent', color: 'var(--meta)', fontSize: 13,
              fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || loading}
            style={{
              padding: '9px 22px', borderRadius: 8, border: 'none',
              background: 'var(--moss)', color: '#fff', fontSize: 13,
              fontWeight: 500, cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              opacity: !name.trim() ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            {loading && <CircleNotch size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
            {loading ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </dialog>
  );
}
