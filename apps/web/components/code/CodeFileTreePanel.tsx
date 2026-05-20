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
        borderRight: '1px solid #1e2a1c',
        background: '#0f1410',
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
          borderBottom: '1px solid #1e2a1c', flexShrink: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          width: '100%', textAlign: 'left',
        } as React.CSSProperties}
      >
        {open
          ? <span style={{ fontSize: 12, fontWeight: 600, color: '#8aaa85', fontFamily: 'DM Sans, sans-serif' }}>Files</span>
          : <Icon name="menu" size={14} color="#8aaa85" />}
      </button>
      {open && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 14, borderRadius: 4, background: '#1e2a1c', animation: 'pulse 1.5s ease infinite' }} />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#6b8a6b', marginBottom: 4 }}>No files yet</p>
              <p style={{ fontSize: 11, color: '#4a6a4a' }}>Start chatting to generate code.</p>
            </div>
          ) : (
            <FileTree projectId={projectId} files={files} onFileClick={onFileClick} onFilesChanged={onFilesChanged} />
          )}
        </div>
      )}
    </div>
  );
}
