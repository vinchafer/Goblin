"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface FileTreeProps {
  projectId: string;
  files: string[];
  onFileClick: (path: string) => void;
  onFilesChanged?: () => void;
}

interface ContextMenu {
  x: number;
  y: number;
  path: string;
  isFolder: boolean;
  inEmptyArea?: boolean;
}

interface InlineInput {
  mode: 'new-file' | 'rename';
  parentPath: string;
  currentName?: string;
  fullPath?: string;
}

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function FileTree({ projectId, files, onFileClick, onFilesChanged }: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [inlineInput, setInlineInput] = useState<InlineInput | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inlineInput && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [inlineInput]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, path: string, isFolder: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path, isFolder });
  };

  const handleEmptyAreaContextMenu = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).closest('[data-file-item]') === null) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, path: '', isFolder: false, inEmptyArea: true });
    }
  };

  const createFile = useCallback(async (parentPath: string, filename: string) => {
    const filePath = parentPath ? `${parentPath}/${filename}` : filename;
    const token = await getToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: '' }),
      });
      onFilesChanged?.();
      onFileClick(filePath);
    } catch { /* silent */ }
  }, [projectId, onFileClick, onFilesChanged]);

  const renameFile = useCallback(async (from: string, newName: string) => {
    const parts = from.split('/');
    parts[parts.length - 1] = newName;
    const to = parts.join('/');
    if (to === from) return;
    const token = await getToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/projects/${projectId}/files/rename`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      onFilesChanged?.();
    } catch { /* silent */ }
  }, [projectId, onFilesChanged]);

  const deleteFileAction = useCallback(async (path: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/projects/${projectId}/files/${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      onFilesChanged?.();
    } catch { /* silent */ }
    setDeleteTarget(null);
  }, [projectId, onFilesChanged]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      if (inlineInput?.mode === 'new-file') {
        createFile(inlineInput.parentPath, inputValue.trim());
      } else if (inlineInput?.mode === 'rename' && inlineInput.fullPath) {
        renameFile(inlineInput.fullPath, inputValue.trim());
      }
      setInlineInput(null);
      setInputValue('');
    } else if (e.key === 'Escape') {
      setInlineInput(null);
      setInputValue('');
    }
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path).catch(() => {});
  };

  const tree = buildTree(files);

  return (
    <div ref={containerRef} style={{ position: 'relative', height: '100%' }} onContextMenu={handleEmptyAreaContextMenu}>
      {/* File tree nodes */}
      <div style={{ padding: '4px 0' }}>
        {renderTreeNode(
          tree, '', expandedFolders, toggleFolder, onFileClick,
          handleContextMenu, inlineInput, inputValue, setInputValue,
          handleInputKeyDown, projectId
        )}

        {/* Inline new file input at root */}
        {inlineInput?.mode === 'new-file' && inlineInput.parentPath === '' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 20px' }}>
            <span style={{ width: 12, flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={() => { setInlineInput(null); setInputValue(''); }}
              placeholder="filename.tsx"
              style={{
                background: 'rgba(201,147,58,0.1)', border: '1px solid #c9933a',
                borderRadius: 3, color: '#c5d0c0', fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace', padding: '2px 6px',
                outline: 'none', width: '100%',
              }}
            />
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed', top: contextMenu.y, left: contextMenu.x,
            background: '#1e2a1c', border: '1px solid #2d4a2b', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 1000,
            minWidth: 160, padding: '4px 0', fontSize: 12,
            fontFamily: 'DM Sans, sans-serif',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {contextMenu.inEmptyArea ? (
            <>
              <ContextItem icon="📝" label="New File" onClick={() => {
                setContextMenu(null);
                setInlineInput({ mode: 'new-file', parentPath: '' });
                setInputValue('');
              }} />
            </>
          ) : contextMenu.isFolder ? (
            <>
              <ContextItem icon="📝" label="New File Here" onClick={() => {
                setContextMenu(null);
                setInlineInput({ mode: 'new-file', parentPath: contextMenu.path });
                setInputValue('');
              }} />
              <div style={{ height: 1, background: 'var(--moss)', margin: '4px 0' }} />
              <ContextItem icon="🗑" label="Delete Folder" danger onClick={() => {
                setContextMenu(null);
                setDeleteTarget({ path: contextMenu.path, name: contextMenu.path.split('/').pop() || contextMenu.path });
              }} />
            </>
          ) : (
            <>
              <ContextItem icon="✏️" label="Rename" onClick={() => {
                const name = contextMenu.path.split('/').pop() || '';
                setContextMenu(null);
                setInlineInput({ mode: 'rename', parentPath: '', currentName: name, fullPath: contextMenu.path });
                setInputValue(name);
              }} />
              <ContextItem icon="📋" label="Copy Path" onClick={() => {
                copyPath(contextMenu.path);
                setContextMenu(null);
              }} />
              <div style={{ height: 1, background: 'var(--moss)', margin: '4px 0' }} />
              <ContextItem icon="🗑" label="Delete" danger onClick={() => {
                setContextMenu(null);
                setDeleteTarget({ path: contextMenu.path, name: contextMenu.path.split('/').pop() || contextMenu.path });
              }} />
            </>
          )}
        </div>
      )}

      {/* Delete confirmation popover */}
      {deleteTarget && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setDeleteTarget(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#1e2a1c', border: '1px solid #2d4a2b', borderRadius: 10,
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 1000,
            padding: '16px 20px', minWidth: 240,
          }}>
            <div style={{ fontSize: 13, color: '#c5d0c0', fontFamily: 'DM Sans, sans-serif', marginBottom: 12 }}>
              Delete <span style={{ color: 'var(--ochre-dark)', fontFamily: 'JetBrains Mono, monospace' }}>{deleteTarget.name}</span>?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => deleteFileAction(deleteTarget.path)}
                style={{
                  background: 'rgba(184,92,60,0.2)', border: '1px solid rgba(184,92,60,0.4)',
                  color: '#e87a5a', borderRadius: 6, padding: '6px 14px',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  background: 'transparent', border: '1px solid #2d4a2b',
                  color: '#8aaa85', borderRadius: 6, padding: '6px 14px',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ContextItem({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '6px 14px', background: 'none', border: 'none',
        color: danger ? '#e87a5a' : '#c5d0c0', fontSize: 12, cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif', textAlign: 'left',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,147,58,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <span style={{ fontSize: 13 }}>{icon}</span> {label}
    </button>
  );
}

function buildTree(paths: string[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const path of paths) {
    const parts = path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      if (i === parts.length - 1) {
        if (!(part in current)) current[part] = null;
      } else {
        if (!(part in current) || current[part] === null) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
    }
  }
  return root;
}

function renderTreeNode(
  node: Record<string, unknown>,
  path: string,
  expanded: Set<string>,
  onToggle: (path: string) => void,
  onFileClick: (path: string) => void,
  onContextMenu: (e: React.MouseEvent, path: string, isFolder: boolean) => void,
  inlineInput: InlineInput | null,
  inputValue: string,
  setInputValue: (v: string) => void,
  onInputKeyDown: (e: React.KeyboardEvent) => void,
  projectId: string,
): React.ReactNode {
  return Object.entries(node)
    .sort(([aName, aVal], [bName, bVal]) => {
      const aIsFolder = aVal !== null;
      const bIsFolder = bVal !== null;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      return aName.localeCompare(bName);
    })
    .map(([name, children]) => {
      const fullPath = path ? `${path}/${name}` : name;
      const isFolder = children !== null;
      const isRenaming = inlineInput?.mode === 'rename' && inlineInput.fullPath === fullPath;
      const depth = fullPath.split('/').length - 1;

      return (
        <div key={fullPath} data-file-item>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px 2px 0', paddingLeft: `${8 + depth * 12}px`,
              cursor: 'pointer', borderRadius: 4, userSelect: 'none',
              color: '#8aaa85',
            }}
            onClick={() => isFolder ? onToggle(fullPath) : onFileClick(fullPath)}
            onContextMenu={e => onContextMenu(e, fullPath, isFolder)}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(138,170,133,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ width: 12, flexShrink: 0, fontSize: 9, color: '#6b8a6b', display: 'inline-flex', alignItems: 'center' }}>
              {isFolder ? (expanded.has(fullPath) ? '▾' : '▸') : ''}
            </span>

            {isRenaming ? (
              <input
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={onInputKeyDown}
                onBlur={() => {}}
                style={{
                  background: 'rgba(201,147,58,0.1)', border: '1px solid #c9933a',
                  borderRadius: 3, color: '#c5d0c0', fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace', padding: '1px 4px',
                  outline: 'none', flex: 1,
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span style={{
                fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
                color: '#c5d0c0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {name}
              </span>
            )}
          </div>

          {/* New file input inside folder */}
          {inlineInput?.mode === 'new-file' && inlineInput.parentPath === fullPath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: `2px 8px 2px ${8 + (depth + 1) * 12}px` }}>
              <span style={{ width: 12 }} />
              <input
                autoFocus
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={onInputKeyDown}
                onBlur={() => {}}
                placeholder="filename.tsx"
                style={{
                  background: 'rgba(201,147,58,0.1)', border: '1px solid #c9933a',
                  borderRadius: 3, color: '#c5d0c0', fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace', padding: '1px 4px',
                  outline: 'none', flex: 1,
                }}
              />
            </div>
          )}

          {isFolder && expanded.has(fullPath) && (
            renderTreeNode(
              children as Record<string, unknown>, fullPath, expanded,
              onToggle, onFileClick, onContextMenu,
              inlineInput, inputValue, setInputValue, onInputKeyDown, projectId,
            )
          )}
        </div>
      );
    });
}
