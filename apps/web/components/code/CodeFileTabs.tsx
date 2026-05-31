'use client';

import { Icon } from '@/components/ui/icon';

interface CodeFileTabsProps {
  openFiles: string[];
  activePath: string | null;
  injectedFiles: Set<string>;
  isDirty: boolean;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function CodeFileTabs({ openFiles, activePath, injectedFiles, isDirty, onSelect, onClose }: CodeFileTabsProps) {
  if (openFiles.length === 0) return null;
  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid var(--rule-strong)',
      background: 'var(--green-950)',
      flexShrink: 0,
      overflowX: 'auto',
      scrollbarWidth: 'thin',
    }}>
      {openFiles.map(path => {
        const isActive = path === activePath;
        const fname = path.split('/').pop() ?? path;
        const isInjected = injectedFiles.has(path);
        const showDirty = isActive && isDirty;
        return (
          <div
            key={path}
            onClick={() => onSelect(path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px',
              borderRight: '1px solid var(--rule-strong)',
              background: isActive ? 'var(--surface-ink-2)' : 'transparent',
              borderBottom: isActive ? '2px solid var(--brand-green)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 'var(--t-caption-fs)',
              color: isActive ? 'var(--ink-on-dark-1)' : 'var(--ink-on-dark-2)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'background 0.12s, border-color 0.12s',
            }}
            title={path}
          >
            <span>{fname}</span>
            {(showDirty || isInjected) && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--brand-gold)',
                display: 'inline-block',
              }} title={showDirty ? 'Unsaved' : 'Injected'} />
            )}
            <button
              onClick={e => { e.stopPropagation(); onClose(path); }}
              aria-label={`Close ${fname}`}
              style={{
                background: 'none', border: 'none', color: 'var(--ink-on-dark-3)',
                cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
                opacity: 0.6, transition: 'opacity 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
