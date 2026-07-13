// F-31 (FIX-WAVE 2) GATE — admin-access decision.
//
// The founder "got no access with any account and no error detail": the /admin
// layout SILENTLY redirected non-admins. The fix routes both the layout and the
// /api/admin proxy through this one pure decision, and shows an honest screen on
// deny. These probes lock the two grant paths (is_admin flag OR ADMIN_EMAIL) and
// the deny reasons the layout branches on.

import { describe, it, expect } from 'vitest';
import { resolveAdminAccess } from './admin-access';

describe('resolveAdminAccess', () => {
  it('grants via is_admin (the 200-path)', () => {
    const r = resolveAdminAccess({ isAdmin: true, userEmail: 'x@y.com', adminEmail: null });
    expect(r.allowed).toBe(true);
    expect(r.via).toBe('is_admin');
  });

  it('grants via an exact ADMIN_EMAIL match (fallback before is_admin is set)', () => {
    const r = resolveAdminAccess({ isAdmin: false, userEmail: 'founder@justgoblin.com', adminEmail: 'founder@justgoblin.com' });
    expect(r.allowed).toBe(true);
    expect(r.via).toBe('admin_email');
  });

  it('ADMIN_EMAIL match is case-insensitive and whitespace-tolerant', () => {
    expect(resolveAdminAccess({ isAdmin: null, userEmail: 'Founder@Justgoblin.com', adminEmail: '  founder@justgoblin.com ' }).allowed).toBe(true);
  });

  it('denies a signed-in non-admin with reason not_admin (→ honest 403 screen)', () => {
    const r = resolveAdminAccess({ isAdmin: false, userEmail: 'someone@else.com', adminEmail: 'founder@justgoblin.com' });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('not_admin');
  });

  it('denies when ADMIN_EMAIL is unset and is_admin is not true', () => {
    const r = resolveAdminAccess({ isAdmin: null, userEmail: 'founder@justgoblin.com', adminEmail: undefined });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('not_admin');
  });

  it('no user → not_authenticated (→ layout redirects to /login, not the deny screen)', () => {
    const r = resolveAdminAccess({ isAdmin: true, userEmail: 'x@y.com', adminEmail: null }, false);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('not_authenticated');
  });

  it('an empty/whitespace ADMIN_EMAIL never accidentally matches an empty email', () => {
    expect(resolveAdminAccess({ isAdmin: false, userEmail: '', adminEmail: '' }).allowed).toBe(false);
    expect(resolveAdminAccess({ isAdmin: false, userEmail: null, adminEmail: '   ' }).allowed).toBe(false);
  });
});
