'use client';

import { FileTree } from '@/components/project/file-tree';
import { Icon } from '@/components/ui/icon';

interface CodeMobileFileSheetProps {
  open: boolean;
  projectId: string;
  files: string[];
  onClose: () => void;
  onFileClick: (path: string) => void;
  onFilesChanged: () => void;
}

export function CodeMobileFileSheet({
  open, projectId, files, onClose, onFileClick, onFilesChanged,
}: CodeMobileFileSheetProps) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.4)' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 280,
          background: 'var(--green-950)', overflowY: 'auto',
          boxShadow: '4px 0 20px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-on-dark-2)' }}>Files</span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'none', border: 'none', color: 'var(--ink-on-dark-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <FileTree projectId={projectId} files={files} onFileClick={onFileClick} onFilesChanged={onFilesChanged} />
        </div>
      </div>
    </div>
  );
}
