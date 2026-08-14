/**
 * AKT 2 · PHASE 4 · U4.4 — the inbox routes.
 *
 * The isolation properties live next door (ops-form-isolation.test.ts). What is
 * here is the OWNER's own experience of their own data, and the two states this
 * surface must never confuse:
 *
 *   • `available: false` — we could not look. NOT an empty inbox.
 *   • `total: 0`         — we looked, and nothing has arrived.
 *
 * Plus the guard on the irreversible action, and the export's honesty about its own
 * completeness.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ single: async () => ({ data: null }) }), limit: async () => ({ data: [] }) }),
        limit: async () => ({ data: [] }),
      }),
    }),
  }),
}));

vi.mock('../services/cf-deploy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/cf-deploy')>()),
  opsAppsDomain: () => 'justgoblin.app',
}));

const listSubmissions = vi.fn();
const allSubmissionsForExport = vi.fn();
const deleteAllSubmissions = vi.fn();
const deleteSubmission = vi.fn();
const markSubmissionRead = vi.fn();
const acceptedThisMonth = vi.fn();
const notificationsEnabled = vi.fn();
const setNotifications = vi.fn();

vi.mock('../services/ops-d1', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/ops-d1')>()),
  listSubmissions: (...a: unknown[]) => listSubmissions(...a),
  allSubmissionsForExport: (...a: unknown[]) => allSubmissionsForExport(...a),
  deleteAllSubmissions: (...a: unknown[]) => deleteAllSubmissions(...a),
  deleteSubmission: (...a: unknown[]) => deleteSubmission(...a),
  markSubmissionRead: (...a: unknown[]) => markSubmissionRead(...a),
  acceptedThisMonth: (...a: unknown[]) => acceptedThisMonth(...a),
  notificationsEnabled: (...a: unknown[]) => notificationsEnabled(...a),
  setNotifications: (...a: unknown[]) => setNotifications(...a),
}));

const findOpsAppById = vi.fn();
vi.mock('../services/ops-apps-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/ops-apps-store')>()),
  findOpsAppById: (...a: unknown[]) => findOpsAppById(...a),
  listUserOpsApps: async () => [],
}));

const { ops } = await import('./ops');

const OWNER = 'vinc.hafner3@gmail.com';
const APP = {
  appId: 'app-1', userId: 'user-1', projectId: 'proj-1', appName: 'meinladen', status: 'active',
  capsProfile: 'free-static', r2Prefix: 'apps/app-1/', routeKey: 'route:meinladen',
  workerScriptName: null, d1DatabaseId: 'db-1', lastPublishedAt: null, createdAt: '2026-08-01T00:00:00Z',
};

const SUB = {
  id: 'sub-1', formId: 'kontakt', createdAt: '2026-08-14T09:00:00Z',
  fields: { name: 'Anna' }, fieldCount: 1, bytes: 10, readAt: null, shapeVersion: 1,
};

const auth = { Authorization: 'Bearer owner-token' };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPS_HOSTING_ENABLED = 'true';
  process.env.OPS_BETA_ACCOUNTS = OWNER;
  process.env.OPS_APPS_DOMAIN = 'justgoblin.app';
  getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: OWNER } }, error: null });
  findOpsAppById.mockResolvedValue(APP);
  listSubmissions.mockResolvedValue({ submissions: [SUB], total: 1 });
  acceptedThisMonth.mockResolvedValue(1);
  notificationsEnabled.mockResolvedValue(true);
  setNotifications.mockResolvedValue(true);
  markSubmissionRead.mockResolvedValue(true);
  deleteSubmission.mockResolvedValue(true);
  deleteAllSubmissions.mockResolvedValue({ ok: true, deleted: 1 });
  allSubmissionsForExport.mockResolvedValue({ submissions: [SUB], truncated: false });
});

describe('reading the inbox', () => {
  it('returns the submissions, the month and the notification setting', async () => {
    const res = await ops.request(`/apps/${APP.appId}/submissions`, { headers: auth });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.available).toBe(true);
    expect(body.total).toBe(1);
    expect(body.monthlyCap).toBe(500);
    expect(body.acceptedThisMonth).toBe(1);
    expect(body.notifications).toBe(true);
  });

  it('A DATABASE THAT CANNOT BE READ IS `available: false`, NOT AN EMPTY INBOX', async () => {
    listSubmissions.mockResolvedValue(null);
    const res = await ops.request(`/apps/${APP.appId}/submissions`, { headers: auth });
    const body = (await res.json()) as { available: boolean; message: string; total?: number };
    expect(body.available).toBe(false);
    // The distinction is in the payload, not only in the UI: there is no `total: 0`
    // for a client to render as "nothing has arrived".
    expect(body.total).toBeUndefined();
    expect(body.message).toContain('NICHT');
  });

  it('an app with no form has no inbox — 404, not an empty one', async () => {
    findOpsAppById.mockResolvedValue({ ...APP, d1DatabaseId: null });
    const res = await ops.request(`/apps/${APP.appId}/submissions`, { headers: auth });
    expect(res.status).toBe(404);
    expect(listSubmissions).not.toHaveBeenCalled();
  });

  it('a month counter that cannot be read comes through as null, never as 0', async () => {
    acceptedThisMonth.mockResolvedValue(null);
    const body = (await (await ops.request(`/apps/${APP.appId}/submissions`, { headers: auth })).json()) as {
      acceptedThisMonth: number | null;
    };
    expect(body.acceptedThisMonth).toBeNull();
  });
});

describe('the export', () => {
  it('is a CSV attachment named after the app', async () => {
    const res = await ops.request(`/apps/${APP.appId}/submissions.csv`, { headers: auth });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('einsendungen-meinladen.csv');
    expect(await res.text()).toContain('Anna');
  });

  it('SAYS when it is truncated, in a header a client can act on', async () => {
    allSubmissionsForExport.mockResolvedValue({ submissions: [SUB], truncated: true });
    const res = await ops.request(`/apps/${APP.appId}/submissions.csv`, { headers: auth });
    expect(res.headers.get('x-goblin-export-truncated')).toBe('true');
    expect(res.headers.get('x-goblin-export-rows')).toBe('1');
  });

  it('an export that cannot be built is a 503, never an empty file that looks complete', async () => {
    allSubmissionsForExport.mockResolvedValue(null);
    const res = await ops.request(`/apps/${APP.appId}/submissions.csv`, { headers: auth });
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).not.toContain('text/csv');
  });
});

describe('deleting', () => {
  it('one message', async () => {
    const res = await ops.request(`/apps/${APP.appId}/submissions/sub-1`, { method: 'DELETE', headers: auth });
    expect(res.status).toBe(200);
    expect(deleteSubmission).toHaveBeenCalledWith('db-1', 'sub-1');
  });

  it('EVERYTHING needs the confirm token — a stray request cannot empty an inbox', async () => {
    const res = await ops.request(`/apps/${APP.appId}/submissions`, { method: 'DELETE', headers: auth });
    expect(res.status).toBe(400);
    expect(deleteAllSubmissions).not.toHaveBeenCalled();
    expect(((await res.json()) as { message: string }).message).toContain('ALLES-LOESCHEN');
  });

  it('and with it, it reports how many went', async () => {
    deleteAllSubmissions.mockResolvedValue({ ok: true, deleted: 7 });
    const res = await ops.request(`/apps/${APP.appId}/submissions?confirm=ALLES-LOESCHEN`, { method: 'DELETE', headers: auth });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { deleted: number }).deleted).toBe(7);
  });

  it('a delete that did not happen is a 503, never a cheerful ok', async () => {
    deleteSubmission.mockResolvedValue(false);
    const res = await ops.request(`/apps/${APP.appId}/submissions/sub-1`, { method: 'DELETE', headers: auth });
    expect(res.status).toBe(503);
  });
});

describe('the notification switch is the owner’s', () => {
  it('turns off', async () => {
    const res = await ops.request(`/apps/${APP.appId}/notifications`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(200);
    expect(setNotifications).toHaveBeenCalledWith('db-1', false);
  });

  it('a body with no `enabled` means ON — the safe direction is being told about your own form', async () => {
    await ops.request(`/apps/${APP.appId}/notifications`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(setNotifications).toHaveBeenCalledWith('db-1', true);
  });

  it('a setting that could not be saved says so rather than reporting success', async () => {
    setNotifications.mockResolvedValue(false);
    const res = await ops.request(`/apps/${APP.appId}/notifications`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(503);
  });
});

describe('GET /apps reports whether an app has an inbox at all', () => {
  it('emits a boolean, never the database id', async () => {
    const store = await import('../services/ops-apps-store');
    vi.spyOn(store, 'listUserOpsApps').mockResolvedValue([APP as never]);
    const res = await ops.request('/apps', { headers: auth });
    const text = await res.text();
    expect(text).toContain('"hasForms":true');
    expect(text).not.toContain('db-1');
  });
});

// ── the configuration report the founder verifies from (2026-08-14) ────────
//
// Requested before the merge: the health surface must report the three Phase-4
// variables BY NAME, and the endpoint BY SHAPE — never a value. This block is the
// evidence that it does, and that it cannot accidentally start doing otherwise.

describe('GET /health — the forms configuration report', () => {
  const health = async () => (await ops.request('/health', { headers: auth })).json() as Promise<Record<string, any>>;

  beforeEach(() => {
    delete process.env.OPS_FORMS_ENDPOINT;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.CF_TURNSTILE_SITE_KEY;
    delete process.env.CF_TURNSTILE_SECRET_KEY;
  });

  it('reports all three by NAME, as booleans', async () => {
    process.env.OPS_FORMS_ENDPOINT = 'https://api.justgoblin.com';
    process.env.CF_TURNSTILE_SITE_KEY = '0xsite';
    process.env.CF_TURNSTILE_SECRET_KEY = '0xsecret';
    const body = await health();
    expect(body.forms.present).toMatchObject({
      OPS_FORMS_ENDPOINT: true,
      CF_TURNSTILE_SITE_KEY: true,
      CF_TURNSTILE_SECRET_KEY: true,
    });
    expect(body.forms.verdict).toBe('ready');
    expect(body.forms.missing).toEqual([]);
  });

  it('NEVER emits a value, a prefix, a length or a hostname', async () => {
    process.env.OPS_FORMS_ENDPOINT = 'https://api.justgoblin.com';
    process.env.CF_TURNSTILE_SITE_KEY = '0xSITEKEYVALUE';
    process.env.CF_TURNSTILE_SECRET_KEY = '0xSECRETKEYVALUE';
    const text = JSON.stringify((await health()).forms);
    expect(text).not.toContain('0xSITEKEYVALUE');
    expect(text).not.toContain('0xSECRETKEYVALUE');
    // The host is a value too. The shape is reported; the origin is not.
    expect(text).not.toContain('api.justgoblin.com');
    expect(text).not.toMatch(/"length"|"prefix"/);
  });

  it('reports the endpoint by SHAPE — bare origin, scheme, normalisation', async () => {
    process.env.OPS_FORMS_ENDPOINT = 'https://api.justgoblin.com/';
    const body = await health();
    expect(body.forms.endpoint).toEqual({
      source: 'OPS_FORMS_ENDPOINT', scheme: 'https', bareOrigin: true, trailingSlashRemoved: true,
    });
  });

  it('a MALFORMED endpoint is its own verdict, with the problem named', async () => {
    process.env.OPS_FORMS_ENDPOINT = 'https://api.justgoblin.com/api';
    process.env.CF_TURNSTILE_SITE_KEY = '0xsite';
    process.env.CF_TURNSTILE_SECRET_KEY = '0xsecret';
    const body = await health();
    expect(body.forms.verdict).toBe('malformed');
    expect(body.forms.endpoint).toMatchObject({ bareOrigin: false, problem: 'has_path' });
  });

  it('HALF-configured is `incomplete`, never `not_configured` — the dangerous middle has its own name', async () => {
    process.env.CF_TURNSTILE_SITE_KEY = '0xsite';
    const body = await health();
    expect(body.forms.verdict).toBe('incomplete');
    expect(body.forms.missing).toEqual(['CF_TURNSTILE_SECRET_KEY', 'OPS_FORMS_ENDPOINT']);
  });

  it('nothing set at all is `not_configured` — a correct state, not a fault', async () => {
    expect((await health()).forms.verdict).toBe('not_configured');
  });

  it('does NOT change the overall status — an instance without forms stays green', async () => {
    const withoutForms = await health();
    process.env.CF_TURNSTILE_SITE_KEY = '0xsite';
    process.env.CF_TURNSTILE_SECRET_KEY = '0xsecret';
    process.env.OPS_FORMS_ENDPOINT = 'https://api.justgoblin.com';
    const withForms = await health();
    expect(withForms.status).toBe(withoutForms.status);
  });

  it('says out loud that it cannot speak for the D1 token scope', async () => {
    expect((await health()).forms.note).toContain('D1:Edit');
  });

  it('the console and the health probe compute the SAME report — one function, two surfaces', async () => {
    process.env.OPS_FORMS_ENDPOINT = 'https://api.justgoblin.com';
    process.env.CF_TURNSTILE_SITE_KEY = '0xsite';
    process.env.CF_TURNSTILE_SECRET_KEY = '0xsecret';
    const { formsConfigReport } = await import('../services/ops-forms-config');
    // The console renders whatever this returns; the probe embeds whatever this
    // returns. Two implementations is how one surface says yes and the other no.
    expect((await health()).forms).toEqual(formsConfigReport());
  });
});
