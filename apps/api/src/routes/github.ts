import { Hono } from 'hono';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { getAuthUrl, exchangeCodeForToken, getUsername } from '../services/github-oauth';
import { createRepo, pushFiles, disconnectGitHub, saveGitHubConnection, getDecryptedAccessToken } from '../services/github-service';
import { listFiles, getFile } from '../services/file-storage';
import { getSupabaseAdmin } from '../lib/supabase';
import { sendToUser } from '../services/notification-service';

type Variables = { userId: string }
const github = new Hono<{ Variables: Variables }>();

// Protected routes
github.use('/connect', authMiddleware);
github.use('/push', authMiddleware);
github.use('/disconnect', authMiddleware);

github.post('/connect', async (c) => {
  const userId = c.get('userId');
  const state = randomUUID();

  const supabase = getSupabaseAdmin();

  await supabase
    .from('oauth_states')
    .insert({ state, user_id: userId });

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
    .select('user_id')
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

  try {
    const accessToken = await exchangeCodeForToken(code);
    const username = await getUsername(accessToken);
    
    await saveGitHubConnection(oauthState.user_id, accessToken, username);
    
    // Send notification for success toast
    await sendToUser(oauthState.user_id, {
      title: 'GitHub',
      body: '✅ GitHub connected successfully',
      url: '/dashboard',
      tag: 'github-connected',
    }).catch((err: unknown) => console.error('[github] notification failed:', err));
    
    return c.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?github=connected`);
  } catch {
    return c.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=github_failed`);
  }
});

github.post('/push', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const schema = z.object({
    projectId: z.string().uuid(),
    name: z.string().regex(/^[a-zA-Z0-9-_]+$/),
    description: z.string().optional(),
    isPrivate: z.boolean().optional()
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const supabase = getSupabaseAdmin();

  // Verify project ownership
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', result.data.projectId)
    .eq('user_id', userId)
    .single();

  if (projectError || !project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const accessToken = await getDecryptedAccessToken(userId);
  if (!accessToken) {
    return c.json({ error: 'GitHub not connected' }, 400);
  }

  try {
    // Create repo
    const repo = await createRepo(accessToken, {
      name: result.data.name,
      description: result.data.description,
      private: result.data.isPrivate
    });

    // Get all project files
    const filePaths = await listFiles(result.data.projectId);
    const files = await Promise.all(
      filePaths.map(async fullPath => {
        // Remove project ID prefix and fix leading slash
        let path = fullPath.replace(`${result.data.projectId}/`, '');
        path = path.startsWith('/') ? path.slice(1) : path;
        return {
          path,
          content: await getFile(result.data.projectId, fullPath) || ''
        };
      })
    );

    // Push all files
    const fileMap: Record<string, string> = {};
    files.forEach(file => {
      fileMap[file.path] = file.content;
    });
    
    await pushFiles(accessToken, repo.owner.login, repo.name, fileMap);

    // Update project with GitHub repo URL
    const repoUrl = `https://github.com/${repo.owner.login}/${repo.name}`;
    await supabase
      .from('projects')
      .update({ github_repo: repoUrl })
      .eq('id', result.data.projectId)
      .eq('user_id', userId);

    sendToUser(userId, {
      title: `⬆ Pushed to GitHub`,
      body: `${result.data.name} → ${repoUrl}`,
      url: `/dashboard/project/${result.data.projectId}`,
      tag: 'build_complete',
      actionUrls: {
        open_preview: repoUrl,
      },
    }).catch((err: unknown) => console.error('[github] push notification failed:', err));

    return c.json({ success: true, url: repo.html_url });
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