'use client';
import type { ReactNode } from 'react';
import { AdvancedModeContext, useAdvancedModeState } from '@/hooks/use-advanced-mode';

export function AdvancedModeProvider({ children }: { children: ReactNode }) {
  const value = useAdvancedModeState();
  return (
    <AdvancedModeContext.Provider value={value}>
      {children}
    </AdvancedModeContext.Provider>
  );
}
