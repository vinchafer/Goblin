import { apiGet } from '@/lib/api';

/**
 * X1 — "what happens to my published app?", answered before the confirm click.
 *
 * A delete dialog cannot name the address it is about to retire unless it asks, and
 * the only surface that knows is `GET /api/ops/apps`. That endpoint sits behind
 * `opsGate`, which ANDs in `OPS_HOSTING_ENABLED` and the beta allowlist and 404s for
 * everyone else — so for the whole Act-1 cohort this call fails and the dialog falls
 * back to its unchanged generic wording. That fallback is the normal path, not the
 * error path, which is why EVERY failure resolves to `[]` rather than surfacing:
 * a lookup that cannot answer must not be able to block a delete.
 */
export interface HostedApp {
  appId: string;
  name: string;
  url: string;
  status: string;
  projectId: string | null;
}

export async function fetchHostedApps(): Promise<HostedApp[]> {
  try {
    const res = await apiGet<{ apps?: HostedApp[] }>('/api/ops/apps');
    return res?.apps ?? [];
  } catch {
    return [];
  }
}

/**
 * The published app for one project, or null.
 *
 * `status` is deliberately not filtered on: a SUSPENDED app is still an app whose
 * address this delete retires, and telling someone their suspended app is
 * unaffected would be a lie in the one direction that matters.
 */
export function hostedAppForProject(apps: HostedApp[], projectId: string): HostedApp | null {
  return apps.find((a) => a.projectId === projectId) ?? null;
}
