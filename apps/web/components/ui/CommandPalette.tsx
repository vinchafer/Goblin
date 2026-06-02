"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { Icon, type IconName } from "@/components/ui/icon";

export interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon?: IconName;
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
          <span style={{ fontSize: 'var(--t-body-fs)', opacity: 0.5 }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search anything…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent',
              color: 'var(--text)', fontSize: 15,
              fontFamily: 'var(--font-sans)',
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
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--t-small-fs)',
                        textAlign: 'left', transition: 'background 0.08s',
                      }}
                    >
                      {cmd.icon && (
                        <span style={{ width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon name={cmd.icon} size={16} />
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

/** Bridge a palette command to the mounted CodeMirror editor (Slice 2 + 5). The
 *  editor listens for `goblin:editor-cmd`; no-ops gracefully if none is mounted. */
function editorCmd(type: 'find' | 'replace') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('goblin:editor-cmd', { detail: type }));
  }
}

// Hook to build the command registry. Sprint 10 Slice 2: a real developer command
// palette (reusing the existing ⌘K shell, per the Convergence architecture) — not
// the old nav-only switcher. Sofia's #1 reach tool; Max never opens it.
export function useCommandPalette({
  projects,
  activeProjectId,
  onNewProject,
  onToggleSidebar,
  onLogout,
  onShortcuts,
  onReplayTour,
}: {
  projects: { id: string; name: string }[];
  activeProjectId?: string;
  onNewProject: () => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onShortcuts?: () => void;
  onReplayTour?: () => void;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const p = activeProjectId;

  const commands: CommandItem[] = [
    // ── Navigate ──
    { id: 'nav-dashboard', label: 'Go to Dashboard', category: 'Navigate', icon: 'project', action: () => router.push('/dashboard'), keywords: 'home start' },
    { id: 'nav-usage', label: 'Usage & Spend', category: 'Navigate', icon: 'usage', action: () => router.push('/dashboard/usage'), keywords: 'verbrauch billing tokens cost' },
    { id: 'nav-settings', label: 'Open Settings', category: 'Navigate', icon: 'settings', action: () => router.push('/dashboard/settings'), keywords: 'preferences einstellungen' },
    { id: 'nav-api-keys', label: 'API Keys (BYOK)', category: 'Navigate', icon: 'apiKey', action: () => router.push('/dashboard/settings/keys'), keywords: 'byok keys provider model' },

    // ── Current project (only in a project context) ──
    ...(p ? [
      { id: 'cur-code', label: 'Open Code', category: 'This Project', icon: 'code' as const, action: () => router.push(`/dashboard/project/${p}/work?tab=code`), keywords: 'editor code session' },
      { id: 'cur-chat', label: 'Open Chat', category: 'This Project', icon: 'chat' as const, action: () => router.push(`/dashboard/project/${p}/work?tab=chat`), keywords: 'chat talk' },
      { id: 'cur-preview', label: 'Open Preview', category: 'This Project', icon: 'web' as const, action: () => router.push(`/dashboard/project/${p}/work?tab=preview`), keywords: 'preview live' },
      { id: 'cur-files', label: 'File Explorer', category: 'This Project', icon: 'document' as const, action: () => router.push(`/dashboard/project/${p}/files`), keywords: 'files explorer dateien tree' },
      { id: 'cur-secrets', label: 'Secrets / Env Vars', category: 'This Project', icon: 'security' as const, action: () => router.push(`/dashboard/project/${p}/secrets`), keywords: 'secrets env environment variables' },
      { id: 'cur-hub', label: 'Project Hub', category: 'This Project', icon: 'project' as const, action: () => router.push(`/dashboard/project/${p}`), keywords: 'overview hub layout' },
    ] : []),

    // ── Edit (bridged to the mounted editor) ──
    { id: 'edit-find', label: 'Find in File', category: 'Edit', icon: 'search', action: () => editorCmd('find'), keywords: 'find search suchen ctrl+f' },
    { id: 'edit-replace', label: 'Find & Replace', category: 'Edit', icon: 'rename', action: () => editorCmd('replace'), keywords: 'replace ersetzen ctrl+h' },

    // ── Workspace ──
    { id: 'act-new-project', label: 'New Project', category: 'Workspace', icon: 'add', action: onNewProject, keywords: 'create neu projekt' },
    ...(p ? [
      { id: 'act-new-session', label: 'New Code Session', category: 'Workspace', icon: 'code' as const, action: () => router.push(`/dashboard/project/${p}/work?tab=code`), keywords: 'session neue code' },
    ] : []),
    { id: 'act-toggle-sidebar', label: 'Toggle Sidebar', category: 'Workspace', icon: 'menu', action: onToggleSidebar, keywords: 'sidebar menu close open' },

    // ── Appearance ──
    { id: 'theme-light', label: 'Light Theme', category: 'Appearance', icon: 'sun', action: () => setTheme('light'), keywords: 'light theme hell appearance' },
    { id: 'theme-dark', label: 'Dark Theme', category: 'Appearance', icon: 'moon', action: () => setTheme('dark'), keywords: 'dark theme dunkel appearance' },
    { id: 'theme-system', label: 'System Theme', category: 'Appearance', icon: 'monitor', action: () => setTheme('system'), keywords: 'system theme auto' },

    // ── Help & Account ──
    ...(onShortcuts ? [{ id: 'help-shortcuts', label: 'Keyboard Shortcuts', category: 'Help', icon: 'help' as const, action: onShortcuts, keywords: 'shortcuts keys tastatur' }] : []),
    ...(onReplayTour ? [{ id: 'help-tour', label: 'Replay Onboarding', category: 'Help', icon: 'refresh' as const, action: onReplayTour, keywords: 'onboarding tour intro replay' }] : []),
    { id: 'logout', label: 'Logout', category: 'Account', icon: 'logout', action: onLogout, keywords: 'sign out abmelden' },

    // ── Jump to project ──
    ...projects.slice(0, 10).map(pr => ({
      id: `proj-${pr.id}`,
      label: pr.name,
      category: 'Jump to Project',
      icon: 'project' as const,
      action: () => router.push(`/dashboard/project/${pr.id}`),
      keywords: pr.name.toLowerCase(),
    })),
  ];

  return commands;
}
