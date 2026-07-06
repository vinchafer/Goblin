// U2 (feel-sprint-2): change manifest — classify incoming files against the
// project's existing files and compute compact line deltas / unified diffs.
// Used by the Send-to-Code preview sheet (GEÄNDERT/NEU/IDENTISCH badges, diff
// preview) and the chat file-card change summary ("ändert index.html · +12 −3").

import { structuredPatch } from 'diff';

// U2 classification (classifyFile / lineDelta) is now the single source in
// @goblin/shared so the API's FEEL-3a agent write_file tool returns the SAME
// GEÄNDERT/NEU/IDENTISCH + line delta. Re-exported here so existing web imports
// (StcPreviewSheet, FileCardList, CodeBlock, DiffSheet) are untouched.
export { classifyFile, lineDelta, type FileStatus, type LineDelta } from '@goblin/shared';

// Line endings and a missing trailing newline are presentation noise, not a
// content change — LLM output routinely drops the final newline. (Local to the
// render-only unified diff below; the shared module normalizes independently.)
function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
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
