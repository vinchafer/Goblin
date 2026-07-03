'use client';

// B4 (feel-sprint-2b): the persisted id of the chat message currently being
// rendered — lets deeply nested markdown components (CodeBlock) key their
// stored change line to the message. null/"streaming" = not yet persisted.

import { createContext, useContext } from 'react';

export const MessageIdContext = createContext<string | null>(null);

export function useMessageId(): string | null {
  return useContext(MessageIdContext);
}
