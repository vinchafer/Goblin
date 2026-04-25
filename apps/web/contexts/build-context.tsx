'use client';

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface BuildStatus {
  isBuilding: boolean;
  progress: number;
  currentAction: string;
}

interface BuildStatusContextType extends BuildStatus {
  setBuildStatus: (status: Partial<BuildStatus>) => void;
}

const BuildStatusContext = createContext<BuildStatusContextType>({
  isBuilding: false,
  progress: 0,
  currentAction: '',
  setBuildStatus: () => {}
});

export function BuildProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BuildStatus>({
    isBuilding: false,
    progress: 0,
    currentAction: ''
  });

  const setBuildStatus = (update: Partial<BuildStatus>) => {
    setStatus(prev => ({ ...prev, ...update }));
  };

  return (
    <BuildStatusContext.Provider value={{ ...status, setBuildStatus }}>
      {children}
    </BuildStatusContext.Provider>
  );
}

export function useBuildStatus() {
  return useContext(BuildStatusContext);
}