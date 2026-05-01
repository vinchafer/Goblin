"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";

export interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon?: string;
  action: () => void;
  keywords?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 3;
  if (t.startsWith(q)) return 2;
  if (t.includes(q)) return 1;
  return 0;
}

export function CommandPalette({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? commands
        .map(c => ({ c, score: Math.max(fuzzyScore(query, c.label), fuzzyScore(query, c.keywords ?? '')) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || a.c.category.localeCompare(b.c.category))
        .map(x => x.c)
    : commands;

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  const run = useCallback((cmd: CommandItem) => {
    cmd.action();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[selected] as CommandItem | undefined;
        if (cmd) run(cmd);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected, run, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const categories = [...new Set(filtered.map(c => c.category))];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'overlayIn 0.15s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--panel)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'modalIn 0.15s ease-out',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid var(--div)',
        }}>
          <span style={{ fontSize: 16, opacity: 0.5 }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search anything…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent',
              color: 'var(--text)', fontSize: 15,
              fontFamily: 'DM Sans, sans-serif',
            }}
          />
          <kbd style={{
            fontSize: 11, color: 'var(--meta)',
            background: 'var(--subtle)', borderRadius: 4,
            padding: '2px 6px', border: '1px solid var(--border)',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--meta)', fontSize: 13 }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {categories.map(cat => {
            const items = filtered.filter(c => c.category === cat);
            const firstItem = items[0];
            const globalOffset = firstItem ? filtered.indexOf(firstItem) : 0;
            return (
              <div key={cat}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--meta)',
                  padding: '8px 16px 4px',
                }}>
                  {cat}
                </div>
                {items.map((cmd, i) => {
                  const idx = globalOffset + i;
                  const isSelected = idx === selected;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => run(cmd)}
                      onMouseEnter={() => setSelected(idx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px', border: 'none', cursor: 'pointer',
                        background: isSelected ? 'var(--subtle)' : 'transparent',
                        color: isSelected ? 'var(--text)' : 'var(--text-2)',
                        fontFamily: 'DM Sans, sans-serif', fontSize: 14,
                        textAlign: 'left', transition: 'background 0.08s',
                      }}
                    >
                      {cmd.icon && (
                        <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>
                          {cmd.icon}
                        </span>
                      )}
                      <span style={{ flex: 1 }}>{cmd.label}</span>
                      {isSelected && (
                        <kbd style={{
                          fontSize: 10, color: 'var(--meta)',
                          background: 'var(--div)', borderRadius: 4,
                          padding: '1px 5px', border: '1px solid var(--border)',
                        }}>↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Hook to build command list — use in shell
export function useCommandPalette({
  projects,
  activeProjectId,
  onNewProject,
  onToggleSidebar,
  onLogout,
}: {
  projects: { id: string; name: string }[];
  activeProjectId?: string;
  onNewProject: () => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();

  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard', category: 'Navigation', icon: '🏠', action: () => router.push('/dashboard'), keywords: 'home' },
    { id: 'nav-settings', label: 'Open Settings', category: 'Navigation', icon: '⚙️', action: () => router.push('/dashboard/settings'), keywords: 'preferences' },
    { id: 'nav-api-keys', label: 'API Keys', category: 'Navigation', icon: '🔑', action: () => router.push('/dashboard/settings/keys'), keywords: 'byok keys provider' },
    // Actions
    { id: 'act-new-project', label: 'New Project', category: 'Actions', icon: '✨', action: onNewProject, keywords: 'create' },
    { id: 'act-toggle-sidebar', label: 'Toggle Sidebar', category: 'Actions', icon: '◀', action: onToggleSidebar, keywords: 'sidebar menu close open' },
    // Per-project navigation
    ...projects.slice(0, 8).map(p => ({
      id: `proj-${p.id}`,
      label: `${p.name} — Chat`,
      category: 'Projects',
      icon: '💬',
      action: () => router.push(`/dashboard/project/${p.id}`),
      keywords: p.name.toLowerCase(),
    })),
    // Settings
    { id: 'theme-light', label: 'Switch to Light Mode', category: 'Settings', icon: '☀️', action: () => setTheme('light'), keywords: 'light theme appearance' },
    { id: 'theme-dark', label: 'Switch to Dark Mode', category: 'Settings', icon: '🌙', action: () => setTheme('dark'), keywords: 'dark theme appearance' },
    { id: 'theme-system', label: 'Use System Theme', category: 'Settings', icon: '💻', action: () => setTheme('system'), keywords: 'system theme auto' },
    { id: 'logout', label: 'Logout', category: 'Settings', icon: '🚪', action: onLogout, keywords: 'sign out' },
  ];

  return commands;
}
