// U2 (feel-sprint-2): fetch the current contents of a project's files so the
// client can compare incoming (chat/STC) files against what already exists.
// Uses the existing per-file API — only the requested paths are fetched, in
// parallel, best-effort.
//
// P1.7 (M2 badge hardening): the per-file content route is behind an /api/* rate
// limiter. On a project with many files, bursting every content fetch at once can
// exceed the window and return HTTP 429. Previously a 429 silently yielded no
// entry → the file had "no base" → the M2 file card was mislabeled NEU forever
// (a saved, unchanged file wrongly shown as new).
//
// Fix (Option A — bounded retry + throttle + honest "unknown"): we chose retry
// over a batched contents endpoint because NO batched endpoint exists on the API
// (only per-file GET /:id/files/*, plus metadata-only files-tree), and building a
// new API route is out of scope this sprint. So we (1) throttle to a small
// concurrency pool so >N-file projects don't burst past the limit, (2) retry a
// 429 up to a bounded budget with exponential backoff + jitter, honoring
// Retry-After, and — critically — (3) distinguish a *known-absent* base (genuinely
// a new file) from an *unknown* base (fetch still failed after retries). The
// caller uses `unknownPaths` so the UI never renders a confident NEU on an unknown
// base.

async function authHeader(): Promise<Record<string, string> | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const { data: { session } } = await createClient().auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : null;
  } catch {
    return null;
  }
}

/** Existing file paths of a project (empty on any failure). */
export async function fetchProjectFileList(projectId: string): Promise<string[]> {
  const headers = await authHeader();
  if (!headers) return [];
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  try {
    const res = await fetch(`${apiBase}/api/projects/${projectId}/files`, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as { files?: string[] };
    return Array.isArray(data.files) ? data.files : [];
  } catch {
    return [];
  }
}

// Text formats the chat compares against (mirror of the API-side allowlist).
const TEXT_EXT = /\.(html?|css|js|mjs|cjs|ts|tsx|jsx|json|md|txt|svg|xml|ya?ml|toml|csv|vue|svelte|py)$/i;

/**
 * Base map load result: resolved file contents keyed by path, plus the set of
 * paths whose base could NOT be resolved (429 past the retry budget or a network
 * failure). A path in `unknownPaths` must NOT be treated as a genuinely-new file.
 */
export interface TextFilesResult {
  files: Record<string, string>;
  unknownPaths: Set<string>;
}

// Retry/throttle knobs. Concurrency is intentionally small so a many-file project
// does not fire all content fetches at once and trip the rate limiter.
const MAX_RETRIES = 3;
const CONCURRENCY = 4;
const BACKOFF_BASE_MS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Exponential backoff with full jitter (attempt is 0-based).
function backoffMs(attempt: number): number {
  const base = BACKOFF_BASE_MS * 2 ** attempt;
  return base + Math.floor(Math.random() * BACKOFF_BASE_MS);
}

type FetchOutcome =
  | { kind: 'content'; content: string }
  | { kind: 'absent' } // resolved, but no such content (definite non-429 miss)
  | { kind: 'unknown' }; // could not resolve — 429 past budget or network error

async function fetchFileContent(
  url: string,
  headers: Record<string, string>,
): Promise<FetchOutcome> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers });
    } catch {
      // Network error — retry within budget, else report unknown (not absent).
      if (attempt >= MAX_RETRIES) return { kind: 'unknown' };
      await sleep(backoffMs(attempt));
      continue;
    }
    if (res.ok) {
      try {
        const data = (await res.json()) as { content?: string };
        return typeof data.content === 'string'
          ? { kind: 'content', content: data.content }
          : { kind: 'absent' };
      } catch {
        return { kind: 'absent' };
      }
    }
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000 + Math.floor(Math.random() * BACKOFF_BASE_MS)
          : backoffMs(attempt);
      await sleep(wait);
      continue;
    }
    // 429 past budget → unknown (do NOT let this become a permanent NEU).
    // Any other non-OK (404/etc.) → a definite miss → absent.
    return res.status === 429 ? { kind: 'unknown' } : { kind: 'absent' };
  }
}

// Run `worker` over `items` with at most `limit` in flight at once.
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      await worker(items[idx]!);
    }
  });
  await Promise.all(runners);
}

/**
 * Contents of the given paths that exist in the project, keyed by path, plus the
 * set of paths whose base could not be resolved (see {@link TextFilesResult}).
 * Paths that genuinely don't exist in the project are simply absent from both.
 */
export async function fetchExistingFilesWithStatus(
  projectId: string,
  paths: string[],
): Promise<TextFilesResult> {
  const out: TextFilesResult = { files: {}, unknownPaths: new Set() };
  if (paths.length === 0) return out;
  const headers = await authHeader();
  if (!headers) return out;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  const existing = new Set(await fetchProjectFileList(projectId));
  const wanted = [...new Set(paths)].filter((p) => existing.has(p));

  await runPool(wanted, CONCURRENCY, async (path) => {
    const url = `${apiBase}/api/projects/${projectId}/files/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const outcome = await fetchFileContent(url, headers);
    if (outcome.kind === 'content') out.files[path] = outcome.content;
    else if (outcome.kind === 'unknown') out.unknownPaths.add(path);
    // 'absent' → genuinely no base → correctly treated as new by the caller.
  });
  return out;
}

/**
 * Contents of the given paths that exist in the project, keyed by path.
 * Back-compat shape (map only). Paths that don't exist or fail to load are absent.
 */
export async function fetchExistingFiles(
  projectId: string,
  paths: string[],
): Promise<Record<string, string>> {
  return (await fetchExistingFilesWithStatus(projectId, paths)).files;
}

/**
 * Contents of the project's text files (capped), keyed by path, plus the set of
 * paths whose base could not be resolved. Feeds the M2 file-card badge base.
 */
export async function fetchAllTextFilesWithStatus(
  projectId: string,
  cap = 30,
): Promise<TextFilesResult> {
  // B6 (feel-sprint-2): exclude soft-deleted files (`.trash/`) — deleted content
  // must not appear as a GEÄNDERT/IDENTISCH candidate in the STC change summary.
  const paths = (await fetchProjectFileList(projectId))
    .filter((p) => TEXT_EXT.test(p) && !p.startsWith('.trash/'))
    .slice(0, cap);
  return fetchExistingFilesWithStatus(projectId, paths);
}

/**
 * Contents of the project's text files (capped), keyed by path — feeds the
 * chat's file-card change summaries. Back-compat shape (map only).
 */
export async function fetchAllTextFiles(projectId: string, cap = 30): Promise<Record<string, string>> {
  return (await fetchAllTextFilesWithStatus(projectId, cap)).files;
}
