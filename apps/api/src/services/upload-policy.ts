// FW5-U3 (D-D) — explorer file-upload policy.
//
// The workspace Explorer lets a user upload "Unterlagen" into a project. The upload is
// routed through the EXISTING hardened storage chain (storageKey prefix-jail → guardedPut
// plan cap) and the EXISTING D-2 daily-bytes cap; this module adds the one missing guard
// the chat-attachment path already had and the explorer route did not: a type whitelist.
//
// Extension-driven (not MIME) on purpose: the OS reports no/unknown MIME for many text
// formats (the F-42 lesson — `text/*` greyed out `.md`/`.csv`/`.json`), so the reliable
// signal is the extension. The set mirrors the chat-attachment whitelist (text/code +
// images + pdf) and adds the common office/document types a "Unterlagen" upload implies.
// Anything else is refused with an honest, type-specific error — never silently stored.

/** Upload ceiling for a single explorer file (mirrors the existing route + PDF attach). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Text/code extensions — kept in sync with the chat-attachment whitelist
 * (`apps/web/lib/chat-attachments.ts` TEXT_EXTENSIONS) so upload and attach agree.
 */
const TEXT_CODE_EXT = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'yml', 'yaml',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'css', 'scss', 'sass', 'less', 'py', 'rb',
  'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'php', 'sh', 'bash', 'sql',
  'vue', 'svelte', 'toml', 'ini', 'env', 'log',
]);

/** Image extensions (the explorer previews these). */
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif', 'svg']);

/** Document / "Unterlagen" extensions — the founder's explicit intent for the explorer. */
const DOC_EXT = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf',
]);

/** The full upload allowlist (union). */
export const ALLOWED_UPLOAD_EXTENSIONS: ReadonlySet<string> = new Set<string>([
  ...TEXT_CODE_EXT, ...IMAGE_EXT, ...DOC_EXT,
]);

/** Lowercased extension of a filename, or '' when it has none. */
export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

export interface UploadTypeCheck {
  ok: boolean;
  ext: string;
  /** Present when ok === false. */
  reason?: 'no_extension' | 'type_not_allowed';
}

/**
 * Is this filename an allowed upload type? Pure — the caller enforces size + the storage
 * prefix-jail separately. A file with no extension is refused honestly (we can't classify
 * it, and an extensionless binary in a deployable project is exactly what the whitelist
 * exists to keep out).
 */
export function checkUploadType(filename: string): UploadTypeCheck {
  const ext = fileExtension(filename);
  if (!ext) return { ok: false, ext: '', reason: 'no_extension' };
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return { ok: false, ext, reason: 'type_not_allowed' };
  return { ok: true, ext };
}
