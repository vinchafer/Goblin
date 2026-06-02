import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { getAuthUrl, exchangeCodeForToken, getUsername } from '../services/github-oauth';
import { createRepo, pushFiles, disconnectGitHub, saveGitHubConnection, getDecryptedAccessToken } from '../services/github-service';
import { listFiles, getFile } from '../services/file-storage';
import { getSupabaseAdmin } from '../lib/supabase';
import { sendToUser } from '../services/notification-service';
import logger from '../lib/logger';

type Variables = { userId: string }
const github = new Hono<{ Variables: Variables }>();

// Protected routes
github.use('/connect', authMiddleware);
github.use('/status', authMiddleware);
github.use('/project-status', authMiddleware);
github.use('/push', authMiddleware);
github.use('/disconnect', authMiddleware);

github.get('/status', async (c) => {
  const userId = c.get('userId');
  const accessToken = await getDecryptedAccessToken(userId);
  if (!accessToken) {
    return c.json({ connected: false });
  }
  try {
    const username = await getUsername(accessToken);
    return c.json({ connected: true, username });
  } catch {
    return c.json({ connected: false });
  }
});

// Validate a relative same-origin redirect target. Rejects:
//  - absolute URLs (http://, https://, javascript:, data:, etc.)
//  - protocol-relative paths (//evil.com)
//  - anything not starting with a single '/'
//  - backslash injection
function isSafeReturnPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > 200) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.startsWith('/\\')) return false;
  if (/[\r\n\t]/.test(value)) return false;
  // No colon before the first slash (catches `javascript:`, `data:`, etc.)
  // Already enforced by the startsWith('/') guard, but defence in depth.
  if (/^\/?[a-z][a-z0-9+.-]*:/i.test(value.slice(1))) return false;
  return true;
}

github.post('/connect', async (c) => {
  const userId = c.get('userId');
  const state = randomUUID();

  // Optional returnTo — where to land after OAuth completes.
  let returnTo: string | null = null;
  try {
    const body = await c.req.json().catch(() => null) as { returnTo?: unknown } | null;
    if (body && isSafeReturnPath(body.returnTo)) {
      returnTo = body.returnTo as string;
    }
  } catch {
    /* no body / invalid JSON — ignore, fall back to /dashboard */
  }

  const supabase = getSupabaseAdmin();

  const insertRow: Record<string, unknown> = { state, user_id: userId };
  if (returnTo) insertRow.return_to = returnTo;

  await supabase
    .from('oauth_states')
    .insert(insertRow);

  const authUrl = getAuthUrl(state);
  return c.json({ url: authUrl, state });
});

// Public callback route (GitHub redirects here - no auth middleware)
github.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=github_invalid_request`);
  }

  const supabase = getSupabaseAdmin();

  // Validate state
  const { data: oauthState, error } = await supabase
    .from('oauth_states')
    .select('user_id, return_to')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !oauthState) {
    return c.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=github_oauth_expired`);
  }

  // Delete state after use (one-time only)
  await supabase
    .from('oauth_states')
    .delete()
    .eq('state', state);

  // Re-validate return_to at read time (defence in depth — never trust DB).
  const safeReturnTo = isSafeReturnPath(oauthState.return_to)
    ? (oauthState.return_to as string)
    : '/dashboard';

  try {
    const accessToken = await exchangeCodeForToken(code);
    const username = await getUsername(accessToken);

    await saveGitHubConnection(oauthState.user_id, accessToken, username);

    // Send notification for success toast
    await sendToUser(oauthState.user_id, {
      title: 'GitHub',
      body: '✅ GitHub connected successfully',
      url: safeReturnTo,
      tag: 'github-connected',
    }).catch((err: unknown) => logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'github_notification_failed'));

    const sep = safeReturnTo.includes('?') ? '&' : '?';
    return c.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${safeReturnTo}${sep}github=connected`);
  } catch {
    const sep = safeReturnTo.includes('?') ? '&' : '?';
    return c.redirect(`${process.env.NEXT_PUBLIC_APP_URL}${safeReturnTo}${sep}error=github_failed`);
  }
});

// GET /project-status?projectId= — git surface READ (Slice 4). Honest status:
// account connection + whether THIS project is linked to a repo. (The file store
// is a Backblaze snapshot, not a git working tree, so there is no per-file diff /
// ahead-behind to report — we report only what is true.)
github.get('/project-status', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.query('projectId');
  if (!projectId) return c.json({ error: 'projectId required' }, 400);

  const accessToken = await getDecryptedAccessToken(userId);
  let username: string | null = null;
  if (accessToken) {
    try { username = await getUsername(accessToken); } catch { username = null; }
  }

  const supabase = getSupabaseAdmin();
  const { data: project } = await supabase
    .from('projects')
    .select('github_repo, last_active')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle() as { data: { github_repo: string | null; last_active: string | null } | null };
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const repoUrl = project.github_repo;
  const repoSlug = repoUrl ? repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '') : null;

  return c.json({
    connected: !!accessToken,
    username,
    repo: repoSlug ? { url: repoUrl, slug: repoSlug } : null,
  });
});

github.post('/push', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  // `name` only needed for the FIRST push (repo creation); subsequent pushes go to
  // the linked repo. `message` is the commit message (the WRITE half of Slice 4).
  const schema = z.object({
    projectId: z.string().uuid(),
    name: z.string().regex(/^[a-zA-Z0-9-_]+$/).optional(),
    description: z.string().optional(),
    isPrivate: z.boolean().optional(),
    message: z.string().max(500).optional(),
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const supabase = getSupabaseAdmin();

  // Verify project ownership + read any existing repo link.
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, github_repo, name')
    .eq('id', result.data.projectId)
    .eq('user_id', userId)
    .single() as { data: { id: string; github_repo: string | null; name: string | null } | null; error: unknown };

  if (projectError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const accessToken = await getDecryptedAccessToken(userId);
  if (!accessToken) {
    return c.json({ error: 'GitHub not connected' }, 400);
  }

  try {
    // Collect all project files into a path→content map.
    const filePaths = await listFiles(result.data.projectId);
    const fileMap: Record<string, string> = {};
    await Promise.all(filePaths.map(async (fullPath) => {
      let path = fullPath.replace(`${result.data.projectId}/`, '');
      path = path.startsWith('/') ? path.slice(1) : path;
      fileMap[path] = (await getFile(result.data.projectId, fullPath)) || '';
    }));

    if (Object.keys(fileMap).length === 0) {
      return c.json({ error: 'Keine Dateien zum Pushen' }, 400);
    }

    let owner: string, repoName: string, repoUrl: string, htmlUrl: string;

    if (project.github_repo) {
      // Linked repo → commit + push to it (the recurring WRITE path).
      const slug = project.github_repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
      [owner, repoName] = slug.split('/') as [string, string];
      await pushFiles(accessToken, owner, repoName, fileMap, result.data.message);
      repoUrl = project.github_repo;
      htmlUrl = project.github_repo;
    } else {
      // First push → create the repo, then push. `name` required here.
      const name = result.data.name || (project.name ?? '').replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 80);
      if (!name) return c.json({ error: 'Repo-Name erforderlich' }, 400);
      const repo = await createRepo(accessToken, {
        name,
        description: result.data.description,
        private: result.data.isPrivate,
      });
      await pushFiles(accessToken, repo.owner.login, repo.name, fileMap, result.data.message);
      owner = repo.owner.login; repoName = repo.name;
      repoUrl = `https://github.com/${owner}/${repoName}`;
      htmlUrl = repo.html_url;
      await supabase
        .from('projects')
        .update({ github_repo: repoUrl })
        .eq('id', result.data.projectId)
        .eq('user_id', userId);
    }

    sendToUser(userId, {
      title: `⬆ Pushed to GitHub`,
      body: `${repoName} → ${repoUrl}`,
      url: `/dashboard/project/${result.data.projectId}`,
      tag: 'build_complete',
      actionUrls: { open_preview: repoUrl },
    }).catch((err: unknown) => console.error('[github] push notification failed:', err));

    return c.json({ success: true, url: htmlUrl, repo: `${owner}/${repoName}` });
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : 'Failed to push to GitHub'
    }, 500);
  }
});

github.delete('/disconnect', async (c) => {
  const userId = c.get('userId');
  await disconnectGitHub(userId);
  return c.json({ success: true });
});

export { github };