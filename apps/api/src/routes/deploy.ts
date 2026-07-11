import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Context, Next } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { deployToVercel, getDeployStatus } from '../services/vercel-service';
import { verifyDeployment } from '../services/deploy-verification';
import { listFiles, downloadFile } from '../services/file-storage';
import { trackEvent } from '../lib/platform-events';
import { runPublishGuard } from '../services/safety/publish-scan';

type Variables = { userId: string };
const deploy = new Hono<{ Variables: Variables }>();
deploy.use('*', authMiddleware);

// Rate-limit: max 10 deploys per hour per user using agent_runs as proxy
// DEPLOY-FIX [2026-04-29]: removed broken deploy_logs reference (table never existed)
const deployRateLimit = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();

  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  // D-2: env-knobbed (BUILDS_PER_HOUR), 10/hr default. Honest German 429 + Retry-After.
  const raw = Number(process.env.BUILDS_PER_HOUR);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10;

  const { count } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('last_deployed_at', oneHourAgo);

  if (count !== null && count >= limit) {
    c.header('Retry-After', '3600');
    return c.json(
      {
        error: 'deploy_rate_limited',
        message: `Du hast in der letzten Stunde schon viele Veröffentlichungen gestartet (max ${limit}/Stunde). Bitte kurz warten und erneut versuchen.`,
      },
      429,
    );
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
      // K3 (Wave-K, Layer 3) — deterministic safety scan BEFORE the deploy, alongside
      // the truth-gate. A high-confidence phishing/malware hit blocks here with an honest,
      // appeal-carrying message (Option A: softer signals are logged, not blocked). The
      // guard degrades open on its own failure — it never kills an honest publish itself.
      const guard = await runPublishGuard({ listFiles, downloadFile }, userId, projectId);
      if (!guard.ok) {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'blocked',
            policyArea: guard.policyArea,
            message: guard.message ?? 'Veröffentlichung wurde aus Sicherheitsgründen gestoppt.',
            // The client wires this to the Wave-J feedback affordance (category auto-set)
            // so a wrongly-blocked builder can appeal to a human.
            appeal: { surface: 'publish_block', category: 'other', policyArea: guard.policyArea, ruleIds: guard.ruleIds },
          }),
        });
        return;
      }

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
          // A4.1: READY must not read as done — verification (truth-gate below) has not run yet.
          UPLOADING: 'Dateien werden hochgeladen…', DEPLOYING: 'Wird veröffentlicht…', READY: 'Bereitstellung abgeschlossen — wird geprüft…',
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
        // I1 funnel: publish_failed at the truth-gate (metadata only — the failing
        // check name + failed-asset count, never file contents). This is the
        // server-side truth, not a client claim.
        trackEvent({
          eventType: 'publish_failed',
          userId,
          projectId,
          meta: { stage: 'verification', check: verdict.reason ?? 'unverified', failed_assets: verdict.failedAssets?.length ?? 0 },
        });
        await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: verdict.reason ?? 'Veröffentlichung konnte nicht bestätigt werden.' }) });
        return;
      }

      await supabase
        .from('projects')
        .update({ preview_url: finalUrl, last_deployed_at: new Date().toISOString() })
        .eq('id', projectId);

      // I1 funnel: publish_verified — fires only after the truth-gate confirms the
      // live URL serves the deployed artifact. first-per-user timestamp feeds the
      // first_publish_verified funnel stage (the "reached a live app" number).
      trackEvent({ eventType: 'publish_verified', userId, projectId });

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
      // I1 funnel: publish_failed on a build/pipeline error (before the truth-gate).
      // Categorised, metadata only — no file contents.
      trackEvent({ eventType: 'publish_failed', userId, projectId, meta: { stage: 'build' } });
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
