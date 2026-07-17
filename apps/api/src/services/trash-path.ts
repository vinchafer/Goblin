import { randomUUID } from 'node:crypto';

/**
 * Trash-path scheme for the soft-delete (`.trash/`) convention.
 *
 * WHY THIS EXISTS: the original soft-delete key was
 *   `.trash/<ts>_<originalPath with every "/" replaced by "_">`
 * which is LOSSY — a real underscore in a name is indistinguishable from a path
 * separator, so the original path can never be reconstructed. That was fine when
 * `.trash/` was write-only (no restore existed). Wave C adds a Papierkorb with
 * restore, so we need a REVERSIBLE scheme:
 *   `.trash/<ts>-<rand>/<originalPath verbatim>`
 * The original path is preserved as real sub-segments under a unique trash-id
 * folder, so restore is exact. All existing `.trash/` prefix filters (B6 agent
 * exclusion, zip export, UI hide) keep working unchanged — the prefix is identical.
 *
 * Legacy `.trash/<ts>_<flat>` entries (created before this change) remain listable,
 * downloadable and purgeable; they are flagged `legacy` and are not auto-restorable
 * (the original path is genuinely unrecoverable — we degrade honestly rather than
 * guess a wrong path).
 */

export const TRASH_PREFIX = '.trash/';

/** Build a reversible trash key for a project-relative original path. */
export function makeTrashPath(originalPath: string): string {
  const clean = originalPath.replace(/^\/+/, '');
  return `${TRASH_PREFIX}${Date.now()}-${randomUUID().slice(0, 8)}/${clean}`;
}

export interface ParsedTrash {
  /** The `<ts>-<rand>` (new) or `<ts>_<flat>` (legacy) segment right after `.trash/`. */
  trashId: string;
  /** The recovered original path, or null for legacy (lossy) entries. */
  originalPath: string | null;
  /** Deletion time (ms) parsed from the leading timestamp, or null if unparseable. */
  deletedAt: number | null;
  /** True for the old lossy `.trash/<ts>_<flat>` scheme (not auto-restorable). */
  legacy: boolean;
}

/** Parse a `.trash/...` key back into its trash-id + recovered original path. */
export function parseTrashPath(trashPath: string): ParsedTrash | null {
  if (!trashPath.startsWith(TRASH_PREFIX)) return null;
  const rest = trashPath.slice(TRASH_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash === -1) {
    // Legacy flattened scheme: `<ts>_<flat>` — original path unrecoverable.
    const ts = rest.match(/^(\d+)_/);
    return { trashId: rest, originalPath: null, deletedAt: ts?.[1] ? parseInt(ts[1], 10) : null, legacy: true };
  }
  const trashId = rest.slice(0, slash);
  const originalPath = rest.slice(slash + 1);
  const ts = trashId.match(/^(\d+)/);
  return {
    trashId,
    originalPath: originalPath || null,
    deletedAt: ts?.[1] ? parseInt(ts[1], 10) : null,
    legacy: false,
  };
}
