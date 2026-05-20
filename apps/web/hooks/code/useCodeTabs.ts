import { useCallback, useEffect, useState } from 'react';

export function useCodeTabs(activeFilePath: string | null) {
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  useEffect(() => {
    if (!activeFilePath) return;
    setOpenFiles(prev => prev.includes(activeFilePath) ? prev : [...prev, activeFilePath]);
  }, [activeFilePath]);

  const closeTab = useCallback((filePath: string) => {
    setOpenFiles(prev => prev.filter(f => f !== filePath));
  }, []);

  const closeAll = useCallback(() => setOpenFiles([]), []);

  return { openFiles, closeTab, closeAll };
}
