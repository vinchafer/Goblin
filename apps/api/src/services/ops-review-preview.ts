/**
 * AKT 2 · PHASE 3 · U3.3 — the SAFE preview of a held candidate.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THE THREAT THIS FILE EXISTS FOR.
 *
 * An operator is about to look at content that the platform has NOT cleared —
 * that is the entire premise of a review queue. The naive surface (an iframe, or
 * `dangerouslySetInnerHTML`, or even a rendered screenshot service) would execute
 * or embed a hostile page inside the one browser session that holds founder
 * privileges. A review tool that can be attacked by the thing under review is
 * worse than no review tool.
 *
 * So the preview is TEXT. This module returns plain strings; the console renders
 * them inside a <pre>, where React escapes by default. Nothing is parsed as HTML,
 * nothing is fetched, nothing runs. The operator reads the source, exactly as they
 * would read it in an editor.
 *
 * ── What is deliberately NOT here ────────────────────────────────────────────
 * • No rendering, no screenshot, no sandboxed iframe. A sandboxed iframe is a
 *   defensible design and it is not this one: it depends on the sandbox attribute
 *   being right forever, and "forever" includes every future edit to the console.
 *   Text has no such dependency.
 * • No link rewriting or "safe HTML" sanitisation. A sanitiser is a parser, a
 *   parser has bugs, and the whole point is not to have one in this path.
 * ════════════════════════════════════════════════════════════════════════════════
 */

import { getFileBytes, listFiles } from './file-storage';

/** One file, as the operator reads it. */
export interface PreviewFile {
  path: string;
  /** Inert source text. Never rendered as markup. */
  text: string;
  bytes: number;
  /** True when the text was cut at the per-file limit — the operator is told. */
  truncated: boolean;
}

export interface CandidatePreview {
  files: PreviewFile[];
  /** Files in the artifact that are not text and were listed by name only. */
  binaryFiles: string[];
  /** Files beyond `MAX_PREVIEW_FILES`, named so nothing looks complete when it is not. */
  omittedFiles: string[];
  totalFiles: number;
  /** The project could not be read — deleted, or storage refused. Not "it is empty". */
  available: boolean;
}

/** A held candidate is small by construction (it fit the classifier budget), but bound anyway. */
export const MAX_PREVIEW_FILES = 12;
export const MAX_PREVIEW_CHARS_PER_FILE = 20_000;

const TEXT_EXT = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
  '.json', '.md', '.txt', '.xml', '.svg', '.csv', '.webmanifest',
]);

function ext(path: string): string {
  const i = path.lastIndexOf('.');
  return i >= 0 ? path.slice(i).toLowerCase() : '';
}

export interface PreviewDeps {
  listFiles: (projectId: string) => Promise<string[]>;
  getFileBytes: (projectId: string, path: string) => Promise<{ bytes: Buffer } | null>;
}

export const defaultPreviewDeps: PreviewDeps = { listFiles, getFileBytes };

/**
 * Read a candidate's files as inert text.
 *
 * Read fresh from the project's own storage, never from a stored copy — so an
 * approval acts on what is actually there rather than on the bytes that happened
 * to be scanned. The cost of that choice: if the builder replaced the artifact
 * between the hold and the review, the operator is looking at the new one. That is
 * the correct direction (approving the current thing), and it is why the approve
 * action re-runs stage 1 rather than trusting the queue row.
 */
export async function loadCandidatePreview(
  projectId: string | null,
  deps: PreviewDeps = defaultPreviewDeps,
): Promise<CandidatePreview> {
  const empty: CandidatePreview = { files: [], binaryFiles: [], omittedFiles: [], totalFiles: 0, available: false };
  if (!projectId) return empty;

  let paths: string[];
  try {
    paths = await deps.listFiles(projectId);
  } catch {
    return empty;
  }

  // index.html first: it is what a visitor would see, so it is what an operator
  // should read first.
  const ordered = [...paths].sort((a, b) => {
    const rank = (p: string) => (p === 'index.html' ? 0 : p.endsWith('.html') ? 1 : 2);
    return rank(a) - rank(b) || a.localeCompare(b);
  });

  const textPaths = ordered.filter((p) => TEXT_EXT.has(ext(p)));
  const binaryFiles = ordered.filter((p) => !TEXT_EXT.has(ext(p)));
  const shown = textPaths.slice(0, MAX_PREVIEW_FILES);
  const omittedFiles = textPaths.slice(MAX_PREVIEW_FILES);

  const files: PreviewFile[] = [];
  for (const path of shown) {
    const got = await deps.getFileBytes(projectId, path).catch(() => null);
    if (!got) continue;
    const full = got.bytes.toString('utf8');
    files.push({
      path,
      text: full.slice(0, MAX_PREVIEW_CHARS_PER_FILE),
      bytes: got.bytes.length,
      truncated: full.length > MAX_PREVIEW_CHARS_PER_FILE,
    });
  }

  return { files, binaryFiles, omittedFiles, totalFiles: ordered.length, available: true };
}
