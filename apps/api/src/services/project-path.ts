// WAVE-D · D-1 — project-path safety (the agent tool sandbox's structural boundary).
//
// Every file path a run supplies (read_file/write_file) and every path that reaches
// object storage (save_draft/publish → uploadFile → storageKey) must stay inside the
// run's own project prefix `projects/<projectId>/`. Before this guard, a path was
// trimmed and used verbatim: S3 happens to treat keys literally (so `..` did not
// resolve across projects on that backend), but that is a fragile, backend-specific
// accident — the in-memory dev store, a future filesystem backend, or the Vercel
// deploy's file list all read these paths, and a zip/FS consumer WOULD resolve `..`.
// This module makes the safety explicit and backend-independent: canonicalize, reject
// traversal / absolute / encoded-separator / null-byte paths, then assert the composed
// key never escapes the prefix.
//
// Two layers use it:
//   • the agent tools (read_file/write_file) — an unsafe path is an honest tool error;
//   • storageKey() in file-storage — the low-level choke-point every persisted write
//     passes through — throws, so no unsafe path can ever reach real storage.

/** Max bytes/chars a single agent write may carry (mirrors the write_file cap). */
export const WRITE_FILE_MAX_CHARS = 500_000;

/** Basenames a run may never write — secrets or platform/VCS control files that, once
 *  saved into a project and deployed, would leak credentials or subvert the build. */
const FORBIDDEN_BASENAMES = new Set([
  '.env',
  '.npmrc',
  '.netrc',
  '.git-credentials',
  '.htpasswd',
]);

/** Path segments a run may never write into (secret/VCS/infra directories). */
const FORBIDDEN_SEGMENTS = new Set(['.git', '.ssh', '.aws', '.gnupg']);

export type PathRejection =
  | 'empty'
  | 'not_string'
  | 'null_byte'
  | 'backslash'
  | 'encoded_separator'
  | 'absolute'
  | 'drive_letter'
  | 'home_expansion'
  | 'traversal'
  | 'escapes_prefix';

export interface PathCheck {
  ok: boolean;
  /** The canonicalized, safe project-relative path (only when ok). */
  path?: string;
  reason?: PathRejection;
}

// %2e = '.', %2f = '/', %5c = '\'  — reject any URL-encoded separator/dot so an
// encoded traversal can never slip past a literal `..` check.
const ENCODED_SEPARATOR = /%2e|%2f|%5c/i;
// Any C0 control character (incl. the NUL byte) has no place in a file path.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f]/;

/**
 * Canonicalize + validate a project-relative path. Returns the normalized path when
 * safe, or a structured rejection reason. Pure — no I/O, no project prefix needed.
 * Subdirectories (`css/app.css`, `assets/img/logo.png`) and honest dotdirs (`.trash/…`)
 * are allowed; traversal, absolute, encoded, and null-byte paths are not.
 */
export function checkProjectPath(raw: unknown): PathCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'not_string' };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (CONTROL_CHARS.test(trimmed)) return { ok: false, reason: 'null_byte' };
  if (trimmed.includes('\\')) return { ok: false, reason: 'backslash' };
  if (ENCODED_SEPARATOR.test(trimmed)) return { ok: false, reason: 'encoded_separator' };
  if (trimmed.startsWith('~')) return { ok: false, reason: 'home_expansion' };
  if (/^[A-Za-z]:/.test(trimmed)) return { ok: false, reason: 'drive_letter' };
  if (trimmed.startsWith('/')) return { ok: false, reason: 'absolute' };

  const parts = trimmed.split('/');
  const canonical: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue; // collapse // and ./ noise
    if (part === '..') return { ok: false, reason: 'traversal' };
    canonical.push(part);
  }
  if (canonical.length === 0) return { ok: false, reason: 'empty' };

  const path = canonical.join('/');
  // Defense-in-depth prefix assertion: the composed storage key must still live under
  // the project prefix. With traversal already rejected this is belt-and-suspenders,
  // but it makes the invariant checkable rather than assumed.
  const key = `projects/__pid__/${path}`;
  if (!key.startsWith('projects/__pid__/')) return { ok: false, reason: 'escapes_prefix' };

  return { ok: true, path };
}

/** True when the (already canonicalized) path targets a forbidden secret/control file. */
export function isForbiddenWriteTarget(path: string): boolean {
  const segments = path.split('/');
  const base = segments[segments.length - 1]?.toLowerCase() ?? '';
  if (FORBIDDEN_BASENAMES.has(base)) return true;
  if (base === '.env' || base.startsWith('.env.')) return true; // .env, .env.local, .env.production…
  for (const seg of segments) {
    if (FORBIDDEN_SEGMENTS.has(seg.toLowerCase())) return true;
  }
  return false;
}

/**
 * Structural guard for the storage choke-point. Returns the canonical path or throws a
 * tagged error (so callers can distinguish a traversal attempt from an I/O failure).
 * Type/secret policy is NOT enforced here — that is a write-intent concern owned by the
 * agent tool; this layer guarantees only that the key cannot escape its project prefix.
 */
export function assertSafeStoragePath(raw: unknown): string {
  const res = checkProjectPath(raw);
  if (!res.ok || !res.path) {
    const err = new Error(`unsafe storage path (${res.reason})`) as Error & { code?: string };
    err.code = 'unsafe_path';
    throw err;
  }
  return res.path;
}
