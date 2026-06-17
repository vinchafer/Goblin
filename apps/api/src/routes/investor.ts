import { Hono } from 'hono';
import { getInvestorModelMapping } from '../services/goblin-hosted';

/**
 * Investor-gated, read-only model-mapping endpoint (HR-2/HR-3/HR-4).
 *
 * WHY THIS EXISTS: a browser app ships its bundle to the visitor, so anything baked
 * into the pitch's client code is readable in DevTools. The real Goblin Swift/Forge →
 * underlying-model mapping is a secret, so it can only stay secret if it is served
 * from the server ONLY after an auth check — never embedded in client code. The pitch
 * fetches this server-to-server (or from its own investor-gated context) and renders
 * the names without ever shipping them in its public bundle.
 *
 * AUTH: same shared-secret mechanism the admin surface uses (header == env secret),
 * but a DEDICATED, narrowly-scoped token (`INVESTOR_MODELS_TOKEN`) instead of the
 * full `ADMIN_API_KEY`. Lower blast radius: if the pitch's deployment env leaks, it
 * exposes only model names (already investor-shareable) — never the admin user /
 * telemetry routes. No token configured → every request is denied (fail closed).
 *
 * RETURNS: the two tiers with their public Goblin name AND the underlying open-source
 * model display name + slug, from the single source of truth (goblin-hosted config).
 * NEVER returns the wholesale provider (DeepInfra) and NEVER returns any API key.
 * Read-only — no mutation.
 */
const investor = new Hono();

investor.use('*', async (c, next) => {
  const expected = process.env.INVESTOR_MODELS_TOKEN;
  const provided = c.req.header('x-investor-token');
  // Fail closed: unset secret OR missing/mismatched token → denied, never the names.
  if (!expected || !provided || provided !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// GET /api/investor/models — { swift: {...}, forge: {...} }
investor.get('/models', (c) => {
  return c.json(getInvestorModelMapping());
});

export { investor };
