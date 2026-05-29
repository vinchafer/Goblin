'use client';

import { useSheetStack } from '../ui/SheetStack';
import { SheetCloseButton, SheetBackButton } from '../ui/BottomSheet';

interface Props {
  current: { key: string; node: React.ReactNode; title?: string };
  depth: number;
  onClose: () => void;
}

export function SettingsSheetInner({ current, depth, onClose }: Props) {
  const { pop } = useSheetStack();
  const isRoot = depth === 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 16px',
          minHeight: 56,
          flexShrink: 0,
        }}
      >
        <span style={{ minWidth: 40, display: 'flex' }}>
          {isRoot ? <SheetCloseButton onClick={onClose} /> : <SheetBackButton onClick={pop} />}
        </span>
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            color: 'var(--text)',
          }}
        >
          {current.title ?? (isRoot ? 'Einstellungen' : '')}
        </span>
        <span style={{ minWidth: 40 }} />
      </header>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {current.node}
      </div>
    </div>
  );
}
