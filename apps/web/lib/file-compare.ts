// U2 (feel-sprint-2): change manifest — classify incoming files against the
// project's existing files and compute compact line deltas / unified diffs.
// Used by the Send-to-Code preview sheet (GEÄNDERT/NEU/IDENTISCH badges, diff
// preview) and the chat file-card change summary ("ändert index.html · +12 −3").

import { diffLines, structuredPatch } from 'diff';

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

export interface DiffLine {
  kind: 'add' | 'del' | 'ctx' | 'hunk';
  text: string;
}

/** Compact unified diff as renderable lines (hunk headers + ±/context lines). */
export function unifiedDiffLines(path: string, oldStr: string, newStr: string): DiffLine[] {
  const patch = structuredPatch(path, path, normalize(oldStr) + '\n', normalize(newStr) + '\n', '', '', { context: 2 });
  const out: DiffLine[] = [];
  for (const hunk of patch.hunks) {
    out.push({
      kind: 'hunk',
      text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
    });
    for (const line of hunk.lines) {
      const kind = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'ctx';
      out.push({ kind, text: line.slice(1) });
    }
  }
  return out;
}
