/**
 * Dev-Safety Shield — Vercel allowlist guard (B3, 2026-05-30).
 *
 * The Vercel deploy path uses a per-user BYOK token (see services/vercel-service.ts), which
 * could point at any Vercel account. This guard is defense-in-depth: while the shield is
 * active it refuses to create/mutate any Vercel project except the sanctioned one
 * (`synapse-platform`) or throwaway `test-*` projects. Reads (deploy status) are not gated.
 *
 * Keyed on IS_DEV_MODE (NOT NODE_ENV, which is forced to "production" in .env.local).
 */
import { IS_DEV_MODE, VERCEL_ALLOWED_PROJECT } from './env.js';

export function guardVercelCall(projectIdOrName: string, op: string): void {
  if (!IS_DEV_MODE) return;
  const name = (projectIdOrName ?? '').toLowerCase();
  if (name === VERCEL_ALLOWED_PROJECT || name.startsWith('test-')) return;
  throw new Error(
    `[VERCEL-GUARD] Blocked ${op} on "${projectIdOrName}": in dev only ` +
      `"${VERCEL_ALLOWED_PROJECT}" or test-prefixed project names are allowed. ` +
      'Set GOBLIN_DEV_MODE=false to disable shield.',
  );
}
