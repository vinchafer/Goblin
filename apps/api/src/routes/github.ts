import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { getAuthUrl, exchangeCodeForToken, getUsername } from '../services/github-oauth';
import { createRepo, pushFiles, disconnectGitHub, saveGitHubConnection, getDecryptedAccessToken } from '../services/github-service';
import { listFiles, getFile } from '../services/file-storage';

const github = new Hono();

github.use('*', authMiddleware);

github.post('/connect', async (c) => {
  const state = crypto.randomUUID();
  const authUrl = getAuthUrl(state);
  return c.json({ url: authUrl, state });
});

github.get('/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.json({ error: 'Code required' }, 400);
  }

  const accessToken = await exchangeCodeForToken(code);
  const username = await getUsername(accessToken);
  const userId = c.get('userId');

  await saveGitHubConnection(userId, accessToken, username);

  return c.json({ success: true, username });
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

  const accessToken = await getDecryptedAccessToken(userId);
  if (!accessToken) {
    return c.json({ error: 'GitHub not connected' }, 400);
  }

  // Create repo
  const repo = await createRepo(accessToken, {
    name: result.data.name,
    description: result.data.description,
    isPrivate: result.data.isPrivate
  });

  // Get all project files
  const filePaths = await listFiles(result.data.projectId);
  const files = await Promise.all(
    filePaths.map(async path => ({
      path,
      content: await getFile(result.data.projectId, path) || ''
    }))
  );

  // Push all files
  await pushFiles(accessToken, repo.owner, repo.repo, files);

  return c.json({ success: true, url: repo.url });
});

github.delete('/disconnect', async (c) => {
  const userId = c.get('userId');
  await disconnectGitHub(userId);
  return c.json({ success: true });
});

export { github };