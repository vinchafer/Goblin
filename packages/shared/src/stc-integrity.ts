// P0.3 (feel-sprint-1): Send-to-Code filename integrity. The walk (W10) shipped
// a page referencing styles.css + settings.js while the payload contained
// script.js + script-1.js — deployed, both 404. This check runs BEFORE transfer:
// every file the entry HTML references must exist in the transferred set, and
// unreferenced non-HTML files are flagged as orphans. When a missing reference
// has exactly one orphan with the same extension, an auto-rename is proposed.

import { extractLocalRefs } from './html-refs';

export interface StcFileLike {
  path: string;
  content: string;
}

export interface StcIntegrity {
  ok: boolean;
  /** Entry HTML path the check ran against (null = no HTML entry → ok). */
  entryPath: string | null;
  /** Paths the entry HTML references that are NOT in the transferred set. */
  missing: string[];
  /** Non-entry, non-HTML files the entry HTML does NOT reference. */
  orphans: string[];
  /** Unambiguous fix proposal: orphan path → referenced (missing) path. */
  renameMap: Record<string, string>;
}

function ext(p: string): string {
  const i = p.lastIndexOf('.');
  return i >= 0 ? p.slice(i + 1).toLowerCase() : '';
}

export function checkStcIntegrity(files: StcFileLike[]): StcIntegrity {
  const paths = new Set(files.map((f) => f.path));
  const entry =
    files.find((f) => f.path === 'index.html') ??
    files.find((f) => f.path.endsWith('.html'));

  if (!entry) {
    return { ok: true, entryPath: null, missing: [], orphans: [], renameMap: {} };
  }

  const refs = extractLocalRefs(entry.content);
  const missing = refs.filter((r) => !paths.has(r));
  const referenced = new Set(refs);
  const orphans = files
    .filter((f) => f.path !== entry.path && !f.path.endsWith('.html') && !referenced.has(f.path))
    .map((f) => f.path);

  // 1:1 by extension = unambiguous rename proposal.
  const renameMap: Record<string, string> = {};
  for (const m of missing) {
    const wanted = ext(m);
    const candidates = orphans.filter((o) => ext(o) === wanted && !Object.keys(renameMap).includes(o));
    if (candidates.length === 1) renameMap[candidates[0]!] = m;
  }

  return {
    ok: missing.length === 0,
    entryPath: entry.path,
    missing,
    orphans,
    renameMap,
  };
}

/** Apply a rename map to a file set (paths only; contents untouched). */
export function applyRenames(files: StcFileLike[], renameMap: Record<string, string>): StcFileLike[] {
  return files.map((f) => (renameMap[f.path] ? { ...f, path: renameMap[f.path]! } : f));
}
