'use client';

import { useApp } from '@/contexts/app-context';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SheetStackProvider } from '@/components/ui/SheetStack';
import { SettingsRoot } from './SettingsRoot';
import { SettingsSheetInner } from './SettingsSheetInner';

export function SettingsSheet() {
  const { showSettingsSheet, setShowSettingsSheet, setSettingsInitialItem } = useApp();

  const close = () => {
    setShowSettingsSheet(false);
    setSettingsInitialItem(null);
  };

  if (!showSettingsSheet) return null;

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
