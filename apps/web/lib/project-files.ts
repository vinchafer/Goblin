// U2 (feel-sprint-2): fetch the current contents of a project's files so the
// client can compare incoming (chat/STC) files against what already exists.
// Uses the existing per-file API — only the requested paths are fetched, in
// parallel, best-effort (a failed fetch just means "unknown" → treated as new).

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
 * Contents of the project's text files (capped), keyed by path — feeds the
 * chat's file-card change summaries.
 */
export async function fetchAllTextFiles(projectId: string, cap = 30): Promise<Record<string, string>> {
  const paths = (await fetchProjectFileList(projectId)).filter((p) => TEXT_EXT.test(p)).slice(0, cap);
  return fetchExistingFiles(projectId, paths);
}

/**
 * Contents of the given paths that exist in the project, keyed by path.
 * Paths that don't exist (or fail to load) are simply absent from the map.
 */
export async function fetchExistingFiles(
  projectId: string,
  paths: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (paths.length === 0) return out;
  const headers = await authHeader();
  if (!headers) return out;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  const existing = new Set(await fetchProjectFileList(projectId));
  const wanted = [...new Set(paths)].filter((p) => existing.has(p));

  await Promise.all(
    wanted.map(async (path) => {
      try {
        const res = await fetch(
          `${apiBase}/api/projects/${projectId}/files/${path.split('/').map(encodeURIComponent).join('/')}`,
          { headers },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { content?: string };
        if (typeof data.content === 'string') out[path] = data.content;
      } catch {
        /* unknown → treated as new */
      }
    }),
  );
  return out;
}
