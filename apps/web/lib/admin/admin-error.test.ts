// FOUNDER-WALK-3 U5 — the shared admin error copy is the single source, so every
// admin page fails honestly and identically, never as a silent empty table.
//
// The 401 case additionally locks HONESTY: it must not blame a single cause it
// cannot observe. The previous copy asserted "the ADMIN_API_KEY values differ",
// which was wrong — the real cause was the `/api/:path*` rewrite shadowing the
// admin proxy — and it cost the founder days of chasing identical env values
// across two platforms.

import { describe, it, expect } from 'vitest';
import { adminErrorMessage, readAdminErrorDetail } from './admin-error';

describe('adminErrorMessage', () => {
  it('401 names BOTH causes, not just the env values', () => {
    const m = adminErrorMessage(401);
    expect(m).toContain('401');
    // cause A — the key never arrives (proxy bypassed)
    expect(m).toContain('x-admin-key');
    expect(m).toMatch(/Proxy/);
    // cause B — the values differ
    expect(m).toContain('ADMIN_API_KEY');
    expect(m).toContain('Web und API');
  });

  it('401 gives the test that tells the two causes apart', () => {
    const m = adminErrorMessage(401);
    expect(m).toContain('/api/admin/telemetry');
    expect(m).toContain('403');
  });

  it('401 does not assert a single cause as fact', () => {
    const m = adminErrorMessage(401);
    // "stimmt nicht" / "müssen übereinstimmen" was the false, single-cause claim.
    expect(m).not.toMatch(/müssen übereinstimmen/);
  });

  it('403 is a distinct "no admin access" message', () => {
    expect(adminErrorMessage(403)).toContain('403');
    expect(adminErrorMessage(403)).not.toContain('ADMIN_API_KEY');
  });

  it('500 surfaces the proxy detail when present', () => {
    expect(adminErrorMessage(500, 'admin_key_unconfigured')).toContain('admin_key_unconfigured');
    expect(adminErrorMessage(500)).toContain('500');
  });

  // ─── FOUNDER-WALK-4 · U2 ────────────────────────────────────────────────────
  // /admin/insight went 401 → 500 after PR #72 fixed the rewrite shadowing. The 500 was
  // unreadable because THREE layers each dropped a bit of it: the API answered `{ error }`,
  // the page read `detail`, and this copy then asserted "Konfigurationsfehler" — a cause
  // nobody had observed. That is the retracted 401 verdict's failure mode, one surface down.

  it('500 does NOT assert a configuration cause it has not observed', () => {
    // Two different 500s reach an admin page: the web proxy's own `admin_key_unconfigured`
    // (genuinely config) and the API failing a read behind it (not config at all). Naming
    // the second one a config error sends the founder back to env vars they already checked.
    for (const m of [adminErrorMessage(500), adminErrorMessage(500, 'platform_events read failed: …')]) {
      expect(m).not.toMatch(/Konfigurationsfehler/);
      expect(m).toContain('500');
    }
  });

  it('500 hands over the server\'s own words verbatim', () => {
    const m = adminErrorMessage(500, 'platform_events read failed: could not find the table');
    expect(m).toContain('platform_events read failed: could not find the table');
  });

  it('500 without a reason says the reason is missing, instead of inventing one', () => {
    expect(adminErrorMessage(500)).toMatch(/keinen Grund|Serverlog/);
  });

  it('an unknown status carries its detail too', () => {
    expect(adminErrorMessage(502, 'Admin API unavailable')).toContain('Admin API unavailable');
  });
});

describe('readAdminErrorDetail — one reader for two body shapes', () => {
  const res = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 500, headers: { 'Content-Type': 'application/json' } });

  it("reads the web proxy's `detail`", async () => {
    expect(await readAdminErrorDetail(res({ error: 'admin_key_unconfigured', detail: 'ADMIN_API_KEY is not set' })))
      .toBe('ADMIN_API_KEY is not set');
  });

  it("reads the API's `error` — the key /admin/insight never looked at", async () => {
    // This is the one that made the founder's 500 unreadable: the message was in the body
    // the whole time, under a key nothing on the web side read.
    expect(await readAdminErrorDetail(res({ error: 'insight platform_events read failed: …' })))
      .toBe('insight platform_events read failed: …');
  });

  it('prefers `detail` when a body carries both', async () => {
    expect(await readAdminErrorDetail(res({ error: 'short', detail: 'the actionable one' })))
      .toBe('the actionable one');
  });

  it('returns undefined for a non-JSON or empty body rather than throwing', async () => {
    expect(await readAdminErrorDetail(new Response('<html>502</html>', { status: 502 }))).toBeUndefined();
    expect(await readAdminErrorDetail(res({}))).toBeUndefined();
    expect(await readAdminErrorDetail(res({ error: '   ' }))).toBeUndefined();
  });

  it('does not consume the body — the caller can still read the response', async () => {
    const r = res({ error: 'boom' });
    await readAdminErrorDetail(r);
    await expect(r.json()).resolves.toEqual({ error: 'boom' });
  });

  it('network + unknown statuses degrade honestly in German', () => {
    expect(adminErrorMessage('network')).toMatch(/Netzwerk|nicht erreichbar/);
    expect(adminErrorMessage(418)).toContain('418');
  });
});
