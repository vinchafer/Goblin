"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@goblin/shared/src/schemas";

const COLOR_PRESETS = [
  "#2D4A2B", "#D4A94A", "#B85C3C", "#4A7C3B", "#6B6B6B"
];

interface NewProjectModalProps {
  onClose: () => void;
  onProjectCreated?: (project: Project) => void;
}

export function NewProjectModal({ onClose, onProjectCreated }: NewProjectModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    dialogRef.current?.showModal();
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

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          color: selectedColor
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create project');
      }

      const project = await response.json();
      
      if (onProjectCreated) {
        onProjectCreated(project);
      }
      
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="rounded-2xl border shadow-2xl p-0"
      style={{
        backgroundColor: 'white',
        borderColor: 'var(--goblin-light)'
      }}
      onClick={(e) => e.target === dialogRef.current && handleClose()}
    >
      <form onSubmit={handleSubmit} className="w-[440px] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--goblin-slate)' }}>
            New Project
          </h2>
          <button type="button" onClick={handleClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" style={{ color: 'var(--goblin-gray)' }} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--goblin-slate)' }}>
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="My Awesome Project"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: 'var(--goblin-light)',
                color: 'var(--goblin-slate)'
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--goblin-slate)' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What are you building?"
              className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
              style={{
                borderColor: 'var(--goblin-light)',
                color: 'var(--goblin-slate)'
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--goblin-slate)' }}>
              Color
            </label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform ${selectedColor === color ? 'scale-110 ring-2 ring-offset-2' : ''}`}
                  style={{
                    backgroundColor: color
                  }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--goblin-warn)' }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: 'var(--goblin-gray)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name || loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: 'var(--goblin-moss)' }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </dialog>
  );
}