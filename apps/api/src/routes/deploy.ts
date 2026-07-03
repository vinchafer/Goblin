import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Context, Next } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { deployToVercel, getDeployStatus } from '../services/vercel-service';
import { verifyDeployment } from '../services/deploy-verification';
import { listFiles } from '../services/file-storage';

type Variables = { userId: string };
const deploy = new Hono<{ Variables: Variables }>();
deploy.use('*', authMiddleware);

// Rate-limit: max 10 deploys per hour per user using agent_runs as proxy
// DEPLOY-FIX [2026-04-29]: removed broken deploy_logs reference (table never existed)
const deployRateLimit = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const { count } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('last_deployed_at', oneHourAgo);

  if (count !== null && count >= 10) {
    return c.json({ error: 'Deploy rate limit: max 10 deploys per hour' }, 429);
  }

  await next();
};

// POST /api/deploy/vercel — SSE stream
deploy.post('/vercel', deployRateLimit, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({})) as { projectId?: string };
  const { projectId } = body;

  if (!projectId) return c.json({ error: 'projectId required' }, 400);

  const supabase = getSupabaseAdmin();
  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (!project) return c.json({ error: 'Project not found' }, 404);

  return streamSSE(c, async (stream) => {
    try {
      const result = await deployToVercel(
        userId,
        projectId,
        project.name,
        async (msg) => {
          await stream.writeSSE({ data: JSON.stringify({ type: 'progress', message: msg }) });
        },
      );

      // 10.6-3: at creation time Vercel has not yet assigned the production alias,
      // so result.url is the build-hash URL (which can 404 while still building).
      // Poll until READY to surface the canonical <project>.vercel.app alias (B-S5)
      // and a URL that actually answers 200. Fall back to the hash URL on timeout.
      let finalUrl = result.url;
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        let status: { state: string; url?: string };
        try {
          status = await getDeployStatus(userId, result.deploymentId);
        } catch {
          continue; // transient status read failure — keep polling
        }
        if (status.url) finalUrl = status.url;
        // F1.5 — German status stream: translate Vercel's state enum instead of
        // leaking "Status: BUILDING…" to a German UI.
        const stateDe: Record<string, string> = {
          QUEUED: 'Warteschlange…', BUILDING: 'Build läuft…', INITIALIZING: 'Build läuft…',
          UPLOADING: 'Dateien werden hochgeladen…', DEPLOYING: 'Wird veröffentlicht…', READY: 'Fertig…',
        };
        await stream.writeSSE({ data: JSON.stringify({ type: 'progress', message: stateDe[status.state] ?? 'Wird veröffentlicht…' }) });
        if (status.state === 'READY') break;
        if (status.state === 'ERROR' || status.state === 'CANCELED') {
          throw new Error(status.state === 'CANCELED' ? 'Veröffentlichung wurde abgebrochen.' : 'Veröffentlichung fehlgeschlagen (Build-Fehler bei Vercel).');
        }
      }

      // P0.2 — truth-gate: verify the URL serves the deployed artifact and all
      // referenced assets before any success is claimed.
      const deployedPaths = await listFiles(projectId).catch(() => [] as string[]);
      const verdict = await verifyDeployment(finalUrl, projectId, deployedPaths, async (msg) => {
        await stream.writeSSE({ data: JSON.stringify({ type: 'progress', message: msg }) });
      });
      if (!verdict.ok) {
        await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: verdict.reason ?? 'Veröffentlichung konnte nicht bestätigt werden.' }) });
        return;
      }

      await supabase
        .from('projects')
        .update({ preview_url: finalUrl, last_deployed_at: new Date().toISOString() })
        .eq('id', projectId);

      // Push notification (non-blocking)
      try {
        const { sendToUser } = await import('../services/notification-service');
        await sendToUser(userId, {
          title: `✅ ${project.name} deployed`,
          body: finalUrl,
          url: `/dashboard/project/${projectId}`,
          tag: 'build_complete',
          actionUrls: {
            open_preview: finalUrl,
          },
        });
      } catch {
        // VAPID may not be configured — not fatal
      }

      await stream.writeSSE({
        data: JSON.stringify({
          type: 'success',
          url: finalUrl,
          deploymentId: result.deploymentId,
          // 10.9-6 — 'public' = Goblin disabled SSO protection; 'manual' = token
          // lacked scope, the UI shows the one-time Vercel instruction.
          protection: result.protection ?? 'public',
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deploy failed';
      await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: msg }) });
    }
  });
});

// GET /api/deploy/vercel/:deploymentId/status
deploy.get('/vercel/:deploymentId/status', async (c) => {
  const userId = c.get('userId');
  const deploymentId = c.req.param('deploymentId');
  try {
    const status = await getDeployStatus(userId, deploymentId);
    return c.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to get status';
    return c.json({ error: msg }, 500);
  }
});

export { deploy };
