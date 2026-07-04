// B4 (feel-sprint-2b): persist the chat file-card change line ("ändert
// index.html · +n −m") across reloads. The delta is computed live during
// streaming (CodeBlock) and saved here at completion, keyed by the persisted
// assistant message id; on reload the card renders from this store when the
// live computation no longer yields a delta (e.g. the file was since saved and
// is now identical). Device-local by design: chat_messages has no metadata
// column, and a server-side field would need a migration (flagged in the
// sprint report, not authored silently).

import type { LineDelta } from './file-compare';

const STORAGE_KEY = 'goblin:chat-change-notes';
const MAX_MESSAGES = 200;

interface Store {
  order: string[]; // message ids, oldest first
  entries: Record<string, Record<string, LineDelta>>; // msgId → filename → delta
}

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { order: [], entries: {} };
    const parsed = JSON.parse(raw) as Store;
    if (!Array.isArray(parsed.order) || typeof parsed.entries !== 'object') {
      return { order: [], entries: {} };
    }
    return parsed;
  } catch {
    return { order: [], entries: {} };
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage full / unavailable — the line simply won't survive reloads */
  }
}

export function saveChangeNote(messageId: string, filename: string, delta: LineDelta): void {
  if (typeof window === 'undefined' || !messageId || !filename) return;
  const store = read();
  const existing = store.entries[messageId]?.[filename];
  if (existing && existing.added === delta.added && existing.removed === delta.removed) return;
  if (!store.entries[messageId]) {
    store.entries[messageId] = {};
    store.order.push(messageId);
    while (store.order.length > MAX_MESSAGES) {
      const evicted = store.order.shift();
      if (evicted) delete store.entries[evicted];
    }
  }
  store.entries[messageId][filename] = { added: delta.added, removed: delta.removed };
  write(store);
}

export function loadChangeNote(messageId: string, filename: string): LineDelta | null {
  if (typeof window === 'undefined' || !messageId || !filename) return null;
  const delta = read().entries[messageId]?.[filename];
  return delta && typeof delta.added === 'number' && typeof delta.removed === 'number'
    ? delta
    : null;
}
