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
          background: 'var(--ed-chrome)', borderRight: '1px solid var(--ed-rule)', overflowY: 'auto',
          boxShadow: '4px 0 20px rgba(15,43,30,0.18)',
          // SAFEAREA-U-BOTTOM: full-height drawer — pad the scroll container's
          // bottom so the last file rows clear the iOS home indicator (0 in a
          // browser tab).
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ed-fg-2)' }}>Dateien</span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'none', border: 'none', color: 'var(--ed-fg-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
