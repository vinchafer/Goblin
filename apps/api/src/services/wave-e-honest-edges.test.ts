// WAVE-E E5 — the three framework honest edges are bilingual (DE + EN), actionable, and
// never leak a raw trace. This test is the honesty contract for the new user-facing copy.

import { describe, it, expect } from 'vitest';
import { dependencyRejectionMessage } from './deps-allowlist';
import { buildFailureMessage } from './agent/publish';

describe('E5 honest edges — DE + EN, actionable', () => {
  it('build-failure copy (framework build): bilingual + names likely causes + reassures files saved', () => {
    const msg = buildFailureMessage(true);
    expect(msg).toContain('[EN]');
    expect(msg).toMatch(/Build ist bei Vercel fehlgeschlagen/);
    expect(msg).toMatch(/gesichert/); // files are safe — honest reassurance
    expect(msg).toMatch(/build failed on Vercel/i);
    expect(msg).not.toMatch(/at .*\.ts:\d+/); // no raw stack trace
  });

  it('build-failure copy (static deploy): still bilingual + actionable', () => {
    const msg = buildFailureMessage(false);
    expect(msg).toContain('[EN]');
    expect(msg).toMatch(/versuch es/); // actionable next step
  });

  it('dependency-rejected copy: bilingual + names the package', () => {
    const msg = dependencyRejectionMessage([{ name: 'sketchy-lib', version: '1.0.0', reason: 'not_allowlisted' }]);
    expect(msg).toContain('sketchy-lib');
    expect(msg).toContain('Freigabeliste');
    expect(msg).toContain('[EN]');
  });

  it('dependency-rejected copy: distinguishes unpinned from not-allowlisted', () => {
    const msg = dependencyRejectionMessage([{ name: 'react', version: '^18.0.0', reason: 'not_pinned' }]);
    expect(msg).toMatch(/exakte Version/);
    expect(msg).toMatch(/exact version/i);
  });
});
