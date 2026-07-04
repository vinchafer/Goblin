'use client';

// U2 (feel-sprint-2): the current contents of the bound project's files,
// provided by the project chat so file-cards can render a change summary
// ("ändert index.html · +12 −3") when a reply modifies an existing file.
// null = no project bound / not loaded (cards render without a change line).

import { createContext, useContext } from 'react';

export const ExistingFilesContext = createContext<Record<string, string> | null>(null);

export function useExistingFiles(): Record<string, string> | null {
  return useContext(ExistingFilesContext);
}
