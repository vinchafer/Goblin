'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface StackEntry {
  key: string;
  node: React.ReactNode;
  title?: string;
}

interface SheetStackContextType {
  push: (key: string, node: React.ReactNode, title?: string) => void;
  pop: () => void;
  current: StackEntry;
  depth: number;
}

const SheetStackContext = createContext<SheetStackContextType | null>(null);

export function SheetStackProvider({
  rootKey,
  rootNode,
  rootTitle,
  children,
}: {
  rootKey: string;
  rootNode: React.ReactNode;
  rootTitle?: string;
  children?: (current: StackEntry, depth: number) => React.ReactNode;
}) {
  const [stack, setStack] = useState<StackEntry[]>([
    { key: rootKey, node: rootNode, title: rootTitle },
  ]);

  const push = useCallback((key: string, node: React.ReactNode, title?: string) => {
    setStack(s => [...s, { key, node, title }]);
  }, []);

  const pop = useCallback(() => {
    setStack(s => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const current = stack[stack.length - 1] ?? { key: rootKey, node: rootNode, title: rootTitle };

  return (
    <SheetStackContext.Provider value={{ push, pop, current, depth: stack.length }}>
      {children ? children(current, stack.length) : current.node}
    </SheetStackContext.Provider>
  );
}

export function useSheetStack() {
  const ctx = useContext(SheetStackContext);
  if (!ctx) throw new Error('useSheetStack must be used inside SheetStackProvider');
  return ctx;
}
