// WAVE-B B1 — deterministic, no-network tests for the provision_backend tool logic.
// Mocks the BackendProvider + store deps (same injection style as publish/goblin-hosted).

import { describe, it, expect, vi } from 'vitest';
import { runProvisionBackend, newProvisionState, type ProvisionDeps } from './provision-tool';
import { ProvisionError, type BackendProvider, type ProvisionedBackend } from './types';
import type { ToolContext } from '../agent/types';

const ctx: ToolContext = { userId: 'u1', projectId: 'p1', sessionId: 's1' };
const tables = [{ name: 'tasks', columns: [{ name: 'title', type: 'text' as const, notNull: true }] }];

function backend(overrides: Partial<ProvisionedBackend> = {}): ProvisionedBackend {
  return {
    provider: 'supabase',
    projectRef: 'abcd1234',
    projectUrl: 'https://abcd1234.supabase.co',
    region: 'eu-central-1',
    anonKey: 'anon_public_key_value',
    serviceRoleKey: 'SERVICE_ROLE_SECRET_DO_NOT_LEAK',
    provisionLatencyMs: 4200,
    ...overrides,
  };
}

function makeProvider(overrides: Partial<BackendProvider> = {}): BackendProvider {
  return {
    id: 'supabase',
    isConnected: vi.fn().mockResolvedValue(true),
    provision: vi.fn().mockResolvedValue(backend()),
    applySchema: vi.fn().mockResolvedValue({ ok: true, tablesCreated: 1, rlsEnabled: true }),
    teardown: vi.fn().mockResolvedValue({ ok: true, status: 200, alreadyGone: false }),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ProvisionDeps> = {}): ProvisionDeps {
  return {
    provider: makeProvider(),
    resolvePlan: vi.fn().mockResolvedValue('trial'),
    tableAvailable: vi.fn().mockResolvedValue(true),
    countUserBackends: vi.fn().mockResolvedValue(0),
    getProjectBackend: vi.fn().mockResolvedValue(null),
    recordProvisioned: vi.fn().mockResolvedValue('row1'),
    recordFailed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runProvisionBackend', () => {
  it('provisions + applies RLS schema and attests the result (no service_role leak)', async () => {
    const deps = makeDeps();
    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { name: 'aufgaben', tables });
    expect(res.ok).toBe(true);
    expect(res.summary).toMatch(/Datenbank angelegt: 1 Tabellen, RLS aktiv/);
    expect(res.summary).toMatch(/4200 ms/); // MEASURED latency surfaced, not invented
    const data = res.data as Record<string, unknown>;
    expect(data.projectUrl).toBe('https://abcd1234.supabase.co');
    expect(data.anonKey).toBe('anon_public_key_value');
    expect(data.rlsEnabled).toBe(true);
    // The service_role key must NEVER appear anywhere in the tool result (R5).
    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain('SERVICE_ROLE_SECRET_DO_NOT_LEAK');
    expect(deps.recordProvisioned).toHaveBeenCalledOnce();
  });

  it('the schema actually applied has RLS on every table (generator wired in)', async () => {
    const applySchema = vi.fn().mockResolvedValue({ ok: true, tablesCreated: 1, rlsEnabled: true });
    const deps = makeDeps({ provider: makeProvider({ applySchema }) });
    await runProvisionBackend(deps, ctx, newProvisionState(), { tables });
    const sqlArg = applySchema.mock.calls[0]![2] as string;
    expect(sqlArg).toContain('enable row level security');
    expect(sqlArg).toContain('"tasks_select_own"');
  });

  it('returns the JIT signal (no_supabase_connection) when the account is not connected', async () => {
    const deps = makeDeps({ provider: makeProvider({ isConnected: vi.fn().mockResolvedValue(false) }) });
    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { tables });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('no_supabase_connection');
    expect(deps.provider.provision).not.toHaveBeenCalled();
  });

  it('enforces the trial cap (D-B2) BEFORE provisioning', async () => {
    const deps = makeDeps({ resolvePlan: vi.fn().mockResolvedValue('trial'), countUserBackends: vi.fn().mockResolvedValue(2) });
    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { tables });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('trial_cap');
    expect(deps.provider.provision).not.toHaveBeenCalled();
  });

  it('allows a paid user past the trial cap of 2', async () => {
    const deps = makeDeps({ resolvePlan: vi.fn().mockResolvedValue('pro'), countUserBackends: vi.fn().mockResolvedValue(2) });
    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { tables });
    expect(res.ok).toBe(true);
  });

  it('is idempotent: reuses an existing active backend (applies schema, no re-provision)', async () => {
    const provision = vi.fn();
    const deps = makeDeps({
      provider: makeProvider({ provision }),
      getProjectBackend: vi.fn().mockResolvedValue({
        id: 'b1', projectId: 'p1', supabaseProjectRef: 'exist99',
        projectUrl: 'https://exist99.supabase.co', region: 'eu-central-1', anonKey: 'a', status: 'active',
      }),
    });
    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { tables });
    expect(res.ok).toBe(true);
    expect((res.data as Record<string, unknown>).reused).toBe(true);
    expect(provision).not.toHaveBeenCalled();
  });

  it('records a FAILED row (never a silent orphan) when provision creates but cannot finish', async () => {
    const err = new ProvisionError('keys_unavailable', 'keys not ready', 'partialref77');
    const deps = makeDeps({ provider: makeProvider({ provision: vi.fn().mockRejectedValue(err) }) });
    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { tables });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('keys_unavailable');
    expect(deps.recordFailed).toHaveBeenCalledWith('u1', 'p1', 'partialref77');
  });

  it('records a FAILED row when schema apply fails after provision', async () => {
    const deps = makeDeps({
      provider: makeProvider({ applySchema: vi.fn().mockResolvedValue({ ok: false, tablesCreated: 0, rlsEnabled: false, error: 'boom' }) }),
    });
    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { tables });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('schema_failed');
    expect(deps.recordFailed).toHaveBeenCalledWith('u1', 'p1', 'abcd1234');
  });

  it('honest-degrades when the registry table is absent (pre-migration)', async () => {
    const deps = makeDeps({ tableAvailable: vi.fn().mockResolvedValue(false) });
    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { tables });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('fullstack_unavailable');
  });

  it('rejects an invalid schema before any provider call', async () => {
    const deps = makeDeps();
    const res = await runProvisionBackend(deps, ctx, newProvisionState(), { tables: [{ name: 'bad name', columns: [{ name: 'a', type: 'text' }] }] });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('bad_schema');
    expect(deps.provider.isConnected).not.toHaveBeenCalled();
  });
});
