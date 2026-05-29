"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    section: 'Global',
    items: [
      { keys: ['⌘', 'K'], label: 'Command Palette' },
      { keys: ['⌘', 'B'], label: 'Toggle Sidebar' },
      { keys: ['⌘', ','], label: 'Settings' },
      { keys: ['⌘', 'N'], label: 'New Project' },
      { keys: ['?'], label: 'Show this help' },
    ],
  },
  {
    section: 'Tabs',
    items: [
      { keys: ['⌘', '1'], label: 'Chat' },
      { keys: ['⌘', '2'], label: 'Code' },
      { keys: ['⌘', '3'], label: 'Preview' },
    ],
  },
  {
    section: 'Chat',
    items: [
      { keys: ['⌘', '↵'], label: 'Send message' },
      { keys: ['/'], label: 'Focus chat input' },
      { keys: ['Esc'], label: 'Close modal / dropdown' },
    ],
  },
  {
    section: 'Code',
    items: [
      { keys: ['⌘', 'S'], label: 'Save file' },
      { keys: ['F2'], label: 'Rename file' },
    ],
  },
];

export function ShortcutsHelp({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'overlayIn 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'var(--panel)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'modalIn 0.15s ease-out',
        }}
      >
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--div)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--brand-green)', fontWeight: 700, letterSpacing: '-0.3px' }}>
              Your goblin&apos;s secret spells 🪄
            </h2>
            <p style={{ fontSize: 12, color: 'var(--meta)', marginTop: 2 }}>Keyboard shortcuts</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--meta)', fontSize: 18, padding: 4 }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '12px 24px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          {SHORTCUTS.map(section => (
            <div key={section.section} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--meta)', marginBottom: 8 }}>
                {section.section}
              </div>
              {section.items.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--div)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{item.label}</span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {item.keys.map((k, i) => (
                      <kbd key={i} style={{
                        fontSize: 11, background: 'var(--subtle)',
                        border: '1px solid var(--border)', borderRadius: 4,
                        padding: '1px 6px', color: 'var(--text)',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
