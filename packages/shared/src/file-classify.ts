// U2 (feel-sprint-2) classification — the single source, shared by web (Send-to-Code
// preview badges, chat change summary) and the API (FEEL-3a agent write_file tool,
// which must return the SAME GEÄNDERT/NEU/IDENTISCH + line delta so its reports are
// attestable). Moved here from apps/web/lib/file-compare.ts so the server can reuse
// the exact classification instead of building a parallel one; web re-exports these.

import { diffLines } from 'diff';

export type FileStatus = 'new' | 'changed' | 'identical';

export interface LineDelta {
  added: number;
  removed: number;
}

// Line endings and a missing trailing newline are presentation noise, not a
// content change — LLM output routinely drops the final newline.
function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

export function classifyFile(existing: string | null | undefined, incoming: string): FileStatus {
  if (existing == null) return 'new';
  return normalize(existing) === normalize(incoming) ? 'identical' : 'changed';
}

export function lineDelta(oldStr: string, newStr: string): LineDelta {
  let added = 0;
  let removed = 0;
  for (const part of diffLines(normalize(oldStr) + '\n', normalize(newStr) + '\n')) {
    if (part.added) added += part.count ?? 0;
    else if (part.removed) removed += part.count ?? 0;
  }
  return { added, removed };
}
