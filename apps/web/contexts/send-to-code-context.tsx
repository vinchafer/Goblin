'use client';

import { createContext, useContext } from 'react';

/**
 * Lets a chat file-card (deeply nested via the markdown renderer) request a
 * single-file "Ins Projekt übernehmen" without prop-drilling. StandaloneChat
 * provides the handler; it opens the same StcPreviewSheet (P0.3 integrity + U2
 * classification) the multi-file "Alle übernehmen" flow uses. Null when there is
 * no chat host (e.g. static previews) → the card hides the affordance.
 */
export interface CardStcFile {
  path: string;
  content: string;
}

export type CardStcHandler = (file: CardStcFile) => void;

export const SendToCodeContext = createContext<CardStcHandler | null>(null);

export function useCardSendToCode(): CardStcHandler | null {
  return useContext(SendToCodeContext);
}
