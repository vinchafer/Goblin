/**
 * AKT 2 · PHASE 2 — publishing WITHOUT a project, i.e. the E2E run.
 *
 * The defect this file exists to make impossible: the E2E run published with
 * `projectId: ''`, every loop died at `registry/registry_unavailable`, and manual
 * publishes on the byte-identical code path kept working. Same client (the service-
 * role Supabase admin), same schema, same column set, same RLS context — the only
 * difference was the VALUE: `ops_apps.project_id` is a nullable uuid (0099), and
 * `''` is not a uuid. Postgres answers 22P02, `claimOpsApp` returns null (its
 * contract for "the registry refused"), and the publish path correctly refuses to
 * upload anything.
 *
 * No test in the repo could see it, because every fake registry accepted whatever
 * it was handed. So the fake below enforces the ONE database rule that mattered:
 * a uuid column takes a uuid or NULL, and nothing else. The constraint is not
 * relaxed to make the run pass — the run was asking for something Postgres was
 * right to refuse.
 */

import { describe, it, expect, vi } from 'vitest';
import { claimOpsApp, findOpsAppByProject } from './ops-apps-store';
import { publishHostedApp, type PublishDeps } from './ops-publish';
import type { OpsApp } from './ops-apps-store';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT_UUID = '3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607';
const USER_UUID = '9c8b7a65-4321-4fed-9876-0123456789ab';

/**
 * A Supabase stand-in that behaves like the column types actually declared in 0099.
 * It is deliberately strict about exactly one thing — uuid columns — because that is
 * the rule the production insert broke.
 */
function fakePostgres() {
  const inserted: Record<string, unknown>[] = [];
  const sb = {
    from: () => ({
      // opsAppsTableAvailable() probes with a select; the table exists here.
      select: () => ({
        limit: async () => ({ data: [], error: null }),
        eq: () => ({ neq: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      }),
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          limit: async () => {
            for (const col of ['app_id', 'user_id', 'project_id']) {
              const v = row[col];
              if (v === null || v === undefined) continue; // nullable uuid — fine
              if (typeof v !== 'string' || !UUID.test(v)) {
                return {
                  data: null,
                  error: { code: '22P02', message: `invalid input syntax for type uuid: "${String(v)}"` },
                };
              }
            }
            inserted.push(row);
            return {
              data: [{
                ...row,
                created_at: '2026-08-11T00:00:00Z',
                last_published_at: null,
                worker_script_name: null,
                d1_database_id: null,
              }],
              error: null,
            };
          },
        }),
      }),
    }),
  };
  return { sb: sb as unknown as Parameters<typeof claimOpsApp>[1], inserted };
}

describe('claimOpsApp against a uuid column', () => {
  it('accepts null for "no project" — the value the registry actually declares', async () => {
    const { sb, inserted } = fakePostgres();
    const claimed = await claimOpsApp({ userId: USER_UUID, projectId: null, appName: 'e2e-abc123' }, sb);
    expect(claimed).not.toBeNull();
    expect(claimed?.projectId).toBeNull();
    expect(inserted[0]?.project_id).toBeNull();
  });

  it('still accepts a real project uuid — the manual publish path, unchanged', async () => {
    const { sb, inserted } = fakePostgres();
    const claimed = await claimOpsApp({ userId: USER_UUID, projectId: PROJECT_UUID, appName: 'meinladen' }, sb);
    expect(claimed?.projectId).toBe(PROJECT_UUID);
    expect(inserted[0]?.project_id).toBe(PROJECT_UUID);
  });

  it('is refused by the database for the empty string — this WAS the E2E failure', async () => {
    const { sb, inserted } = fakePostgres();
    const claimed = await claimOpsApp(
      { userId: USER_UUID, projectId: '' as unknown as null, appName: 'e2e-abc123' },
      sb,
    );
    expect(claimed).toBeNull();      // → publishHostedApp reports registry_unavailable
    expect(inserted).toHaveLength(0); // and nothing was written
  });
});

describe('findOpsAppByProject with no project', () => {
  it('answers null without asking the database — "" and null are not uuids to compare', async () => {
    const from = vi.fn();
    const sb = { from } as unknown as Parameters<typeof findOpsAppByProject>[1];
    expect(await findOpsAppByProject(null, sb)).toBeNull();
    expect(await findOpsAppByProject('', sb)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

/** A two-stage scan that cleared both stages. Shape only — the verdicts are tested in ops-publish.test.ts. */
const PASS_OUTCOME = {
  verdict: 'pass' as const,
  decidedBy: 'none' as const,
  stage1: { verdict: 'pass' as const, ruleIds: [], hits: [], scannedFiles: 1, scannedBytes: 10 },
  stage2: null,
  categories: [],
  ruleIds: [],
  scannedFiles: 1,
  scannedBytes: 10,
};

describe('the publish path with projectId: null — the E2E run, end to end at the registry', () => {
  /** The E2E run's shape: a synthetic artifact, a real registry, everything else faked. */
  function e2eLikeDeps(sb: Parameters<typeof claimOpsApp>[1], overrides: Partial<PublishDeps> = {}): PublishDeps {
    const files: Record<string, string> = { 'index.html': '<!doctype html><html><body><h1>E2E</h1></body></html>' };
    return {
      listFiles: async () => Object.keys(files),
      getFileBytes: async (_p: string, path: string) =>
        files[path] === undefined ? null : { bytes: Buffer.from(files[path]!, 'utf8') },
      // PHASE 3: the two-stage runner. A pass here means both stages passed.
      scan: async () => PASS_OUTCOME,
      enqueueReview: async () => null,
      putAppFiles: async () => ({ ok: true as const, value: { files: 1, bytes: 10 } }),
      setRoute: async () => ({ ok: true as const, value: { name: 'e2e-abc123', appId: 'a', status: 'active' as const } }),
      getRoute: async () => ({ ok: true as const, value: null }),
      deleteRoute: async () => ({ ok: true as const, value: { deleted: true } }),
      verify: async () => ({ ok: true, entryOk: true, assetsChecked: 1, assetsMatched: 1, mismatched: [] }),
      // THE REAL registry write, against the strict fake database.
      claimOpsApp: (input: Parameters<typeof claimOpsApp>[0]) => claimOpsApp(input, sb),
      findOpsAppByName: async () => null,
      findOpsAppByProject: async () => null,
      markOpsAppPublished: async () => true,
      markOpsAppFailed: async () => true,
      renameOpsApp: async () => true,
      appsDomain: () => 'justgoblin.app',
      ...overrides,
    } as unknown as PublishDeps;
  }

  it('reaches "live" instead of registry/registry_unavailable', async () => {
    const { sb, inserted } = fakePostgres();
    const result = await publishHostedApp(
      { userId: USER_UUID, projectId: null, name: 'e2e-abc123' },
      e2eLikeDeps(sb),
    );
    expect(result.ok, result.ok ? '' : `${result.stage}/${result.code}: ${result.message}`).toBe(true);
    expect(result.ok && result.stage).toBe('live');
    expect(inserted[0]?.project_id).toBeNull();
  });

  it('hands the registry null verbatim — the publish path invents no project', async () => {
    const claim = vi.fn(async () => null as OpsApp | null);
    const { sb } = fakePostgres();
    const result = await publishHostedApp(
      { userId: USER_UUID, projectId: null, name: 'e2e-abc123' },
      e2eLikeDeps(sb, { claimOpsApp: claim as unknown as PublishDeps['claimOpsApp'] }),
    );
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ projectId: null, appName: 'e2e-abc123' }));
    // A registry that refuses is still a refusal to publish — unchanged.
    expect(result.ok).toBe(false);
    expect(!result.ok && result.code).toBe('registry_unavailable');
  });

  it('passes null into the scan context too, so a blocked publish records no bogus project', async () => {
    const scan = vi.fn(async () => PASS_OUTCOME);
    const { sb } = fakePostgres();
    await publishHostedApp(
      { userId: USER_UUID, projectId: null, name: 'e2e-abc123' },
      e2eLikeDeps(sb, { scan: scan as unknown as PublishDeps['scan'] }),
    );
    expect(scan).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ projectId: null }));
  });

  it('a real project publish still writes its uuid — the manual path is untouched', async () => {
    const { sb, inserted } = fakePostgres();
    const result = await publishHostedApp(
      { userId: USER_UUID, projectId: PROJECT_UUID, name: 'meinladen' },
      e2eLikeDeps(sb),
    );
    expect(result.ok).toBe(true);
    expect(inserted[0]?.project_id).toBe(PROJECT_UUID);
  });
});
