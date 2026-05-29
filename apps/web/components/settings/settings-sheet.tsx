'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/app-context';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SheetStackProvider } from '@/components/ui/SheetStack';
import { SettingsRoot } from './SettingsRoot';
import { SettingsSheetInner } from './SettingsSheetInner';

export function SettingsSheet() {
  const { showSettingsSheet, setShowSettingsSheet, setSettingsInitialItem } = useApp();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const close = () => {
    setShowSettingsSheet(false);
    setSettingsInitialItem(null);
  };

  // Desktop uses SettingsModal (mounted in DashboardShell); the sheet is mobile-only.
  if (isDesktop || !showSettingsSheet) return null;

  return (
    <BottomSheet open={showSettingsSheet} onClose={close} size="full" testId="settings-sheet">
      <SheetStackProvider rootKey="settings-root" rootNode={<SettingsRoot />} rootTitle="Einstellungen">
        {(current, depth) => (
          <SettingsSheetInner current={current} depth={depth} onClose={close} />
        )}
      </SheetStackProvider>
    </BottomSheet>
  );
}
