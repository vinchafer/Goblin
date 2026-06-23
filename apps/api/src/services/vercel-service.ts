// DEPLOY-FIX [2026-04-29]:
// 1. Token cache never cleared on Vercel 401/403 → stale revoked tokens used indefinitely
// 2. content! null assertion → crash when a file fails to download from S3
// 3. >100 file truncation was silent → users received incomplete deploys without warning
// 4. getDeployStatus didn't check res.ok → returned UNKNOWN instead of proper error
import { listFiles, downloadFile } from './file-storage';
import { guardVercelCall } from '../lib/vercel-guard';
import { getActiveKeyByProvider } from './byok-service';

const _vercelTokenCache = new Map<string, string>();

function clearTokenCache(userId: string): void {
  _vercelTokenCache.delete(userId);
}

async function getUserVercelToken(userId: string): Promise<string | null> {
  if (_vercelTokenCache.has(userId)) return _vercelTokenCache.get(userId)!;
  // Decrypt via the canonical v1/v2 path (was previously decryptData(), which never matched
  // how byok-service stores keys → tokens were undecryptable. Fixed Sprint 2 B1).
  const token = await getActiveKeyByProvider(userId, 'vercel');
  if (!token) return null;
  _vercelTokenCache.set(userId, token);
  return token;
}

// Sprint 10.9-6 — zero-config public publish. On Hobby the production alias is
// already public; this closes the Pro/team gap by disabling Vercel Deployment
// Protection (Vercel Authentication) on the project Goblin created, via the
// user's own token. Never fails the deploy: returns 'public' on success, 'manual'
// when the token lacks scope (the UI then shows the one-time instruction).
async function disableDeploymentProtection(
  token: string,
  projectName: string,
): Promise<'public' | 'manual'> {
  // Dev-safety shield: only ever touch the project we just created.
  guardVercelCall(projectName, 'disable-protection');

  const patch = async (teamId?: string): Promise<number> => {
    const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`;
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssoProtection: null }),
      });
      return res.status;
    } catch {
      return 0; // network — treat as failure → manual
    }
  };

  // §7f — attempt personal scope first; on 403/404 try each team scope.
  let status = await patch();
  if (status === 200) return 'public';

  if (status === 403 || status === 404) {
    try {
      const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (teamsRes.ok) {
        const body = (await teamsRes.json()) as { teams?: Array<{ id?: string }> };
        for (const t of body.teams ?? []) {
          if (!t.id) continue;
          status = await patch(t.id);
          if (status === 200) return 'public';
        }
      }
    } catch { /* fall through to manual */ }
  }

  console.warn('[vercel] could not disable SSO protection', JSON.stringify({ projectName, status }));
  return 'manual';
}

// The Vercel project name Goblin deploys under. A publish POSTs to
// /v13/deployments with this `name`, so Vercel auto-creates/reuses a project
// called <slug> whose public production alias is <slug>.vercel.app. Teardown
// targets this same slug. Single source of truth — deployToVercel uses it too.
export function vercelProjectName(projectName: string): string {
  return projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 52);
}

export type TeardownResult = {
  ok: boolean;          // true = site removed or already gone
  status: number;       // last Vercel HTTP status seen (0 = network/guard)
  alreadyGone: boolean; // Vercel returned 404 → nothing left to remove
  error?: string;       // human-readable reason when ok === false
};

// Best-effort removal of a project's LIVE Vercel resource (rule b). Deleting the
// Vercel *project* (not a single deployment) takes down ALL its deployments and
// the public <slug>.vercel.app alias — a single-deployment delete would leave the
// alias serving. NEVER throws: callers must always be able to proceed with the DB
// delete. 404 = SUCCESS (resource already gone). Token stays server-side (rule e).
export async function teardownVercelProject(
  userId: string,
  projectName: string,
): Promise<TeardownResult> {
  const slug = vercelProjectName(projectName);
  if (!slug) return { ok: true, status: 0, alreadyGone: true };

  const token = await getUserVercelToken(userId);
  // No token = user never connected Vercel = nothing was ever deployed by us.
  if (!token) return { ok: true, status: 0, alreadyGone: true };

  // Dev-safety shield is a no-op in prod; in dev it throws for non-test names.
  // Teardown must never block a delete, so swallow the guard throw → failure.
  try {
    guardVercelCall(slug, 'teardown');
  } catch (err) {
    return { ok: false, status: 0, alreadyGone: false, error: err instanceof Error ? err.message : 'guard blocked' };
  }

  const del = async (teamId?: string): Promise<number> => {
    const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(slug)}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`;
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status;
    } catch {
      return 0; // network — treat as failure
    }
  };

  // Personal scope first; on 403/404 try each team scope (mirrors deploy path).
  let status = await del();
  // 204/200 = deleted; 404 = already gone → both success.
  if (status === 204 || status === 200 || status === 404) {
    return { ok: true, status, alreadyGone: status === 404 };
  }

  if (status === 403 || status === 404) {
    try {
      const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (teamsRes.ok) {
        const body = (await teamsRes.json()) as { teams?: Array<{ id?: string }> };
        for (const t of body.teams ?? []) {
          if (!t.id) continue;
          status = await del(t.id);
          if (status === 204 || status === 200 || status === 404) {
            return { ok: true, status, alreadyGone: status === 404 };
          }
        }
      }
    } catch { /* fall through to failure */ }
  }

  if (status === 401 || status === 403) clearTokenCache(userId);
  return { ok: false, status, alreadyGone: false, error: `Vercel teardown failed (HTTP ${status})` };
}

export async function deployToVercel(
  userId: string,
  projectId: string,
  projectName: string,
  onProgress?: (msg: string) => void,
): Promise<{ deploymentId: string; url: string; deploymentUrl?: string; aliasUrl?: string; protection?: 'public' | 'manual' }> {
  const token = await getUserVercelToken(userId);
  if (!token) throw new Error('NO_VERCEL_TOKEN — Du brauchst einen eigenen Vercel-Account (gratis). Token unter vercel.com/account/tokens erstellen und in Einstellungen → Konnektoren → Vercel einfügen.');

  onProgress?.('Preparing files…');
  const files = await listFiles(projectId);

  if (files.length === 0) {
    throw new Error('Project has no files to deploy. Generate some code first.');
  }

  const filesToDeploy = files.slice(0, 100);
  if (files.length > 100) {
    onProgress?.(`⚠️ Project has ${files.length} files — deploying first 100 only (Vercel API limit)`);
  } else {
    onProgress?.(`Uploading ${filesToDeploy.length} files to Vercel…`);
  }

  const vercelFilesSettled = await Promise.allSettled(
    filesToDeploy.map(async (filePath) => {
      const content = await downloadFile(projectId, filePath);
      if (content === null) return null;
      return {
        file: filePath,
        data: Buffer.from(content).toString('base64'),
        encoding: 'base64' as const,
      };
    })
  );

  const vercelFiles = vercelFilesSettled
    .filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof downloadFile>> extends string ? { file: string; data: string; encoding: 'base64' } : null>> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value as { file: string; data: string; encoding: 'base64' });

  if (vercelFiles.length === 0) {
    throw new Error('Failed to read any project files from storage.');
  }

  onProgress?.('Creating deployment…');
  const deployName = vercelProjectName(projectName);
  // Dev-safety shield: refuse to create/touch any Vercel project except synapse-platform
  // or test-* throwaways while GOBLIN_DEV_MODE=true. No-op in prod.
  guardVercelCall(deployName, 'deploy');
  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: deployName,
      files: vercelFiles,
      projectSettings: { framework: null },
      target: 'production',
    }),
  });

  if (!res.ok) {
    // Clear cached token on auth failure so next attempt re-fetches from DB
    if (res.status === 401 || res.status === 403) {
      clearTokenCache(userId);
      throw new Error('Vercel token rejected (401/403). Please update your Vercel token in Settings → API Keys.');
    }
    if (res.status === 429) {
      throw new Error('Vercel API rate limit reached. Wait a few minutes and try again.');
    }
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`Vercel deploy failed: ${err.error?.message ?? res.statusText}`);
  }

  const data = await res.json() as { id: string; url: string; alias?: string[] };

  // 10.9-6 — make the project public (best-effort, never fails the deploy).
  onProgress?.('Veröffentlichung wird öffentlich geschaltet…');
  const protection = await disableDeploymentProtection(token, deployName);

  // 10.8-9 ROOT CAUSE of the recurring "Öffnen → SSO → 404": at POST time
  // `data.alias` is almost always EMPTY, so we fell back to `data.url` — the
  // deployment-unique HASH url (<project>-<hash>-<scope>.vercel.app). Vercel's
  // Deployment Protection gates exactly that hash/preview url behind SSO → the
  // login wall + 404 Vincent saw. The PRODUCTION ALIAS (<project>.vercel.app) is
  // public by default, but it's only assigned once the deployment is READY.
  // So: poll until the production alias appears, and return THAT.
  const deploymentUrl = `https://${data.url}`;
  let aliasUrl: string | undefined =
    pickProductionAlias(data.alias, deployName) ?? undefined;

  if (!aliasUrl) {
    onProgress?.('Warte auf öffentliche URL…');
    aliasUrl = await pollForProductionAlias(token, data.id, deployName, onProgress);
  }

  const best = aliasUrl ?? deploymentUrl;
  console.log('[vercel] deployment created', JSON.stringify({
    id: data.id, deploymentUrl, alias: data.alias ?? null, aliasUrl: aliasUrl ?? null, returned: best, protection,
  }));
  return { deploymentId: data.id, url: best, deploymentUrl, aliasUrl, protection };
}

// The production alias is the short, public `<project>.vercel.app` (and the
// team-scoped `<project>-<scope>.vercel.app`). Deployment hash urls contain a
// random segment and stay protected — never pick those. Prefer an exact
// `<deployName>.vercel.app`, else the shortest *.vercel.app alias.
function pickProductionAlias(aliases: string[] | undefined, deployName: string): string | undefined {
  if (!Array.isArray(aliases) || aliases.length === 0) return undefined;
  const vercelAliases = aliases.filter((a) => a.endsWith('.vercel.app'));
  if (vercelAliases.length === 0) {
    // Custom domain attached — that's the most public of all.
    return aliases[0] ? `https://${aliases[0]}` : undefined;
  }
  const exact = vercelAliases.find((a) => a === `${deployName}.vercel.app`);
  const chosen = exact ?? [...vercelAliases].sort((a, b) => a.length - b.length)[0]!;
  return `https://${chosen}`;
}

async function pollForProductionAlias(
  token: string,
  deploymentId: string,
  deployName: string,
  onProgress?: (msg: string) => void,
): Promise<string | undefined> {
  const MAX_ATTEMPTS = 12; // ~24s at 2s intervals
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;
      const d = await res.json() as { readyState?: string; status?: string; alias?: string[] };
      const alias = pickProductionAlias(d.alias, deployName);
      const state = d.readyState ?? d.status;
      if (alias) return alias;
      if (state === 'READY') {
        // Ready but no alias yet — give it one more cycle, then give up.
        if (i >= MAX_ATTEMPTS - 2) return undefined;
      }
      if (state === 'ERROR' || state === 'CANCELED') return undefined;
      onProgress?.(`Build läuft… (${state ?? 'queued'})`);
    } catch { /* transient — keep polling */ }
  }
  return undefined;
}

export async function getDeployStatus(
  userId: string,
  deploymentId: string,
): Promise<{ state: string; url?: string }> {
  const token = await getUserVercelToken(userId);
  if (!token) throw new Error('No Vercel token');

  const res = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) clearTokenCache(userId);
    throw new Error(`Failed to get deployment status: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { readyState?: string; status?: string; url?: string; alias?: string[] };
  // Prefer the production alias once it's assigned (see createDeployment note).
  const canonical = (Array.isArray(data.alias) && data.alias.length > 0) ? data.alias[0]! : data.url;
  console.log('[vercel] deployment status', JSON.stringify({ id: deploymentId, state: data.readyState ?? data.status, url: data.url, alias: data.alias ?? null, canonical }));
  return {
    state: data.readyState ?? data.status ?? 'UNKNOWN',
    url: canonical ? `https://${canonical}` : undefined,
  };
}
