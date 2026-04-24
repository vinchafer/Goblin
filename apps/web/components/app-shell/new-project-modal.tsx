"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

const COLOR_PRESETS = [
  "#2D4A2B", "#D4A94A", "#B85C3C", "#4A7C3B", "#6B6B6B"
];

interface NewProjectModalProps {
  onClose: () => void;
}

export function NewProjectModal({ onClose }: NewProjectModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[1]);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Will POST to /api/projects in next phase
    handleClose();
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
                    backgroundColor: color,
                    ringColor: 'var(--goblin-moss)'
                  }}
                />
              ))}
            </div>
          </div>
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
            disabled={!name}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--goblin-moss)' }}
          >
            Create Project
          </button>
        </div>
      </form>
    </dialog>
  );
}