// Row 1 — mechanical hunk split + honest labels + subset reconstruction.
//
// Pure helpers around the `diff` package. NO model call, NO new store, NO agent
// path. They turn the existing unified diff (from POST /api/projects/:id/diff,
// built with createTwoFilesPatch) into reviewable hunks and reconstruct the file
// from the base + an accepted subset of hunks. Used by the in-place review card
// (diff-modal.tsx). Variant (a): labels are honest/generic, never invented.

import { parsePatch, applyPatch } from 'diff';

export type HunkLineType = 'add' | 'del' | 'ctx';
export interface HunkLine { type: HunkLineType; content: string; }
export interface Hunk {
  index: number;
  label: string;   // semantic when certain, else "Änderung N" / "Change N"
  loc: string;     // always shown — "Z. 4–6" / "ln 4–6"
  lines: HunkLine[];
  addCount: number;
  delCount: number;
}

function labelHunk(lines: HunkLine[], i: number, lang: 'de' | 'en'): string {
  const generic = lang === 'en' ? `Change ${i + 1}` : `Änderung ${i + 1}`;
  const changed = lines.find(l => l.type !== 'ctx');
  if (!changed) return generic;
  const txt = changed.content;
  // Only label from patterns that cannot mislabel:
  // 1) CSS custom property  --foo: …   → "--foo"
  const cssVar = txt.match(/(--[A-Za-z0-9-]+)\s*:/);
  if (cssVar?.[1]) return cssVar[1];
  // 2) a selector / block opener that ends in "{"  → that selector
  const block = txt.match(/^\s*([.#]?[A-Za-z][\w-]*)\s*\{\s*$/);
  if (block?.[1]) return block[1];
  return generic;
}

/** Split a unified diff into hunks. Mechanical, deterministic. [] on parse fail. */
export function splitHunks(diff: string, lang: 'de' | 'en' = 'de'): Hunk[] {
  let patches;
  try { patches = parsePatch(diff); } catch { return []; }
  const p = patches[0];
  if (!p || !p.hunks) return [];
  return p.hunks.map((h, i) => {
    const lines: HunkLine[] = h.lines
      .map((l): HunkLine => {
        const c = l[0];
        if (c === '+') return { type: 'add', content: l.slice(1) };
        if (c === '-') return { type: 'del', content: l.slice(1) };
        return { type: 'ctx', content: l.startsWith(' ') ? l.slice(1) : l };
      })
      // drop the "\ No newline at end of file" marker
      .filter(l => !(l.type === 'ctx' && l.content.startsWith('\\ No newline')));
    const addCount = lines.filter(l => l.type === 'add').length;
    const delCount = lines.filter(l => l.type === 'del').length;
    const start = h.newStart;
    const end = h.newStart + Math.max(0, h.newLines - 1);
    const loc = lang === 'en' ? `ln ${start}–${end}` : `Z. ${start}–${end}`;
    return { index: i, label: labelHunk(lines, i, lang), loc, lines, addCount, delCount };
  });
}

/**
 * Reconstruct the file content from `currentContent` + the accepted hunks only.
 * Returns the new content, or `null` if the subset can't apply cleanly (caller
 * must fail safe — keep the file, surface a message, never write corrupt data).
 */
export function reconstructWithHunks(
  currentContent: string,
  diff: string,
  acceptedIdx: number[],
): string | null {
  if (acceptedIdx.length === 0) return currentContent; // nothing accepted = unchanged
  let patches;
  try { patches = parsePatch(diff); } catch { return null; }
  const p = patches[0];
  if (!p || !p.hunks) return null;
  const hunks = acceptedIdx
    .slice().sort((a, b) => a - b)
    .map(i => p.hunks[i])
    .filter((h): h is NonNullable<typeof h> => h != null);
  if (hunks.length === 0) return null;
  try {
    const result = applyPatch(currentContent, { ...p, hunks });
    return result === false ? null : result;
  } catch {
    return null;
  }
}
