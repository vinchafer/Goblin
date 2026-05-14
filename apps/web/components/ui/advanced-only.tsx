'use client';
import type { ReactNode } from 'react';
import { useAdvancedMode } from '@/hooks/use-advanced-mode';

interface AdvancedOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AdvancedOnly({ children, fallback = null }: AdvancedOnlyProps) {
  const { isAdvancedMode, loading } = useAdvancedMode();
  if (loading || !isAdvancedMode) return <>{fallback}</>;
  return <>{children}</>;
}
