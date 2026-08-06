// FOUNDER-WALK-3 U5 — the shared admin error copy is the single source, so every
// admin page fails honestly and identically, never as a silent empty table.
//
// The 401 case additionally locks HONESTY: it must not blame a single cause it
// cannot observe. The previous copy asserted "the ADMIN_API_KEY values differ",
// which was wrong — the real cause was the `/api/:path*` rewrite shadowing the
// admin proxy — and it cost the founder days of chasing identical env values
// across two platforms.

import { describe, it, expect } from 'vitest';
import { adminErrorMessage } from './admin-error';

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

  it('network + unknown statuses degrade honestly in German', () => {
    expect(adminErrorMessage('network')).toMatch(/Netzwerk|nicht erreichbar/);
    expect(adminErrorMessage(418)).toContain('418');
  });
});
