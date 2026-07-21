// FOUNDER-WALK-3 U5 — the shared admin error copy is the single source, and the
// 401 message NAMES the ADMIN_API_KEY cause (so every admin page fails honestly
// and identically, never as a silent empty table).

import { describe, it, expect } from 'vitest';
import { adminErrorMessage } from './admin-error';

describe('adminErrorMessage', () => {
  it('401 names the ADMIN_API_KEY env cause (the actionable message)', () => {
    const m = adminErrorMessage(401);
    expect(m).toContain('401');
    expect(m).toContain('ADMIN_API_KEY');
    expect(m).toContain('Web und API');
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
