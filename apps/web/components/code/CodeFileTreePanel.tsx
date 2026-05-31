'use client';

import { FileTree } from '@/components/project/file-tree';
import { Icon } from '@/components/ui/icon';

interface CodeFileTreePanelProps {
  projectId: string;
  files: string[];
  loading: boolean;
  open: boolean;
  onToggle: () => void;
  onFileClick: (path: string) => void;
  onFilesChanged: () => void;
}

export function CodeFileTreePanel({
  projectId, files, loading, open, onToggle, onFileClick, onFilesChanged,
}: CodeFileTreePanelProps) {
  return (
    <div
      className="gb-filetree-panel"
      style={{
        flexDirection: 'column',
        borderRight: '1px solid var(--ed-rule)',
        background: 'var(--ed-chrome)',
        width: open ? 256 : 44,
        minWidth: open ? 256 : 44,
        transition: 'width 0.2s ease, min-width 0.2s ease',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onToggle}
        aria-label={open ? 'Collapse file tree' : 'Expand file tree'}
        style={{
          padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: '1px solid var(--ed-rule)', flexShrink: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          width: '100%', textAlign: 'left',
        } as React.CSSProperties}
      >
        {open
          ? <span style={{ fontSize: 'var(--t-caption-fs)', fontWeight: 600, color: 'var(--ed-fg-2)', fontFamily: 'var(--font-sans)' }}>Files</span>
          : <Icon name="menu" size={14} color="var(--ed-fg-2)" />}
      </button>
      {open && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 14, borderRadius: 4, background: 'var(--ed-rule)', animation: 'pulse 1.5s ease infinite' }} />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--t-caption-fs)', color: 'var(--ed-fg-3)', marginBottom: 4 }}>No files yet</p>
              <p style={{ fontSize: 11, color: 'var(--ed-fg-3)' }}>Start chatting to generate code.</p>
            </div>
          ) : (
            <FileTree projectId={projectId} files={files} onFileClick={onFileClick} onFilesChanged={onFilesChanged} />
          )}
        </div>
      )}
    </div>
  );
}
